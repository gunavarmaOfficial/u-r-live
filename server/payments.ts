/**
 * Cashfree Payments & Subscription Entitlement Management
 * Handles order creation, server-to-server status verification,
 * webhook processing, and idempotency for U-R-LIVE Pro (₹299/month).
 */
import crypto from 'crypto';
import { db } from './db';
import { Subscription, PaymentEvent } from './types';

export const PRO_PLAN_PRICE_INR = 299;
export const PRO_PLAN_CODE = 'pro_monthly_299';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const CASHFREE_APP_ID =
  process.env.CASHFREE_APP_ID || process.env.CASHFREE_CLIENT_ID || '';

export const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';

export const CASHFREE_ENV = (process.env.CASHFREE_ENV || 'TEST').toUpperCase();
export const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';

const CASHFREE_BASE_URL =
  CASHFREE_ENV === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

/**
 * Verifies standard Cashfree payment signature using HMAC-SHA256.
 * Rejects any empty, mock, or missing inputs.
 */
export function verifyCashfreePaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret = CASHFREE_SECRET_KEY
): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;

  try {
    const payload = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return (
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    );
  } catch {
    return false;
  }
}

/**
 * Verifies Cashfree Webhook HMAC-SHA256 signature over timestamp + rawBody.
 * Requires timestamp and rawBody; rejects if missing.
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret = CASHFREE_SECRET_KEY
): boolean {
  if (!rawBody || !signature || !timestamp || !secret) return false;

  try {
    const dataToSign = `${timestamp}${rawBody}`;
    const expectedBase64 = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('base64');
    const expectedHex = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex');

    return (
      (signature.length === expectedBase64.length &&
        crypto.timingSafeEqual(Buffer.from(expectedBase64), Buffer.from(signature))) ||
      (signature.length === expectedHex.length &&
        crypto.timingSafeEqual(Buffer.from(expectedHex), Buffer.from(signature)))
    );
  } catch {
    return false;
  }
}

/**
 * Server-to-server verification of Cashfree Order status and amount.
 * Verifies that the order exists on Cashfree, has status 'PAID', and matches the ₹299 plan price.
 */
export async function verifyCashfreeOrderStatus(orderId: string): Promise<{
  success: boolean;
  error?: string;
  orderData?: any;
}> {
  if (!orderId || typeof orderId !== 'string') {
    return { success: false, error: 'Valid order ID is required' };
  }

  const appId = CASHFREE_APP_ID;
  const secretKey = CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    return {
      success: false,
      error: 'Cashfree API credentials are not configured on the server. Payment cannot be verified.',
    };
  }

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Cashfree order verification returned HTTP ${response.status}: ${errText}`,
      };
    }

    const orderData: any = await response.json();

    if (orderData.order_status !== 'PAID') {
      return {
        success: false,
        error: `Order status is '${orderData.order_status}', expected 'PAID'`,
      };
    }

    if (Number(orderData.order_amount) < PRO_PLAN_PRICE_INR) {
      return {
        success: false,
        error: `Order amount ${orderData.order_amount} is less than required ₹${PRO_PLAN_PRICE_INR}`,
      };
    }

    if (orderData.order_currency && orderData.order_currency !== 'INR') {
      return {
        success: false,
        error: `Invalid order currency '${orderData.order_currency}', expected 'INR'`,
      };
    }

    return { success: true, orderData };
  } catch (err: any) {
    return {
      success: false,
      error: `Network error verifying Cashfree order: ${err.message}`,
    };
  }
}

/**
 * Cashfree requires an absolute callback URL. Derive it from PUBLIC_URL and fail
 * closed in production rather than sending a path Cashfree cannot resolve.
 */
export function resolveNotifyUrl(): string {
  const base = process.env.PUBLIC_URL || process.env.VITE_SITE_URL;
  if (base) {
    try {
      return new URL('/api/subscription/webhook', base).toString();
    } catch {
      // fall through to the explicit error below
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PUBLIC_URL must be configured to an absolute https origin before creating Cashfree orders.'
    );
  }

  return 'http://localhost:3000/api/subscription/webhook';
}

/**
 * Create a new Cashfree subscription checkout session for an authenticated user.
 * Fails closed if Cashfree API credentials are not set.
 */
export async function createSubscriptionOrder(userId: string) {
  const user = db.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Require a verified account (email/login) before purchasing Pro so it can be restored
  if (user.authProvider === 'guest' || !user.email) {
    throw new Error(
      'Account verification required: users must sign in with an email or Google account before purchasing a Pro subscription.'
    );
  }

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new Error(
      'Cashfree payment gateway is not configured on the server. Please configure CASHFREE_APP_ID and CASHFREE_SECRET_KEY.'
    );
  }

  // Generate unique order and customer references
  const orderId = 'order_cf_' + Math.random().toString(36).substring(2, 12);
  const subscriptionId = 'sub_cf_' + Math.random().toString(36).substring(2, 12);
  const customerId = user.id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45);
  const customerPhone = '9999999999';
  const customerEmail = user.email;
  const customerName = user.displayName || 'Subscriber';

  const response = await fetch(`${CASHFREE_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': CASHFREE_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: PRO_PLAN_PRICE_INR,
      order_currency: 'INR',
      customer_details: {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        notify_url: resolveNotifyUrl(),
        payment_methods: 'cc,dc,upi,nb',
      },
      order_note: 'U-R-LIVE Pro Monthly Subscription ₹299',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cashfree order creation failed (${response.status}): ${errorText}`);
  }

  const cfData: any = await response.json();
  return {
    orderId: cfData.order_id || orderId,
    paymentSessionId: cfData.payment_session_id,
    cfOrderId: cfData.cf_order_id,
    subscriptionId,
    amount: PRO_PLAN_PRICE_INR,
    currency: 'INR',
    planName: 'U-R-LIVE Pro Monthly',
    planCode: PRO_PLAN_CODE,
    priceInr: PRO_PLAN_PRICE_INR,
    environment: CASHFREE_ENV,
    appId: CASHFREE_APP_ID,
    gateway: 'cashfree',
  };
}

function buildProSubscription(
  userId: string,
  providerSubscriptionId: string,
  providerCustomerId: string
): Subscription {
  const now = Date.now();
  return {
    id: 'sub_cf_ent_' + crypto.randomBytes(6).toString('hex'),
    userId,
    provider: 'cashfree',
    providerCustomerId,
    providerSubscriptionId,
    planCode: PRO_PLAN_CODE,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: now + THIRTY_DAYS_MS,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };
}

function auditSubscriptionActivation(sub: Subscription): void {
  db.addAuditLog({
    adminUserId: 'system',
    action: 'subscription_activated',
    targetType: 'subscription',
    targetId: sub.id,
    details: {
      userId: sub.userId,
      provider: 'cashfree',
      planCode: PRO_PLAN_CODE,
      price: PRO_PLAN_PRICE_INR,
    },
  });
}

/**
 * Activate Pro subscription following verified Cashfree payment.
 * Synchronous variant kept for entitlement tests and in-memory callers.
 */
export function activateProSubscription(
  userId: string,
  providerSubscriptionId: string,
  providerCustomerId = 'cust_' + userId
): Subscription {
  const sub = buildProSubscription(userId, providerSubscriptionId, providerCustomerId);
  db.saveSubscription(sub);
  auditSubscriptionActivation(sub);
  return sub;
}

/**
 * Awaited activation used by payment routes and webhooks. Persistence happens
 * before the caller is told Pro is active.
 */
export async function activateProSubscriptionPersisted(
  userId: string,
  providerSubscriptionId: string,
  providerCustomerId = 'cust_' + userId
): Promise<Subscription> {
  const sub = buildProSubscription(userId, providerSubscriptionId, providerCustomerId);
  await db.saveSubscriptionAwait(sub);
  auditSubscriptionActivation(sub);
  return sub;
}

/**
 * Idempotently process incoming Cashfree webhooks.
 * The event is claimed in the database first (atomic unique insert), so a
 * replayed or concurrently delivered webhook can only mutate state once.
 */
export async function processCashfreeWebhook(
  eventId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<{ processed: boolean; duplicate: boolean; message: string }> {
  const paymentEvent: PaymentEvent = {
    id: 'evt_cf_' + crypto.randomBytes(6).toString('hex'),
    provider: 'cashfree',
    providerEventId: eventId,
    eventType,
    processingStatus: 'processing',
    receivedAt: Date.now(),
    payload,
  };

  const claimed = await db.claimPaymentEvent(paymentEvent);
  if (!claimed) {
    return {
      processed: true,
      duplicate: true,
      message: 'Event already processed (idempotent)',
    };
  }

  try {
    const data = payload.data || payload;

    switch (eventType) {
      case 'ORDER_PAID':
      case 'PAYMENT_SUCCESS_WEBHOOK':
      case 'SUBSCRIPTION_CHARGED':
      case 'subscription.charged': {
        const customerDetails = data.customer_details || {};
        const customerId = customerDetails.customer_id;
        const orderId = data.order?.order_id || data.order_id || eventId;
        const subId = 'sub_cf_' + orderId;
        const amount = Number(
          data.order?.order_amount || data.payment?.payment_amount || data.order_amount || 0
        );

        // Verify amount satisfies Pro pricing
        if (amount > 0 && amount < PRO_PLAN_PRICE_INR) {
          paymentEvent.processingStatus = 'ignored';
          await db.updatePaymentEvent(paymentEvent);
          return {
            processed: false,
            duplicate: false,
            message: `Order amount ₹${amount} is less than required ₹${PRO_PLAN_PRICE_INR}`,
          };
        }

        // Extract user id from customer_id or metadata
        let userId = customerId;
        if (!userId && data.order_meta?.return_url) {
          const match = String(data.order_meta.return_url).match(/userId=([^&]+)/);
          if (match) userId = match[1];
        }

        // Never grant entitlement to an identity we do not know
        if (!userId || !db.getUser(userId)) {
          paymentEvent.processingStatus = 'ignored';
          await db.updatePaymentEvent(paymentEvent);
          return {
            processed: false,
            duplicate: false,
            message: 'Webhook did not reference a known user; entitlement not granted',
          };
        }

        const sub = buildProSubscription(userId, subId, customerId || 'cust_' + userId);
        await db.activateSubscriptionWithEvent(sub, paymentEvent);
        auditSubscriptionActivation(sub);
        return { processed: true, duplicate: false, message: 'Pro subscription activated' };
      }

      case 'SUBSCRIPTION_CANCELLED':
      case 'subscription.cancelled': {
        const customerId = data.customer_details?.customer_id || data.userId;
        if (customerId) {
          await db.cancelSubscriptionAwait(customerId);
        }
        break;
      }

      case 'SUBSCRIPTION_HALTED':
      case 'SUBSCRIPTION_EXPIRED':
      case 'subscription.expired': {
        const customerId = data.customer_details?.customer_id || data.userId;
        if (customerId) {
          const sub = db.getSubscription(customerId);
          if (sub) {
            sub.status = 'expired';
            sub.updatedAt = Date.now();
            await db.saveSubscriptionAwait(sub);
          }
        }
        break;
      }

      default:
        paymentEvent.processingStatus = 'ignored';
        break;
    }

    await db.updatePaymentEvent(paymentEvent);
    return { processed: true, duplicate: false, message: 'Processed successfully by Cashfree handler' };
  } catch (err: any) {
    paymentEvent.processingStatus = 'failed';
    try {
      await db.updatePaymentEvent(paymentEvent);
    } catch (persistErr: any) {
      console.error('[Payments] Could not record failed event:', persistErr.message);
    }
    return { processed: false, duplicate: false, message: err.message || 'Processing error' };
  }
}
