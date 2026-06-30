import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { sendEmail, escapeHtml } from './email.js';

// Trial-end reminder buckets, in days remaining. Each pharmacy gets
// one email per bucket — checked via the audit log so we don't spam
// if they log in repeatedly inside a window. Buckets are picked from
// largest down so a manager catching up after a quiet stretch gets the
// most-urgent message rather than a stale one.
const BUCKETS = [14, 7, 3, 1, 0] as const;

function pickBucket(daysRemaining: number): number | null {
  if (daysRemaining < 0) return 0;
  for (const b of BUCKETS) {
    if (daysRemaining <= b) return b;
  }
  return null;
}

// Fire-and-forget. Called from the login path — must never throw or
// the login itself fails. Idempotent: if the bucket reminder has
// already been logged for this pharmacy, sends nothing.
export async function maybeSendTrialReminder(pharmacy: {
  id: string;
  name: string;
  manager_email: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
}): Promise<void> {
  try {
    if (pharmacy.subscription_status !== 'trial') return;
    if (!pharmacy.trial_ends_at || !pharmacy.manager_email) return;

    const endMs = new Date(pharmacy.trial_ends_at).getTime();
    if (!Number.isFinite(endMs)) return;
    const daysRemaining = Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysRemaining > 14) return;
    const bucket = pickBucket(daysRemaining);
    if (bucket === null) return;

    // Have we sent THIS bucket's reminder already?
    const { data: existing } = await supabase.from('audit_log')
      .select('id')
      .eq('pharmacy_id', pharmacy.id)
      .eq('action', 'trial_reminder_sent')
      .contains('details', { bucket })
      .limit(1);
    if (existing && existing.length > 0) return;

    const endDateLabel = new Date(pharmacy.trial_ends_at).toLocaleDateString('en-NZ', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const daysLabel = daysRemaining <= 0
      ? 'has ended'
      : daysRemaining === 1
        ? 'ends tomorrow'
        : `ends in ${daysRemaining} days`;
    const subject = daysRemaining <= 0
      ? `${pharmacy.name}: your NearMissPro trial has ended`
      : `${pharmacy.name}: your NearMissPro trial ${daysLabel}`;

    const text = `Hi,

Your NearMissPro free trial for ${pharmacy.name} ${daysLabel} (${endDateLabel}).

If you'd like to keep using NearMissPro after the trial, just reply to this email and we'll set up your subscription ($30/month or $300/year). No card needed yet — we'll send you the details.

If you don't want to continue, no action needed. Your account will become read-only when the trial ends. You can download a copy of your data any time from Settings → Pharmacy → Download my data.

— NearMissPro
${env.clientUrl}`;

    const html = `<p>Hi,</p>
<p>Your NearMissPro free trial for <strong>${escapeHtml(pharmacy.name)}</strong> ${escapeHtml(daysLabel)} (<strong>${escapeHtml(endDateLabel)}</strong>).</p>
<p>If you'd like to keep using NearMissPro after the trial, just reply to this email and we'll set up your subscription ($30/month or $300/year). No card needed yet — we'll send you the details.</p>
<p>If you don't want to continue, no action needed. Your account will become read-only when the trial ends. You can download a copy of your data any time from Settings → Pharmacy → Download my data.</p>
<p style="color:#999;font-size:12px">— NearMissPro<br/><a href="${env.clientUrl}">${env.clientUrl}</a></p>`;

    await sendEmail({ to: pharmacy.manager_email, subject, text, html });
    await supabase.from('audit_log').insert({
      pharmacy_id: pharmacy.id,
      action: 'trial_reminder_sent',
      performed_by: 'system',
      details: { bucket, days_remaining: daysRemaining, sent_to: pharmacy.manager_email },
    });
  } catch (err) {
    console.error('[trialReminders] failed:', err);
  }
}
