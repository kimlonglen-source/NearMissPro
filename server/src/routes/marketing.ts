import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';

const router = Router();

// ── Trial sign-up — public endpoint hit by the marketing landing page.
// Stores the email + optional pharmacy name in trial_signups so the
// founder can email back to start onboarding. No auth — anyone can
// submit. Rate-limited at the app level by the auth limiter mounted
// in index.ts (which covers /api/auth and /api/marketing).
router.post('/trial-signup', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      email: z.string().email().max(200),
      pharmacyName: z.string().max(200).optional(),
      notes: z.string().max(1000).optional(),
    }).parse(req.body);

    await supabase.from('trial_signups').insert({
      email: body.email.trim().toLowerCase(),
      pharmacy_name: body.pharmacyName?.trim() || null,
      notes: body.notes?.trim() || null,
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[marketing] trial-signup failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
