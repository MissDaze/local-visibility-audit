import { Request, Response, NextFunction } from 'express';

// Gates the audit endpoint behind a shared access code so anonymous
// visitors can't burn the configured Outscraper/OpenRouter keys. Fails
// closed: if DEMO_ACCESS_CODE isn't set, every request is rejected.
export function demoGate(req: Request, res: Response, next: NextFunction) {
  const code = process.env.DEMO_ACCESS_CODE;
  if (code && req.headers['x-demo-code'] === code) return next();
  return res.status(401).json({ error: 'Demo access code required.', gated: true });
}
