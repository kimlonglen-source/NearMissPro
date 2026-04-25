import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

interface IncidentData {
  id: string;
  pharmacy_id: string;
  error_step?: string;
  error_types: string[];
  drug_name?: string;
  dispensed_drug?: string;
  prescribed_strength?: string;
  dispensed_strength?: string;
  correct_formulation?: string;
  dispensed_formulation?: string;
  where_caught?: string;
  time_of_day?: string;
  occurred_at?: string;
  factors: string[];
  notes?: string;
  other_entries?: { category: string; text: string }[];
}

const NZ_SYSTEM_PROMPT = `You are a safety advisor for a New Zealand community pharmacy. Your audience is pharmacy techs and pharmacists on the shop floor — not consultants or auditors. Write like a senior pharmacist talking to the team, not a policy document.

Write ONE short prevention recommendation for this near miss. Hard rules:
- Maximum 2 short sentences. Aim for under 40 words total.
- Plain language. NO markdown, NO bold, NO headers, NO bullet points.
- Do NOT restate what happened — go straight to the action.
- One concrete action a tech could do tomorrow morning. Name the actual drug, shelf, label, dose, or check step. No generic advice ("be careful", "review processes", "consider implementing").
- British spelling (colour, organise, centre, labelling).

Use NZ context where it adds real value — at most ONE source per recommendation, named only if directly relevant to the action:
- NZ Formulary (NZF) — dose checks, paediatric/renal/hepatic dosing, special populations
- Medsafe — safety alerts, recalls, LASA list, Section 29 unapproved medicines
- NZULM — drug info and CAL (Cautionary Advisory Label) details
- Pharmac — Schedule funding, Special Authority, brand changes (bioequivalence-sensitive list)
- Pharmacy Council NZ — practice standards (counselling, two-identifier patient ID, compliance pack SOP)
- HQSC — distraction-reduction, no-interruption zones
- Misuse of Drugs Act / Regulations — controlled drugs, methadone, register
- Te Whatu Ora Pharmacy Procedures Manual — NHI, HPI, PSO, NZePS

NZ shop-floor language: dispensary software (not "PMS"), script (not "prescription"), pick (not "select"), shelf (not "storage location"), checker / checking pharmacist, blister pack / compliance pack, Pharmac brand, subsidy, NHI, dispense fee, cautionary advisory label.

If this is a clear repeat pattern, you may add ONE short final sentence flagging it — plain, no padding ("This is the third script-entry error this month — raise at next team meeting").`;

// ── NZ-grounded stub recommendation ─────────────────────────────
// Used when ANTHROPIC_API_KEY is not configured. Produces a specific
// recommendation that references the drug, stage, factor and — where
// relevant — the specific NZ guidance source (NZ Formulary, Medsafe,
// Pharmac, Pharmacy Council NZ, HQSC, NZULM, Misuse of Drugs Act).
// Substring matching on the new taxonomy labels so every path is covered.
function nzStubRecommendation(incident: IncidentData): string {
  const drug = incident.drug_name?.trim();
  const drugRef = drug ? ` for ${drug}` : '';
  const errors = (incident.error_types || []).map(e => e.toLowerCase());
  const stage = (incident.error_step || '').toLowerCase();
  const factors = incident.factors || [];
  const factorNote = factors.length > 0 ? ` Contributing factor${factors.length > 1 ? 's' : ''}: ${factors.join(', ')}.` : '';
  const hasAny = (kw: string[]) => errors.some(e => kw.some(k => e.includes(k)));

  // Look-alike / sound-alike — Medsafe & NZ LASA guidance
  if (hasAny(['look-alike'])) {
    return `Separate${drugRef} from similar-looking items on the dispensing shelf. Apply tallman lettering per Medsafe LASA guidance, add a high-contrast alert sticker, and require a second-check at picking. Review the NZULM entry for known look-alike pairs.${factorNote}`;
  }
  if (hasAny(['sound-alike'])) {
    return `Add a read-back confirmation at data entry${drugRef}. Flag known sound-alike pairs in your dispensary software (Medsafe publishes an NZ SALAD list). If phoned-in, require written confirmation before dispensing.${factorNote}`;
  }

  // Strength / dose
  if (hasAny(['strength', 'dose'])) {
    return `Segregate${drugRef} strengths with colour-coded bins on the shelf. Cross-check unusual doses against the NZ Formulary before dispensing, and flag them at data entry. Highlight strength on the dispensing label (bold/large).${factorNote}`;
  }

  // Quantity / volume counted or measured
  if (hasAny(['quantity', 'volume']) && stage.includes('counted')) {
    return `Enforce a double-count${drugRef} — second person or calibrated tablet counter. Consider a no-interruption zone during counting (a tabard or clear signage), per HQSC distraction-reduction guidance.${factorNote}`;
  }

  // Wrong patient (data entry, bag, label) — NZ NHI guidance
  if (hasAny(['wrong patient'])) {
    return `Confirm patient identity using NHI + date of birth at every handoff (data entry, final check, handout). For same-name patients, add a dispensary software flag. Pharmacy Council NZ practice standards require two identifiers at handout.${factorNote}`;
  }

  // Allergy / interaction / duplicate therapy — clinical decision support
  if (hasAny(['allergy', 'interaction', 'duplicate therapy'])) {
    return `Review dispensary software override policy: allergy/interaction/duplicate-therapy alerts should require a documented reason, not a single-tap dismissal. Pharmacist-in-charge audits the override log weekly. Pharmacy Council NZ standard 1.8 applies.${factorNote}`;
  }

  // Renal / hepatic / paediatric / geriatric / pregnancy dose
  if (hasAny(['renal', 'hepatic', 'paediatric', 'geriatric', 'pregnancy', 'breastfeeding'])) {
    return `Cross-check${drugRef} against NZ Formulary special-population dosing. A dispensary software alert is required for high-risk populations. Consider a pharmacist clinical review step before dispensing for these groups.${factorNote}`;
  }

  // Pharmac funding / Special Authority / brand
  if (hasAny(['pharmac', 'special authority', 'subsidy'])) {
    return `Verify Pharmac Schedule Section B funding rules and Special Authority number before dispensing. Check expiry of SA. Pharmac Schedule updates monthly — subscribe to notifications.${factorNote}`;
  }
  if (hasAny(['brand'])) {
    return `${drug || 'This drug'} is bioequivalence-sensitive on brand swap (Medsafe alert list). Counsel the patient verbally on any brand change and document it. Flag in dispensary software to prevent silent substitution.${factorNote}`;
  }

  // NHI/HPI, NZePS, PSO
  if (hasAny(['nhi', 'hpi'])) {
    return `Verify NHI at data entry against the patient's ID document. Pharmacy Procedures Manual (Te Whatu Ora) section on patient identification applies.${factorNote}`;
  }
  if (hasAny(['nzeps'])) {
    return `Check the NZePS reject reason in the dispensary software log. If re-submission is needed, confirm with the prescriber. Do not manually override a rejected electronic prescription.${factorNote}`;
  }
  if (hasAny(['pso'])) {
    return `Practitioner's Supply Orders follow a separate funding and labelling path from patient scripts. Review the Pharmacy Procedures Manual (Te Whatu Ora) PSO section and retrain the team on recognising PSO forms.${factorNote}`;
  }

  // Out-of-date / forged prescription
  if (hasAny(['out-of-date', 'forged', 'altered'])) {
    return `Check prescription date at receipt — scripts are valid for 6 months (3 for CD). If anything looks altered, verify with the prescriber and retain the original per Medicines Regulations 1984.${factorNote}`;
  }

  // Verbal / phone / fax order
  if (hasAny(['verbal', 'phone order', 'faxed'])) {
    return `Require a read-back for verbal/phone orders. Fax prescriptions must be followed by the original within 7 days (Medicines Regulations). Retain the original hardcopy.${factorNote}`;
  }

  // Label typo / directions / CAL
  if (hasAny(['typo', 'directions', 'sig'])) {
    return `Read labels word-for-word against the prescription at final check. Pharmacist-in-charge reviews dispensing label templates quarterly. If dispensary software shortens directions, consider manual override per NZULM.${factorNote}`;
  }
  if (hasAny(['cal'])) {
    return `Check NZ CAL requirements for ${drug || 'this medication'} (NZULM or the NZ Formulary). Ensure dispensary software CAL prompts are not being dismissed without review. Print CAL labels on a high-contrast background.${factorNote}`;
  }
  if (hasAny(['label on wrong item', 'missing label'])) {
    return `Enforce one-label-one-item workflow — never batch-label. Match label to item immediately after print. Pharmacist-in-charge final check must verify label is on the correct pack.${factorNote}`;
  }
  if (hasAny(['pharmacist initials'])) {
    return `Pharmacist initials/signature on the dispensing label is required under Pharmacy Council NZ standard. Embed in the dispensary software template. Do not dispense without.${factorNote}`;
  }

  // Stock / expiry / recall / damaged / pack size / Section 29
  if (hasAny(['expired'])) {
    return `Monthly expiry-check rotation on the shelf. Flag stock within 3 months of expiry with a coloured sticker. Rotate FIFO. Medsafe publishes short-dated-stock alerts.${factorNote}`;
  }
  if (hasAny(['recalled'])) {
    return `Check Medsafe recall alerts daily (subscribe to the Medsafe recall feed). Remove recalled stock immediately and quarantine. Document the action per Medicines Act 1981.${factorNote}`;
  }
  if (hasAny(['damaged'])) {
    return `Inspect packs at receipt and at picking. Damaged tablets/strips must not be dispensed — return to supplier with credit note. Document the batch.${factorNote}`;
  }
  if (hasAny(['pack size'])) {
    return `Verify pack size matches the prescribed quantity at picking. The dispensary software should warn on a mismatch. For non-matching packs, use original-pack dispensing where possible.${factorNote}`;
  }
  if (hasAny(['section 29'])) {
    return `Section 29 (unapproved medicines) requires specific documentation: prescriber acknowledgement of unapproved status and retention for 10 years. Review Medsafe Section 29 guidance.${factorNote}`;
  }

  // Repeat / continuity
  if (hasAny(['repeat'])) {
    return `Check dispensing history${drugRef} before processing repeats. Set a dispensary software alert on minimum repeat interval. Confirm with patient when they last collected.${factorNote}`;
  }

  // Compliance pack
  if (stage.includes('compliance pack')) {
    return `Double-check compliance pack contents against the medication chart at packing AND at final check (two pharmacists for CD items). Flag any pack changes with a sticker. Pharmacy Council NZ compliance-pack SOP applies.${factorNote}`;
  }

  // CD dispensing — Misuse of Drugs Act
  if (stage.includes('controlled') || hasAny(['cd ', 'methadone'])) {
    return `Review CD SOP under Misuse of Drugs Act/Regulations: register entry before dispensing, two-person check, observed methadone dose where required. Audit CD register this week. Pharmacist-in-charge reviews CD log weekly.${factorNote}`;
  }

  // Formulation swap
  if (hasAny(['formulation'])) {
    return `Separate formulations (tab/cap/liquid/IR/SR)${drugRef} on the shelf. Confirm formulation verbally at handout. The dispensary software should warn on formulation swap for the same drug.${factorNote}`;
  }

  // Counselling / handout
  if (hasAny(['counselling', 'inhaler', 'driving', 'alcohol'])) {
    return `Pharmacy Council NZ requires counselling for all new medicines. Demonstrate device technique in-store (inhalers, injectables). Document the counselling event in the dispensary software.${factorNote}`;
  }

  // Bag mix-up
  if (hasAny(['bag mixed', 'bag missing', 'bag contains extra'])) {
    return `One-bag-one-patient workflow. Verify patient identifiers at handout. If multi-item bag, show contents to patient and confirm each item against the prescription.${factorNote}`;
  }

  // Unspecified / quick log
  if (errors[0]?.includes('unspecified')) {
    return `This was logged as "submitted in error" or as a quick-log. Discuss the event at the team meeting to decide whether a full record is needed, or remove via Void if it was not a genuine near-miss.${factorNote}`;
  }

  // Fallback — still references the specific stage and factor
  const stagePart = incident.error_step ? ` at the ${incident.error_step} stage` : '';
  return `Review the dispensing workflow${drugRef}${stagePart}. Discuss at the next team meeting and agree a specific prevention action aligned with Pharmacy Council NZ practice standards. Document the agreed change.${factorNote}`;
}

export async function generateRecommendation(incident: IncidentData): Promise<string> {
  if (!env.anthropicApiKey) {
    const recommendation = nzStubRecommendation(incident);
    await saveRecommendation(incident.id, incident.pharmacy_id, recommendation);
    return recommendation;
  }

  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [drugCount, factorCounts] = await Promise.all([
      incident.drug_name
        ? supabase.from('incidents').select('id', { count: 'exact', head: true })
            .eq('pharmacy_id', incident.pharmacy_id).gte('submitted_at', periodStart)
            .eq('drug_name', incident.drug_name).eq('status', 'active')
            .then(r => r.count || 0)
        : Promise.resolve(0),
      incident.factors.length > 0
        ? supabase.from('incidents').select('factors', { count: 'exact', head: true })
            .eq('pharmacy_id', incident.pharmacy_id).gte('submitted_at', periodStart)
            .overlaps('factors', incident.factors).eq('status', 'active')
            .then(r => r.count || 0)
        : Promise.resolve(0),
    ]);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        system: NZ_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: JSON.stringify({
            error_types: incident.error_types,
            drug_name: incident.drug_name,
            dispensed_drug: incident.dispensed_drug,
            prescribed_strength: incident.prescribed_strength,
            dispensed_strength: incident.dispensed_strength,
            correct_formulation: incident.correct_formulation,
            dispensed_formulation: incident.dispensed_formulation,
            where_caught: incident.where_caught,
            time_of_day: incident.time_of_day,
            factors: incident.factors,
            notes: incident.notes,
            prior_same_drug_count: drugCount,
            prior_same_factor_count: factorCounts,
            other_text: incident.other_entries?.map(e => e.text).join('; '),
          }),
        }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic ${response.status} ${response.statusText}: ${body}`);
    }
    const result = await response.json();
    const aiText = result.content?.[0]?.text || 'Unable to generate recommendation.';
    await saveRecommendation(incident.id, incident.pharmacy_id, aiText);
    return aiText;
  } catch (err) {
    console.error('[ai] generateRecommendation failed:', err);
    const fallback = 'AI recommendation unavailable. Please review this incident manually.';
    await saveRecommendation(incident.id, incident.pharmacy_id, fallback);
    return fallback;
  }
}

async function saveRecommendation(incidentId: string, pharmacyId: string, aiText: string) {
  await supabase.from('recommendations').insert({
    incident_id: incidentId, pharmacy_id: pharmacyId, ai_text: aiText,
  });
}

export async function detectPatterns(pharmacyId: string, since?: string, until?: string): Promise<string | null> {
  // Default window: start of current month → now. Callers (the dashboard)
  // pass the manager's selected range so the alert matches the visible
  // incident list — otherwise "16 near misses" can show next to a stat
  // card that says 5.
  const periodStart = since || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  let q = supabase.from('incidents')
    .select('error_types, drug_name, factors, time_of_day')
    .eq('pharmacy_id', pharmacyId).gte('submitted_at', periodStart).eq('status', 'active');
  if (until) {
    const u = /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until;
    q = q.lte('submitted_at', u);
  }
  const { data: incidents } = await q;

  if (!incidents || incidents.length < 3) return null;

  const drugCounts: Record<string, number> = {};
  const factorCounts: Record<string, number> = {};
  const timeCounts: Record<string, number> = {};

  for (const i of incidents) {
    if (i.drug_name) drugCounts[i.drug_name] = (drugCounts[i.drug_name] || 0) + 1;
    if (i.time_of_day) timeCounts[i.time_of_day] = (timeCounts[i.time_of_day] || 0) + 1;
    for (const f of i.factors || []) factorCounts[f] = (factorCounts[f] || 0) + 1;
  }

  const alerts: string[] = [];
  for (const [drug, count] of Object.entries(drugCounts)) { if (count >= 3) alerts.push(`${drug} appears in ${count} incidents`); }
  for (const [factor, count] of Object.entries(factorCounts)) { if (count >= 3) alerts.push(`"${factor}" is a factor in ${count} incidents`); }
  for (const [time, count] of Object.entries(timeCounts)) { if (count >= 3) alerts.push(`${count} incidents during ${time}`); }

  if (alerts.length === 0) return null;

  if (!env.anthropicApiKey) {
    return alerts.join('. ') + '.';
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 150,
        system: 'You are a NZ community pharmacy safety advisor writing for shop-floor staff. In ONE plain-language sentence, name the most significant pattern across these near misses and the single concrete action to take. No markdown. British spelling. NZ shop language ("script", "dispensary software", "checking pharmacist", "Pharmac brand"). Reference an NZ source (NZ Formulary, Medsafe, NZULM, Pharmac, Pharmacy Council NZ) only if directly relevant to the action.',
        messages: [{ role: 'user', content: JSON.stringify({ patterns: alerts, incident_count: incidents.length }) }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic ${response.status} ${response.statusText}: ${body}`);
    }
    const result = await response.json();
    return result.content?.[0]?.text || alerts.join('. ');
  } catch (err) {
    console.error('[ai] detectPatterns failed:', err);
    return alerts.join('. ');
  }
}

// Drug + error-type hotspots. A hotspot is a (drug_name, error_type) pair
// that has appeared `minCount` or more times in the window. Used by the
// period-summary section of the monthly report.
export interface DrugErrorHotspot { drug: string; errorType: string; count: number; }
export async function detectDrugErrorHotspots(
  pharmacyId: string,
  since: string,
  until?: string,
  minCount = 2,
): Promise<DrugErrorHotspot[]> {
  let q = supabase.from('incidents').select('drug_name, error_types')
    .eq('pharmacy_id', pharmacyId).eq('status', 'active').gte('submitted_at', since);
  if (until) {
    const u = /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until;
    q = q.lte('submitted_at', u);
  }
  const { data, error } = await q;
  if (error) { console.error('[ai] detectDrugErrorHotspots failed:', error); return []; }
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const drug = (row as { drug_name?: string }).drug_name?.trim();
    if (!drug) continue;
    const key = drug.toLowerCase();
    for (const et of (row as { error_types?: string[] }).error_types || []) {
      const k = `${key}|||${et}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= minCount)
    .map(([k, count]) => {
      const [drugLower, errorType] = k.split('|||');
      // Recover a pretty drug label — use the first incident's casing.
      const drug = (data || []).find(r => (r as { drug_name?: string }).drug_name?.trim().toLowerCase() === drugLower)
        ?.drug_name?.trim() || drugLower;
      return { drug, errorType, count };
    })
    .sort((a, b) => b.count - a.count || a.drug.localeCompare(b.drug));
}

// Weekly trend series for a pharmacy over the given window. Used by the
// report's trend chart. Empty weeks come back as count 0.
export interface TrendPoint { weekStart: string; count: number; }
export async function getTrendSeries(pharmacyId: string, since: string, until?: string): Promise<TrendPoint[]> {
  const startOfWeekKey = (d: Date): string => {
    const nd = new Date(d); nd.setHours(0, 0, 0, 0);
    const day = nd.getDay() || 7;
    nd.setDate(nd.getDate() - day + 1);
    return nd.toISOString().slice(0, 10);
  };
  let q = supabase.from('incidents').select('submitted_at, occurred_at')
    .eq('pharmacy_id', pharmacyId).eq('status', 'active').gte('submitted_at', since);
  if (until) {
    const u = /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until;
    q = q.lte('submitted_at', u);
  }
  const { data, error } = await q;
  if (error) { console.error('[ai] getTrendSeries failed:', error); return []; }
  // Build bucket keys covering [since, until].
  const start = new Date(since);
  const end = until ? new Date(until) : new Date();
  const keys: string[] = [];
  const firstKey = startOfWeekKey(start);
  let cursor = new Date(firstKey);
  const endKey = startOfWeekKey(end);
  while (cursor.toISOString().slice(0, 10) <= endKey) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  const counts: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  for (const row of data || []) {
    const when = new Date((row as { occurred_at?: string; submitted_at: string }).occurred_at || (row as { submitted_at: string }).submitted_at);
    const key = startOfWeekKey(when);
    if (key in counts) counts[key] += 1;
  }
  return keys.map(k => ({ weekStart: k, count: counts[k] }));
}

export async function generatePeriodSummary(pharmacyId: string, periodStart: string, periodEnd: string): Promise<{ summary: string; agenda: string[]; previousSummary?: string }> {
  // YYYY-MM-DD coerces to midnight UTC; bump to end-of-day so incidents
  // submitted later on periodEnd still count.
  const endBound = /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ? `${periodEnd}T23:59:59.999Z` : periodEnd;
  const { data: incidents } = await supabase.from('incidents')
    .select('*, recommendations(*)').eq('pharmacy_id', pharmacyId)
    .gte('submitted_at', periodStart).lte('submitted_at', endBound).eq('status', 'active');

  const { data: lastReport } = await supabase.from('reports')
    .select('period_summary, agenda_items').eq('pharmacy_id', pharmacyId)
    .lt('period_end', periodStart).order('period_end', { ascending: false }).limit(1).single();

  const incidentCount = incidents?.length || 0;
  const errorSummary = incidents?.flatMap(i => i.error_types).reduce<Record<string, number>>((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {}) || {};
  const topErrors = Object.entries(errorSummary).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const stub = {
    summary: incidentCount === 0
      ? 'No incidents were recorded this period. Continue to encourage staff to report all near misses — a low count may indicate under-reporting rather than absence of errors.'
      : `This period recorded ${incidentCount} near miss${incidentCount > 1 ? 'es' : ''}. ${topErrors.length > 0 ? `Most common: ${topErrors.map(([e, c]) => `${e} (${c})`).join(', ')}.` : ''} Review the incident log below and discuss prevention actions at the team meeting.`,
    agenda: [
      'Acknowledge the team for continuing to report near misses — this culture of openness keeps patients safe.',
      ...(topErrors.length > 0 ? [`Discuss the ${topErrors[0][1]} ${topErrors[0][0]} incident${topErrors[0][1] > 1 ? 's' : ''} and agree on a specific prevention action.`] : []),
      'Review any accepted recommendations and confirm they have been implemented.',
      'Identify any training needs or workflow changes required.',
      'Confirm the date of the next review meeting.',
    ],
    previousSummary: lastReport ? 'Review the actions agreed at the last meeting and assess whether they have reduced incidents.' : undefined,
  };

  if (!env.anthropicApiKey || incidentCount === 0) return stub;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 500,
        system: `You are a NZ community pharmacy safety advisor writing the period summary for a team-meeting report. Audience is the dispensary team — techs and pharmacists.

Write 3-5 short sentences in plain language. No markdown, no bold, no bullets. British spelling.

Cover, in this order: what dominated the period (drug, error type, or factor), one concrete change to make, and ONE NZ-grounded reference if directly relevant (NZ Formulary, Medsafe, NZULM, Pharmac, Pharmacy Council NZ standards, HQSC, Misuse of Drugs Act, Te Whatu Ora Pharmacy Procedures Manual). Use NZ shop-floor language: script, dispensary software, checking pharmacist, Pharmac brand, blister pack, NHI, CAL.

Skip preamble like "this period saw" or "it is recommended that". Don't restate counts the report already shows.`,
        messages: [{ role: 'user', content: JSON.stringify({ incidents: incidents?.map(i => ({ error_types: i.error_types, drug_name: i.drug_name, factors: i.factors, recommendation: i.recommendations?.[0]?.ai_text, outcome: i.recommendations?.[0]?.manager_outcome })), previous_period_summary: lastReport?.period_summary }) }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic ${response.status} ${response.statusText}: ${body}`);
    }
    const result = await response.json();
    return {
      summary: result.content?.[0]?.text || stub.summary,
      agenda: stub.agenda,
      // "Last period improvements" should carry forward what was written at
      // the LAST team meeting, not a duplicate of this period's summary.
      // Pull the previous report's saved text verbatim so the manager can
      // see and review what they agreed last time.
      previousSummary: lastReport?.period_summary || undefined,
    };
  } catch (err) {
    console.error('[ai] generatePeriodSummary failed:', err);
    return stub;
  }
}
