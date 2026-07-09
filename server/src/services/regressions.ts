// Regression detection: a near-miss pattern (drug + error type) that was
// previously ACTIONED, then went quiet, and has now come back in the current
// period. This is the "our fix didn't hold" signal the month-to-month
// follow-up misses (once a pattern hits 0 it drops off that comparison).
//
// A regression requires:
//   1. the pattern occurs in the current period, AND
//   2. a logged action (pattern_intervention) exists for it within the
//      lookback window before this period, AND
//   3. it did NOT occur between that action and this period (it stopped, i.e.
//      the fix worked for a while) — otherwise it's ongoing, not a regression.

import { supabase } from '../config/supabase.js';
import { normalizeDrugName } from '../lib/normalize.js';

// How far back we look for a prior fix. A fix that held for months then broke
// is still worth flagging; older than this is rarely actionable.
export const REGRESSION_LOOKBACK_MONTHS = 6;

export interface Regression {
  drug: string;          // display spelling (empty for drug-less patterns)
  errorType: string;
  count: number;         // occurrences this period
  lastActionAt: string;  // ISO timestamp of the most recent prior action
  lastActionNote: string;
}

export async function detectRegressions(
  pharmacyId: string,
  fromStr: string,
  toStr: string,
  lookbackMonths = REGRESSION_LOOKBACK_MONTHS,
): Promise<Regression[]> {
  const fromIso = `${fromStr}T00:00:00.000Z`;
  const toIso = `${toStr}T23:59:59.999Z`;
  const f = new Date(fromIso);
  const lookbackStart = new Date(Date.UTC(
    f.getUTCFullYear(), f.getUTCMonth() - lookbackMonths, f.getUTCDate(),
  )).toISOString();

  const [{ data: incRows }, { data: intRows }] = await Promise.all([
    supabase.from('incidents')
      .select('drug_name, error_types, submitted_at')
      .eq('pharmacy_id', pharmacyId).eq('status', 'active')
      .gte('submitted_at', lookbackStart).lte('submitted_at', toIso),
    supabase.from('pattern_interventions')
      .select('drug_key, error_type, note, created_at')
      .eq('pharmacy_id', pharmacyId)
      .gte('created_at', lookbackStart).lt('created_at', fromIso)
      .order('created_at', { ascending: true }),
  ]);

  const incidents = (incRows || []) as { drug_name: string | null; error_types: string[] | null; submitted_at: string }[];
  const interventions = (intRows || []) as { drug_key: string; error_type: string; note: string; created_at: string }[];

  // Most recent action per (drugKey|||errorType). Rows are ascending, so the
  // last write for a key is the latest action.
  const lastAction = new Map<string, { at: string; note: string }>();
  for (const iv of interventions) {
    const key = `${(iv.drug_key || '').trim().toLowerCase()}|||${iv.error_type}`;
    lastAction.set(key, { at: iv.created_at, note: iv.note });
  }
  if (lastAction.size === 0) return [];

  // Occurrences per pattern, with timestamp + a display spelling.
  const occ = new Map<string, { at: string; display: string }[]>();
  for (const r of incidents) {
    const display = (r.drug_name || '').trim();
    const drugKey = normalizeDrugName(display);
    for (const et of r.error_types || []) {
      const key = `${drugKey}|||${et}`;
      const arr = occ.get(key) || [];
      arr.push({ at: r.submitted_at, display });
      occ.set(key, arr);
    }
  }

  const regressions: Regression[] = [];
  for (const [key, occs] of occ) {
    const action = lastAction.get(key);
    if (!action) continue;                              // never actioned
    const current = occs.filter(o => o.at >= fromIso && o.at <= toIso);
    if (current.length === 0) continue;                 // not back this period
    const gap = occs.filter(o => o.at > action.at && o.at < fromIso);
    if (gap.length > 0) continue;                       // never stopped → ongoing, not a regression
    const errorType = key.split('|||')[1];
    const display = current[0].display || occs[0].display || '';
    regressions.push({
      drug: display, errorType, count: current.length,
      lastActionAt: action.at, lastActionNote: action.note,
    });
  }
  regressions.sort((a, b) => b.count - a.count || b.lastActionAt.localeCompare(a.lastActionAt));
  return regressions;
}
