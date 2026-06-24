// Generates a strong founder password + a TOTP secret for MFA, and
// prints both alongside the otpauth URI for adding the secret to an
// authenticator app (Google Authenticator, 1Password, Authy, etc.).
//
// Run from the server folder:
//   npm run founder-setup
//
// Then copy the two FOUNDER_* lines into your env vars (server/.env
// locally, Render's Environment panel in production) and add the
// TOTP secret to your authenticator app.
import { authenticator } from 'otplib';
import crypto from 'crypto';

// 24 bytes -> 32 char base64url password. Long enough that even a
// targeted online brute-force is infeasible.
const password = crypto.randomBytes(24).toString('base64url');
const totpSecret = authenticator.generateSecret();
const otpauthUri = authenticator.keyuri('founder', 'NearMissPro', totpSecret);

console.log('');
console.log('════════════════════════════════════════════════════════');
console.log(' NearMissPro — founder credentials generated');
console.log('════════════════════════════════════════════════════════');
console.log('');
console.log(' 1. Add these two lines to your server/.env (and to');
console.log('    Render env vars when you host):');
console.log('');
console.log(`    FOUNDER_PASSWORD=${password}`);
console.log(`    FOUNDER_TOTP_SECRET=${totpSecret}`);
console.log('');
console.log(' 2. Add the TOTP secret to your authenticator app');
console.log('    (Google Authenticator / 1Password / Authy / etc.).');
console.log('');
console.log('    Option A — paste the URI below into a QR generator');
console.log('    (e.g. https://www.qr-code-generator.com) and scan');
console.log('    with your authenticator app:');
console.log('');
console.log(`    ${otpauthUri}`);
console.log('');
console.log('    Option B — add the account manually in your');
console.log('    authenticator app:');
console.log('');
console.log('      Account name: NearMissPro (founder)');
console.log(`      Secret:       ${totpSecret}`);
console.log('      Type:         Time-based (TOTP)');
console.log('');
console.log(' 3. Restart the server (Ctrl+C, then npm run dev) so');
console.log('    the new env vars are picked up.');
console.log('');
console.log(' 4. Test the login at /founder with:');
console.log(`      Email:    ${process.env.FOUNDER_EMAIL || 'your founder email from FOUNDER_EMAIL'}`);
console.log('      Password: (the FOUNDER_PASSWORD value above)');
console.log('      MFA:      (current 6-digit code from your auth app)');
console.log('');
console.log(' Save this output somewhere safe — the secret is only');
console.log(' shown once. To rotate, run this script again and');
console.log(' replace both env vars.');
console.log('════════════════════════════════════════════════════════');
console.log('');
