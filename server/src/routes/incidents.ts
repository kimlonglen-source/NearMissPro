import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { scanFields } from '../lib/phi.js';

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
    if (to && typeof to === 'string') query = query.lte('submitted_at', to);

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
    const { detectPatterns } = await import('../services/ai.js');
    const alert = await detectPatterns(req.auth!.pharmacyId);
    res.json({ alert });
  } catch { res.json({ alert: null }); }
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

export default router;
