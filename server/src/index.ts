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

const app = express();

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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

const server = app.listen(env.port, () => console.log(`NearMissPro server on port ${env.port}`));

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit if server hasn't closed within 5 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
