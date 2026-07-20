import { Request, Response, NextFunction } from 'express';

// Replaces the old shared-code demoGate: every audit/report/batch/branding
// route now requires a logged-in tenant session instead of one access code
// shared across all users.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.tenantId) return next();
  return res.status(401).json({ error: 'Login required.' });
}
