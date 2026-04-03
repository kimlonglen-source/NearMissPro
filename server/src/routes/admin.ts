import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('founder'));

// ── Platform health stats ───────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [pharmacies, thisMonth, lastMonth, otherPending] = await Promise.all([
      supabase.from('pharmacies').select('id, name, subscription_status, created_at'),
      supabase.from('incidents').select('id', { count: 'exact', head: true }).gte('submitted_at', monthStart),
      supabase.from('incidents').select('id', { count: 'exact', head: true }).gte('submitted_at', lastMonthStart).lt('submitted_at', monthStart),
      supabase.from('other_entries').select('id', { count: 'exact', head: true }).eq('review_outcome', 'pending'),
    ]);

    const totalPharmacies = pharmacies.data?.length || 0;

    // Check active pharmacies (has incidents in last 30 days)
    const { data: activeIds } = await supabase.from('incidents')
      .select('pharmacy_id').gte('submitted_at', thirtyDaysAgo);
    const activeSet = new Set((activeIds || []).map(r => r.pharmacy_id));

    res.json({
      totalPharmacies,
      activePharmacies: activeSet.size,
      inactivePharmacies: totalPharmacies - activeSet.size,
      incidentsThisMonth: thisMonth.count || 0,
      incidentsLastMonth: lastMonth.count || 0,
      otherEntriesPending: otherPending.count || 0,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// ── Other entry review queue ────────────────────────────────
router.get('/other-entries', async (_req: Request, res: Response) => {
  try {
    const { data } = await supabase.from('other_entries')
      .select('id, category, text, review_outcome, created_at, pharmacy_id')
      .eq('review_outcome', 'pending')
      .order('created_at', { ascending: false });
    res.json(data || []);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Action other entry ──────────────────────────────────────
router.patch('/other-entries/:id', async (req: Request, res: Response) => {
  try {
    const { outcome } = z.object({ outcome: z.enum(['added', 'dismissed']) }).parse(req.body);
    const { data: entry } = await supabase.from('other_entries')
      .update({ review_outcome: outcome, reviewed_by_founder: true })
      .eq('id', req.params.id).select().single();

    if (!entry) { res.status(404).json({ error: 'Not found' }); return; }

    // If added, create new checkbox option
    if (outcome === 'added') {
      await supabase.from('checkbox_options').insert({
        category: entry.category, label: entry.text,
        sort_order: 99, created_by_founder: true,
      });
    }

    await supabase.from('audit_log').insert({
      action: `other_entry_${outcome}`, performed_by: 'founder',
      details: { entry_id: req.params.id, category: entry.category, text: entry.text },
    });

    res.json(entry);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Audit log ───────────────────────────────────────────────
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const p = parseInt(page as string, 10);
    const l = parseInt(limit as string, 10);
    const { data, count } = await supabase.from('audit_log')
      .select('*', { count: 'exact' }).order('created_at', { ascending: false })
      .range((p - 1) * l, p * l - 1);
    res.json({ entries: data || [], total: count || 0 });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Per-pharmacy stats ──────────────────────────────────────
router.get('/pharmacy-stats', async (_req: Request, res: Response) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: pharmacies } = await supabase.from('pharmacies')
      .select('id, name, subscription_status, created_at');

    const stats = await Promise.all((pharmacies || []).map(async (p) => {
      const { count } = await supabase.from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('pharmacy_id', p.id).gte('submitted_at', monthStart);

      const { data: lastIncident } = await supabase.from('incidents')
        .select('submitted_at').eq('pharmacy_id', p.id)
        .order('submitted_at', { ascending: false }).limit(1).single();

      return { ...p, incidentsThisMonth: count || 0, lastActive: lastIncident?.submitted_at || null };
    }));

    res.json(stats);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
