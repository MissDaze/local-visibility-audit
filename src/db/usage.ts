import { pool } from './pool';
import { findTenantById } from './tenants';
import { getSubscriptionForTenant, getPricingTier } from './subscriptions';

function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

async function getOrCreateUsageCounter(tenantId: string, periodStart: string): Promise<{ reports_used: number; bundle_reports_remaining: number }> {
  const { rows } = await pool.query<{ reports_used: number; bundle_reports_remaining: number }>(
    `INSERT INTO usage_counters (tenant_id, period_start, reports_used, bundle_reports_remaining)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (tenant_id, period_start) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
     RETURNING reports_used, bundle_reports_remaining`,
    [tenantId, periodStart],
  );
  return rows[0];
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
}

// Only meaningful when BILLING_ENABLED=true — the caller (requireQuota
// middleware) skips this entirely otherwise, which is why the internal/demo
// deployment (BILLING_ENABLED=false) is unaffected by any of this.
//
// Trial handling: there's no separate "trial quota" in the pricing doc, so
// as a working default, an active trial (tenant.trial_ends_at in the
// future) is capped at the Solo Operator monthly allowance (30 reports).
// This is a technical default, not a pricing decision — easy to change
// later without touching the pricing_tiers table itself.
export async function checkAndReserveQuota(tenantId: string, count = 1): Promise<QuotaCheckResult> {
  const tenant = await findTenantById(tenantId);
  if (!tenant) return { allowed: false, reason: 'Account not found.' };

  const subscription = await getSubscriptionForTenant(tenantId);
  const isActiveSubscription = subscription?.status === 'active' && subscription.tier_id;
  const isOnTrial = new Date(tenant.trial_ends_at) > new Date();

  let quota: number;
  if (isActiveSubscription) {
    const tier = await getPricingTier(subscription!.tier_id!);
    if (!tier) return { allowed: false, reason: 'Your subscription tier could not be found — contact support.' };
    quota = tier.reports_per_month;
  } else if (isOnTrial) {
    const soloTier = await getPricingTier('solo');
    quota = soloTier?.reports_per_month ?? 30;
  } else {
    return { allowed: false, reason: 'Your free trial has ended. Subscribe to keep generating reports.' };
  }

  const periodStart = currentPeriodStart();
  const usage = await getOrCreateUsageCounter(tenantId, periodStart);
  const remaining = quota + usage.bundle_reports_remaining - usage.reports_used;

  if (remaining < count) {
    return { allowed: false, reason: `You only have ${Math.max(remaining, 0)} report(s) left in your monthly quota. Upgrade your plan or wait for it to reset next billing cycle.` };
  }

  await pool.query(
    `UPDATE usage_counters SET reports_used = reports_used + $3 WHERE tenant_id = $1 AND period_start = $2`,
    [tenantId, periodStart, count],
  );

  return { allowed: true };
}
