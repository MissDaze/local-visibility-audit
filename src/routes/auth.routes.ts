import { Router, Request, Response } from 'express';
import { createTenant, findTenantByEmail, findTenantById } from '../db/tenants';
import { hashPassword, verifyPassword } from '../auth/password';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/signup', async (req: Request, res: Response) => {
  const { email, password, companyName } = req.body as {
    email?: string; password?: string; companyName?: string;
  };

  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const existing = await findTenantByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists.' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const tenant = await createTenant(email, passwordHash, companyName);

  req.session.tenantId = tenant.id;
  res.json({ id: tenant.id, email: tenant.email, companyName: tenant.company_name });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const tenant = await findTenantByEmail(email);
  if (!tenant || !(await verifyPassword(password, tenant.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  req.session.tenantId = tenant.id;
  res.json({ id: tenant.id, email: tenant.email, companyName: tenant.company_name });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get('/me', async (req: Request, res: Response) => {
  if (!req.session?.tenantId) {
    res.status(401).json({ error: 'Not logged in.' });
    return;
  }
  const tenant = await findTenantById(req.session.tenantId);
  if (!tenant) {
    res.status(401).json({ error: 'Not logged in.' });
    return;
  }
  res.json({
    id: tenant.id,
    email: tenant.email,
    companyName: tenant.company_name,
    planTier: tenant.plan_tier,
    trialEndsAt: tenant.trial_ends_at,
    writtenBy: tenant.brand_written_by,
  });
});
