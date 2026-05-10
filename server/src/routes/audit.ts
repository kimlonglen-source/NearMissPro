import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('manager', 'founder'));

// ── Audit log for the manager's own pharmacy ─────────────────
// Returns the audit_log entries scoped to req.auth.pharmacyId (founders
// already have a global view via /api/admin/audit-log). Used by the
// Settings → Audit page so the manager can see every void / restore /
// recommendation decision with timestamp and reason — what an
// inspector will ask for.
router.get('/log', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit || '50'), 10) || 50));
    const { data, count, error } = await supabase.from('audit_log')
      .select('id, action, performed_by, details, created_at', { count: 'exact' })
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.json({ entries: data || [], total: count || 0, page, limit });
  } catch (err) {
    console.error('[audit] log failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
