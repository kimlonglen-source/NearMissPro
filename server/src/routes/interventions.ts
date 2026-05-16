import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
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

// ── Suggest a system-level action for a (drug, error_type) pattern ──
// The manager opens the Log Action modal and clicks "Suggest" to get
// a one-sentence draft they can edit or use as-is. Different from
// the per-incident AI recommendations (which target a single event):
// this one targets the recurring PATTERN — workspace, SOP, software,
// or layout changes. The endpoint also passes the prior interventions
// so the suggestion doesn't just repeat what's already been tried.
router.post('/suggest', async (req: Request, res: Response) => {
  try {
    const d = z.object({
      drug: z.string().min(1).max(200),
      errorType: z.string().min(1).max(200),
    }).parse(req.body);

    // Prior actions so we can ask the AI for something NEW.
    const { data: prior } = await supabase.from('pattern_interventions')
      .select('note').eq('pharmacy_id', req.auth!.pharmacyId)
      .eq('drug_key', drugKey(d.drug)).eq('error_type', d.errorType)
      .order('created_at', { ascending: true });
    const priorNotes = (prior || []).map(r => r.note).filter(Boolean);

    if (!env.anthropicApiKey) {
      // No key — return a generic stub so the UI still works.
      const stub = `Move ${d.drug} away from look-alike items. Use TALLman lettering on the bin label, add a bright warning sticker, and brief the team at the next handover.`;
      res.json({ suggestion: stub });
      return;
    }

    const system = `You are a NZ community pharmacy safety advisor. The manager has a recurring near-miss pattern and wants ONE specific, practical system change they can put in place today. Write ONE plain-English sentence (under 40 words). British spelling. NZ shop-floor language (script, dispensary software, checking pharmacist, Pharmac brand, NHI, CAL). No markdown, no preamble like "I suggest". Name the actual change (move shelf, add sticker, software flag, SOP step, no-interruption zone). Don't repeat anything already in "actions tried so far".`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 120,
        system,
        messages: [{
          role: 'user',
          content: JSON.stringify({
            drug: d.drug,
            error_type: d.errorType,
            actions_tried_so_far: priorNotes,
          }),
        }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('Anthropic suggest failed:', response.status, body);
      res.json({ suggestion: `Review the dispensing workflow for ${d.drug} (${d.errorType}) at the next team meeting and agree one specific prevention action.` });
      return;
    }
    const result = await response.json();
    const text = result.content?.[0]?.text?.trim() || `Review the workflow for ${d.drug} at the next team meeting.`;
    res.json({ suggestion: text });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[interventions] suggest failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
