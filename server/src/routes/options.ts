import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('checkbox_options')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Group by category then group_name
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
    console.error('Get options:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
