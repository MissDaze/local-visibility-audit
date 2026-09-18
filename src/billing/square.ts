import crypto from 'crypto';

// Raw REST calls (no SDK) — matching this repo's existing pattern for
// Outscraper. Request shapes below were verified live against the sandbox
// API before being encoded here (Square's docs/SDK examples for this API
// version didn't match what the sandbox actually accepted — e.g. the plan
// price lives under `phases[].pricing.price_money`, not
// `recurring_price_money`, and a payment link needs an `order` with a
// plain display line item plus `checkout_options.subscription_plan_id` —
// referencing the plan variation directly as a line item is rejected).
const SQUARE_VERSION = '2026-06-18';

function baseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

export function squareConfigured(): boolean {
  return !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

async function squareFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set.');

  const res = await fetch(`${baseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json() as any;
  if (!res.ok || json.errors) {
    const detail = json.errors?.map((e: any) => e.detail).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Square API error: ${detail}`);
  }
  return json as T;
}

export interface SquarePlanVariationResult {
  planId: string;
  monthlyVariationId: string;
  annualVariationId: string;
}

// Creates a Square Catalog subscription plan with monthly and annual
// variations for one pricing tier. The monthly variation includes a one-week
// free phase followed by recurring monthly billing. Square Checkout supports
// exactly this shape (one free phase + one paid phase) and stores the card
// during hosted checkout so the paid phase can begin automatically.
export async function createSquareSubscriptionPlan(
  tierName: string,
  monthlyPriceCents: number,
  annualPriceCents: number,
  currency: string,
): Promise<SquarePlanVariationResult> {
  const result = await squareFetch<{
    objects: any[];
    id_mappings: { client_object_id: string; object_id: string }[];
  }>('/v2/catalog/batch-upsert', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      batches: [{
        objects: [
          {
            type: 'SUBSCRIPTION_PLAN',
            id: '#plan',
            subscription_plan_data: { name: tierName },
          },
          {
            type: 'SUBSCRIPTION_PLAN_VARIATION',
            id: '#plan-monthly',
            subscription_plan_variation_data: {
              name: `${tierName} - Monthly with 7 Day Trial`,
              subscription_plan_id: '#plan',
              phases: [
                {
                  cadence: 'WEEKLY',
                  ordinal: 0,
                  periods: 1,
                  pricing: {
                    type: 'STATIC',
                    price_money: { amount: 0, currency },
                  },
                },
                {
                  cadence: 'MONTHLY',
                  ordinal: 1,
                  pricing: { type: 'STATIC', price_money: { amount: monthlyPriceCents, currency } },
                },
              ],
            },
          },
          {
            type: 'SUBSCRIPTION_PLAN_VARIATION',
            id: '#plan-annual',
            subscription_plan_variation_data: {
              name: `${tierName} - Annual`,
              subscription_plan_id: '#plan',
              phases: [{
                cadence: 'ANNUAL',
                pricing: { type: 'STATIC', price_money: { amount: annualPriceCents, currency } },
              }],
            },
          },
        ],
      }],
    },
  });

  const findId = (clientId: string) => result.id_mappings.find(m => m.client_object_id === clientId)?.object_id;
  const planId = findId('#plan');
  const monthlyVariationId = findId('#plan-monthly');
  const annualVariationId = findId('#plan-annual');
  if (!planId || !monthlyVariationId || !annualVariationId) {
    throw new Error(`Square did not return expected id_mappings for tier "${tierName}".`);
  }

  return { planId, monthlyVariationId, annualVariationId };
}

export async function findOrCreateSquareCustomer(tenantId: string, email: string): Promise<string> {
  const search = await squareFetch<{ customers?: { id: string }[] }>('/v2/customers/search', {
    method: 'POST',
    body: { query: { filter: { reference_id: { exact: tenantId } } } },
  });
  if (search.customers?.[0]?.id) return search.customers[0].id;

  const created = await squareFetch<{ customer: { id: string } }>('/v2/customers', {
    method: 'POST',
    body: { email_address: email, reference_id: tenantId },
  });
  return created.customer.id;
}

export async function createSubscriptionCheckoutLink(params: {
  squareCustomerId: string;
  planVariationId: string;
  displayName: string;
  priceCents: number;
  currency: string;
  redirectUrl: string;
  tenantId: string;
  buyerEmail: string;
}): Promise<string> {
  const result = await squareFetch<{ payment_link: { url: string } }>('/v2/online-checkout/payment-links', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        customer_id: params.squareCustomerId,
        reference_id: params.tenantId,
        line_items: [{
          name: params.displayName,
          quantity: '1',
          base_price_money: { amount: params.priceCents, currency: params.currency },
        }],
      },
      checkout_options: {
        subscription_plan_id: params.planVariationId,
        redirect_url: params.redirectUrl,
      },
      pre_populated_data: {
        buyer_email: params.buyerEmail,
      },
    },
  });
  return result.payment_link.url;
}


export async function retrieveSquareCustomer(customerId: string): Promise<{ id: string; email: string | null }> {
  const result = await squareFetch<{ customer: { id: string; email_address?: string } }>(
    `/v2/customers/${encodeURIComponent(customerId)}`,
  );
  return {
    id: result.customer.id,
    email: result.customer.email_address?.trim().toLowerCase() || null,
  };
}

export async function findLatestSquareSubscriptionForEmail(email: string): Promise<{
  customerId: string;
  subscriptionId: string;
  status: string;
  chargedThroughDate: string | null;
} | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const customerSearch = await squareFetch<{ customers?: { id: string; email_address?: string }[] }>(
    '/v2/customers/search',
    {
      method: 'POST',
      body: { query: { filter: { email_address: { exact: normalizedEmail } } } },
    },
  );
  const customerIds = (customerSearch.customers || [])
    .filter(customer => customer.email_address?.trim().toLowerCase() === normalizedEmail)
    .map(customer => customer.id);
  if (!customerIds.length) return null;

  const subscriptionSearch = await squareFetch<{ subscriptions?: any[] }>('/v2/subscriptions/search', {
    method: 'POST',
    body: { query: { filter: { customer_ids: customerIds } } },
  });
  const candidates = (subscriptionSearch.subscriptions || [])
    .filter(sub => !['CANCELED', 'DEACTIVATED'].includes(sub.status))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const subscription = candidates[0];
  if (!subscription?.id || !subscription?.customer_id) return null;

  return {
    customerId: subscription.customer_id,
    subscriptionId: subscription.id,
    status: subscription.status || 'PENDING',
    chargedThroughDate: subscription.charged_through_date || null,
  };
}


async function resolveTenantReferenceFromSubscription(subscription: any): Promise<string | null> {
  let fullSubscription = subscription;
  if (!fullSubscription?.invoice_ids?.length && fullSubscription?.id) {
    const result = await squareFetch<{ subscription: any }>(
      `/v2/subscriptions/${encodeURIComponent(fullSubscription.id)}`,
    );
    fullSubscription = result.subscription;
  }

  for (const invoiceId of fullSubscription?.invoice_ids || []) {
    const invoiceResult = await squareFetch<{ invoice: { order_id?: string } }>(
      `/v2/invoices/${encodeURIComponent(invoiceId)}`,
    );
    const orderId = invoiceResult.invoice?.order_id;
    if (!orderId) continue;
    const orderResult = await squareFetch<{ order: { reference_id?: string } }>(
      `/v2/orders/${encodeURIComponent(orderId)}`,
    );
    if (orderResult.order?.reference_id) return orderResult.order.reference_id;
  }
  return null;
}

export async function resolveSquareSubscriptionTenantReference(subscription: any): Promise<string | null> {
  return resolveTenantReferenceFromSubscription(subscription);
}

export async function findLatestSquareSubscriptionForTenantReference(tenantId: string): Promise<{
  customerId: string;
  subscriptionId: string;
  status: string;
  chargedThroughDate: string | null;
} | null> {
  const result = await squareFetch<{ subscriptions?: any[] }>('/v2/subscriptions/search', {
    method: 'POST',
    body: {},
  });
  const candidates = (result.subscriptions || [])
    .filter(sub => !['CANCELED', 'DEACTIVATED'].includes(sub.status))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  for (const subscription of candidates.slice(0, 50)) {
    const reference = await resolveTenantReferenceFromSubscription(subscription);
    if (reference === tenantId && subscription.id && subscription.customer_id) {
      return {
        customerId: subscription.customer_id,
        subscriptionId: subscription.id,
        status: subscription.status || 'PENDING',
        chargedThroughDate: subscription.charged_through_date || null,
      };
    }
  }
  return null;
}


export async function cancelSquareSubscription(subscriptionId: string): Promise<{ canceledDate: string | null }> {
  const result = await squareFetch<{ subscription?: { canceled_date?: string | null } }>(
    `/v2/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: 'POST' },
  );
  return { canceledDate: result.subscription?.canceled_date ?? null };
}

// Square signs webhook bodies as base64(HMAC-SHA256(signatureKey, notificationUrl + rawBody)).
// `rawBody` must be the exact bytes Square sent — this only works if the
// webhook route reads the body before any JSON-parsing middleware touches it.
export function verifyWebhookSignature(notificationUrl: string, rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signatureHeader) return false;
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(notificationUrl + rawBody.toString('utf8'));
  const expected = hmac.digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc. — definitely not a match
  }
}

export async function createWebhookSubscription(notificationUrl: string): Promise<{ id: string; signatureKey: string }> {
  const result = await squareFetch<{ subscription: { id: string; signature_key: string } }>('/v2/webhooks/subscriptions', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      subscription: {
        name: 'local-visibility-audit-billing',
        event_types: ['subscription.created', 'subscription.updated', 'invoice.payment_made', 'invoice.payment_failed'],
        notification_url: notificationUrl,
      },
    },
  });
  return { id: result.subscription.id, signatureKey: result.subscription.signature_key };
}
