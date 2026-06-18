import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ── IP-allowlist helpers ────────────────────────────────────
// Pharmacies can opt-in to restricting logins to specific networks
// (e.g. only allow staff to log in from the dispensary's own internet
// connection). Empty array = no restriction (default).
//
// Founder login (/founder/login) deliberately bypasses this so we
// can always recover from a lockout if the pharmacy's IP changes.
function getClientIp(req: Request): string {
  let ip = req.ip || req.socket.remoteAddress || '';
  // Strip the IPv4-mapped-IPv6 prefix so '::ffff:1.2.3.4' compares
  // equal to '1.2.3.4'.
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

function isAllowedFromIp(allowedIps: string[] | null | undefined, clientIp: string): boolean {
  if (!allowedIps || allowedIps.length === 0) return true;
  return allowedIps.includes(clientIp);
}

// ── Staff login (pharmacy name + password) ──────────────────
router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { name, password } = z.object({ name: z.string().min(1), password: z.string().min(1) }).parse(req.body);

    const { data: pharmacy } = await supabase
      .from('pharmacies').select('id, name, password_hash, login_attempts, locked_until, allowed_ips')
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

    // Network restriction check — only applies when the pharmacy
    // has opted in. Runs AFTER the password check so we don't leak
    // which networks are allowed via timing or different error.
    if (!isAllowedFromIp(pharmacy.allowed_ips, getClientIp(req))) {
      res.status(403).json({ error: 'This account can only be used from the pharmacy network. Contact your manager.' });
      return;
    }

    await supabase.from('pharmacies').update({ login_attempts: 0, locked_until: null }).eq('id', pharmacy.id);

    // 7-day token for staff — lets the till computer stay logged in
    // through the working week (log in Mon, no friction until next
    // Mon). Near-miss data is anonymous and low-value; the till is
    // physically secured behind the dispensary counter, so the
    // security trade is fine.
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

// ── Manager access — straight upgrade from staff, no PIN gate. The
//    PIN feature was removed because the pharmacy password already
//    gates this; the PIN was just a speedbump that created lockout
//    risk if forgotten. ──
router.post('/manager/access', authenticate, async (req: Request, res: Response) => {
  try {
    // Re-check IP restriction on manager upgrade so a staff session
    // that left the pharmacy (e.g. on a laptop someone took home)
    // can't escalate to manager privileges.
    const { data: pharmacy } = await supabase.from('pharmacies').select('allowed_ips').eq('id', req.auth!.pharmacyId).single();
    if (!isAllowedFromIp(pharmacy?.allowed_ips, getClientIp(req))) {
      res.status(403).json({ error: 'Manager access is restricted to the pharmacy network.' });
      return;
    }
    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret, { expiresIn: '12h' } as jwt.SignOptions
    );
    res.json({ token, role: 'manager' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Access failed' }); }
});

// ── Network settings (per-pharmacy IP allowlist) ────────────
// Returns the detected client IP + the pharmacy's current allowlist.
// Manager and founder can read; only manager can update.
router.get('/network', authenticate, requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const { data } = await supabase.from('pharmacies').select('allowed_ips').eq('id', req.auth!.pharmacyId).single();
    res.json({
      currentIp: getClientIp(req),
      allowedIps: (data?.allowed_ips as string[] | null) || [],
    });
  } catch (err) {
    console.error('[auth] network/get failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/network', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const body = z.object({ allowedIps: z.array(z.string().max(64)).max(10) }).parse(req.body);
    const cleaned = body.allowedIps.map(ip => ip.trim()).filter(Boolean);
    await supabase.from('pharmacies').update({ allowed_ips: cleaned }).eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId,
      action: 'network_settings_changed',
      performed_by: 'manager',
      details: { allowed_ips: cleaned },
    });
    res.json({ ok: true, allowedIps: cleaned });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[auth] network/patch failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Manager password change ─────────────────────────────────
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
  let pharmacySize: string | null = null;
  if (req.auth!.pharmacyId) {
    const { data } = await supabase.from('pharmacies')
      .select('pharmacy_size').eq('id', req.auth!.pharmacyId).single();
    pharmacySize = (data?.pharmacy_size as string | null) || null;
  }
  res.json({ ...req.auth, pharmacySize });
});

// ── Update pharmacy-level settings (manager only) ───────────
// Single endpoint for whatever pharmacy-level toggles we add over time.
// Today: pharmacy_size. Returns the saved value so the client can
// confirm the write rather than trusting its local state.
router.patch('/pharmacy/settings', authenticate, requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const body = z.object({
      pharmacySize: z.enum(['sole', 'pharmacist_plus_tech', 'multi']).nullable().optional(),
    }).parse(req.body);
    const updates: Record<string, unknown> = {};
    if (body.pharmacySize !== undefined) updates.pharmacy_size = body.pharmacySize;
    if (Object.keys(updates).length === 0) { res.json({ ok: true }); return; }
    const { data, error } = await supabase.from('pharmacies').update(updates)
      .eq('id', req.auth!.pharmacyId).select('pharmacy_size').single();
    if (error) throw error;
    res.json({ ok: true, pharmacySize: data?.pharmacy_size || null });
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
      name: z.string().min(1), password: z.string().min(8), managerEmail: z.string().email(),
      address: z.string().optional(), licenceNumber: z.string().optional(),
    }).parse(req.body);

    const { data: pharmacy, error } = await supabase.from('pharmacies').insert({
      name: data.name, password_hash: await bcrypt.hash(data.password, 12),
      manager_email: data.managerEmail, address: data.address, licence_number: data.licenceNumber,
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
