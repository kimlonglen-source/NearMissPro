import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { lockedPeriodCoveringDate } from '../lib/lockedPeriod.js';

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

    // Refuse to mutate a recommendation whose incident sits inside a
    // locked (signed-off) report — same rule we apply to incident
    // edits. Without this, the buttons under the AI text (Accept /
    // Modify / No change) would let a manager silently change what
    // was on a printed signed-off report.
    const { data: incident, error: incidentErr } = await supabase.from('recommendations')
      .select('incidents!inner(submitted_at, occurred_at, pharmacy_id)')
      .eq('id', req.params.id)
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .single();
    if (incidentErr || !incident) { res.status(404).json({ error: 'Not found' }); return; }
    const inc = (incident as unknown as { incidents: { submitted_at: string; occurred_at: string | null } }).incidents;
    const effectiveDate = inc.occurred_at || inc.submitted_at;
    const lockedEnd = await lockedPeriodCoveringDate(req.auth!.pharmacyId, effectiveDate);
    if (lockedEnd) {
      res.status(409).json({
        error: 'period_locked',
        message: 'This near miss is on a report that has already been signed off, so the recommendation buttons are locked. Unlock the report first if you really need to change the decision — that will be recorded in the audit log.',
      });
      return;
    }

    // Scope the update by pharmacy_id too — without it, a manager
    // could PATCH any recommendation by guessing its UUID, including
    // ones belonging to other pharmacies. Founders never action
    // per-pharmacy recommendations (their pharmacyId is 'all', which
    // won't match a real UUID), so this also correctly excludes them.
    const { data, error } = await supabase.from('recommendations').update({
      manager_outcome: body.managerOutcome,
      manager_text: body.managerText || null,
      manager_name: body.managerName || null,
      private_note: body.privateNote || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).select().single();

    if (error) { res.status(404).json({ error: 'Not found' }); return; }

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
      .select('id, incidents!inner(submitted_at, occurred_at)')
      .eq('pharmacy_id', req.auth!.pharmacyId).is('manager_outcome', null);

    if (!pending?.length) { res.json({ updated: 0 }); return; }

    // Exclude any recommendation whose incident sits inside a signed-off
    // (locked) report — same integrity rule as the single-recommendation
    // PATCH. Fetch the locked report ranges once and filter in memory.
    const { data: lockedReports } = await supabase.from('reports')
      .select('period_start, period_end')
      .eq('pharmacy_id', req.auth!.pharmacyId).eq('locked', true);
    const inLockedPeriod = (iso: string) => (lockedReports || []).some(r =>
      iso >= `${r.period_start}T00:00:00.000Z` && iso <= `${r.period_end}T23:59:59.999Z`);

    const eligible = (pending as unknown as { id: string; incidents: { submitted_at: string; occurred_at: string | null } }[])
      .filter(p => !inLockedPeriod(p.incidents.occurred_at || p.incidents.submitted_at));

    if (!eligible.length) { res.json({ updated: 0 }); return; }
    const ids = eligible.map(r => r.id);
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
