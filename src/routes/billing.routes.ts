import { Router, Request, Response } from 'express';
import {
  listPricingTiers,
  getPricingTier,
  getSubscriptionForTenant,
  upsertPendingSubscription,
  findTenantIdBySquareCustomerId,
  updateSubscriptionStatus,
} from '../db/subscriptions';
import { findTenantById } from '../db/tenants';
import {
  findOrCreateSquareCustomer,
  createSubscriptionCheckoutLink,
  verifyWebhookSignature,
  squareConfigured,
} from '../billing/square';

export const billingRouter = Router();

const CURRENCY = process.env.SQUARE_CURRENCY || 'AUD';

billingRouter.get('/pricing', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const tiers = await listPricingTiers();
  const subscription = await getSubscriptionForTenant(tenantId);
  res.json({
    billingEnabled: process.env.BILLING_ENABLED === 'true',
    tiers: tiers.map(t => ({
      tierId: t.tier_id,
      name: t.name,
      reportsPerMonth: t.reports_per_month,
      monthlyPriceCents: t.monthly_price_cents,
      annualPriceCents: t.annual_price_cents,
      bundleSize: t.bundle_size,
      bundlePriceCents: t.bundle_price_cents,
    })),
    subscription: subscription ? {
      tierId: subscription.tier_id,
      billingCycle: subscription.billing_cycle,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    } : null,
  });
});

billingRouter.post('/checkout', async (req: Request, res: Response) => {
  if (process.env.BILLING_ENABLED !== 'true' || !squareConfigured()) {
    res.status(503).json({ error: 'Billing is not enabled on this deployment.' });
    return;
  }

  const tenantId = req.session.tenantId!;
  const { tierId, billingCycle } = req.body as { tierId?: string; billingCycle?: 'monthly' | 'annual' };

  if (!tierId || (billingCycle !== 'monthly' && billingCycle !== 'annual')) {
    res.status(400).json({ error: 'tierId and billingCycle ("monthly" or "annual") are required.' });
    return;
  }

  const tier = await getPricingTier(tierId);
  if (!tier) {
    res.status(404).json({ error: 'Unknown pricing tier.' });
    return;
  }
  const planVariationId = billingCycle === 'monthly' ? tier.square_monthly_plan_id : tier.square_annual_plan_id;
  if (!planVariationId) {
    res.status(503).json({ error: 'This plan is not yet available for checkout — try again shortly.' });
    return;
  }

  const tenant = await findTenantById(tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  try {
    const squareCustomerId = await findOrCreateSquareCustomer(tenantId, tenant.email);
    await upsertPendingSubscription(tenantId, tierId, billingCycle, squareCustomerId);

    const priceCents = billingCycle === 'monthly' ? tier.monthly_price_cents : tier.annual_price_cents;
    const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

    const url = await createSubscriptionCheckoutLink({
      squareCustomerId,
      planVariationId,
      displayName: `${tier.name} — ${billingCycle === 'monthly' ? 'Monthly' : 'Annual'}`,
      priceCents,
      currency: CURRENCY,
      redirectUrl: `${baseUrl}/dashboard.html?checkout=success`,
    });

    res.json({ url });
  } catch (e: unknown) {
    console.error('[billing] checkout failed:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Mounted separately in server.ts with express.raw() BEFORE the global JSON
// body parser — signature verification needs the exact raw bytes Square
// signed, which a JSON-parsed-then-restringified body won't reliably match.
export async function handleSquareWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = req.body as Buffer;
  const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const notificationUrl = `${baseUrl}/api/billing/webhook`;
  const signature = req.header('x-square-hmacsha256-signature');

  if (!verifyWebhookSignature(notificationUrl, rawBody, signature)) {
    console.warn('[billing] webhook signature verification failed');
    res.status(401).send('Invalid signature');
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }

  console.log(`[billing] webhook received: ${event.type}`);

  try {
    if (event.type?.startsWith('subscription.')) {
      const sub = event.data?.object?.subscription;
      if (sub?.customer_id) {
        const tenantId = await findTenantIdBySquareCustomerId(sub.customer_id);
        if (tenantId) {
          await updateSubscriptionStatus(tenantId, {
            squareSubscriptionId: sub.id,
            status: mapSquareStatus(sub.status),
            currentPeriodEnd: sub.charged_through_date ? `${sub.charged_through_date}T00:00:00Z` : null,
          });
        } else {
          console.warn(`[billing] webhook: no tenant found for square customer ${sub.customer_id}`);
        }
      }
    } else if (event.type === 'invoice.payment_made' || event.type === 'invoice.payment_failed') {
      // Subscription status itself is authoritative for access — invoice
      // events are logged for now rather than acted on directly.
      console.log(`[billing] invoice event: ${event.type}`, JSON.stringify(event.data).slice(0, 500));
    }
  } catch (e: unknown) {
    console.error('[billing] webhook handling error:', e instanceof Error ? e.message : e);
  }

  res.status(200).send('OK');
}

function mapSquareStatus(squareStatus: string | undefined): string {
  switch (squareStatus) {
    case 'ACTIVE': return 'active';
    case 'CANCELED': return 'canceled';
    case 'PAUSED': return 'paused';
    case 'PENDING': return 'pending';
    case 'DEACTIVATED': return 'deactivated';
    default: return squareStatus?.toLowerCase() || 'unknown';
  }
}
