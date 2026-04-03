import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── Create incident ─────────────────────────────────────────
const createSchema = z.object({
  errorTypes: z.array(z.string()).min(1),
  drugName: z.string().optional(),
  dispensedDrug: z.string().optional(),
  prescribedStrength: z.string().optional(),
  dispensedStrength: z.string().optional(),
  correctFormulation: z.string().optional(),
  dispensedFormulation: z.string().optional(),
  whereCaught: z.string().optional(),
  timeOfDay: z.string().optional(),
  factors: z.array(z.string()).default([]),
  otherEntries: z.array(z.object({ category: z.string(), text: z.string() })).default([]),
  notes: z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const d = createSchema.parse(req.body);
    if (req.auth!.role === 'founder') { res.status(403).json({ error: 'Founders cannot submit incidents' }); return; }

    const { data: incident, error } = await supabase.from('incidents').insert({
      pharmacy_id: req.auth!.pharmacyId,
      error_types: d.errorTypes,
      drug_name: d.drugName || null,
      dispensed_drug: d.dispensedDrug || null,
      prescribed_strength: d.prescribedStrength || null,
      dispensed_strength: d.dispensedStrength || null,
      correct_formulation: d.correctFormulation || null,
      dispensed_formulation: d.dispensedFormulation || null,
      where_caught: d.whereCaught || null,
      time_of_day: d.timeOfDay || null,
      factors: d.factors,
      other_entries: d.otherEntries,
      notes: d.notes || null,
    }).select().single();

    if (error) throw error;

    // Trigger AI recommendation asynchronously
    if (incident) {
      import('../services/ai.js').then(({ generateRecommendation }) => {
        generateRecommendation(incident as any).catch(console.error);
      });
    }

    // Save other entries to dedicated table for founder review
    if (d.otherEntries.length > 0 && incident) {
      await supabase.from('other_entries').insert(
        d.otherEntries.map(e => ({
          pharmacy_id: req.auth!.pharmacyId, incident_id: incident.id,
          category: e.category, text: e.text,
        }))
      );
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
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data: incident } = await supabase.from('incidents').select('editable_until, pharmacy_id')
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).single();

    if (!incident) { res.status(404).json({ error: 'Not found' }); return; }

    if (req.auth!.role === 'staff' && new Date(incident.editable_until) < new Date()) {
      res.status(403).json({ error: 'Edit window has expired' }); return;
    }

    const updates = req.body;
    updates.edited_at = new Date().toISOString();

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
