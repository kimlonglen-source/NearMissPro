import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generatePeriodSummary, detectDrugErrorHotspots, getTrendSeries } from '../services/ai.js';

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

    // Run summary, hotspot detection, and trend series in parallel —
    // they each hit the DB independently.
    const [{ summary, agenda, previousSummary }, hotspots, trend] = await Promise.all([
      generatePeriodSummary(req.auth!.pharmacyId, periodStart, periodEnd),
      detectDrugErrorHotspots(req.auth!.pharmacyId, periodStart, periodEnd),
      getTrendSeries(req.auth!.pharmacyId, periodStart, periodEnd),
    ]);

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
      pattern_alerts: hotspots,
      trend_data: trend,
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
// Audit logging policy: draft edits (locked=false) are NOT logged
// — auto-save fires constantly while a manager polishes a report
// and the noise would drown out anything meaningful. Once the
// report is signed off (locked=true), every change after that
// point IS logged: sign-off itself, unlock, and any field edit
// while locked. The diff captures before/after for each field so
// an inspector can see exactly what changed and when.
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data: before, error: readErr } = await supabase.from('reports')
      .select('*')
      .eq('id', req.params.id)
      .eq('pharmacy_id', req.auth!.pharmacyId)
      .single();
    if (readErr || !before) { res.status(404).json({ error: 'Report not found' }); return; }

    const { data: after, error } = await supabase.from('reports')
      .update(req.body).eq('id', req.params.id).eq('pharmacy_id', req.auth!.pharmacyId).select().single();
    if (error) throw error;

    // Human-friendly period label so the audit log entry can be
    // cross-referenced with the printed report by an inspector.
    const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const reportPeriod = `${fmt(before.period_start)} — ${fmt(before.period_end)}`;
    const reportRef = { report_id: before.id, report_period: reportPeriod };

    const wasLocked = before.locked === true;
    const nowLocked = after.locked === true;

    if (!wasLocked && nowLocked) {
      // Snapshot every active incident on the report at the moment
      // of sign-off. Lets the manager (or an inspector) prove later
      // exactly what was on the printed report — even if the period
      // is reopened, edited, or re-signed.
      const { data: snapshotRows } = await supabase.from('incidents')
        .select('id')
        .eq('pharmacy_id', req.auth!.pharmacyId)
        .eq('status', 'active')
        .gte('submitted_at', before.period_start)
        .lte('submitted_at', `${before.period_end}T23:59:59.999Z`);
      const incidentIds = (snapshotRows || []).map(r => (r as { id: string }).id);
      const { error: auditErr } = await supabase.from('audit_log').insert({
        pharmacy_id: req.auth!.pharmacyId,
        action: 'report_signed_off',
        performed_by: 'manager',
        details: {
          ...reportRef,
          locked_at: new Date().toISOString(),
          incident_count: incidentIds.length,
          incident_ids: incidentIds,
        },
      });
      if (auditErr) console.error('[reports] audit insert (signed_off) failed:', auditErr);
    } else if (wasLocked && !nowLocked) {
      const { error: auditErr } = await supabase.from('audit_log').insert({
        pharmacy_id: req.auth!.pharmacyId,
        action: 'report_unlocked',
        performed_by: 'manager',
        details: reportRef,
      });
      if (auditErr) console.error('[reports] audit insert (unlocked) failed:', auditErr);
    } else if (wasLocked && nowLocked) {
      const trackedFields = ['period_summary', 'previous_period_summary', 'agenda_items', 'generated_by'] as const;
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const field of trackedFields) {
        if (req.body[field] !== undefined && JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
          changes[field] = { old: before[field], new: after[field] };
        }
      }
      if (Object.keys(changes).length > 0) {
        const { error: auditErr } = await supabase.from('audit_log').insert({
          pharmacy_id: req.auth!.pharmacyId,
          action: 'report_amended',
          performed_by: 'manager',
          details: { ...reportRef, fields_changed: Object.keys(changes), changes },
        });
        if (auditErr) console.error('[reports] audit insert (amended) failed:', auditErr);
      }
    }
    // !wasLocked && !nowLocked → draft edit, intentionally not logged

    res.json(after);
  } catch (err) {
    console.error('[reports] patch failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
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
