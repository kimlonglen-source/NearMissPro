import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthPayload {
  pharmacyId: string;
  pharmacyName: string;
  role: 'staff' | 'manager' | 'founder';
  founderId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const token = header.slice(7);
    // Pin the algorithm — tokens are signed with HS256, so only accept HS256.
    // Without this, a token claiming a different algorithm would still be run
    // through verification, which is a known class of JWT bypass.
    req.auth = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    next();
  };
}
