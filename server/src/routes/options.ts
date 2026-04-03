import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { pharmacyId, role } = req.auth!;

    let query = supabase
      .from('checkbox_options')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (role !== 'founder') {
      query = query.or(`pharmacy_id.is.null,pharmacy_id.eq.${pharmacyId}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    const grouped: Record<string, Record<string, typeof data>> = {};
    for (const opt of data || []) {
      const cat = opt.category;
      const group = opt.group_name || 'default';
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][group]) grouped[cat][group] = [];
      grouped[cat][group].push(opt);
    }

    res.json(grouped);
  } catch (err) {
    console.error('Get options error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
