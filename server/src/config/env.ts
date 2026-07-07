import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.APP_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-min-32-chars-change-in-prod!!',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  founderEmail: process.env.FOUNDER_EMAIL || '',
  // Founder password + TOTP secret. When either is empty the
  // server falls back to dev-mode credentials ('founder123' /
  // accept any 6 digits) so localhost stays frictionless. Both
  // MUST be set on any deployed instance — otherwise the founder
  // login is essentially open. Use `npm run founder-setup` from
  // the server folder to generate a strong pair.
  founderPassword: process.env.FOUNDER_PASSWORD || '',
  founderTotpSecret: process.env.FOUNDER_TOTP_SECRET || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsS3Bucket: process.env.AWS_S3_BUCKET || '',
  // SMTP credentials for transactional emails (password resets, etc.).
  // Set to Zoho values in production. When SMTP_HOST is empty the
  // email service falls back to console.log so local dev keeps
  // working without burning real email sends.
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'hello@nearmisspro.co.nz',
} as const;

// Safety gate. The dev fallbacks above (default JWT secret, founder123
// password, accept-any-MFA) are intentional conveniences for localhost.
// On a deployed instance they'd leave founder login and token signing
// wide open — so refuse to start if they're still at their defaults
// whenever the app is NOT clearly running on localhost. This deliberately
// does NOT rely on NODE_ENV alone: forgetting to set NODE_ENV=production
// on a real host must not silently re-enable the defaults. Fail loud at
// boot, never silently run insecure.
const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(env.clientUrl);
if (env.nodeEnv === 'production' || !isLocalhost) {
  const problems: string[] = [];
  if (!process.env.JWT_SECRET || env.jwtSecret.startsWith('dev-secret')) {
    problems.push('JWT_SECRET is missing or still the dev default');
  }
  if (env.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters');
  }
  if (!env.founderPassword) {
    problems.push('FOUNDER_PASSWORD is not set (founder login would accept "founder123")');
  }
  if (!env.founderTotpSecret) {
    problems.push('FOUNDER_TOTP_SECRET is not set (founder MFA would accept any 6 digits)');
  }
  if (problems.length > 0) {
    console.error('\nRefusing to start — insecure production configuration:');
    for (const p of problems) console.error(`  • ${p}`);
    console.error('\nSet these in the server environment and restart.\n');
    process.exit(1);
  }
}
