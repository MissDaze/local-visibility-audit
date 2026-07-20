import { pool } from './pool';

export interface PricingTier {
  tier_id: string;
  name: string;
  reports_per_month: number;
  monthly_price_cents: number;
  annual_price_cents: number;
  bundle_size: number;
  bundle_price_cents: number;
  sort_order: number;
  square_monthly_plan_id: string | null;
  square_annual_plan_id: string | null;
}

export interface SubscriptionRow {
  tenant_id: string;
  tier_id: string | null;
  billing_cycle: 'monthly' | 'annual' | null;
  square_customer_id: string | null;
  square_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
}

export async function listPricingTiers(): Promise<PricingTier[]> {
  const { rows } = await pool.query<PricingTier>(`SELECT * FROM pricing_tiers ORDER BY sort_order ASC`);
  return rows;
}

export async function getPricingTier(tierId: string): Promise<PricingTier | null> {
  const { rows } = await pool.query<PricingTier>(`SELECT * FROM pricing_tiers WHERE tier_id = $1`, [tierId]);
  return rows[0] ?? null;
}

export async function setSquarePlanIds(tierId: string, monthlyPlanId: string, annualPlanId: string): Promise<void> {
  await pool.query(
    `UPDATE pricing_tiers SET square_monthly_plan_id = $2, square_annual_plan_id = $3, updated_at = now() WHERE tier_id = $1`,
    [tierId, monthlyPlanId, annualPlanId],
  );
}

export async function getSubscriptionForTenant(tenantId: string): Promise<SubscriptionRow | null> {
  const { rows } = await pool.query<SubscriptionRow>(`SELECT * FROM subscriptions WHERE tenant_id = $1`, [tenantId]);
  return rows[0] ?? null;
}

export async function upsertPendingSubscription(
  tenantId: string,
  tierId: string,
  billingCycle: 'monthly' | 'annual',
  squareCustomerId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO subscriptions (tenant_id, tier_id, billing_cycle, square_customer_id, status, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       tier_id = EXCLUDED.tier_id,
       billing_cycle = EXCLUDED.billing_cycle,
       square_customer_id = EXCLUDED.square_customer_id,
       status = 'pending',
       updated_at = now()`,
    [tenantId, tierId, billingCycle, squareCustomerId],
  );
}

export async function findTenantIdBySquareCustomerId(squareCustomerId: string): Promise<string | null> {
  const { rows } = await pool.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM subscriptions WHERE square_customer_id = $1`,
    [squareCustomerId],
  );
  return rows[0]?.tenant_id ?? null;
}

export async function updateSubscriptionStatus(
  tenantId: string,
  fields: { squareSubscriptionId?: string; status?: string; currentPeriodEnd?: string | null; tierId?: string },
): Promise<void> {
  await pool.query(
    `UPDATE subscriptions SET
       square_subscription_id = COALESCE($2, square_subscription_id),
       status = COALESCE($3, status),
       current_period_end = COALESCE($4, current_period_end),
       tier_id = COALESCE($5, tier_id),
       updated_at = now()
     WHERE tenant_id = $1`,
    [tenantId, fields.squareSubscriptionId ?? null, fields.status ?? null, fields.currentPeriodEnd ?? null, fields.tierId ?? null],
  );
}
