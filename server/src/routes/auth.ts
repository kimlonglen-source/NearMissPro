import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ─── Staff login (pharmacy name + password) ─────────────────
const staffLoginSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
});

router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { name, password } = staffLoginSchema.parse(req.body);

    const { data: pharmacy, error } = await supabase
      .from('pharmacies')
      .select('id, name, password_hash, login_attempts, locked_until')
      .ilike('name', name)
      .single();

    if (error || !pharmacy) {
      res.status(401).json({ error: 'Invalid pharmacy name or password' });
      return;
    }

    // Check lockout (10 attempts)
    if (pharmacy.locked_until && new Date(pharmacy.locked_until) > new Date()) {
      res.status(423).json({ error: 'Account locked. Contact your manager.' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, pharmacy.password_hash);
    if (!passwordValid) {
      const attempts = (pharmacy.login_attempts || 0) + 1;
      const lockout = attempts >= 10 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;
      await supabase.from('pharmacies').update({
        login_attempts: attempts,
        ...(lockout && { locked_until: lockout }),
      }).eq('id', pharmacy.id);

      if (attempts >= 10) {
        console.log(`[EMAIL] To: manager | Subject: Account locked | Body: ${pharmacy.name} has been locked after 10 failed login attempts.`);
        res.status(423).json({ error: 'Account locked after too many attempts. Check manager email.' });
        return;
      }
      res.status(401).json({ error: 'Invalid pharmacy name or password' });
      return;
    }

    // Reset login attempts on success
    await supabase.from('pharmacies').update({ login_attempts: 0, locked_until: null }).eq('id', pharmacy.id);

    // Permanent token for staff (no expiry)
    const token = jwt.sign(
      { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, role: 'staff' },
      env.jwtSecret
    );

    res.json({ token, role: 'staff', pharmacyName: pharmacy.name, pharmacyId: pharmacy.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Manager PIN verification ───────────────────────────────
const pinSchema = z.object({
  pin: z.string().min(4).max(6),
});

router.post('/manager/verify-pin', authenticate, async (req: Request, res: Response) => {
  try {
    const { pin } = pinSchema.parse(req.body);
    const pharmacyId = req.auth!.pharmacyId;

    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('manager_pin_hash, manager_pin_enabled')
      .eq('id', pharmacyId)
      .single();

    if (!pharmacy?.manager_pin_enabled || !pharmacy.manager_pin_hash) {
      res.status(400).json({ error: 'PIN not enabled' });
      return;
    }

    const valid = await bcrypt.compare(pin, pharmacy.manager_pin_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }

    // Upgrade token to manager role
    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret,
      { expiresIn: '12h' } as jwt.SignOptions
    );

    res.json({ token, role: 'manager' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('PIN verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── Manager access (no PIN) ────────────────────────────────
router.post('/manager/access', authenticate, async (req: Request, res: Response) => {
  try {
    const pharmacyId = req.auth!.pharmacyId;

    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('manager_pin_enabled')
      .eq('id', pharmacyId)
      .single();

    if (pharmacy?.manager_pin_enabled) {
      res.json({ requiresPin: true });
      return;
    }

    const token = jwt.sign(
      { pharmacyId: req.auth!.pharmacyId, pharmacyName: req.auth!.pharmacyName, role: 'manager' },
      env.jwtSecret,
      { expiresIn: '12h' } as jwt.SignOptions
    );

    res.json({ token, role: 'manager', requiresPin: false });
  } catch (err) {
    console.error('Manager access error:', err);
    res.status(500).json({ error: 'Access failed' });
  }
});

// ─── Manager PIN management ─────────────────────────────────
router.post('/manager/pin/enable', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { pin } = z.object({ pin: z.string().min(4).max(6) }).parse(req.body);
    const hash = await bcrypt.hash(pin, 12);

    await supabase.from('pharmacies').update({
      manager_pin_hash: hash,
      manager_pin_enabled: true,
    }).eq('id', req.auth!.pharmacyId);

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId,
      action: 'manager_pin_enabled',
      performed_by: 'manager',
      details: {},
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to enable PIN' });
  }
});

router.post('/manager/pin/disable', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPin } = z.object({ currentPin: z.string() }).parse(req.body);

    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('manager_pin_hash')
      .eq('id', req.auth!.pharmacyId)
      .single();

    if (!pharmacy?.manager_pin_hash || !(await bcrypt.compare(currentPin, pharmacy.manager_pin_hash))) {
      res.status(401).json({ error: 'Invalid current PIN' });
      return;
    }

    await supabase.from('pharmacies').update({
      manager_pin_hash: null,
      manager_pin_enabled: false,
    }).eq('id', req.auth!.pharmacyId);

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId,
      action: 'manager_pin_disabled',
      performed_by: 'manager',
      details: {},
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable PIN' });
  }
});

// ─── Founder login (email + password + MFA) ─────────────────
const founderLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().length(6).optional(),
});

router.post('/founder/login', async (req: Request, res: Response) => {
  try {
    const { email, password, mfaCode } = founderLoginSchema.parse(req.body);

    const { data: founder, error } = await supabase
      .from('founder_accounts')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !founder) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check lockout (5 attempts)
    if (founder.locked_until && new Date(founder.locked_until) > new Date()) {
      res.status(423).json({ error: 'Account locked. Try again later.' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, founder.password_hash);
    if (!passwordValid) {
      const attempts = (founder.login_attempts || 0) + 1;
      const lockout = attempts >= 5 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
      await supabase.from('founder_accounts').update({
        login_attempts: attempts,
        ...(lockout && { locked_until: lockout }),
      }).eq('id', founder.id);

      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // MFA always required for founder
    if (!mfaCode) {
      res.json({ requiresMfa: true });
      return;
    }

    // Verify MFA
    const { authenticator } = await import('otplib');
    const mfaValid = authenticator.verify({ token: mfaCode, secret: founder.mfa_secret });
    if (!mfaValid) {
      res.status(401).json({ error: 'Invalid MFA code' });
      return;
    }

    // Reset attempts
    await supabase.from('founder_accounts').update({ login_attempts: 0, locked_until: null }).eq('id', founder.id);

    // 8-hour session
    const token = jwt.sign(
      { founderId: founder.id, role: 'founder', pharmacyId: 'all', pharmacyName: 'Founder' },
      env.jwtSecret,
      { expiresIn: '8h' } as jwt.SignOptions
    );

    await supabase.from('audit_log').insert({
      action: 'founder_login',
      performed_by: founder.email,
      details: {},
    });

    res.json({ token, role: 'founder', email: founder.email, fullName: founder.full_name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Founder login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Current auth info ──────────────────────────────────────
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ auth: req.auth });
});

// ─── Founder: create pharmacy ───────────────────────────────
const createPharmacySchema = z.object({
  name: z.string().min(1),
  password: z.string().min(8),
  managerEmail: z.string().email(),
  address: z.string().optional(),
  licenceNumber: z.string().optional(),
});

router.post('/pharmacies', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    const data = createPharmacySchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const { data: pharmacy, error } = await supabase
      .from('pharmacies')
      .insert({
        name: data.name,
        password_hash: passwordHash,
        manager_email: data.managerEmail,
        address: data.address,
        licence_number: data.licenceNumber,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Pharmacy name already exists' });
        return;
      }
      throw error;
    }

    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'pharmacy_created',
      performed_by: 'founder',
      details: { name: data.name },
    });

    console.log(`[EMAIL] To: ${data.managerEmail} | Subject: Welcome to NearMiss Pro | Body: Your pharmacy "${data.name}" has been set up. Login at ${env.appUrl} with your pharmacy name and password.`);

    res.status(201).json(pharmacy);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Create pharmacy error:', err);
    res.status(500).json({ error: 'Failed to create pharmacy' });
  }
});

// ─── Manager: change password ───────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

router.post('/change-password', authenticate, requireRole('manager'), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('password_hash')
      .eq('id', req.auth!.pharmacyId)
      .single();

    if (!pharmacy || !(await bcrypt.compare(currentPassword, pharmacy.password_hash))) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await supabase.from('pharmacies').update({ password_hash: newHash }).eq('id', req.auth!.pharmacyId);

    await supabase.from('audit_log').insert({
      pharmacy_id: req.auth!.pharmacyId,
      action: 'password_changed',
      performed_by: 'manager',
      details: {},
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
