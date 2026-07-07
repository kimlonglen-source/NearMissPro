import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { isAiEnabledForPharmacy } from '../services/ai.js';
import { detectPHI } from '../lib/phi.js';

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
    // Defence-in-depth: a chip is shared pharmacy-wide, so it must never carry
    // patient identifiers. Block the high-confidence kinds (NHI, DOB, phone /
    // long digit run); the "name" heuristic is skipped as it false-flags legit
    // labels like "Special Authority". Mirrors the client-side block.
    if (detectPHI(d.label).kinds.some(k => k !== 'name')) {
      res.status(400).json({ error: "That looks like patient information — a shared chip can't include a name, NHI, date of birth, or phone number." });
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

// ── AI sanity check ─────────────────────────────────────────
// Backstop for the client-side heuristics. Returns { ok: true } when
// the label looks like a plausible category, { ok: false, reason }
// when it looks like random keystrokes / scribble. Fail-open: any
// error or missing API key returns ok=true so the form keeps working.
const checkSchema = z.object({
  section: z.enum(['stage', 'error_type', 'where_caught', 'factor']),
  label: z.string().trim().min(1).max(80),
});

router.post('/check', async (req: Request, res: Response) => {
  try {
    const d = checkSchema.parse(req.body);
    // Never send patient identifiers to the AI. Reject before the API call.
    if (detectPHI(d.label).kinds.some(k => k !== 'name')) {
      res.json({ ok: false, reason: "looks like patient information — a shared chip can't include a name, NHI, date of birth, or phone number" });
      return;
    }
    if (!env.anthropicApiKey || !(await isAiEnabledForPharmacy(req.auth!.pharmacyId))) { res.json({ ok: true }); return; }

    const sectionDesc: Record<typeof d.section, string> = {
      stage: 'a step in the pharmacy dispensing workflow',
      error_type: 'a type of dispensing error or near miss',
      where_caught: 'a place or moment where the near miss was caught',
      factor: 'a contributing factor or condition at the time of the near miss',
    };

    const system = `You decide if a typed label is a real category or random keystrokes for a NZ community pharmacy near-miss reporting tool. The label is for ${sectionDesc[d.section]}.

Reply with JSON only — no markdown, no preamble. Two shapes:
{"ok": true}  for plausible labels: real words, phrases, NZ pharmacy abbreviations (PSO, DAA, NHI, CD, HPI, CAL, NHI, IM, IV, GP), or short descriptive phrases.
{"ok": false, "reason": "<3-6 words>"}  for scribble, random typing, keyboard mashing, or nonsense.

Examples:
- "PSO funding" -> {"ok": true}
- "asopas" -> {"ok": false, "reason": "looks like random letters"}
- "Methadone supervision step" -> {"ok": true}
- "kdjfa" -> {"ok": false, "reason": "random keystrokes"}
- "DAA filling" -> {"ok": true}
- "qweop" -> {"ok": false, "reason": "keyboard mash"}
- "CD register" -> {"ok": true}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        system,
        messages: [{ role: 'user', content: d.label }],
      }),
    });
    if (!response.ok) {
      console.error('[customOptions] AI check failed:', response.status);
      res.json({ ok: true });
      return;
    }
    const result = await response.json();
    const raw = (result.content?.[0]?.text || '').trim().replace(/^```json|```$/g, '').trim();
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.ok === 'boolean') {
        res.json({
          ok: parsed.ok,
          reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
        });
        return;
      }
    } catch { /* fall through to fail-open */ }
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[customOptions] check failed:', err);
    res.json({ ok: true });
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
