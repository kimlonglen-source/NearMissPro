import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('manager', 'founder'));

// ── Action a recommendation ─────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      managerOutcome: z.enum(['accepted', 'modified', 'no_action']),
      managerText: z.string().optional(),
      managerName: z.string().optional(),
      privateNote: z.string().optional(),
    }).parse(req.body);

    const { data, error } = await supabase.from('recommendations').update({
      manager_outcome: body.managerOutcome,
      manager_text: body.managerText || null,
      manager_name: body.managerName || null,
      private_note: body.privateNote || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();

    if (error) throw error;

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId, action: `recommendation_${body.managerOutcome}`,
      performed_by: body.managerName || 'manager',
      details: { recommendation_id: req.params.id, ...(body.managerText && { modified_text: body.managerText }) },
    });

    res.json(data);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Bulk accept ─────────────────────────────────────────────
router.post('/bulk-accept', async (req: Request, res: Response) => {
  try {
    const { managerName } = z.object({ managerName: z.string() }).parse(req.body);

    const { data: pending } = await supabase.from('recommendations')
      .select('id').eq('pharmacy_id', req.auth!.pharmacyId).is('manager_outcome', null);

    if (!pending?.length) { res.json({ updated: 0 }); return; }

    const ids = pending.map(r => r.id);
    await supabase.from('recommendations').update({
      manager_outcome: 'accepted', manager_name: managerName, reviewed_at: new Date().toISOString(),
    }).in('id', ids);

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId, action: 'bulk_accept',
      performed_by: managerName, details: { count: ids.length },
    });

    res.json({ updated: ids.length });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
