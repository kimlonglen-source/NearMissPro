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
      .from('pharmacies').select('id, name, password_hash, login_attempts, locked_until, manager_pin_enabled')
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

    // 24-hour token for staff
    const token = jwt.sign(
      { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, role: 'staff' },
      env.jwtSecret, { expiresIn: '24h' } as jwt.SignOptions
    );

    res.json({ token, role: 'staff', pharmacyName: pharmacy.name, pharmacyId: pharmacy.id, pinEnabled: pharmacy.manager_pin_enabled });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Manager access (check if PIN needed) ────────────────────
router.post('/manager/access', authenticate, async (req: Request, res: Response) => {
  try {
    const { data: pharmacy } = await supabase
      .from('pharmacies').select('manager_pin_enabled').eq('id', req.auth!.pharmacyId).single();

    if (pharmacy?.manager_pin_enabled) {
      res.json({ requiresPin: true }); return;
    }

    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret, { expiresIn: '12h' } as jwt.SignOptions
    );
    res.json({ token, role: 'manager', requiresPin: false });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Access failed' }); }
});

// ── Manager PIN verify ──────────────────────────────────────
router.post('/manager/verify-pin', authenticate, async (req: Request, res: Response) => {
  try {
    const { pin } = z.object({ pin: z.string().min(4).max(6) }).parse(req.body);
    const { data: pharmacy } = await supabase
      .from('pharmacies').select('manager_pin_hash').eq('id', req.auth!.pharmacyId).single();

    if (!pharmacy?.manager_pin_hash || !(await bcrypt.compare(pin, pharmacy.manager_pin_hash))) {
      res.status(401).json({ error: 'Invalid PIN' }); return;
    }

    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret, { expiresIn: '12h' } as jwt.SignOptions
    );
    res.json({ token, role: 'manager' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Manager PIN management ──────────────────────────────────
router.post('/manager/pin/enable', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { pin } = z.object({ pin: z.string().min(4).max(6) }).parse(req.body);
    await supabase.from('pharmacies').update({ manager_pin_hash: await bcrypt.hash(pin, 12), manager_pin_enabled: true }).eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({ pharmacy_id: req.auth!.pharmacyId, action: 'pin_enabled', performed_by: 'manager', details: {} });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/manager/pin/disable', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPin } = z.object({ currentPin: z.string() }).parse(req.body);
    const { data: p } = await supabase.from('pharmacies').select('manager_pin_hash').eq('id', req.auth!.pharmacyId).single();
    if (!p?.manager_pin_hash || !(await bcrypt.compare(currentPin, p.manager_pin_hash))) {
      res.status(401).json({ error: 'Invalid PIN' }); return;
    }
    await supabase.from('pharmacies').update({ manager_pin_hash: null, manager_pin_enabled: false }).eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({ pharmacy_id: req.auth!.pharmacyId, action: 'pin_disabled', performed_by: 'manager', details: {} });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/manager/pin/change', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPin, newPin } = z.object({ currentPin: z.string(), newPin: z.string().min(4).max(6) }).parse(req.body);
    const { data: p } = await supabase.from('pharmacies').select('manager_pin_hash').eq('id', req.auth!.pharmacyId).single();
    if (!p?.manager_pin_hash || !(await bcrypt.compare(currentPin, p.manager_pin_hash))) {
      res.status(401).json({ error: 'Invalid current PIN' }); return;
    }
    await supabase.from('pharmacies').update({ manager_pin_hash: await bcrypt.hash(newPin, 12) }).eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({ pharmacy_id: req.auth!.pharmacyId, action: 'pin_changed', performed_by: 'manager', details: {} });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
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
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json(req.auth);
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
