import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

type Section = 'stage' | 'error_type' | 'where_caught' | 'factor';
const SECTIONS: Section[] = ['stage', 'error_type', 'where_caught', 'factor'];
const MAX_PER_SECTION = 8;

// ── List all custom chips for this pharmacy, grouped by section ──
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('pharmacy_custom_options')
      .select('id, section, label, created_at')
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const grouped: Record<Section, { id: string; label: string }[]> = {
      stage: [], error_type: [], where_caught: [], factor: [],
    };
    for (const row of data || []) {
      if (SECTIONS.includes(row.section as Section)) {
        grouped[row.section as Section].push({ id: row.id, label: row.label });
      }
    }
    res.json(grouped);
  } catch (err) {
    console.error('[customOptions] list failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Add a custom chip for the pharmacy ──
const createSchema = z.object({
  section: z.enum(['stage', 'error_type', 'where_caught', 'factor']),
  label: z.string().trim().min(1).max(80),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const d = createSchema.parse(req.body);
    if (req.auth!.role === 'founder') {
      res.status(403).json({ error: 'Founders cannot add pharmacy chips' });
      return;
    }
    // Cap at MAX_PER_SECTION so the form doesn't sprawl.
    const { count, error: countErr } = await supabase.from('pharmacy_custom_options')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .eq('section', d.section);
    if (countErr) throw countErr;
    if ((count || 0) >= MAX_PER_SECTION) {
      res.status(400).json({ error: `Limit reached — only ${MAX_PER_SECTION} custom chips per section. Delete one first.` });
      return;
    }
    const { data, error } = await supabase.from('pharmacy_custom_options')
      .insert({
        pharmacy_id: req.auth!.pharmacyId,
        section: d.section,
        label: d.label.trim(),
      })
      .select('id, section, label')
      .single();
    if (error) {
      // Unique violation — chip already exists, return the existing one.
      if (error.code === '23505') {
        const existing = await supabase.from('pharmacy_custom_options')
          .select('id, section, label')
          .eq('pharmacy_id', req.auth!.pharmacyId)
          .eq('section', d.section)
          .eq('label', d.label.trim())
          .single();
        if (existing.data) { res.status(200).json(existing.data); return; }
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[customOptions] create failed:', err);
    // Surface the most common deploy mistake — table not yet created —
    // so the user sees a useful hint instead of a bare "Failed".
    const msg = err instanceof Error ? err.message : '';
    if (/relation .*pharmacy_custom_options.* does not exist/i.test(msg)) {
      res.status(500).json({ error: 'Database not ready — run supabase/migrate_custom_options.sql in Supabase SQL Editor.' });
      return;
    }
    res.status(500).json({ error: 'Could not save the chip — try again.' });
  }
});

// ── Delete a custom chip ──
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (req.auth!.role === 'founder') {
      res.status(403).json({ error: 'Founders cannot delete pharmacy chips' });
      return;
    }
    const { error } = await supabase.from('pharmacy_custom_options')
      .delete()
      .eq('id', req.params.id)
      .eq('pharmacy_id', req.auth!.pharmacyId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[customOptions] delete failed:', err);
    res.status(500).json({ error: 'Could not delete the chip — try again.' });
  }
});

export default router;
