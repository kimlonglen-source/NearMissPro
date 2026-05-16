import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { scanFields } from '../lib/phi.js';
import { normalizeDrugName } from '../lib/normalize.js';
import { FACTOR_SUGGESTIONS } from '../lib/factorSuggestions.js';

const router = Router();
router.use(authenticate);

// ── Create incident ─────────────────────────────────────────
const createSchema = z.object({
  errorStep: z.string().min(1),
  errorTypes: z.array(z.string()).min(1),
  drugName: z.string().optional(),
  dispensedDrug: z.string().optional(),
  prescribedStrength: z.string().optional(),
  dispensedStrength: z.string().optional(),
  correctFormulation: z.string().optional(),
  dispensedFormulation: z.string().optional(),
  prescribedQuantity: z.number().finite().nonnegative().optional(),
  dispensedQuantity: z.number().finite().nonnegative().optional(),
  whereCaught: z.string().optional(),
  factors: z.array(z.string()).default([]),
  notes: z.string().optional(),
  // Actual time the incident happened, if different from submit time.
  // Must be parseable and not in the future.
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

// Derive "morning" / "lunch" / "afternoon" / "evening" from a Date in NZ local time.
// Uses the server clock — acceptable for a NZ-hosted deployment; for multi-region
// we'd pass an IANA zone from the client and use Intl.DateTimeFormat.
function bucketTimeOfDay(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'Morning 8\u201312pm';
  if (h >= 11 && h < 14) return 'Lunch 12\u20132pm';
  if (h >= 14 && h < 18) return 'Afternoon 2\u20136pm';
  return 'Evening 6pm+';
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const d = createSchema.parse(req.body);
    if (req.auth!.role === 'founder') { res.status(403).json({ error: 'Founders cannot submit incidents' }); return; }

    // Use the actual occurrence time when provided, else fall back to now.
    // Reject future times — that's always an input mistake.
    const now = new Date();
    let occurredAt: Date | null = null;
    if (d.occurredAt) {
      const parsed = new Date(d.occurredAt);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid occurredAt timestamp' }); return;
      }
      if (parsed.getTime() > now.getTime() + 60_000) { // allow 1min clock skew
        res.status(400).json({ error: 'occurredAt cannot be in the future' }); return;
      }
      occurredAt = parsed;
    }
    const timeOfDay = bucketTimeOfDay(occurredAt ?? now);

    const { data: incident, error } = await supabase.from('incidents').insert({
      pharmacy_id: req.auth!.pharmacyId,
      error_step: d.errorStep,
      error_types: d.errorTypes,
      drug_name: d.drugName || null,
      dispensed_drug: d.dispensedDrug || null,
      prescribed_strength: d.prescribedStrength || null,
      dispensed_strength: d.dispensedStrength || null,
      correct_formulation: d.correctFormulation || null,
      dispensed_formulation: d.dispensedFormulation || null,
      prescribed_quantity: d.prescribedQuantity ?? null,
      dispensed_quantity: d.dispensedQuantity ?? null,
      where_caught: d.whereCaught || null,
      time_of_day: timeOfDay,
      occurred_at: occurredAt ? occurredAt.toISOString() : null,
      factors: d.factors,
      notes: d.notes || null,
    }).select().single();

    if (error) throw error;

    // Defence-in-depth: server-side PHI scan. We still save the record — losing the
    // report is worse than logging the potential leak — but write an audit row so
    // the founder can review and prune if needed.
    const phi = scanFields({
      notes: d.notes,
      drug_name: d.drugName,
      dispensed_drug: d.dispensedDrug,
    });
    if (phi.anyHit && incident) {
      await supabase.from('audit_log').insert({
        pharmacy_id: req.auth!.pharmacyId,
        action: 'phi_suspected',
        performed_by: 'system',
        details: { incident_id: incident.id, fields: phi.perField },
      });
    }

    // Trigger AI recommendation asynchronously
    if (incident) {
      import('../services/ai.js').then(({ generateRecommendation }) => {
        generateRecommendation(incident as any).catch(console.error);
      });
    }

    res.status(201).json(incident);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: err.errors }); return; }
    console.error('Create incident:', err);
    res.status(500).json({ error: 'Failed to save incident' });
  }
});

// ── List incidents ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, from, to, page = '1', limit = '50' } = req.query;
    let query = supabase.from('incidents').select('*, recommendations(*)', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    if (req.auth!.role !== 'founder') query = query.eq('pharmacy_id', req.auth!.pharmacyId);
    if (status && typeof status === 'string') query = query.eq('status', status);
    if (from && typeof from === 'string') query = query.gte('submitted_at', from);
    if (to && typeof to === 'string') {
      // YYYY-MM-DD coerces to midnight UTC, excluding anything later in the
      // day. Bump to end-of-day so incidents submitted that day still match.
      const toBound = /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
      query = query.lte('submitted_at', toBound);
    }

    const p = parseInt(page as string, 10);
    const l = parseInt(limit as string, 10);
    query = query.range((p - 1) * l, p * l - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ incidents: data || [], total: count || 0, page: p, limit: l });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// ── Pattern alert (must be before /:id) ─────────────────────
router.get('/pattern-alert', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const { detectPatterns } = await import('../services/ai.js');
    const alert = await detectPatterns(req.auth!.pharmacyId, from, to);
    res.json({ alert });
  } catch { res.json({ alert: null }); }
});

// ── Drug+error-type hotspot check (Record-form live warning) ─
// Returns whether this exact (drug_name, error_type) pair has appeared
// 2+ times in the last 30 days — i.e. whether the incident being logged
// would be the 3rd+ repeat. Any staff role can call it; it only sees
// counts from their own pharmacy.
router.get('/hotspot-check', async (req: Request, res: Response) => {
  try {
    const { drug, errorType } = req.query;
    if (typeof drug !== 'string' || typeof errorType !== 'string' || !drug.trim() || !errorType.trim()) {
      res.json({ isHotspot: false, count: 0, days: 30 }); return;
    }
    // Escape ILIKE wildcards so a name containing % or _ matches literally.
    const needle = drug.trim().replace(/[%_\\]/g, '\\$&');
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { count } = await supabase.from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .eq('status', 'active')
      .gte('submitted_at', since)
      .ilike('drug_name', needle)
      .contains('error_types', [errorType]);
    const c = count || 0;
    res.json({ isHotspot: c >= 2, count: c, days: 30 });
  } catch { res.json({ isHotspot: false, count: 0, days: 30 }); }
});

// ── Weekly incident trend (dashboard trend strip) ───────────
// Returns one bucket per ISO-week (Mon–Sun), oldest first, for the
// last N weeks. Empty weeks come back as count 0 so the chart has
// a consistent x-axis.
router.get('/stats/trend', async (req: Request, res: Response) => {
  try {
    const weeks = Math.max(1, Math.min(52, parseInt(String(req.query.weeks || '8'), 10) || 8));
    const now = new Date();
    const startOfWeekKey = (d: Date): string => {
      const nd = new Date(d);
      nd.setHours(0, 0, 0, 0);
      const day = nd.getDay() || 7; // Sunday = 7
      nd.setDate(nd.getDate() - day + 1);
      return nd.toISOString().slice(0, 10);
    };
    // Build the key list oldest → newest so the chart renders left-to-right.
    const keys: string[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i * 7);
      keys.push(startOfWeekKey(d));
    }
    const earliest = keys[0];
    const { data, error } = await supabase.from('incidents')
      .select('submitted_at, occurred_at')
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .eq('status', 'active')
      .gte('submitted_at', earliest);
    if (error) throw error;
    const counts: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
    for (const row of data || []) {
      const when = new Date((row as { occurred_at?: string; submitted_at: string }).occurred_at || (row as { submitted_at: string }).submitted_at);
      const key = startOfWeekKey(when);
      if (key in counts) counts[key] += 1;
    }
    res.json({ weeks: keys.map(k => ({ weekStart: k, count: counts[k] })) });
  } catch (err) { console.error('[incidents] trend failed:', err); res.status(500).json({ error: 'Failed' }); }
});

// ── Monthly incident count (must be before /:id) ────────────
router.get('/stats/monthly-count', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase.from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .gte('submitted_at', start)
      .eq('status', 'active');
    res.json({ count: count || 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Period comparison — "Did our actions work?" (must be before /:id) ──
// Compares the current review period against the same-length window
// immediately preceding it. For each (drug, error type) pair that
// appeared in either period, return the count delta and whether the
// previous-period incidents had a manager decision (accepted/modified)
// so the UI can label things as "actioned and resolved" vs "actioned
// but still happening" vs "new pattern this period".
router.get('/stats/period-comparison', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = now.toISOString().slice(0, 10);
    const fromStr = (typeof req.query.from === 'string' && req.query.from) || defaultFrom;
    const toStr = (typeof req.query.to === 'string' && req.query.to) || defaultTo;

    const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(fromStr) ? `${fromStr}T00:00:00.000Z` : fromStr;
    const toIso = /^\d{4}-\d{2}-\d{2}$/.test(toStr) ? `${toStr}T23:59:59.999Z` : toStr;
    const periodMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const prevToIso = new Date(new Date(fromIso).getTime() - 1).toISOString();
    const prevFromIso = new Date(new Date(fromIso).getTime() - periodMs - 1).toISOString();

    type Row = { drug_name: string | null; error_types: string[] | null; recommendations: { manager_outcome: string | null }[] };
    const fetchRange = async (a: string, b: string) => {
      const { data, error } = await supabase.from('incidents')
        .select('drug_name, error_types, recommendations(manager_outcome)')
        .eq('pharmacy_id', req.auth!.pharmacyId).eq('status', 'active')
        .gte('submitted_at', a).lte('submitted_at', b);
      if (error) throw error;
      return (data || []) as Row[];
    };

    const [current, previous] = await Promise.all([
      fetchRange(fromIso, toIso),
      fetchRange(prevFromIso, prevToIso),
    ]);

    // Group by normalised drug name so spelling variants ("Atorvastatin"
    // vs "atorvastatin" vs "ATORVASTATIN") count as one pattern. Display
    // recovers whichever spelling the staff first used at this pharmacy.
    type PatternStats = { count: number; actioned: boolean; display: string };
    const buildMap = (rows: Row[]): Map<string, PatternStats> => {
      const m = new Map<string, PatternStats>();
      for (const r of rows) {
        const display = (r.drug_name || '').trim();
        const drugKey = normalizeDrugName(display);
        if (!drugKey) continue;
        const wasActioned = Array.isArray(r.recommendations)
          && r.recommendations.some(rc => rc.manager_outcome === 'accepted' || rc.manager_outcome === 'modified');
        for (const et of r.error_types || []) {
          const key = `${drugKey}|||${et}`;
          const cur = m.get(key) || { count: 0, actioned: false, display };
          cur.count += 1;
          if (wasActioned) cur.actioned = true;
          m.set(key, cur);
        }
      }
      return m;
    };

    const curMap = buildMap(current);
    const prevMap = buildMap(previous);
    const allKeys = new Set<string>([...curMap.keys(), ...prevMap.keys()]);

    type Direction = 'resolved' | 'reduced' | 'same' | 'increased' | 'new';
    const patterns = Array.from(allKeys).map(key => {
      const [, errorType] = key.split('|||');
      const cur = curMap.get(key)?.count || 0;
      const prev = prevMap.get(key)?.count || 0;
      const actionedPreviously = prevMap.get(key)?.actioned || false;
      // Prefer the spelling used in the current period, fall back to previous.
      const drug = curMap.get(key)?.display || prevMap.get(key)?.display || key.split('|||')[0];
      let direction: Direction;
      if (prev === 0 && cur > 0) direction = 'new';
      else if (prev > 0 && cur === 0) direction = 'resolved';
      else if (cur < prev) direction = 'reduced';
      else if (cur > prev) direction = 'increased';
      else direction = 'same';
      return { drug, errorType, currentCount: cur, previousCount: prev, delta: cur - prev, actionedPreviously, direction };
    });

    // Sort: highest-signal items first.
    // Actioned + resolved (action worked!) → actioned + reduced → increased → new → resolved → reduced → same
    const priority = (p: typeof patterns[number]) => {
      if (p.direction === 'resolved' && p.actionedPreviously) return 0;
      if (p.direction === 'reduced' && p.actionedPreviously) return 1;
      if (p.direction === 'increased') return 2;
      if (p.direction === 'new') return 3;
      if (p.direction === 'resolved') return 4;
      if (p.direction === 'reduced') return 5;
      return 6;
    };
    patterns.sort((a, b) => {
      const pa = priority(a), pb = priority(b);
      if (pa !== pb) return pa - pb;
      return Math.abs(b.delta) - Math.abs(a.delta);
    });

    res.json({
      currentPeriod: { from: fromStr, to: toStr, totalIncidents: current.length },
      previousPeriod: {
        from: prevFromIso.slice(0, 10), to: prevToIso.slice(0, 10),
        totalIncidents: previous.length,
      },
      patterns,
    });
  } catch (err) {
    console.error('[incidents] period-comparison failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Factor analysis — "What's behind these errors?" (must be before /:id) ──
// For each contributing factor (high volume / interruption / similar packaging
// etc.) count occurrences this period, the previous same-length period, and
// pair with one NZ-grounded suggestion the manager can act on. Surfaces
// SYSTEM-level causes — the lever for actually reducing near misses, not
// per-incident fixes. The fix-text dictionary lives in lib/factorSuggestions.ts
// because the period-summary generator weaves the same fixes into its
// paragraph so the report has one consistent voice.

router.get('/stats/factor-analysis', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = now.toISOString().slice(0, 10);
    const fromStr = (typeof req.query.from === 'string' && req.query.from) || defaultFrom;
    const toStr = (typeof req.query.to === 'string' && req.query.to) || defaultTo;

    const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(fromStr) ? `${fromStr}T00:00:00.000Z` : fromStr;
    const toIso = /^\d{4}-\d{2}-\d{2}$/.test(toStr) ? `${toStr}T23:59:59.999Z` : toStr;
    const periodMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const prevToIso = new Date(new Date(fromIso).getTime() - 1).toISOString();
    const prevFromIso = new Date(new Date(fromIso).getTime() - periodMs - 1).toISOString();

    const fetchFactors = async (a: string, b: string): Promise<{ counts: Record<string, number>; total: number }> => {
      const { data, error } = await supabase.from('incidents').select('factors')
        .eq('pharmacy_id', req.auth!.pharmacyId).eq('status', 'active')
        .gte('submitted_at', a).lte('submitted_at', b);
      if (error) throw error;
      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of (data || []) as { factors: string[] | null }[]) {
        total += 1;
        for (const f of row.factors || []) counts[f] = (counts[f] || 0) + 1;
      }
      return { counts, total };
    };

    const [current, previous] = await Promise.all([
      fetchFactors(fromIso, toIso),
      fetchFactors(prevFromIso, prevToIso),
    ]);

    const allFactors = new Set<string>([...Object.keys(current.counts), ...Object.keys(previous.counts)]);
    type Direction = 'new' | 'up' | 'down' | 'same' | 'gone';
    const factors = Array.from(allFactors).map(name => {
      const cur = current.counts[name] || 0;
      const prev = previous.counts[name] || 0;
      let direction: Direction;
      if (prev === 0 && cur > 0) direction = 'new';
      else if (prev > 0 && cur === 0) direction = 'gone';
      else if (cur > prev) direction = 'up';
      else if (cur < prev) direction = 'down';
      else direction = 'same';
      return {
        name,
        currentCount: cur,
        previousCount: prev,
        delta: cur - prev,
        direction,
        suggestion: FACTOR_SUGGESTIONS[name] || 'Discuss at the next team meeting and agree a specific system-level change.',
      };
    });
    // Show factors with at least 2 incidents in the current period — fewer
    // is noise. Always include any factor that's gone (prev > 0, cur = 0)
    // because that's a win worth celebrating.
    factors.sort((a, b) => b.currentCount - a.currentCount || b.previousCount - a.previousCount);
    const meaningful = factors.filter(f => f.currentCount >= 2 || (f.previousCount > 0 && f.currentCount === 0));

    res.json({
      currentPeriod: { from: fromStr, to: toStr, totalIncidents: current.total },
      previousPeriod: { from: prevFromIso.slice(0, 10), to: prevToIso.slice(0, 10), totalIncidents: previous.total },
      factors: meaningful,
    });
  } catch (err) {
    console.error('[incidents] factor-analysis failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Workflow heatmap (must be before /:id) ──────────────────
// Time-of-day buckets x day-of-week, showing where incidents cluster across
// the week. Reveals predictable danger zones (e.g. "Mondays at lunch") so
// the manager can adjust roster, prep before rush, or apply HQSC's no-
// interruption-zone guidance during specific hours.
//
// Buckets follow the existing time_of_day labels stored on incidents:
// Morning 8–12pm, Lunch 12–2pm, Afternoon 2–6pm, Evening 6pm+.
// Day of week comes from occurred_at (preferred) or submitted_at.
router.get('/stats/heatmap', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = now.toISOString().slice(0, 10);
    const fromStr = (typeof req.query.from === 'string' && req.query.from) || defaultFrom;
    const toStr = (typeof req.query.to === 'string' && req.query.to) || defaultTo;

    const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(fromStr) ? `${fromStr}T00:00:00.000Z` : fromStr;
    const toIso = /^\d{4}-\d{2}-\d{2}$/.test(toStr) ? `${toStr}T23:59:59.999Z` : toStr;

    const { data, error } = await supabase.from('incidents')
      .select('time_of_day, occurred_at, submitted_at')
      .eq('pharmacy_id', req.auth!.pharmacyId).eq('status', 'active')
      .gte('submitted_at', fromIso).lte('submitted_at', toIso);
    if (error) throw error;

    // Day labels: Mon..Sun (NZ convention).
    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const timeKeys = ['Morning 8–12pm', 'Lunch 12–2pm', 'Afternoon 2–6pm', 'Evening 6pm+'];
    // Initialise grid as zeros so the response shape is stable.
    const grid: Record<string, Record<string, number>> = {};
    for (const t of timeKeys) {
      grid[t] = {};
      for (const d of dayKeys) grid[t][d] = 0;
    }

    let total = 0;
    for (const row of (data || []) as { time_of_day: string | null; occurred_at: string | null; submitted_at: string }[]) {
      const t = row.time_of_day;
      if (!t || !grid[t]) continue;
      const when = new Date(row.occurred_at || row.submitted_at);
      const jsDay = when.getDay(); // 0 = Sun
      const dKey = dayKeys[(jsDay + 6) % 7]; // shift so Mon = 0
      grid[t][dKey] += 1;
      total += 1;
    }

    // Find peak cell so the UI can highlight it ("Mondays at lunch is your danger zone").
    let peakDay = '';
    let peakTime = '';
    let peakCount = 0;
    for (const t of timeKeys) {
      for (const d of dayKeys) {
        if (grid[t][d] > peakCount) {
          peakCount = grid[t][d];
          peakDay = d;
          peakTime = t;
        }
      }
    }

    res.json({
      currentPeriod: { from: fromStr, to: toStr },
      times: timeKeys,
      days: dayKeys,
      grid,
      total,
      peak: peakCount >= 2 ? { day: peakDay, time: peakTime, count: peakCount } : null,
    });
  } catch (err) {
    console.error('[incidents] heatmap failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Active hotspots — drug+error pairs with 2+ incidents inside the
// caller's date range. The dashboard passes the manager's selected
// review window via ?from=&to= so the banner stays consistent with
// the rest of the page. When no range is given, falls back to the
// last 30 days so the endpoint still answers "what's happening now"
// for any caller that doesn't care about a specific period.
router.get('/stats/active-hotspots', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const fromStr = typeof req.query.from === 'string' ? req.query.from : '';
    const toStr = typeof req.query.to === 'string' ? req.query.to : '';

    const since = fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)
      ? `${fromStr}T00:00:00.000Z`
      : new Date(Date.now() - 30 * 86400_000).toISOString();
    const until = toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)
      ? `${toStr}T23:59:59.999Z`
      : undefined;

    const { detectDrugErrorHotspots } = await import('../services/ai.js');
    const hotspots = await detectDrugErrorHotspots(req.auth!.pharmacyId, since, until, 2);

    // Look up the most recent submitted_at for each hotspot so the UI
    // can show "last seen 5 May" — managers care more about whether the
    // pattern is still happening than just the rolling count.
    const enriched = await Promise.all(hotspots.map(async h => {
      let q = supabase.from('incidents')
        .select('submitted_at')
        .eq('pharmacy_id', req.auth!.pharmacyId).eq('status', 'active')
        .ilike('drug_name', h.drug.replace(/[%_\\]/g, '\\$&'))
        .contains('error_types', [h.errorType])
        .gte('submitted_at', since);
      if (until) q = q.lte('submitted_at', until);
      const { data } = await q.order('submitted_at', { ascending: false }).limit(1).single();
      return {
        drug: h.drug,
        errorType: h.errorType,
        count: h.count,
        lastSeen: data?.submitted_at || null,
      };
    }));

    res.json({ hotspots: enriched });
  } catch (err) {
    console.error('[incidents] active-hotspots failed:', err);
    res.json({ hotspots: [] });
  }
});

// ── Get single incident ─────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    let query = supabase.from('incidents').select('*, recommendations(*)').eq('id', req.params.id);
    if (req.auth!.role !== 'founder') query = query.eq('pharmacy_id', req.auth!.pharmacyId);
    const { data, error } = await query.single();
    if (error || !data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Edit incident (15-min window for staff, anytime for manager before lock) ─
const editSchema = z.object({
  errorStep: z.string().optional(),
  errorTypes: z.array(z.string()).optional(),
  drugName: z.string().nullable().optional(),
  dispensedDrug: z.string().nullable().optional(),
  prescribedStrength: z.string().nullable().optional(),
  dispensedStrength: z.string().nullable().optional(),
  correctFormulation: z.string().nullable().optional(),
  dispensedFormulation: z.string().nullable().optional(),
  prescribedQuantity: z.number().finite().nonnegative().nullable().optional(),
  dispensedQuantity: z.number().finite().nonnegative().nullable().optional(),
  whereCaught: z.string().nullable().optional(),
  factors: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }).nullable().optional(),
  // Manager-only fields
  edit_reason: z.string().optional(),
});

function mapUpdates(d: z.infer<typeof editSchema>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.errorStep !== undefined) out.error_step = d.errorStep;
  if (d.errorTypes !== undefined) out.error_types = d.errorTypes;
  if (d.drugName !== undefined) out.drug_name = d.drugName || null;
  if (d.dispensedDrug !== undefined) out.dispensed_drug = d.dispensedDrug || null;
  if (d.prescribedStrength !== undefined) out.prescribed_strength = d.prescribedStrength || null;
  if (d.dispensedStrength !== undefined) out.dispensed_strength = d.dispensedStrength || null;
  if (d.correctFormulation !== undefined) out.correct_formulation = d.correctFormulation || null;
  if (d.dispensedFormulation !== undefined) out.dispensed_formulation = d.dispensedFormulation || null;
  if (d.prescribedQuantity !== undefined) out.prescribed_quantity = d.prescribedQuantity;
  if (d.dispensedQuantity !== undefined) out.dispensed_quantity = d.dispensedQuantity;
  if (d.whereCaught !== undefined) out.where_caught = d.whereCaught || null;
  if (d.factors !== undefined) out.factors = d.factors;
  if (d.notes !== undefined) out.notes = d.notes || null;
  if (d.occurredAt !== undefined) out.occurred_at = d.occurredAt || null;
  if (d.edit_reason !== undefined) out.edit_reason = d.edit_reason;
  return out;
}

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data: incident } = await supabase.from('incidents').select('editable_until, pharmacy_id, occurred_at, submitted_at')
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).single();

    if (!incident) { res.status(404).json({ error: 'Not found' }); return; }

    if (req.auth!.role === 'staff' && new Date(incident.editable_until) < new Date()) {
      res.status(403).json({ error: 'Edit window has expired' }); return;
    }

    const parsed = editSchema.parse(req.body);

    // Future-time guard on edited occurred_at
    if (parsed.occurredAt) {
      const t = new Date(parsed.occurredAt).getTime();
      if (Number.isFinite(t) && t > Date.now() + 60_000) {
        res.status(400).json({ error: 'occurredAt cannot be in the future' }); return;
      }
    }

    const updates: Record<string, unknown> = mapUpdates(parsed);
    updates.edited_at = new Date().toISOString();

    // Keep time_of_day bucket consistent when the time changes.
    if (parsed.occurredAt !== undefined) {
      updates.time_of_day = bucketTimeOfDay(parsed.occurredAt ? new Date(parsed.occurredAt) : new Date(incident.submitted_at));
    }

    const { data, error } = await supabase.from('incidents').update(updates)
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).select().single();

    if (error) throw error;

    if (req.auth!.role === 'manager') {
      await supabase.from('audit_log').insert({
        pharmacy_id: req.auth!.pharmacyId, action: 'incident_edited',
        performed_by: 'manager', details: { incident_id: req.params.id, reason: updates.edit_reason },
      });
    }

    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Flag for manager ────────────────────────────────────────
router.post('/:id/flag', async (req: Request, res: Response) => {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body);
    const { data, error } = await supabase.from('incidents').update({
      flagged_by_staff: true, flag_note: note || null, flagged_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Void incident (manager only) ────────────────────────────
router.post('/:id/void', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const { data, error } = await supabase.from('incidents')
      .update({ status: 'voided', edit_reason: reason })
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).select().single();
    if (error) throw error;

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId, action: 'incident_voided',
      performed_by: 'manager', details: { incident_id: req.params.id, reason },
    });
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Restore voided incident (manager only) ──────────────────
// A voided incident is never deleted — its row stays with status='voided'
// and the void reason. Restore flips status back to 'active' so it
// counts in analytics again. The audit log captures both the original
// void and the restore so the trail is complete.
router.post('/:id/restore', requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('incidents')
      .update({ status: 'active', edit_reason: null })
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId)
      .eq('status', 'voided').select().single();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Not found or not voided' }); return; }

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId, action: 'incident_restored',
      performed_by: 'manager', details: { incident_id: req.params.id },
    });
    res.json(data);
  } catch (err) {
    console.error('[incidents] restore failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
