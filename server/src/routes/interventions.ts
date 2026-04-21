import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Normalise drug for case-insensitive matching; preserves whitespace-trimmed
// original as drug_label for display.
function drugKey(d: string): string { return d.trim().toLowerCase(); }

// ── List interventions for a (drug, error_type) pattern ─────
// Staff, manager, or founder can list — all see their own pharmacy only.
router.get('/', async (req: Request, res: Response) => {
  try {
    const { drug, errorType } = req.query;
    if (typeof drug !== 'string' || typeof errorType !== 'string' || !drug.trim() || !errorType.trim()) {
      res.json({ interventions: [] }); return;
    }
    const { data, error } = await supabase.from('pattern_interventions')
      .select('id, drug_label, error_type, note, created_at')
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .eq('drug_key', drugKey(drug))
      .eq('error_type', errorType)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ interventions: data || [] });
  } catch (err) {
    console.error('[interventions] list failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Add an intervention ─────────────────────────────────────
const createSchema = z.object({
  drug: z.string().min(1).max(200),
  errorType: z.string().min(1).max(200),
  note: z.string().min(1).max(500),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const d = createSchema.parse(req.body);
    if (req.auth!.role === 'founder') { res.status(403).json({ error: 'Founders do not log interventions' }); return; }
    const { data, error } = await supabase.from('pattern_interventions').insert({
      pharmacy_id: req.auth!.pharmacyId,
      drug_key: drugKey(d.drug),
      drug_label: d.drug.trim(),
      error_type: d.errorType,
      note: d.note.trim(),
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[interventions] create failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
