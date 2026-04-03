import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

function signToken(payload: object): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

const staffLoginSchema = z.object({
  pharmacyCode: z.string().min(1),
});

router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { pharmacyCode } = staffLoginSchema.parse(req.body);

    const { data: pharmacy, error } = await supabase
      .from('pharmacies')
      .select('id, name, is_active')
      .eq('pharmacy_code', pharmacyCode.toUpperCase())
      .single();

    if (error || !pharmacy) {
      res.status(401).json({ error: 'Invalid pharmacy code' });
      return;
    }

    if (!pharmacy.is_active) {
      res.status(403).json({ error: 'Pharmacy account is inactive' });
      return;
    }

    const token = signToken({
      pharmacyId: pharmacy.id,
      role: 'staff',
      pharmacyName: pharmacy.name,
    });

    res.json({ token, role: 'staff', pharmacyName: pharmacy.name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const managerLoginSchema = z.object({
  pharmacyCode: z.string().min(1),
  pin: z.string().min(4).max(8),
});

router.post('/manager/login', async (req: Request, res: Response) => {
  try {
    const { pharmacyCode, pin } = managerLoginSchema.parse(req.body);

    const { data: pharmacy, error } = await supabase
      .from('pharmacies')
      .select('id, name, manager_pin, is_active')
      .eq('pharmacy_code', pharmacyCode.toUpperCase())
      .single();

    if (error || !pharmacy) {
      res.status(401).json({ error: 'Invalid pharmacy code' });
      return;
    }

    if (!pharmacy.is_active) {
      res.status(403).json({ error: 'Pharmacy account is inactive' });
      return;
    }

    if (!pharmacy.manager_pin) {
      res.status(403).json({ error: 'Manager access not configured for this pharmacy' });
      return;
    }

    const pinValid = await bcrypt.compare(pin, pharmacy.manager_pin);
    if (!pinValid) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }

    const token = signToken({
      pharmacyId: pharmacy.id,
      role: 'manager',
      pharmacyName: pharmacy.name,
    });

    res.json({ token, role: 'manager', pharmacyName: pharmacy.name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Manager login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const founderLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().optional(),
});

router.post('/founder/login', async (req: Request, res: Response) => {
  try {
    const { email, password, mfaCode } = founderLoginSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, full_name, role, mfa_enabled, mfa_secret, is_active')
      .eq('email', email.toLowerCase())
      .eq('role', 'founder')
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'Account is inactive' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.mfa_enabled) {
      if (!mfaCode) {
        res.json({ requiresMfa: true });
        return;
      }

      if (env.nodeEnv === 'production' && user.mfa_secret) {
        const { authenticator } = await import('otplib');
        const valid = authenticator.verify({ token: mfaCode, secret: user.mfa_secret });
        if (!valid) {
          res.status(401).json({ error: 'Invalid MFA code' });
          return;
        }
      }
    }

    const token = signToken({
      userId: user.id,
      role: 'founder',
      pharmacyId: 'all',
    });

    res.json({
      token,
      role: 'founder',
      user: { id: user.id, email: user.email, fullName: user.full_name },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Founder login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({ auth: req.auth });
});

const registerPharmacySchema = z.object({
  name: z.string().min(1),
  pharmacyCode: z.string().min(4).max(12),
  managerPin: z.string().min(4).max(8).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  nzbn: z.string().optional(),
});

router.post(
  '/pharmacies',
  authenticate,
  requireRole('founder'),
  async (req: Request, res: Response) => {
    try {
      const data = registerPharmacySchema.parse(req.body);

      const hashedPin = data.managerPin
        ? await bcrypt.hash(data.managerPin, 12)
        : null;

      const { data: pharmacy, error } = await supabase
        .from('pharmacies')
        .insert({
          name: data.name,
          pharmacy_code: data.pharmacyCode.toUpperCase(),
          manager_pin: hashedPin,
          address: data.address,
          city: data.city,
          region: data.region,
          nzbn: data.nzbn,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          res.status(409).json({ error: 'Pharmacy code already exists' });
          return;
        }
        throw error;
      }

      res.status(201).json(pharmacy);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: err.errors });
        return;
      }
      console.error('Register pharmacy error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
