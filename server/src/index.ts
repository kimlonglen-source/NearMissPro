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

// Trust the first proxy in front of us (Render, Vercel, etc.) so
// req.ip reads the real client IP from X-Forwarded-For instead of the
// proxy's own address. Needed for the per-pharmacy IP-allowlist
// feature; harmless in dev where there is no proxy.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30, message: { error: 'Too many attempts' } });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/options', optionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/marketing', authLimiter, marketingRoutes);
app.use('/api/custom-options', customOptionRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

app.listen(env.port, () => console.log(`NearMissPro server on port ${env.port}`));

export default app;
