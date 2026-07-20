import { Request, Response, NextFunction } from 'express';
import { checkAndReserveQuota } from '../db/usage';

// No-op unless BILLING_ENABLED=true — the internal/demo deployment leaves
// this unset (false), so report generation there stays unlimited exactly
// as it was before billing existed. Only the customer-facing twin turns
// this on.
export function requireQuota(count = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.BILLING_ENABLED !== 'true') return next();

    const tenantId = req.session.tenantId!;
    const result = await checkAndReserveQuota(tenantId, count);
    if (!result.allowed) {
      res.status(402).json({ error: result.reason || 'Quota exceeded.' });
      return;
    }
    next();
  };
}
