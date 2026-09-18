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

const TRIAL_REPORT_LIMIT = 5;

// Comma-separated allowlist for internal/admin accounts.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export async function checkAndReserveQuota(tenantId: string, count = 1): Promise<QuotaCheckResult> {
  const tenant = await findTenantById(tenantId);
  if (!tenant) return { allowed: false, reason: 'Account not found.' };

  if (ADMIN_EMAILS.includes(tenant.email.toLowerCase())) return { allowed: true };

  const subscription = await getSubscriptionForTenant(tenantId);
  const isOnTrial = new Date(tenant.trial_ends_at) > new Date();

  if (isOnTrial) {
    // Trial access only starts once Square has created the subscription and
    // stored the customer's payment method through hosted checkout.
    const cardBackedTrial =
      !!subscription?.square_subscription_id &&
      (subscription.status === 'active' || subscription.status === 'pending');

    if (!cardBackedTrial) {
      return {
        allowed: false,
        reason: 'Complete subscription setup to activate your 7-day free trial. Your card will not be charged until the trial ends.',
      };
    }

    const { rows } = await pool.query<{ trial_reports_used: number }>(
      `UPDATE tenants
       SET trial_reports_used = trial_reports_used + $2
       WHERE id = $1 AND trial_reports_used + $2 <= $3
       RETURNING trial_reports_used`,
      [tenantId, count, TRIAL_REPORT_LIMIT],
    );

    if (!rows.length) {
      return {
        allowed: false,
        reason: 'Your free trial includes 5 reports. Monthly billing begins automatically when the 7-day trial ends.',
      };
    }

    return { allowed: true };
  }

  const isActiveSubscription = subscription?.status === 'active' && subscription.tier_id;
  if (!isActiveSubscription) {
    return { allowed: false, reason: 'Your free trial has ended. An active subscription is required to keep generating reports.' };
  }

  const tier = await getPricingTier(subscription!.tier_id!);
  if (!tier) return { allowed: false, reason: 'Your subscription tier could not be found — contact support.' };

  const periodStart = currentPeriodStart();
  const usage = await getOrCreateUsageCounter(tenantId, periodStart);
  const remaining = tier.reports_per_month + usage.bundle_reports_remaining - usage.reports_used;

  if (remaining < count) {
    return { allowed: false, reason: `You only have ${Math.max(remaining, 0)} report(s) left in your monthly quota. Upgrade your plan or wait for it to reset next billing cycle.` };
  }

  await pool.query(
    `UPDATE usage_counters SET reports_used = reports_used + $3 WHERE tenant_id = $1 AND period_start = $2`,
    [tenantId, periodStart, count],
  );

  return { allowed: true };
}
