import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendEmail, escapeHtml } from '../services/email.js';

// Escape LIKE/ILIKE wildcards so a pharmacy name is matched literally.
// Without this, a submitted "%" or "_" is treated as a wildcard — an
// attacker could target a pharmacy by partial name (e.g. "Riverdale%")
// to trigger its reset/lockout emails without knowing the exact name.
const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&');

const router = Router();

// Parse a User-Agent string into a short human label for the
// device-verification email. Best-effort — covers the common cases
// (Chrome / Safari / Edge / Firefox on macOS / Windows / iOS /
// Android) and falls back to "Unknown browser" for the rest.
function describeDevice(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown browser';
  const ua = userAgent;
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = 'unknown OS';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} on ${os}`;
}

// ── Staff login (pharmacy name + password) ──────────────────
// Includes device-verification: a deviceId from the browser is
// hashed and looked up in trusted_devices. If the device isn't
// trusted, we DON'T issue a token — we send an approval email to
// the pharmacy email instead. The user has to wait for someone
// with access to that inbox to click the approval link.
router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { name, password, deviceId, rememberMe } = z.object({
      name: z.string().min(1),
      password: z.string().min(1),
      deviceId: z.string().min(20).max(200).optional(),
      // "Keep me signed in on this computer" — extends the session from
      // 7 to 30 days. Safe on the fixed, physically-secured dispensary
      // computer; there's no patient data in the app either way.
      rememberMe: z.boolean().optional(),
    }).parse(req.body);

    const { data: pharmacy } = await supabase
      .from('pharmacies').select('id, name, password_hash, login_attempts, locked_until, manager_email, subscription_status, trial_ends_at')
      .ilike('name', escapeLike(name)).single();

    if (!pharmacy) { res.status(401).json({ error: 'Invalid pharmacy name or password' }); return; }

    if (pharmacy.locked_until && new Date(pharmacy.locked_until) > new Date()) {
      res.status(423).json({ error: 'Account locked. Contact your manager.' }); return;
    }

    // Lockout window has expired — reset the counter so a legitimate
    // user gets a fresh 10 attempts. Without this, login_attempts stays
    // at 10 after the 30-min window, and the next wrong password
    // instantly re-locks (attempts=11) with zero retry budget.
    if (pharmacy.locked_until && new Date(pharmacy.locked_until) <= new Date() && (pharmacy.login_attempts || 0) > 0) {
      await supabase.from('pharmacies').update({ login_attempts: 0, locked_until: null }).eq('id', pharmacy.id);
      pharmacy.login_attempts = 0;
    }

    // Block login for pharmacies whose lifecycle hasn't reached
    // "can use the app" yet (waiting on approval, declined,
    // suspended). password_hash may also be null for the
    // pending_approval case which would crash bcrypt.compare below.
    if (pharmacy.subscription_status === 'pending_approval') {
      res.status(403).json({ error: 'This pharmacy is still awaiting approval. Check the dispensary email for our approval message, or contact hello@nearmisspro.co.nz.' }); return;
    }
    if (pharmacy.subscription_status === 'declined') {
      res.status(403).json({ error: 'This application was not approved. Contact hello@nearmisspro.co.nz if you think this is a mistake.' }); return;
    }
    if (pharmacy.subscription_status === 'suspended') {
      res.status(403).json({ error: 'This pharmacy account is suspended. Contact hello@nearmisspro.co.nz.' }); return;
    }
    if (!pharmacy.password_hash) {
      res.status(403).json({ error: 'Password has not been set yet. Check the dispensary email for the setup link, or contact hello@nearmisspro.co.nz.' }); return;
    }

    if (!(await bcrypt.compare(password, pharmacy.password_hash))) {
      const attempts = (pharmacy.login_attempts || 0) + 1;
      const remaining = 10 - attempts;
      const isLocked = attempts >= 10;
      const lockout = isLocked ? new Date(Date.now() + 30 * 60_000).toISOString() : null;
      await supabase.from('pharmacies').update({ login_attempts: attempts, ...(lockout && { locked_until: lockout }) }).eq('id', pharmacy.id);
      if (isLocked) {
        // Email the pharmacy email so whoever owns it sees the
        // lockout — could be honest staff fumbling the password, or
        // someone trying to guess. Either way, the inbox holder
        // should know.
        if (pharmacy.manager_email) {
          sendEmail({
            to: pharmacy.manager_email,
            subject: `${pharmacy.name}: NearMissPro account locked (10 wrong passwords)`,
            text: `Hi,

Your NearMissPro account for ${pharmacy.name} was locked after 10 wrong passwords in a row.

It unlocks automatically in 30 minutes. If it was just a staff member fumbling the password, no action needed.

If this wasn't your team, someone may be trying to guess your password. Reset it now using "Forgot password?" on the login screen — that unlocks the account straight away and gives you a fresh password.

— NearMissPro`,
            html: `<p>Hi,</p>
<p>Your NearMissPro account for <strong>${escapeHtml(pharmacy.name)}</strong> was locked after 10 wrong passwords in a row.</p>
<p>It unlocks automatically in 30 minutes. If it was just a staff member fumbling the password, no action needed.</p>
<p style="color:#791F1F"><strong>If this wasn't your team</strong>, someone may be trying to guess your password. Reset it now using <a href="${env.clientUrl}/forgot-password">Forgot password?</a> on the login screen — that unlocks the account straight away and gives you a fresh password.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
          }).catch(err => console.error('[staff/login] lockout email failed:', err));
        }
        res.status(423).json({ error: 'Account locked for 30 minutes after 10 wrong passwords. Use "Forgot password?" to unlock straight away.' });
        return;
      }
      // Escalating warning when the user gets within 3 attempts of
      // the lockout — gives them a chance to pause and check before
      // accidentally locking everyone out.
      if (remaining <= 3) {
        res.status(401).json({ error: `Wrong password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before the account is locked for 30 minutes.` });
        return;
      }
      res.status(401).json({ error: 'Invalid pharmacy name or password' }); return;
    }

    await supabase.from('pharmacies').update({ login_attempts: 0, locked_until: null }).eq('id', pharmacy.id);

    // Device-verification check. If the deviceId hash exists in
    // trusted_devices for this pharmacy, this is a known device —
    // log in normally. Otherwise, send an approval email and tell
    // the client to wait. The client always generates a deviceId
    // if it doesn't have one, so the optional case here is for
    // very old clients pre-rollout — those still get treated as
    // "untrusted" and trigger the email path.
    const effectiveDeviceId = deviceId || crypto.randomBytes(24).toString('base64url');
    const deviceIdHash = crypto.createHash('sha256').update(effectiveDeviceId).digest('hex');
    const { data: trusted } = await supabase.from('trusted_devices')
      .select('id').eq('pharmacy_id', pharmacy.id).eq('device_id_hash', deviceIdHash).maybeSingle();

    if (!trusted) {
      // Untrusted device — generate an approval token and send email.
      const approvalToken = crypto.randomBytes(32).toString('base64url');
      const approvalTokenHash = crypto.createHash('sha256').update(approvalToken).digest('hex');
      const deviceLabel = describeDevice(req.headers['user-agent'] as string | undefined);
      const { error: insertErr } = await supabase.from('device_verification_requests').insert({
        pharmacy_id: pharmacy.id,
        device_id_hash: deviceIdHash,
        device_label: deviceLabel,
        token_hash: approvalTokenHash,
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      });
      if (insertErr) {
        // Most common cause: GRANT for service_role on
        // device_verification_requests wasn't run on the target
        // database. Surface this loudly — silent failure here meant
        // the email went out with a token the server could never
        // validate, and the user saw "no longer valid" forever.
        console.error('[staff/login] could not insert device verification — has the GRANT in migrate_trusted_devices.sql been run?', insertErr);
        res.status(500).json({ error: 'Could not create device approval. Contact support.' });
        return;
      }
      if (pharmacy.manager_email) {
        const approveUrl = `${env.clientUrl}/verify-device?token=${approvalToken}`;
        const ip = req.ip || 'unknown IP';
        const when = new Date().toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' });
        sendEmail({
          to: pharmacy.manager_email,
          subject: `Approve a new device on ${pharmacy.name}`,
          text: `Hi,

Someone just tried to log in to NearMissPro for ${pharmacy.name}:

Device: ${deviceLabel}
IP address: ${ip}
Time: ${when}

If this was you or a member of your team using a new device, click here to approve it (the device is then remembered and won't need approval again):
${approveUrl}

If you DON'T recognise this attempt, do nothing — the request expires in 60 minutes and the device stays locked out. You may also want to change your pharmacy password if you suspect it's been shared with someone who shouldn't have it.

— NearMissPro`,
          html: `<p>Hi,</p>
<p>Someone just tried to log in to NearMissPro for <strong>${escapeHtml(pharmacy.name)}</strong>:</p>
<ul>
<li><strong>Device:</strong> ${escapeHtml(deviceLabel)}</li>
<li><strong>IP address:</strong> ${escapeHtml(ip)}</li>
<li><strong>Time:</strong> ${escapeHtml(when)}</li>
</ul>
<p>If this was you or a member of your team on a new device, click below to approve it. The device is then remembered and won't need approval again.</p>
<p><a href="${approveUrl}" style="display:inline-block;background:#0F6E56;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Approve this device</a></p>
<p style="color:#791F1F"><strong>If you DON'T recognise this attempt</strong>, do nothing — the request expires in 60 minutes and the device stays locked out. You may also want to change your pharmacy password if you suspect it's been shared.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
        }).catch(err => console.error('[staff/login] device approval email failed:', err));
      }
      await supabase.from('audit_log').insert({
        pharmacy_id: pharmacy.id,
        action: 'device_verification_requested',
        performed_by: 'self-service',
        details: { device_label: deviceLabel },
      });
      // Hand the deviceId back so the client stores it — same id is
      // sent next time, and the same email approval applies.
      res.json({ needsVerification: true, deviceId: effectiveDeviceId });
      return;
    }

    // Trusted device — refresh last_used_at and issue token as normal.
    await supabase.from('trusted_devices').update({ last_used_at: new Date().toISOString() })
      .eq('id', trusted.id);

    // 7-day token for staff — lets the dispensing computer stay
    // logged in through the working week (log in Mon, no friction
    // until next Mon). Near-miss data is anonymous and low-value;
    // the dispensing computer is physically secured behind the
    // dispensary counter, so the security trade is fine.
    const token = jwt.sign(
      { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, role: 'staff' },
      env.jwtSecret, { expiresIn: rememberMe ? '30d' : '7d' } as jwt.SignOptions
    );

    // Trial-ending nudge — fires only if status === 'trial' AND
    // the manager hasn't already received this bucket's email.
    // Background — must never block the login response.
    import('../services/trialReminders.js').then(({ maybeSendTrialReminder }) => {
      maybeSendTrialReminder({
        id: pharmacy.id,
        name: pharmacy.name,
        manager_email: pharmacy.manager_email,
        subscription_status: pharmacy.subscription_status,
        trial_ends_at: pharmacy.trial_ends_at,
      });
    }).catch(err => console.error('[staff/login] trial reminder import failed:', err));

    res.json({ token, role: 'staff', pharmacyName: pharmacy.name, pharmacyId: pharmacy.id, deviceId: effectiveDeviceId });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Poll: has this device been approved yet? ───────────────
// Lightweight boolean check used by the LoginPage while the user
// waits on the "approve this device" screen. Doesn't validate the
// password or issue a token — just answers "is this deviceId in
// trusted_devices for that pharmacy yet?". Returns false on any
// error or missing pharmacy so polling is forgiving and silent.
router.post('/check-device-trust', async (req: Request, res: Response) => {
  try {
    const { pharmacyName, deviceId } = z.object({
      pharmacyName: z.string().min(1).max(120),
      deviceId: z.string().min(20).max(200),
    }).parse(req.body);
    const deviceIdHash = crypto.createHash('sha256').update(deviceId).digest('hex');
    const { data: pharmacy } = await supabase.from('pharmacies')
      .select('id').ilike('name', escapeLike(pharmacyName)).single();
    if (!pharmacy) { res.json({ trusted: false }); return; }
    const { data: trusted } = await supabase.from('trusted_devices')
      .select('id').eq('pharmacy_id', pharmacy.id).eq('device_id_hash', deviceIdHash).maybeSingle();
    res.json({ trusted: !!trusted });
  } catch {
    res.json({ trusted: false });
  }
});

// ── Verify (approve) a new device ────────────────────────
// Consumes the one-time token in the email link and promotes the
// pending device into trusted_devices. After this, any login
// attempt from that device's browser succeeds normally.
//
// Idempotent by design: if a repeat call hits this endpoint with
// the same token (React StrictMode double-invocation in dev, or a
// user simply clicking the link twice), we check whether the
// device is ALREADY in trusted_devices and return success rather
// than the misleading "no longer valid". The actual approval
// happened on the first call — the second call just observes it.
router.post('/verify-device', async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string().min(20).max(200) }).parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: row } = await supabase.from('device_verification_requests')
      .select('id, pharmacy_id, device_id_hash, device_label, expires_at, used_at')
      .eq('token_hash', tokenHash).single();
    if (!row) {
      res.status(400).json({ error: 'This approval link is no longer valid. Have the person try logging in again to generate a fresh one.' });
      return;
    }
    // If the device is already in trusted_devices, the work is done
    // — return success regardless of whether the token is used or
    // expired. This is the idempotency path: a second click (or a
    // React-StrictMode-induced second mount) lands here and sees
    // "already approved" instead of an alarming error.
    const { data: alreadyTrusted } = await supabase.from('trusted_devices')
      .select('id, device_label')
      .eq('pharmacy_id', row.pharmacy_id)
      .eq('device_id_hash', row.device_id_hash)
      .maybeSingle();
    if (alreadyTrusted) {
      res.json({ ok: true, deviceLabel: alreadyTrusted.device_label || row.device_label });
      return;
    }
    // Not yet trusted — validate the token before approving.
    if (row.used_at || new Date(row.expires_at) < new Date()) {
      res.status(400).json({ error: 'This approval link is no longer valid. Have the person try logging in again to generate a fresh one.' });
      return;
    }
    const { error: upsertErr } = await supabase.from('trusted_devices').upsert({
      pharmacy_id: row.pharmacy_id,
      device_id_hash: row.device_id_hash,
      device_label: row.device_label,
      first_approved_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'pharmacy_id,device_id_hash' });
    if (upsertErr) throw upsertErr;
    await supabase.from('device_verification_requests').update({ used_at: new Date().toISOString() })
      .eq('id', row.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: row.pharmacy_id,
      action: 'device_approved',
      performed_by: 'self-service',
      details: { device_label: row.device_label },
    });
    res.json({ ok: true, deviceLabel: row.device_label });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[verify-device] failed:', err);
    res.status(500).json({ error: 'Could not approve device — try the link again.' });
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
    const { data: p } = await supabase.from('pharmacies').select('password_hash, name, manager_email').eq('id', req.auth!.pharmacyId).single();
    if (!p || !(await bcrypt.compare(currentPassword, p.password_hash))) {
      // 400, NOT 401. The session is fine — the wrong thing was a
      // form field. Returning 401 would trigger the api helper's
      // session-expired bounce and kick the manager back to /login.
      res.status(400).json({ error: 'Current password incorrect' }); return;
    }
    await supabase.from('pharmacies').update({ password_hash: await bcrypt.hash(newPassword, 12) }).eq('id', req.auth!.pharmacyId);
    await supabase.from('audit_log').insert({ pharmacy_id: req.auth!.pharmacyId, action: 'password_changed', performed_by: 'manager', details: {} });
    // Notify the pharmacy email so a hostile password change is
    // visible to whoever owns the recovery channel. Fire-and-forget
    // — a transient SMTP issue shouldn't block the change.
    if (p.manager_email) {
      sendEmail({
        to: p.manager_email,
        subject: `${p.name || 'Your pharmacy'}: NearMissPro password was changed`,
        text: `Hi,

The NearMissPro password for ${p.name || 'your pharmacy'} was just changed.

If you authorised this, no action is needed.

If you DID NOT authorise this, use the 'Forgot password?' link on the login page to reset it back, then contact hello@nearmisspro.co.nz.

— NearMissPro`,
        html: `<p>Hi,</p>
<p>The NearMissPro password for <strong>${escapeHtml(p.name || 'your pharmacy')}</strong> was just changed.</p>
<p>If you authorised this, no action is needed.</p>
<p style="color:#791F1F"><strong>If you DID NOT authorise this</strong>, use the "Forgot password?" link on the login page to reset it back, then contact <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[change-password] notification failed:', err));
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Founder login (email + password + MFA) ──────────────────
router.post('/founder/login', async (req: Request, res: Response) => {
  try {
    const { email, password, mfaCode } = z.object({
      email: z.string().email(), password: z.string().min(8), mfaCode: z.string().length(6).optional(),
    }).parse(req.body);

    if (email.toLowerCase() !== env.founderEmail.toLowerCase()) {
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }

    // Password: env var if set, fallback to dev value when unset.
    // The fallback exists so localhost development doesn't require
    // a .env entry. Any hosted instance MUST have FOUNDER_PASSWORD
    // set — otherwise the login is trivially bypassed.
    const expectedPassword = env.founderPassword || 'founder123';
    if (password !== expectedPassword) {
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }

    if (!mfaCode) {
      res.json({ requiresMfa: true }); return;
    }

    if (env.founderTotpSecret) {
      // Real TOTP check — the secret was generated by
      // `npm run founder-setup` and added to an authenticator app
      // (Google Authenticator, 1Password, Authy, etc.). The code
      // rotates every 30s; otplib's authenticator.check handles
      // the time-window tolerance.
      const { authenticator } = await import('otplib');
      if (!authenticator.check(mfaCode, env.founderTotpSecret)) {
        res.status(401).json({ error: 'Invalid MFA code' }); return;
      }
    } else {
      // Dev fallback — accept any 6-digit code.
      if (!/^\d{6}$/.test(mfaCode)) {
        res.status(401).json({ error: 'Invalid MFA code' }); return;
      }
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
  // so it doesn't have to make a second round-trip. pharmacy_size
  // drives the AI's tone in recommendations and summaries; pharmacy
  // email is where password-reset and product emails are delivered.
  let pharmacySize: string | null = null;
  let pharmacyEmail: string | null = null;
  let trialEndsAt: string | null = null;
  let subscriptionStatus: string | null = null;
  if (req.auth!.pharmacyId) {
    const { data } = await supabase.from('pharmacies')
      .select('pharmacy_size, manager_email, trial_ends_at, subscription_status')
      .eq('id', req.auth!.pharmacyId).single();
    pharmacySize = (data?.pharmacy_size as string | null) || null;
    pharmacyEmail = (data?.manager_email as string | null) || null;
    trialEndsAt = (data?.trial_ends_at as string | null) || null;
    subscriptionStatus = (data?.subscription_status as string | null) || null;
  }
  res.json({ ...req.auth, pharmacySize, pharmacyEmail, trialEndsAt, subscriptionStatus });
});

// ── Update pharmacy-level settings (manager only) ───────────
// Single endpoint for pharmacy-level toggles + the pharmacy email
// (used for password resets + future product emails). Each field
// is optional in the body so the client can save just what
// changed. The DB column is historically named manager_email but
// the UI presents it as the pharmacy email.
router.patch('/pharmacy/settings', authenticate, requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const body = z.object({
      pharmacySize: z.enum(['sole', 'pharmacist_plus_tech', 'multi']).nullable().optional(),
      pharmacyEmail: z.string().trim().email().max(200).optional(),
    }).parse(req.body);

    // Read the existing pharmacy first so we can tell what's actually
    // changing — needed for the "notify the OLD email when email
    // changes" safeguard against rogue-manager lock-outs.
    const { data: existing, error: readErr } = await supabase.from('pharmacies')
      .select('name, manager_email').eq('id', req.auth!.pharmacyId).single();
    if (readErr) throw readErr;
    const oldEmail = (existing?.manager_email as string | null) || null;
    const pharmacyDisplayName = (existing?.name as string | null) || 'your pharmacy';

    const updates: Record<string, unknown> = {};
    if (body.pharmacySize !== undefined) updates.pharmacy_size = body.pharmacySize;
    if (body.pharmacyEmail !== undefined) updates.manager_email = body.pharmacyEmail;
    if (Object.keys(updates).length === 0) { res.json({ ok: true }); return; }
    const { data, error } = await supabase.from('pharmacies').update(updates)
      .eq('id', req.auth!.pharmacyId).select('pharmacy_size, manager_email').single();
    if (error) throw error;

    // Notify the OLD email if it's being changed — gives the previous
    // owner of the recovery channel a chance to spot a hostile change
    // (rogue manager rotating both email + password to lock everyone
    // out). Also notify the NEW email so the new recipient knows the
    // address is now wired up.
    if (body.pharmacyEmail !== undefined && oldEmail && oldEmail !== body.pharmacyEmail) {
      // Don't await — these are fire-and-forget so a transient SMTP
      // issue can't block the manager from saving the change.
      sendEmail({
        to: oldEmail,
        subject: `${pharmacyDisplayName}: your NearMissPro email was changed`,
        text: `Hi,

The dispensary email on the NearMissPro account for ${pharmacyDisplayName} was just changed from this address to ${body.pharmacyEmail}.

If you authorised this, no action is needed.

If you DID NOT authorise this, contact us immediately at hello@nearmisspro.co.nz — your pharmacy may be at risk of being locked out.

— NearMissPro`,
        html: `<p>Hi,</p>
<p>The dispensary email on the NearMissPro account for <strong>${escapeHtml(pharmacyDisplayName)}</strong> was just changed from this address to <strong>${escapeHtml(body.pharmacyEmail)}</strong>.</p>
<p>If you authorised this, no action is needed.</p>
<p style="color:#791F1F"><strong>If you DID NOT authorise this</strong>, contact us immediately at <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a> — your pharmacy may be at risk of being locked out.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[pharmacy/settings] old-email notification failed:', err));
      sendEmail({
        to: body.pharmacyEmail,
        subject: `${pharmacyDisplayName}: this is now your NearMissPro dispensary email`,
        text: `Hi,

This address (${body.pharmacyEmail}) is now the registered dispensary email for ${pharmacyDisplayName} on NearMissPro.

From now on, password-reset links and any other product emails will come here.

— NearMissPro`,
        html: `<p>Hi,</p>
<p>This address (${escapeHtml(body.pharmacyEmail)}) is now the registered dispensary email for <strong>${escapeHtml(pharmacyDisplayName)}</strong> on NearMissPro.</p>
<p>From now on, password-reset links and any other product emails will come here.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[pharmacy/settings] new-email notification failed:', err));
    }

    if (body.pharmacyEmail !== undefined) {
      await supabase.from('audit_log').insert({
        pharmacy_id: req.auth!.pharmacyId,
        action: 'pharmacy_email_updated',
        performed_by: 'manager',
        details: { old: oldEmail, new: body.pharmacyEmail },
      });
    }
    res.json({
      ok: true,
      pharmacySize: data?.pharmacy_size || null,
      pharmacyEmail: data?.manager_email || null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[auth] pharmacy/settings failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Export all pharmacy data (manager only) ─────────────────
// NZ Privacy Act 2020 — pharmacies have the right to a copy of
// their own data. One JSON file containing everything they own:
// profile, incidents, recommendations, reports, interventions,
// custom chips, trusted devices, and the full audit log. Password
// hashes and security tokens are excluded — they're ours, not
// theirs, and surfacing them is a leak risk for no upside.
router.get('/pharmacy/export', authenticate, requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const pharmacyId = req.auth!.pharmacyId;

    const [pharmacy, incidents, recommendations, reports, interventions, customOptions, trustedDevices, auditLog] = await Promise.all([
      supabase.from('pharmacies')
        .select('id, name, address, licence_number, manager_email, manager_name, phone, pharmacy_size, subscription_status, created_at, trial_ends_at, applied_at, approved_at, signup_notes, signup_source')
        .eq('id', pharmacyId).single(),
      supabase.from('incidents').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }),
      supabase.from('recommendations').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }),
      supabase.from('reports').select('*').eq('pharmacy_id', pharmacyId).order('period_end', { ascending: false }),
      supabase.from('pattern_interventions').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }),
      supabase.from('pharmacy_custom_options').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }),
      supabase.from('trusted_devices').select('id, device_label, first_approved_at, last_used_at').eq('pharmacy_id', pharmacyId).order('first_approved_at', { ascending: false }),
      supabase.from('audit_log').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }),
    ]);

    const exportData = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        exported_by: req.auth!.role,
        format_version: 1,
        notes: 'Full data export for this pharmacy from NearMissPro. Password hashes and security tokens are intentionally excluded.',
      },
      pharmacy: pharmacy.data,
      incidents: incidents.data || [],
      recommendations: recommendations.data || [],
      reports: reports.data || [],
      pattern_interventions: interventions.data || [],
      custom_options: customOptions.data || [],
      trusted_devices: trustedDevices.data || [],
      audit_log: auditLog.data || [],
    };

    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacyId,
      action: 'data_exported',
      performed_by: req.auth!.role,
      details: {
        incident_count: exportData.incidents.length,
        report_count: exportData.reports.length,
      },
    });

    const safeName = (pharmacy.data?.name || 'pharmacy').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nearmisspro-export-${safeName}-${today}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error('[auth] pharmacy/export failed:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ── Request pharmacy deletion (manager only) ────────────────
// Privacy Act 2020 — pharmacies have the right to ask for their
// account and data to be deleted. We don't destroy anything
// automatically; we mark the pharmacy as deletion-requested, audit
// the request, and email the founder. The founder does the actual
// delete by hand in Supabase within the policy window (currently
// 12 months per the Privacy page). The pharmacy keeps working
// until then — they can change their mind by emailing us.
router.post('/pharmacy/request-deletion', authenticate, requireRole('manager', 'founder'), async (req: Request, res: Response) => {
  try {
    const { confirmName, confirmDownloaded } = z.object({
      confirmName: z.string().min(1),
      confirmDownloaded: z.boolean().optional(),
    }).parse(req.body);
    const { data: pharmacy, error: readErr } = await supabase.from('pharmacies')
      .select('id, name, manager_email')
      .eq('id', req.auth!.pharmacyId).single();
    if (readErr || !pharmacy) { res.status(404).json({ error: 'Pharmacy not found' }); return; }
    if (confirmName.trim().toLowerCase() !== pharmacy.name.toLowerCase()) {
      res.status(400).json({
        error: 'name_mismatch',
        message: 'The pharmacy name you typed doesn\'t match. To confirm deletion, type the pharmacy name exactly as it appears in your account.',
      });
      return;
    }
    const requestedAt = new Date().toISOString();
    await supabase.from('pharmacies').update({
      deletion_requested_at: requestedAt,
      deletion_requested_by: pharmacy.manager_email || 'manager',
    }).eq('id', pharmacy.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'pharmacy_deletion_requested',
      performed_by: 'manager',
      details: {
        requested_at: requestedAt,
        requested_by: pharmacy.manager_email || 'manager',
        confirmed_downloaded: confirmDownloaded === true,
      },
    });
    if (env.founderEmail) {
      sendEmail({
        to: env.founderEmail,
        subject: `Account deletion requested: ${pharmacy.name}`,
        text: `${pharmacy.name} (${pharmacy.manager_email || 'no email on file'}) has requested account deletion via the in-app button at ${requestedAt}.\n\nReview and delete the row in Supabase when ready.\n\n— NearMissPro`,
        html: `<p><strong>${escapeHtml(pharmacy.name)}</strong> (${escapeHtml(pharmacy.manager_email || 'no email on file')}) has requested account deletion via the in-app button at ${escapeHtml(requestedAt)}.</p><p>Review and delete the row in Supabase when ready.</p><p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[pharmacy/request-deletion] founder notify failed:', err));
    }
    if (pharmacy.manager_email) {
      sendEmail({
        to: pharmacy.manager_email,
        subject: `${pharmacy.name}: NearMissPro deletion request received`,
        text: `Hi,\n\nWe've received your request to delete the NearMissPro account for ${pharmacy.name}. We'll action this within the next few working days.\n\nYou can keep using the account until then. If you change your mind, just email hello@nearmisspro.co.nz.\n\n— NearMissPro`,
        html: `<p>Hi,</p><p>We've received your request to delete the NearMissPro account for <strong>${escapeHtml(pharmacy.name)}</strong>. We'll action this within the next few working days.</p><p>You can keep using the account until then. If you change your mind, just email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p><p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[pharmacy/request-deletion] pharmacy notify failed:', err));
    }
    res.json({ ok: true, requested_at: requestedAt });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[auth] pharmacy/request-deletion failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Founder: create pharmacy ────────────────────────────────
router.post('/pharmacies', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(1).max(120),
      password: z.string().min(8).max(200),
      pharmacyEmail: z.string().email().max(200),
      address: z.string().max(300).optional(),
      licenceNumber: z.string().max(50).optional(),
    }).parse(req.body);

    const { data: pharmacy, error } = await supabase.from('pharmacies').insert({
      name: data.name,
      password_hash: await bcrypt.hash(data.password, 12),
      manager_email: data.pharmacyEmail,
      address: data.address,
      licence_number: data.licenceNumber,
    }).select().single();

    if (error) {
      if (error.code === '23505') { res.status(409).json({ error: 'Pharmacy name already exists' }); return; }
      throw error;
    }

    await supabase.from('audit_log').insert({ pharmacy_id: pharmacy.id, action: 'pharmacy_created', performed_by: 'founder', details: { name: data.name } });
    console.log(`[EMAIL] To: ${data.pharmacyEmail} | Subject: Welcome to NearMiss Pro | Body: Your pharmacy "${data.name}" is set up. Login at ${env.clientUrl}`);

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
      .select('id, name, manager_email, manager_name, phone, address, licence_number, subscription_status, created_at, trial_ends_at, applied_at, approved_at, declined_at, decline_reason, signup_notes, signup_source, pharmacy_size')
      .order('applied_at', { ascending: false, nullsFirst: false })
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

// ── Founder: reset a pharmacy's password ────────────────────
// Last-resort recovery for the cases that self-service email reset
// can't cover: pharmacy email is wrong/lost, the inbox owner went
// rogue, manager left without handover, etc. Generates a random
// 12-char temporary password, returns it ONCE to the founder
// (never stored in plaintext), and clears the lockout state so
// the pharmacy isn't blocked from logging in. Audit-logged so
// every founder intervention is traceable.
router.post('/pharmacies/:id/reset-password', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    // Reasonably memorable temp password — 12 chars, mixed case + digits,
    // generated server-side so the founder doesn't pick something weak.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let tempPassword = '';
    for (let i = 0; i < 12; i++) {
      tempPassword += alphabet[bytes[i] % alphabet.length];
    }
    const { data: pharmacy } = await supabase.from('pharmacies').select('id, name').eq('id', req.params.id).single();
    if (!pharmacy) { res.status(404).json({ error: 'Pharmacy not found' }); return; }
    await supabase.from('pharmacies').update({
      password_hash: await bcrypt.hash(tempPassword, 12),
      login_attempts: 0,
      locked_until: null,
    }).eq('id', req.params.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: req.params.id,
      action: 'founder_password_reset',
      performed_by: 'founder',
      details: {},
    });
    res.json({ ok: true, pharmacyName: pharmacy.name, temporaryPassword: tempPassword });
  } catch (err) {
    console.error('[founder reset] failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Founder: approve a pending signup ─────────────────────
// Flips a pending_approval pharmacy to 'trial', generates a
// one-time setup token, emails the pharmacy a link to set their
// first password. After they click and set the password, they can
// log in normally.
router.post('/pharmacies/:id/approve', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    const { data: pharmacy } = await supabase.from('pharmacies')
      .select('id, name, manager_email, manager_name, subscription_status')
      .eq('id', req.params.id).single();
    if (!pharmacy) { res.status(404).json({ error: 'Pharmacy not found' }); return; }
    if (pharmacy.subscription_status !== 'pending_approval') {
      res.status(400).json({ error: `Cannot approve — pharmacy is in ${pharmacy.subscription_status} status, not pending.` });
      return;
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(); // 7 days
    const { error: insertErr } = await supabase.from('password_setup_tokens').insert({
      pharmacy_id: pharmacy.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertErr) {
      console.error('[approve] could not insert setup token — has migrate_self_serve_signup.sql been run?', insertErr);
      res.status(500).json({ error: 'Could not generate setup link. Check server logs.' });
      return;
    }
    // Marketing everywhere promises a 3-month free trial. The schema
    // default for trial_ends_at is 30 days from row INSERT (i.e. from
    // signup time), which both undershoots the promise and loses any
    // days spent waiting for founder review. Set it explicitly here.
    const trialEndsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('pharmacies').update({
      subscription_status: 'trial',
      approved_at: new Date().toISOString(),
      approved_by: 'founder',
      trial_ends_at: trialEndsAt,
    }).eq('id', pharmacy.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'pharmacy_approved',
      performed_by: 'founder',
      details: { name: pharmacy.name },
    });
    if (pharmacy.manager_email) {
      const setupUrl = `${env.clientUrl}/setup-password?token=${token}`;
      const greeting = pharmacy.manager_name ? `Hi ${escapeHtml(pharmacy.manager_name)},` : 'Hi,';
      sendEmail({
        to: pharmacy.manager_email,
        subject: `You're approved — set your NearMissPro password to get started`,
        text: `${pharmacy.manager_name ? `Hi ${pharmacy.manager_name},` : 'Hi,'}

Your NearMissPro account for ${pharmacy.name} has been approved.

Click the link below to set your pharmacy password and log in for the first time. The link is valid for 7 days.

${setupUrl}

Once you're in, you'll get a 3-month free trial. No payment method is needed during the trial.

If you need help, email hello@nearmisspro.co.nz.

— NearMissPro`,
        html: `<p>${greeting}</p>
<p>Your NearMissPro account for <strong>${escapeHtml(pharmacy.name)}</strong> has been approved.</p>
<p>Click below to set your pharmacy password and log in for the first time. The link is valid for 7 days.</p>
<p><a href="${setupUrl}" style="display:inline-block;background:#0F6E56;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Set your password</a></p>
<p>Once you're in, you'll get a 3-month free trial. No payment method is needed during the trial.</p>
<p style="color:#666;font-size:13px">If you need help, email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[approve] email failed:', err));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[approve] failed:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// ── Founder: decline a pending signup ─────────────────────
router.post('/pharmacies/:id/decline', authenticate, requireRole('founder'), async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body);
    const { data: pharmacy } = await supabase.from('pharmacies')
      .select('id, name, manager_email, manager_name, subscription_status')
      .eq('id', req.params.id).single();
    if (!pharmacy) { res.status(404).json({ error: 'Pharmacy not found' }); return; }
    if (pharmacy.subscription_status !== 'pending_approval') {
      res.status(400).json({ error: `Cannot decline — pharmacy is in ${pharmacy.subscription_status} status, not pending.` });
      return;
    }
    await supabase.from('pharmacies').update({
      subscription_status: 'declined',
      declined_at: new Date().toISOString(),
      decline_reason: reason || null,
    }).eq('id', pharmacy.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'pharmacy_declined',
      performed_by: 'founder',
      details: { name: pharmacy.name, reason: reason || null },
    });
    if (pharmacy.manager_email) {
      const greeting = pharmacy.manager_name ? `Hi ${escapeHtml(pharmacy.manager_name)},` : 'Hi,';
      const reasonBlock = reason ? `\n\nReason: ${reason}\n` : '';
      const reasonHtml = reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : '';
      sendEmail({
        to: pharmacy.manager_email,
        subject: `Update on your NearMissPro application`,
        text: `${pharmacy.manager_name ? `Hi ${pharmacy.manager_name},` : 'Hi,'}

Thank you for your interest in NearMissPro for ${pharmacy.name}.

After review, we're not able to approve your account at this time.${reasonBlock}

If you'd like to discuss or you think this is a mistake, please email hello@nearmisspro.co.nz.

— NearMissPro`,
        html: `<p>${greeting}</p>
<p>Thank you for your interest in NearMissPro for <strong>${escapeHtml(pharmacy.name)}</strong>.</p>
<p>After review, we're not able to approve your account at this time.</p>
${reasonHtml}
<p>If you'd like to discuss or you think this is a mistake, please email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>
<p style="color:#999;font-size:12px">— NearMissPro</p>`,
      }).catch(err => console.error('[decline] email failed:', err));
    }
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[decline] failed:', err);
    res.status(500).json({ error: 'Decline failed' });
  }
});

// ── Set initial password (after approval) ──────────────────
// Consumes the one-time setup token from the approval email,
// stores the password, marks the token used, and returns a staff
// JWT so the user is logged in immediately.
router.post('/set-initial-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = z.object({
      token: z.string().min(20).max(200),
      password: z.string().min(8).max(200),
    }).parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: row } = await supabase.from('password_setup_tokens')
      .select('id, pharmacy_id, expires_at, used_at')
      .eq('token_hash', tokenHash).single();
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      res.status(400).json({ error: 'This setup link is no longer valid. Contact hello@nearmisspro.co.nz to get a fresh one.' });
      return;
    }
    const { data: pharmacy } = await supabase.from('pharmacies')
      .select('id, name').eq('id', row.pharmacy_id).single();
    if (!pharmacy) { res.status(400).json({ error: 'Pharmacy not found' }); return; }
    await supabase.from('pharmacies').update({
      password_hash: await bcrypt.hash(password, 12),
      login_attempts: 0,
      locked_until: null,
    }).eq('id', row.pharmacy_id);
    await supabase.from('password_setup_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    await supabase.from('audit_log').insert({
      pharmacy_id: row.pharmacy_id,
      action: 'initial_password_set',
      performed_by: 'self-service',
      details: {},
    });
    // Log them in immediately so they don't have to type the password
    // they JUST chose — saves a step on first impression.
    const jwtToken = jwt.sign(
      { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, role: 'staff' },
      env.jwtSecret, { expiresIn: '7d' } as jwt.SignOptions
    );
    res.json({ ok: true, token: jwtToken, role: 'staff', pharmacyName: pharmacy.name, pharmacyId: pharmacy.id });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    console.error('[set-initial-password] failed:', err);
    res.status(500).json({ error: 'Setup failed — try the link again.' });
  }
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
      .select('id, name, manager_email')
      .ilike('name', escapeLike(pharmacyName)).single();
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
    await sendEmail({
      to: pharmacy.manager_email,
      subject: `Reset your NearMissPro password`,
      text: `Hi,

We received a request to reset the password for ${pharmacy.name}.

Set a new password using this link (expires in 60 minutes):
${resetUrl}

If you didn't ask to reset, ignore this email — your current password is unchanged.

— NearMissPro`,
      html: `<p>Hi,</p>
<p>We received a request to reset the password for <strong>${escapeHtml(pharmacy.name)}</strong>.</p>
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
