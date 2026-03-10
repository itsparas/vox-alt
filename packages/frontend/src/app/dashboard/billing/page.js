'use client';

import { useState } from 'react';
import { useSubscription, useUsage, useInvoices, useCreateCheckoutSession, useCreatePortalSession } from '@/hooks/queries';
import { Card, Badge, Button, Spinner, EmptyState, Progress } from '@/components/ui';
import {
  CreditCardIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  ClockIcon,
  PhoneIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    features: [
      '500 call minutes/month',
      '100 bookings/month',
      '1 AI receptionist',
      'Email support',
      'Basic analytics',
    ],
    color: 'secondary',
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    features: [
      '2,000 call minutes/month',
      'Unlimited bookings',
      '3 AI receptionists',
      'Priority support',
      'Advanced analytics',
      'Custom voice',
      'Integrations',
    ],
    popular: true,
    color: 'primary',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    features: [
      'Unlimited call minutes',
      'Unlimited bookings',
      'Unlimited AI receptionists',
      '24/7 phone support',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'White-label options',
    ],
    color: 'success',
  },
];

function PlanCard({ plan, currentPlanId, onSelect, isLoading }) {
  const isCurrent = plan.id === currentPlanId;

  return (
    <Card
      className={`p-6 relative ${plan.popular ? 'ring-2 ring-primary-500' : ''}`}
    >
      {plan.popular && (
        <Badge
          variant="primary"
          className="absolute -top-3 left-1/2 transform -translate-x-1/2"
        >
          Most Popular
        </Badge>
      )}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
          {plan.name}
        </h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-secondary-900 dark:text-white">
            ${plan.price}
          </span>
          <span className="text-secondary-500">/month</span>
        </div>
      </div>

      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <CheckIcon className={`h-5 w-5 text-${plan.color}-500 flex-shrink-0`} />
            <span className="text-secondary-600 dark:text-secondary-300">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={isCurrent ? 'secondary' : plan.popular ? 'primary' : 'outline'}
        className="w-full"
        disabled={isCurrent || isLoading}
        onClick={() => onSelect(plan.id)}
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : isCurrent ? (
          'Current Plan'
        ) : (
          'Upgrade'
        )}
      </Button>
    </Card>
  );
}

function UsageCard({ icon: Icon, label, used, limit, unit }) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = percentage > 80;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${isNearLimit ? 'bg-warning-100 dark:bg-warning-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
          <Icon className={`h-5 w-5 ${isNearLimit ? 'text-warning-600' : 'text-primary-600'}`} />
        </div>
        <span className="font-medium text-secondary-900 dark:text-white">{label}</span>
      </div>
      <Progress value={percentage} variant={isNearLimit ? 'warning' : 'primary'} />
      <div className="flex justify-between mt-2 text-sm text-secondary-500">
        <span>{used.toLocaleString()} {unit} used</span>
        <span>{limit.toLocaleString()} {unit} limit</span>
      </div>
    </Card>
  );
}

function InvoiceRow({ invoice }) {
  const date = new Date(invoice.date);

  return (
    <tr className="hover:bg-secondary-50 dark:hover:bg-secondary-800">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
        {invoice.id}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {date.toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
        ${(invoice.amount / 100).toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>
          {invoice.status}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        {invoice.pdfUrl && (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 justify-end"
          >
            Download
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
        )}
      </td>
    </tr>
  );
}

export default function BillingPage() {
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: usage, isLoading: usageLoading } = useUsage(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    new Date().toISOString()
  );
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  
  const createCheckoutSession = useCreateCheckoutSession();
  const createPortalSession = useCreatePortalSession();
  
  const [upgrading, setUpgrading] = useState(null);

  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    try {
      const response = await createCheckoutSession.mutateAsync(planId);
      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await createPortalSession.mutateAsync();
      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Failed to create portal session:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Billing</h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Manage your subscription and view usage
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleManageBilling}
          disabled={createPortalSession.isPending}
          className="flex items-center gap-2"
        >
          <CreditCardIcon className="h-5 w-5" />
          {createPortalSession.isPending ? 'Opening...' : 'Manage Billing'}
        </Button>
      </div>

      {/* Current Plan */}
      {subLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : subscription ? (
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-secondary-500">Current Plan</p>
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white">
                {subscription.planName || 'Free Trial'}
              </h2>
              {subscription.periodEnd && (
                <p className="text-sm text-secondary-500 mt-1 flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  Renews on {new Date(subscription.periodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
                {subscription.status}
              </Badge>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-secondary-500">You are currently on the free plan.</p>
        </Card>
      )}

      {/* Usage */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Current Usage
        </h2>
        {usageLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : usage ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageCard
              icon={PhoneIcon}
              label="Call Minutes"
              used={usage.callMinutes || 0}
              limit={usage.callMinutesLimit || 500}
              unit="min"
            />
            <UsageCard
              icon={CalendarIcon}
              label="Bookings"
              used={usage.bookings || 0}
              limit={usage.bookingsLimit || 100}
              unit=""
            />
            <UsageCard
              icon={DocumentTextIcon}
              label="Transcripts"
              used={usage.transcripts || 0}
              limit={usage.transcriptsLimit || 100}
              unit=""
            />
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-secondary-500">Usage data not available.</p>
          </Card>
        )}
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlanId={subscription?.planId}
              onSelect={handleUpgrade}
              isLoading={upgrading === plan.id}
            />
          ))}
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Invoice History
        </h2>
        {invoicesLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : !invoices?.length ? (
          <EmptyState
            icon={DocumentTextIcon}
            title="No invoices"
            description="Your invoice history will appear here once you have billing activity."
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
              <thead className="bg-secondary-50 dark:bg-secondary-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Invoice ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-secondary-900 divide-y divide-secondary-200 dark:divide-secondary-700">
                {invoices.map((invoice) => (
                  <InvoiceRow key={invoice.id} invoice={invoice} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
