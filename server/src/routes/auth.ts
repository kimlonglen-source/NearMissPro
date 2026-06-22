import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendEmail, escapeHtml } from '../services/email.js';

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

// ── Manager access — one-click upgrade from staff. ──
// No second password: the pharmacy password (which the manager just
// used to log in as staff) already gated entry. A separate manager
// password was tried and removed because the friction outweighed
// the security benefit in a small NZ pharmacy where roles are
// known and the dispensing computer is physically secured.
router.post('/manager/access', authenticate, async (req: Request, res: Response) => {
  try {
    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret, { expiresIn: '12h' } as jwt.SignOptions
    );
    res.json({ token, role: 'manager' });
  } catch (err) {
    console.error('Manager access error:', err);
    res.status(500).json({ error: 'Access failed' });
  }
});

// ── Change the pharmacy password (manager only) ───────────
router.post('/manager/change-password', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
    const { data: p } = await supabase.from('pharmacies').select('password_hash').eq('id', req.auth!.pharmacyId).single();
    if (!p || !(await bcrypt.compare(currentPassword, p.password_hash))) {
      // 400, NOT 401. The session is fine — the wrong thing was a
      // form field. Returning 401 would trigger the api helper's
      // session-expired bounce and kick the manager back to /login.
      res.status(400).json({ error: 'Current password incorrect' }); return;
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
  // the AI's tone in recommendations and summaries; manager name/email
  // drive the report greeting and password-reset destination.
  let pharmacySize: string | null = null;
  let managerName: string | null = null;
  let managerEmail: string | null = null;
  if (req.auth!.pharmacyId) {
    const { data } = await supabase.from('pharmacies')
      .select('pharmacy_size, manager_name, manager_email')
      .eq('id', req.auth!.pharmacyId).single();
    pharmacySize = (data?.pharmacy_size as string | null) || null;
    managerName = (data?.manager_name as string | null) || null;
    managerEmail = (data?.manager_email as string | null) || null;
  }
  res.json({ ...req.auth, pharmacySize, managerName, managerEmail });
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
      managerName: z.string().min(1).max(100),
      managerEmail: z.string().email().max(200),
      address: z.string().max(300).optional(),
      licenceNumber: z.string().max(50).optional(),
    }).parse(req.body);

    const { data: pharmacy, error } = await supabase.from('pharmacies').insert({
      name: data.name,
      password_hash: await bcrypt.hash(data.password, 12),
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

// ── Forgot password ────────────────────────────────────────
// Generates a one-time reset token, stores its hash, emails the
// reset link to the manager_email on file. Always returns 200 so
// an attacker can't probe whether a pharmacy name exists by
// watching response times or status codes.
const forgotSchema = z.object({
  pharmacyName: z.string().min(1).max(120),
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  // Respond OK regardless of outcome to avoid enumeration. Errors are
  // logged server-side for our own debugging.
  res.json({ ok: true });
  try {
    const { pharmacyName } = forgotSchema.parse(req.body);
    const { data: pharmacy } = await supabase.from('pharmacies')
      .select('id, name, manager_email, manager_name')
      .ilike('name', pharmacyName).single();
    if (!pharmacy || !pharmacy.manager_email) {
      console.log('[forgot-password] no pharmacy or no manager_email:', pharmacyName);
      return;
    }
    // 32-byte URL-safe token; only the hash is stored.
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString(); // 60 min
    const { error: insertErr } = await supabase.from('password_reset_tokens').insert({
      pharmacy_id: pharmacy.id,
      password_type: 'pharmacy',
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertErr) {
      // Most common cause: migrate_password_reset_tokens.sql wasn't
      // run on the target database. Surfacing this loudly so the
      // server log shows the cause rather than silently sending an
      // email with a token that won't validate.
      console.error('[forgot-password] could not insert reset token — has migrate_password_reset_tokens.sql been run?', insertErr);
      return;
    }
    const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
    const greeting = pharmacy.manager_name ? `Hi ${escapeHtml(pharmacy.manager_name)},` : 'Hi,';
    await sendEmail({
      to: pharmacy.manager_email,
      subject: `Reset your NearMissPro password`,
      text: `${pharmacy.manager_name ? `Hi ${pharmacy.manager_name},` : 'Hi,'}

We received a request to reset the password for ${pharmacy.name}.

Set a new password using this link (expires in 60 minutes):
${resetUrl}

If you didn't ask to reset, ignore this email — your current password is unchanged.

— NearMissPro`,
      html: `<p>${greeting}</p>
<p>We received a request to reset the password for ${escapeHtml(pharmacy.name)}.</p>
<p><a href="${resetUrl}" style="display:inline-block;background:#0F6E56;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Set a new password</a></p>
<p style="color:#666;font-size:13px">This link expires in 60 minutes. If you didn't ask to reset, ignore this email — your current password is unchanged.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
    });
    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'password_reset_requested',
      performed_by: 'self-service',
      details: {},
    });
  } catch (err) {
    console.error('[forgot-password] failed:', err);
  }
});

// ── Reset password ─────────────────────────────────────────
// Consumes the one-time token, updates the chosen password.
const resetSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8).max(200),
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = resetSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: row } = await supabase.from('password_reset_tokens')
      .select('id, pharmacy_id, expires_at, used_at')
      .eq('token_hash', tokenHash).single();
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      res.status(400).json({ error: 'This reset link is no longer valid. Request a new one.' });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    // Also clear lockout so a forgotten password doesn't leave staff
    // stuck after a fresh reset.
    await supabase.from('pharmacies').update({
      password_hash: hashed,
      login_attempts: 0,
      locked_until: null,
    }).eq('id', row.pharmacy_id);
    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: row.pharmacy_id,
      action: 'pharmacy_password_reset',
      performed_by: 'self-service',
      details: {},
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[reset-password] failed:', err);
    res.status(500).json({ error: 'Reset failed — try requesting a new link.' });
  }
});

export default router;
