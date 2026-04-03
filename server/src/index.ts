import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import incidentRoutes from './routes/incidents.js';
import optionRoutes from './routes/options.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/options', optionRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.listen(env.port, () => {
  console.log(`NearMissPro server running on port ${env.port}`);
});

export default app;
