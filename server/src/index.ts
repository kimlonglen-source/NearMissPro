import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import incidentRoutes from './routes/incidents.js';
import optionRoutes from './routes/options.js';
import recommendationRoutes from './routes/recommendations.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import interventionRoutes from './routes/interventions.js';
import auditRoutes from './routes/audit.js';
import marketingRoutes from './routes/marketing.js';
import customOptionRoutes from './routes/customOptions.js';

const app = express();

// Only trust a forwarded client IP when actually deployed behind a proxy
// (Render, Vercel, etc.). In local dev there is no proxy, so trusting
// X-Forwarded-For would let any client spoof its IP and slip the rate
// limiters or forge the "IP address" shown in the device-approval email.
if (env.nodeEnv === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// 30 attempts per 15 min per IP is the right shape for the
// brute-force-vulnerable endpoints (login, forgot-password). But it's
// too tight for endpoints that get called frequently for legitimate
// reasons — specifically the device-verification polling loop fires
// every 5 seconds while the user waits on the "approve this device"
// screen. Skip the limiter for those endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  message: { error: 'Too many attempts' },
  skip: (req) => req.path === '/check-device-trust' || req.path === '/verify-device',
});

// Several write endpoints call the Anthropic API and so cost real money
// per request: each new near miss triggers a Claude recommendation,
// each report a period summary, each intervention/custom-chip a Claude
// check. A runaway client loop or abuse could quietly burn the API
// budget. Cap the *writes* generously — plenty for a busy dispensary
// day, low enough to stop a runaway. Reads (GET) are cheap and polled
// frequently by the dashboard, so they're skipped.
const aiLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 150,
  message: { error: 'Too many requests — please wait a few minutes and try again.' },
  skip: (req) => req.method === 'GET',
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/incidents', aiLimiter, incidentRoutes);
app.use('/api/options', optionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/reports', aiLimiter, reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/interventions', aiLimiter, interventionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/marketing', authLimiter, marketingRoutes);
app.use('/api/custom-options', aiLimiter, customOptionRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

app.listen(env.port, () => console.log(`NearMissPro server on port ${env.port}`));

export default app;
