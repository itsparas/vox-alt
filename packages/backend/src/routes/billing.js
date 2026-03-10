/**
 * Billing Routes
 * Stripe integration for subscriptions and usage
 */

import { Router } from 'express';
import Stripe from 'stripe';
import config from '../config/index.js';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Initialize Stripe
const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' })
  : null;

function ensureStripe() {
  if (!stripe) {
    throw ApiError.internal('Stripe not configured');
  }
  return stripe;
}

/**
 * GET /api/billing/plans
 * List available subscription plans
 */
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = [
    {
      id: 'BASIC',
      name: 'Basic',
      description: 'Perfect for small businesses',
      priceId: config.stripe.prices?.basic,
      features: [
        '500 minutes/month',
        '2 concurrent calls',
        '3 team members',
        'Audio calls only',
        'Basic analytics',
        'Email support',
      ],
      limits: config.plans.basic,
      price: {
        monthly: 49,
        currency: 'usd',
      },
    },
    {
      id: 'PRO',
      name: 'Professional',
      description: 'For growing teams',
      priceId: config.stripe.prices?.pro,
      features: [
        '2,000 minutes/month',
        '10 concurrent calls',
        '10 team members',
        'Video & audio calls',
        'Advanced analytics',
        'Priority support',
        'Custom branding',
        'API access',
      ],
      limits: config.plans.pro,
      price: {
        monthly: 149,
        currency: 'usd',
      },
      popular: true,
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'For large organizations',
      priceId: config.stripe.prices?.enterprise,
      features: [
        'Unlimited minutes',
        'Unlimited concurrent calls',
        'Unlimited team members',
        'Video & audio calls',
        'Custom analytics',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantee',
        'SSO/SAML',
      ],
      limits: config.plans.enterprise,
      price: {
        monthly: 499,
        currency: 'usd',
      },
    },
  ];

  res.json({
    success: true,
    data: plans,
  });
}));

/**
 * GET /api/billing/subscription
 * Get current subscription details
 */
router.get('/subscription',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        planId: true,
        subscriptionId: true,
        subscriptionStatus: true,
        billingCustomerId: true,
      },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant not found');
    }

    let subscriptionDetails = null;

    if (tenant.subscriptionId && stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(tenant.subscriptionId);
        subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        };
      } catch (error) {
        logger.warn('Failed to retrieve subscription from Stripe', { error: error.message });
      }
    }

    res.json({
      success: true,
      data: {
        planId: tenant.planId,
        status: tenant.subscriptionStatus || 'active',
        subscription: subscriptionDetails,
        limits: config.plans[tenant.planId.toLowerCase()],
      },
    });
  })
);

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session
 */
router.post('/checkout',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const stripe = ensureStripe();
    const { planId } = req.body;
    const db = getDatabase();

    const priceId = config.stripe.prices?.[planId.toLowerCase()];
    if (!priceId) {
      throw ApiError.badRequest('Invalid plan');
    }

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
    });

    // Create or get Stripe customer
    let customerId = tenant.billingCustomerId;

    if (!customerId) {
      const user = await db.user.findUnique({
        where: { id: req.user.id },
      });

      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
        },
      });

      customerId = customer.id;

      await db.tenant.update({
        where: { id: req.tenantId },
        data: { billingCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${config.frontendUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/settings/billing?canceled=true`,
      metadata: {
        tenantId: req.tenantId,
        planId,
      },
    });

    logger.info('Checkout session created', { tenantId: req.tenantId, planId });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  })
);

/**
 * POST /api/billing/portal
 * Create Stripe customer portal session
 */
router.post('/portal',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const stripe = ensureStripe();
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
    });

    if (!tenant.billingCustomerId) {
      throw ApiError.badRequest('No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.billingCustomerId,
      return_url: `${config.frontendUrl}/settings/billing`,
    });

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  })
);

/**
 * POST /api/billing/cancel
 * Cancel subscription
 */
router.post('/cancel',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const stripe = ensureStripe();
    const { immediate = false } = req.body;
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
    });

    if (!tenant.subscriptionId) {
      throw ApiError.badRequest('No active subscription');
    }

    if (immediate) {
      await stripe.subscriptions.cancel(tenant.subscriptionId);
    } else {
      await stripe.subscriptions.update(tenant.subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    await db.tenant.update({
      where: { id: req.tenantId },
      data: {
        subscriptionStatus: immediate ? 'canceled' : 'canceling',
      },
    });

    // Log cancellation
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'subscription.cancelled',
        resourceType: 'subscription',
        resourceId: tenant.subscriptionId,
        metadata: { immediate },
      },
    });

    logger.info('Subscription cancelled', { tenantId: req.tenantId, immediate });

    res.json({
      success: true,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at the end of the billing period',
    });
  })
);

/**
 * GET /api/billing/usage
 * Get usage statistics
 */
router.get('/usage',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { period = 'current' } = req.query;
    const db = getDatabase();

    // Calculate period dates
    const now = new Date();
    let periodStart, periodEnd;

    if (period === 'current') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      // Parse period as YYYY-MM
      const [year, month] = period.split('-').map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0);
    }

    // Get usage record or calculate
    let usageRecord = await db.usageRecord.findFirst({
      where: {
        tenantId: req.tenantId,
        periodStart,
        periodEnd,
      },
    });

    if (!usageRecord) {
      // Calculate usage
      const [callsAggregate, bookingsCount] = await Promise.all([
        db.call.aggregate({
          where: {
            tenantId: req.tenantId,
            createdAt: { gte: periodStart, lte: periodEnd },
            status: 'COMPLETED',
          },
          _sum: { durationSeconds: true },
          _count: true,
        }),
        db.booking.count({
          where: {
            tenantId: req.tenantId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
      ]);

      usageRecord = {
        periodStart,
        periodEnd,
        totalMinutes: Math.round((callsAggregate._sum.durationSeconds || 0) / 60),
        totalCalls: callsAggregate._count,
        totalBookings: bookingsCount,
      };
    }

    // Get plan limits
    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
      select: { planId: true },
    });

    const planLimits = config.plans[tenant.planId.toLowerCase()];

    res.json({
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd,
        },
        usage: {
          minutes: usageRecord.totalMinutes,
          calls: usageRecord.totalCalls,
          bookings: usageRecord.totalBookings,
        },
        limits: {
          maxMinutes: planLimits.maxMinutesPerMonth,
          maxConcurrentCalls: planLimits.maxConcurrentCalls,
        },
        percentages: {
          minutes: planLimits.maxMinutesPerMonth > 0
            ? Math.round((usageRecord.totalMinutes / planLimits.maxMinutesPerMonth) * 100)
            : 0,
        },
      },
    });
  })
);

/**
 * GET /api/billing/invoices
 * Get invoice history
 */
router.get('/invoices',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const stripe = ensureStripe();
    const { limit = 10 } = req.query;
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
    });

    if (!tenant.billingCustomerId) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const invoices = await stripe.invoices.list({
      customer: tenant.billingCustomerId,
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: invoices.data.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount: invoice.amount_due,
        currency: invoice.currency,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        createdAt: new Date(invoice.created * 1000),
      })),
    });
  })
);

export default router;
