import { pool } from './pool';

// Launch pricing for the agency-focused offer.
// Annual values retain a 20% discount for existing billing support, although
// new trial signups are enrolled on monthly billing by default.
const PRICING_SEED = [
  { tier_id: 'agency_starter', name: 'Agency Starter', reports_per_month: 60, monthly_price_cents: 9900, annual_price_cents: 95040, bundle_size: 10, bundle_price_cents: 1900, sort_order: 1 },
  { tier_id: 'agency_growth', name: 'Agency Growth', reports_per_month: 175, monthly_price_cents: 19900, annual_price_cents: 191040, bundle_size: 10, bundle_price_cents: 1900, sort_order: 2 },
  { tier_id: 'agency_scale', name: 'Agency Scale', reports_per_month: 450, monthly_price_cents: 39900, annual_price_cents: 383040, bundle_size: 10, bundle_price_cents: 1900, sort_order: 3 },
];

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT,
      plan_tier TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
      trial_reports_used INT NOT NULL DEFAULT 0,
      brand_logo BYTEA,
      brand_logo_mime TEXT,
      brand_written_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL,
      city TEXT NOT NULL,
      industry TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      markdown TEXT,
      debug_json JSONB,
      error TEXT,
      written_by TEXT,
      batch_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports(tenant_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS batches (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'running',
      total INT NOT NULL,
      completed INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS batch_items (
      id UUID PRIMARY KEY,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
      business_name TEXT NOT NULL,
      city TEXT NOT NULL,
      industry TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      status_detail TEXT,
      position INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id, position);

    CREATE TABLE IF NOT EXISTS usage_counters (
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      reports_used INT NOT NULL DEFAULT 0,
      bundle_reports_remaining INT NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, period_start)
    );

    CREATE TABLE IF NOT EXISTS pricing_tiers (
      tier_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      reports_per_month INT NOT NULL,
      monthly_price_cents INT NOT NULL,
      annual_price_cents INT NOT NULL,
      bundle_size INT NOT NULL DEFAULT 10,
      bundle_price_cents INT NOT NULL,
      sort_order INT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      square_monthly_plan_id TEXT,
      square_annual_plan_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      tier_id TEXT REFERENCES pricing_tiers(tier_id),
      billing_cycle TEXT,
      square_customer_id TEXT,
      square_subscription_id TEXT,
      status TEXT NOT NULL DEFAULT 'trialing',
      current_period_end TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Additive, idempotent migrations — CREATE TABLE IF NOT EXISTS above only
  // applies to a fresh database, it won't alter tables that already exist
  // in production.
  await pool.query(`
    ALTER TABLE batch_items ADD COLUMN IF NOT EXISTS recipient_email TEXT;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_reports_used INT NOT NULL DEFAULT 0;
    ALTER TABLE tenants ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');
    ALTER TABLE pricing_tiers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE pricing_tiers ADD COLUMN IF NOT EXISTS square_application_id TEXT;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS square_application_id TEXT;

    -- Keep legacy tiers for any existing subscribers, but stop offering them
    -- to new customers.
    UPDATE pricing_tiers
      SET is_active = FALSE
      WHERE tier_id IN ('solo', 'freelancer', 'small_agency', 'med_agency', 'large_agency');
  `);

  // Square object IDs belong to the application/account that created them.
  // When credentials move to another Square application, discard all cached
  // provider IDs so startup can create fresh plans and customers instead of
  // sending old-account identifiers to the new account.
  const squareApplicationId = process.env.SQUARE_APPLICATION_ID;
  if (squareApplicationId) {
    await pool.query(
      `UPDATE pricing_tiers
         SET square_monthly_plan_id = NULL,
             square_annual_plan_id = NULL,
             square_application_id = NULL,
             updated_at = now()
         WHERE square_application_id IS DISTINCT FROM $1`,
      [squareApplicationId],
    );
    await pool.query(
      `UPDATE subscriptions
         SET square_customer_id = NULL,
             square_subscription_id = NULL,
             square_application_id = $1,
             status = CASE WHEN status IN ('active', 'canceling') THEN status ELSE 'trialing' END,
             current_period_end = CASE WHEN status IN ('active', 'canceling') THEN current_period_end ELSE NULL END,
             updated_at = now()
         WHERE square_application_id IS DISTINCT FROM $1`,
      [squareApplicationId],
    );
  }

  for (const t of PRICING_SEED) {
    await pool.query(
      `INSERT INTO pricing_tiers
        (tier_id, name, reports_per_month, monthly_price_cents, annual_price_cents, bundle_size, bundle_price_cents, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tier_id) DO UPDATE SET
         name = EXCLUDED.name,
         reports_per_month = EXCLUDED.reports_per_month,
         monthly_price_cents = EXCLUDED.monthly_price_cents,
         annual_price_cents = EXCLUDED.annual_price_cents,
         bundle_size = EXCLUDED.bundle_size,
         bundle_price_cents = EXCLUDED.bundle_price_cents,
         sort_order = EXCLUDED.sort_order,
         is_active = TRUE,
         updated_at = now()`,
      [t.tier_id, t.name, t.reports_per_month, t.monthly_price_cents, t.annual_price_cents, t.bundle_size, t.bundle_price_cents, t.sort_order],
    );
  }

  console.log('[db] schema ready');
}
