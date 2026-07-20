import { Router, Request, Response } from 'express';
import { listPricingTiers } from '../db/subscriptions';

// Unauthenticated routes for the marketing site — no session required.
export const publicRouter = Router();

publicRouter.get('/pricing', async (_req: Request, res: Response) => {
  const tiers = await listPricingTiers();
  res.json({
    tiers: tiers.map(t => ({
      tierId: t.tier_id,
      name: t.name,
      reportsPerMonth: t.reports_per_month,
      monthlyPriceCents: t.monthly_price_cents,
      annualPriceCents: t.annual_price_cents,
      bundleSize: t.bundle_size,
      bundlePriceCents: t.bundle_price_cents,
    })),
  });
});
