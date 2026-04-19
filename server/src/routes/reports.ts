import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generatePeriodSummary } from '../services/ai.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('manager', 'founder'));

// ── Generate report ─────────────────────────────────────────
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd, generatedBy } = z.object({
      periodStart: z.string(), periodEnd: z.string(), generatedBy: z.string(),
      isCustomRange: z.boolean().optional(),
    }).parse(req.body);

    // Get AI summaries
    const { summary, agenda, previousSummary } = await generatePeriodSummary(
      req.auth!.pharmacyId, periodStart, periodEnd
    );

    // Every new report starts as "Pending review". The manager marks it
    // "Completed" from the report screen once the team meeting has happened
    // and actions have been agreed — `locked = true` carries that meaning.
    const { data: report, error } = await supabase.from('reports').insert({
      pharmacy_id: req.auth!.pharmacyId,
      period_start: periodStart, period_end: periodEnd,
      generated_by: generatedBy,
      locked: false,
      period_summary: summary,
      previous_period_summary: previousSummary || null,
      agenda_items: agenda.map(text => ({ text, edited: false })),
    }).select().single();

    if (error) throw error;

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId, action: 'report_generated',
      performed_by: generatedBy, details: { report_id: report.id, period: `${periodStart} to ${periodEnd}` },
    });

    res.status(201).json(report);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('Generate report:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Update report (editable sections) ───────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('reports')
      .update(req.body).eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── List reports ────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    let query = supabase.from('reports').select('*').order('period_end', { ascending: false });
    if (req.auth!.role !== 'founder') query = query.eq('pharmacy_id', req.auth!.pharmacyId);
    const { data } = await query;
    res.json(data || []);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Get single report ───────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data } = await supabase.from('reports').select('*')
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).single();
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Email report (console only) ─────────────────────────────
router.post('/:id/email', async (req: Request, res: Response) => {
  try {
    const { data: report } = await supabase.from('reports').select('*')
      .eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).single();
    if (!report) { res.status(404).json({ error: 'Not found' }); return; }

    const { data: pharmacy } = await supabase.from('pharmacies').select('manager_email, name')
      .eq('id', req.auth!.pharmacyId).single();

    console.log(`[EMAIL] To: ${pharmacy?.manager_email} | Subject: NearMiss Pro Report — ${report.period_start} to ${report.period_end} | Body: Report for ${pharmacy?.name} is attached. PDF URL: ${report.pdf_url || 'pending'}`);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
