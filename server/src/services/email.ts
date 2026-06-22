import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Lazy singleton — we don't build the transporter at import time so the
// module is safe to import in tests / scripts that don't set SMTP env.
let _transporter: nodemailer.Transporter | null = null;
function transporter(): nodemailer.Transporter | null {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPassword) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
  });
  return _transporter;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Send a transactional email via SMTP. Falls back to a console.log
// when SMTP env isn't configured so local dev keeps working — the
// "email" still goes somewhere visible (the server's stdout), which
// is enough to test the surrounding flow without an email account.
// Throws on real SMTP failures so callers can decide whether to
// surface them (we currently swallow on the forgot-password path so
// timing-based pharmacy enumeration isn't possible).
export async function sendEmail(email: OutboundEmail): Promise<void> {
  const t = transporter();
  if (!t) {
    console.log('[email:dev-fallback] would send', {
      to: email.to,
      subject: email.subject,
      preview: email.text.slice(0, 200),
    });
    return;
  }
  await t.sendMail({
    from: env.emailFrom,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

// Wrap user-controlled text for HTML email so we don't inject raw
// pharmacy names or manager names that happen to contain HTML.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
