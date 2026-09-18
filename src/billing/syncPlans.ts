import { listPricingTiers, setSquarePlanIds } from '../db/subscriptions';
import { createSquareSubscriptionPlan, squareConfigured } from './square';

const CURRENCY = process.env.SQUARE_CURRENCY || 'AUD';
const SQUARE_PLAN_VERSION = 'monthly-after-7-day-free-v2';

// Mirrors any pricing_tiers rows that don't yet have Square plan IDs into
// Square's Catalog. pricing_tiers stays the editable source of truth — this
// just keeps Square in sync with it, and is safe to re-run (only touches
// tiers still missing an ID).
export async function syncPricingPlansToSquare(): Promise<void> {
  if (process.env.BILLING_ENABLED !== 'true' || !squareConfigured()) return;

  const squareApplicationId = process.env.SQUARE_APPLICATION_ID;
  if (!squareApplicationId) {
    console.error('[billing] SQUARE_APPLICATION_ID is required to safely scope Square plan IDs.');
    return;
  }

  const tiers = await listPricingTiers();
  for (const tier of tiers) {
    const belongsToCurrentApplication = tier.square_application_id === squareApplicationId;
    const usesCurrentPlanSchema = tier.square_plan_version === SQUARE_PLAN_VERSION;
    if (
      belongsToCurrentApplication &&
      usesCurrentPlanSchema &&
      tier.square_monthly_plan_id &&
      tier.square_annual_plan_id
    ) continue;

    try {
      const result = await createSquareSubscriptionPlan(
        tier.name,
        tier.monthly_price_cents,
        tier.annual_price_cents,
        CURRENCY,
      );
      await setSquarePlanIds(
        tier.tier_id,
        result.monthlyVariationId,
        result.annualVariationId,
        squareApplicationId,
        SQUARE_PLAN_VERSION,
      );
      console.log(`[billing] synced Square plan for tier "${tier.tier_id}"`);
    } catch (e: unknown) {
      console.error(`[billing] failed to sync Square plan for tier "${tier.tier_id}":`, e instanceof Error ? e.message : e);
    }
  }
}
