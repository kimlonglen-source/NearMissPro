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
