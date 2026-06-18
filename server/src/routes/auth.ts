import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ── Staff login (pharmacy name + password) ──────────────────
router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { name, password } = z.object({ name: z.string().min(1), password: z.string().min(1) }).parse(req.body);

    const { data: pharmacy } = await supabase
      .from('pharmacies').select('id, name, password_hash, login_attempts, locked_until')
      .ilike('name', name).single();

    if (!pharmacy) { res.status(401).json({ error: 'Invalid pharmacy name or password' }); return; }

    if (pharmacy.locked_until && new Date(pharmacy.locked_until) > new Date()) {
      res.status(423).json({ error: 'Account locked. Contact your manager.' }); return;
    }

    if (!(await bcrypt.compare(password, pharmacy.password_hash))) {
      const attempts = (pharmacy.login_attempts || 0) + 1;
      const lockout = attempts >= 10 ? new Date(Date.now() + 30 * 60_000).toISOString() : null;
      await supabase.from('pharmacies').update({ login_attempts: attempts, ...(lockout && { locked_until: lockout }) }).eq('id', pharmacy.id);
      if (lockout) console.log(`[EMAIL] To: manager | Subject: Account locked | Body: ${pharmacy.name} locked after 10 failed attempts.`);
      res.status(401).json({ error: 'Invalid pharmacy name or password' }); return;
    }

    await supabase.from('pharmacies').update({ login_attempts: 0, locked_until: null }).eq('id', pharmacy.id);

    // 7-day token for staff — lets the dispensing computer stay
    // logged in through the working week (log in Mon, no friction
    // until next Mon). Near-miss data is anonymous and low-value;
    // the dispensing computer is physically secured behind the
    // dispensary counter, so the security trade is fine.
    const token = jwt.sign(
      { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, role: 'staff' },
      env.jwtSecret, { expiresIn: '7d' } as jwt.SignOptions
    );

    res.json({ token, role: 'staff', pharmacyName: pharmacy.name, pharmacyId: pharmacy.id });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Manager access — requires the manager password. ──
// The pharmacy password (shared with all staff on the dispensing
// computer) and the manager password (held by the pharmacist-in-
// charge) are kept separate so elevated rights aren't quietly
// handed to whoever happens to know the pharmacy password. Until a
// pharmacy sets a dedicated manager password we fall back to
// accepting the pharmacy password — the client shows a banner
// prompting them to set one.
router.post('/manager/access', authenticate, async (req: Request, res: Response) => {
  try {
    const { managerPassword } = z.object({ managerPassword: z.string().min(1) }).parse(req.body);
    const { data: p } = await supabase.from('pharmacies')
      .select('password_hash, manager_password_hash')
      .eq('id', req.auth!.pharmacyId).single();
    if (!p) { res.status(401).json({ error: 'Pharmacy not found' }); return; }
    const expected = p.manager_password_hash || p.password_hash;
    const isSeparate = !!p.manager_password_hash;
    if (!(await bcrypt.compare(managerPassword, expected))) {
      res.status(401).json({ error: 'Manager password incorrect' });
      return;
    }
    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret, { expiresIn: '12h' } as jwt.SignOptions
    );
    res.json({ token, role: 'manager', managerPasswordIsSeparate: isSeparate });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('Manager access error:', err);
    res.status(500).json({ error: 'Access failed' });
  }
});

// ── Manager pharmacy-password change ───────────────────────
// Changes the shared password used by all staff to log into the
// app. Manager-only. The separate manager password is changed by
// /manager/set-manager-password below.
router.post('/manager/change-password', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
    const { data: p } = await supabase.from('pharmacies').select('password_hash').eq('id', req.auth!.pharmacyId).single();
    if (!p || !(await bcrypt.compare(currentPassword, p.password_hash))) {
      res.status(401).json({ error: 'Current password incorrect' }); return;
    }
    await supabase.from('pharmacies').update({ password_hash: await bcrypt.hash(newPassword, 12) }).eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({ pharmacy_id: req.auth!.pharmacyId, action: 'password_changed', performed_by: 'manager', details: {} });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Set / change the manager password ──────────────────────
// First-time set: currentPassword is the pharmacy password (since
// manager_password_hash is NULL). After that: currentPassword is
// the existing manager password.
router.post('/manager/set-manager-password', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(req.body);
    const { data: p } = await supabase.from('pharmacies')
      .select('password_hash, manager_password_hash')
      .eq('id', req.auth!.pharmacyId).single();
    if (!p) { res.status(404).json({ error: 'Pharmacy not found' }); return; }
    const expected = p.manager_password_hash || p.password_hash;
    if (!(await bcrypt.compare(currentPassword, expected))) {
      res.status(401).json({ error: 'Current password incorrect' }); return;
    }
    await supabase.from('pharmacies')
      .update({ manager_password_hash: await bcrypt.hash(newPassword, 12) })
      .eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId,
      action: 'manager_password_set',
      performed_by: 'manager',
      details: { first_time: !p.manager_password_hash },
    });
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('Set manager password error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Founder login (email + password + MFA) ──────────────────
router.post('/founder/login', async (req: Request, res: Response) => {
  try {
    const { email, password, mfaCode } = z.object({
      email: z.string().email(), password: z.string().min(8), mfaCode: z.string().length(6).optional(),
    }).parse(req.body);

    // For dev: use founder_email env var with a fixed password
    if (email.toLowerCase() !== env.founderEmail.toLowerCase()) {
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }

    // In dev mode, accept password "founder123" and any 6-digit MFA
    // In production this would check against founder_accounts table
    if (password !== 'founder123') {
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }

    if (!mfaCode) {
      res.json({ requiresMfa: true }); return;
    }

    if (mfaCode.length !== 6) {
      res.status(401).json({ error: 'Invalid MFA code' }); return;
    }

    // 8-hour session for founder
    const token = jwt.sign(
      { founderId: 'founder', role: 'founder', pharmacyId: 'all', pharmacyName: 'Founder' },
      env.jwtSecret, { expiresIn: '8h' } as jwt.SignOptions
    );

    await supabase.from('audit_log').insert({ action: 'founder_login', performed_by: email, details: {} });

    res.json({ token, role: 'founder', email });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Current auth ────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response) => {
  // Enrich with pharmacy-level settings the client wants on first load
  // so it doesn't have to make a second round-trip. pharmacy_size drives
  // the AI's tone in recommendations and summaries.
  // managerPasswordIsSeparate tells the UI whether to nag the manager
  // to set a dedicated manager password (vs. still falling back to the
  // shared pharmacy password).
  let pharmacySize: string | null = null;
  let managerPasswordIsSeparate = false;
  let managerName: string | null = null;
  let managerEmail: string | null = null;
  if (req.auth!.pharmacyId) {
    const { data } = await supabase.from('pharmacies')
      .select('pharmacy_size, manager_password_hash, manager_name, manager_email')
      .eq('id', req.auth!.pharmacyId).single();
    pharmacySize = (data?.pharmacy_size as string | null) || null;
    managerPasswordIsSeparate = !!data?.manager_password_hash;
    managerName = (data?.manager_name as string | null) || null;
    managerEmail = (data?.manager_email as string | null) || null;
  }
  res.json({ ...req.auth, pharmacySize, managerPasswordIsSeparate, managerName, managerEmail });
});

// ── Update pharmacy-level settings (manager only) ───────────
// Single endpoint for pharmacy-level toggles + manager details
// (name/email). Each field is optional in the body so the client
// can save just what changed. Returns whatever was written so the
// UI doesn't have to trust its local state.
router.patch('/pharmacy/settings', authenticate, requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const body = z.object({
      pharmacySize: z.enum(['sole', 'pharmacist_plus_tech', 'multi']).nullable().optional(),
      managerName: z.string().trim().min(1).max(100).optional(),
      managerEmail: z.string().trim().email().max(200).optional(),
    }).parse(req.body);
    const updates: Record<string, unknown> = {};
    if (body.pharmacySize !== undefined) updates.pharmacy_size = body.pharmacySize;
    if (body.managerName !== undefined) updates.manager_name = body.managerName;
    if (body.managerEmail !== undefined) updates.manager_email = body.managerEmail;
    if (Object.keys(updates).length === 0) { res.json({ ok: true }); return; }
    const { data, error } = await supabase.from('pharmacies').update(updates)
      .eq('id', req.auth!.pharmacyId).select('pharmacy_size, manager_name, manager_email').single();
    if (error) throw error;
    // Manager-details changes are audit-logged so a handover ("who
    // was the manager on 18 June?") is traceable. Pharmacy-size
    // changes don't need an audit entry — they're just AI tone.
    if (body.managerName !== undefined || body.managerEmail !== undefined) {
      await supabase.from('audit_log').insert({
        pharmacy_id: req.auth!.pharmacyId,
        action: 'pharmacy_details_updated',
        performed_by: 'manager',
        details: {
          ...(body.managerName !== undefined ? { manager_name: body.managerName } : {}),
          ...(body.managerEmail !== undefined ? { manager_email: body.managerEmail } : {}),
        },
      });
    }
    res.json({
      ok: true,
      pharmacySize: data?.pharmacy_size || null,
      managerName: data?.manager_name || null,
      managerEmail: data?.manager_email || null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[auth] pharmacy/settings failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Founder: create pharmacy ────────────────────────────────
router.post('/pharmacies', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(1).max(120),
      password: z.string().min(8).max(200),
      managerPassword: z.string().min(8).max(200),
      managerName: z.string().min(1).max(100),
      managerEmail: z.string().email().max(200),
      address: z.string().max(300).optional(),
      licenceNumber: z.string().max(50).optional(),
    }).parse(req.body);

    const { data: pharmacy, error } = await supabase.from('pharmacies').insert({
      name: data.name,
      password_hash: await bcrypt.hash(data.password, 12),
      manager_password_hash: await bcrypt.hash(data.managerPassword, 12),
      manager_name: data.managerName,
      manager_email: data.managerEmail,
      address: data.address,
      licence_number: data.licenceNumber,
    }).select().single();

    if (error) {
      if (error.code === '23505') { res.status(409).json({ error: 'Pharmacy name already exists' }); return; }
      throw error;
    }

    await supabase.from('audit_log').insert({ pharmacy_id: pharmacy.id, action: 'pharmacy_created', performed_by: 'founder', details: { name: data.name } });
    console.log(`[EMAIL] To: ${data.managerEmail} | Subject: Welcome to NearMiss Pro | Body: Your pharmacy "${data.name}" is set up. Login at ${env.clientUrl}`);

    res.status(201).json(pharmacy);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    res.status(500).json({ error: 'Failed to create pharmacy' });
  }
});

// ── Founder: list pharmacies ────────────────────────────────
router.get('/pharmacies', authenticate, requireRole('founder'), async (_req: Request, res: Response) => {
  try {
    const { data } = await supabase.from('pharmacies')
      .select('id, name, manager_email, subscription_status, created_at, trial_ends_at, address, licence_number')
      .order('created_at', { ascending: false });
    res.json(data || []);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Founder: suspend/reinstate pharmacy ─────────────────────
router.patch('/pharmacies/:id/status', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    const { status } = z.object({ status: z.enum(['active', 'suspended', 'trial']) }).parse(req.body);
    await supabase.from('pharmacies').update({ subscription_status: status }).eq('id', req.params.id);
    await supabase.from('audit_log').insert({ pharmacy_id: req.params.id, action: `pharmacy_${status}`, performed_by: 'founder', details: {} });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
