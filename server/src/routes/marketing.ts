import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { sendEmail, escapeHtml } from '../services/email.js';

const router = Router();

// ── Trial sign-up — kept as a lightweight interest list for
// landing-page email captures (visitors who don't want to fill in
// the full application). Stores email + optional pharmacy name in
// trial_signups so the founder can follow up.
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

// ── Full self-serve signup — creates a 'pending_approval'
// pharmacy with the details the pharmacy entered, alerts the
// founder, and acknowledges to the pharmacy. The pharmacy can't
// log in yet — they need the founder to approve and then click
// the set-password link in the approval email.
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const data = z.object({
      pharmacyName: z.string().trim().min(1).max(120),
      address: z.string().trim().min(1).max(300),
      licenceNumber: z.string().trim().min(1).max(50),
      managerName: z.string().trim().min(1).max(100),
      pharmacyEmail: z.string().trim().email().max(200),
      phone: z.string().trim().min(1).max(40),
      pharmacySize: z.enum(['sole', 'pharmacist_plus_tech', 'multi']),
      source: z.string().trim().max(200).optional(),
      notes: z.string().trim().max(1000).optional(),
    }).parse(req.body);

    const { data: pharmacy, error } = await supabase.from('pharmacies').insert({
      name: data.pharmacyName,
      manager_email: data.pharmacyEmail.toLowerCase(),
      address: data.address,
      licence_number: data.licenceNumber,
      manager_name: data.managerName,
      phone: data.phone,
      pharmacy_size: data.pharmacySize,
      signup_source: data.source || null,
      signup_notes: data.notes || null,
      subscription_status: 'pending_approval',
      applied_at: new Date().toISOString(),
    }).select('id, name').single();

    if (error) {
      if (error.code === '23505') {
        // Unique violation — pharmacy name already taken.
        res.status(409).json({ error: 'A pharmacy with this name already exists in our system. If that\'s you, use "Forgot password?" on the login screen. Otherwise contact us at hello@nearmisspro.co.nz.' });
        return;
      }
      throw error;
    }

    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'pharmacy_signup_received',
      performed_by: 'self-service',
      details: { name: pharmacy.name },
    });

    // Fire-and-forget: founder alert + applicant acknowledgement.
    if (env.founderEmail) {
      sendEmail({
        to: env.founderEmail,
        subject: `New NearMissPro signup: ${data.pharmacyName}`,
        text: `A new pharmacy signed up:

Pharmacy: ${data.pharmacyName}
Manager:  ${data.managerName}
Email:    ${data.pharmacyEmail}
Phone:    ${data.phone}
Address:  ${data.address}
Licence:  ${data.licenceNumber}
Size:     ${data.pharmacySize}
Source:   ${data.source || '—'}
Notes:    ${data.notes || '—'}

Review and approve at ${env.clientUrl}/admin (Pharmacies tab).

— NearMissPro`,
        html: `<p>A new pharmacy signed up:</p>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td><strong>Pharmacy</strong></td><td>${escapeHtml(data.pharmacyName)}</td></tr>
<tr><td><strong>Manager</strong></td><td>${escapeHtml(data.managerName)}</td></tr>
<tr><td><strong>Email</strong></td><td>${escapeHtml(data.pharmacyEmail)}</td></tr>
<tr><td><strong>Phone</strong></td><td>${escapeHtml(data.phone)}</td></tr>
<tr><td><strong>Address</strong></td><td>${escapeHtml(data.address)}</td></tr>
<tr><td><strong>Licence</strong></td><td>${escapeHtml(data.licenceNumber)}</td></tr>
<tr><td><strong>Size</strong></td><td>${escapeHtml(data.pharmacySize)}</td></tr>
<tr><td><strong>Source</strong></td><td>${escapeHtml(data.source || '—')}</td></tr>
<tr><td><strong>Notes</strong></td><td>${escapeHtml(data.notes || '—')}</td></tr>
</table>
<p><a href="${env.clientUrl}/admin" style="display:inline-block;background:#0F6E56;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Review in admin</a></p>`,
      }).catch(err => console.error('[signup] founder alert failed:', err));
    }

    sendEmail({
      to: data.pharmacyEmail,
      subject: `We've received your NearMissPro application`,
      text: `Hi ${data.managerName},

Thanks for signing up for NearMissPro for ${data.pharmacyName}.

We review every new application by hand to keep the quality of the platform high. We'll come back to you within 1 business day.

When approved, you'll get an email with a link to set your password and start using the system.

If you don't hear from us within 2 business days, please email hello@nearmisspro.co.nz.

— NearMissPro`,
      html: `<p>Hi ${escapeHtml(data.managerName)},</p>
<p>Thanks for signing up for NearMissPro for <strong>${escapeHtml(data.pharmacyName)}</strong>.</p>
<p>We review every new application by hand to keep the quality of the platform high. We'll come back to you within 1 business day.</p>
<p>When approved, you'll get an email with a link to set your password and start using the system.</p>
<p style="color:#666;font-size:13px">If you don't hear from us within 2 business days, please email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
    }).catch(err => console.error('[signup] applicant ack failed:', err));

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[marketing] signup failed:', err);
    res.status(500).json({ error: 'Signup failed — try again or email hello@nearmisspro.co.nz' });
  }
});

export default router;
