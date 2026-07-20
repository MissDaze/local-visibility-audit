import { pool } from './pool';

// Suggested-target figures from the pricing doc (2026-07-19 draft) for the
// tiers marked TBC there. Solo Operator is the only figure the user has
// actually confirmed; the rest are seeded so Square plans + quota
// enforcement have something to run against, and are editable via this
// table afterwards (not hardcoded into billing logic).
const PRICING_SEED = [
  { tier_id: 'solo', name: 'Solo Operator', reports_per_month: 30, monthly_price_cents: 4495, annual_price_cents: 43152, bundle_size: 10, bundle_price_cents: 2750, sort_order: 1 },
  { tier_id: 'freelancer', name: 'Freelancer', reports_per_month: 90, monthly_price_cents: 11595, annual_price_cents: 111312, bundle_size: 10, bundle_price_cents: 2300, sort_order: 2 },
  { tier_id: 'small_agency', name: 'Small Agency', reports_per_month: 150, monthly_price_cents: 16695, annual_price_cents: 160272, bundle_size: 10, bundle_price_cents: 1900, sort_order: 3 },
  { tier_id: 'med_agency', name: 'Med Agency', reports_per_month: 360, monthly_price_cents: 32395, annual_price_cents: 310992, bundle_size: 10, bundle_price_cents: 1695, sort_order: 4 },
  { tier_id: 'large_agency', name: 'Large Agency', reports_per_month: 750, monthly_price_cents: 56395, annual_price_cents: 541392, bundle_size: 10, bundle_price_cents: 1395, sort_order: 5 },
];

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT,
      plan_tier TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
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
  `);

  for (const t of PRICING_SEED) {
    await pool.query(
      `INSERT INTO pricing_tiers
        (tier_id, name, reports_per_month, monthly_price_cents, annual_price_cents, bundle_size, bundle_price_cents, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tier_id) DO NOTHING`,
      [t.tier_id, t.name, t.reports_per_month, t.monthly_price_cents, t.annual_price_cents, t.bundle_size, t.bundle_price_cents, t.sort_order],
    );
  }

  console.log('[db] schema ready');
}
