'use client';

import { useState } from 'react';
import {
  usePhoneNumbers,
  useSetupBYON,
  useProvisionNumber,
  useConfirmForwarding,
  useReleaseNumber,
} from '@/hooks/queries';
import { phoneNumbersApi } from '@/lib/api';
import { Card, Button, Input, Label, Spinner } from '@/components/ui';
import { toast } from '@/components/ui/Toaster';
import {
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DevicePhoneMobileIcon,
  SignalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

function ForwardingInstructions({ phoneNumber, onConfirm }) {
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState(null);

  const fetchInstructions = async () => {
    if (instructions) return;
    setLoading(true);
    try {
      const res = await phoneNumbersApi.getForwardingInstructions(phoneNumber.id);
      setInstructions(res.data.data);
    } catch (err) {
      toast.error('Failed to load instructions');
    } finally {
      setLoading(false);
    }
  };

  const copyNumber = (num) => {
    navigator.clipboard.writeText(num);
    toast.success('Number copied!');
  };

  if (loading && !instructions) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!instructions) {
    return (
      <Button size="sm" variant="outline" onClick={fetchInstructions}>
        View Forwarding Instructions
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Forward calls from your number to:
        </p>
        <div className="flex items-center gap-2 mt-2">
          <code className="text-lg font-bold text-blue-900 dark:text-blue-100">
            {instructions.twilioNumber}
          </code>
          <button
            onClick={() => copyNumber(instructions.twilioNumber)}
            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800"
          >
            <ClipboardDocumentIcon className="h-4 w-4 text-blue-600" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
          Choose a method to set up forwarding:
        </p>
        {instructions.methods.map((method, idx) => (
          <div
            key={idx}
            className="border rounded-lg dark:border-secondary-700 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary-50 dark:hover:bg-secondary-800"
            >
              <span className="text-sm font-medium">{method.name}</span>
              {expanded === idx ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
            {expanded === idx && (
              <div className="p-3 pt-0 border-t dark:border-secondary-700">
                {method.description && (
                  <p className="text-xs text-secondary-500 mb-2">
                    {method.description}
                  </p>
                )}
                <ol className="list-decimal list-inside space-y-1">
                  {method.steps.map((step, si) => (
                    <li key={si} className="text-sm text-secondary-700 dark:text-secondary-300">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>

      {!phoneNumber.forwardingSetup && (
        <Button onClick={onConfirm} className="w-full">
          <CheckCircleIcon className="h-4 w-4 mr-2" />
          I&apos;ve Set Up Forwarding
        </Button>
      )}
    </div>
  );
}

function PhoneNumberCard({ phone, onRelease, onConfirmForwarding }) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isBYON = phone.numberType === 'byon';
  const needsSetup = isBYON && !phone.forwardingSetup;

  return (
    <Card className="relative">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${
              needsSetup
                ? 'bg-yellow-50 dark:bg-yellow-900/20'
                : 'bg-green-50 dark:bg-green-900/20'
            }`}
          >
            {isBYON ? (
              <DevicePhoneMobileIcon
                className={`h-5 w-5 ${
                  needsSetup
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              />
            ) : (
              <SignalIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div>
            <p className="font-semibold text-secondary-900 dark:text-white">
              {phone.phoneNumber}
            </p>
            {isBYON && phone.businessNumber && (
              <p className="text-xs text-secondary-500 mt-0.5">
                Forwarding from <span className="font-medium">{phone.businessNumber}</span>
              </p>
            )}
            <p className="text-xs text-secondary-500 mt-0.5">
              {phone.friendlyName || (isBYON ? 'Your Number (BYON)' : 'Twilio Number')}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  phone.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-secondary-100 text-secondary-800 dark:bg-secondary-800 dark:text-secondary-400'
                }`}
              >
                {phone.status}
              </span>
              {isBYON && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  BYON
                </span>
              )}
              {needsSetup && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  <ExclamationTriangleIcon className="h-3 w-3" />
                  Forwarding not set up
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isBYON && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              {showInstructions ? 'Hide' : 'Setup'}
            </Button>
          )}
          {!confirmDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onRelease(phone.id);
                  setConfirmDelete(false);
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {showInstructions && isBYON && (
        <div className="mt-4 pt-4 border-t dark:border-secondary-700">
          <ForwardingInstructions
            phoneNumber={phone}
            onConfirm={() => onConfirmForwarding(phone.id)}
          />
        </div>
      )}
    </Card>
  );
}

export default function PhoneNumbersPage() {
  const { data: phoneNumbers, isLoading, refetch } = usePhoneNumbers();
  const setupBYON = useSetupBYON();
  const provisionNumber = useProvisionNumber();
  const confirmForwarding = useConfirmForwarding();
  const releaseNumber = useReleaseNumber();

  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState(null); // 'byon' | 'twilio'
  const [businessNumber, setBusinessNumber] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');

  const handleSetupBYON = async () => {
    if (!businessNumber.match(/^\+[1-9]\d{1,14}$/)) {
      toast.error('Enter a valid phone number in E.164 format (e.g., +15551234567)');
      return;
    }
    try {
      const res = await setupBYON.mutateAsync({ businessNumber });
      toast.success(
        `AI receptionist number provisioned! Set up forwarding from ${businessNumber} to ${res.data.data.phoneNumber}`
      );
      setShowAddModal(false);
      setBusinessNumber('');
      setAddMode(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set up number');
    }
  };

  const handleProvisionTwilio = async () => {
    if (!twilioNumber.match(/^\+[1-9]\d{1,14}$/)) {
      toast.error('Enter a valid phone number in E.164 format');
      return;
    }
    try {
      await provisionNumber.mutateAsync(twilioNumber);
      toast.success('Phone number purchased and configured!');
      setShowAddModal(false);
      setTwilioNumber('');
      setAddMode(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to provision number');
    }
  };

  const handleConfirmForwarding = async (id) => {
    try {
      await confirmForwarding.mutateAsync(id);
      toast.success('Forwarding confirmed! Your AI receptionist is ready for calls.');
    } catch (err) {
      toast.error('Failed to confirm forwarding');
    }
  };

  const handleRelease = async (id) => {
    try {
      await releaseNumber.mutateAsync(id);
      toast.success('Phone number released');
    } catch (err) {
      toast.error('Failed to release number');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Phone Numbers
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Manage phone numbers for your AI receptionist
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Number
          </Button>
        </div>
      </div>

      {/* Add Number Modal */}
      {showAddModal && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Add Phone Number</h3>

          {!addMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setAddMode('byon')}
                className="p-6 rounded-lg border-2 border-dashed hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors text-left"
              >
                <DevicePhoneMobileIcon className="h-8 w-8 text-primary-600 mb-3" />
                <h4 className="font-semibold text-secondary-900 dark:text-white">
                  Use My Existing Number
                </h4>
                <p className="text-sm text-secondary-500 mt-1">
                  Keep your current business number. Calls will be forwarded to your AI receptionist.
                  Best for businesses that already have an established phone number.
                </p>
                <span className="inline-block mt-3 text-xs font-medium text-primary-600 dark:text-primary-400">
                  Recommended for most businesses →
                </span>
              </button>

              <button
                onClick={() => setAddMode('twilio')}
                className="p-6 rounded-lg border-2 border-dashed hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors text-left"
              >
                <SignalIcon className="h-8 w-8 text-secondary-600 mb-3" />
                <h4 className="font-semibold text-secondary-900 dark:text-white">
                  Get a New Number
                </h4>
                <p className="text-sm text-secondary-500 mt-1">
                  Purchase a new dedicated AI receptionist number.
                  Good for a separate business line or toll-free number.
                </p>
                <span className="inline-block mt-3 text-xs font-medium text-secondary-500">
                  $1.15/month →
                </span>
              </button>
            </div>
          ) : addMode === 'byon' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  How it works
                </h4>
                <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>Enter your existing business phone number below</li>
                  <li>We&apos;ll create an AI receptionist line for you</li>
                  <li>Set up call forwarding from your number to the AI line</li>
                  <li>Calls to your number will be answered by your AI receptionist</li>
                </ol>
              </div>

              <div>
                <Label htmlFor="businessNumber">Your Business Phone Number</Label>
                <Input
                  id="businessNumber"
                  type="tel"
                  placeholder="+15551234567"
                  value={businessNumber}
                  onChange={(e) => setBusinessNumber(e.target.value)}
                />
                <p className="mt-1 text-xs text-secondary-500">
                  E.164 format: +[country code][number] (e.g., +15551234567)
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSetupBYON}
                  loading={setupBYON.isPending}
                  disabled={!businessNumber}
                >
                  Set Up AI Receptionist
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAddMode(null);
                    setBusinessNumber('');
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="twilioNumber">Phone Number to Purchase</Label>
                <Input
                  id="twilioNumber"
                  type="tel"
                  placeholder="+15551234567"
                  value={twilioNumber}
                  onChange={(e) => setTwilioNumber(e.target.value)}
                />
                <p className="mt-1 text-xs text-secondary-500">
                  Search for available numbers in the Twilio console, then paste the number here.
                  E.164 format required.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleProvisionTwilio}
                  loading={provisionNumber.isPending}
                  disabled={!twilioNumber}
                >
                  Purchase Number ($1.15/mo)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAddMode(null);
                    setTwilioNumber('');
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {addMode && (
            <div className="mt-4 pt-4 border-t dark:border-secondary-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setAddMode(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
          {!addMode && (
            <div className="mt-4 pt-4 border-t dark:border-secondary-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Phone Numbers List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : !phoneNumbers || phoneNumbers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <PhoneIcon className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
              No Phone Numbers
            </h3>
            <p className="text-secondary-500 mb-6 max-w-md mx-auto">
              Add a phone number to start receiving calls through your AI receptionist.
              You can use your existing business number or get a new one.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Your First Number
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {phoneNumbers.map((phone) => (
            <PhoneNumberCard
              key={phone.id}
              phone={phone}
              onRelease={handleRelease}
              onConfirmForwarding={handleConfirmForwarding}
            />
          ))}
        </div>
      )}

      {/* Info Section */}
      <Card>
        <h3 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-3">
          How Phone Numbers Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-secondary-600 dark:text-secondary-400">
          <div>
            <h4 className="font-medium text-secondary-800 dark:text-secondary-200 mb-1">
              Use Your Existing Number (BYON)
            </h4>
            <p>
              Set up call forwarding from your existing mobile or landline to your AI receptionist.
              Callers still dial your familiar number — the AI answers when you can&apos;t.
              You can forward all calls, or only unanswered/busy calls.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-secondary-800 dark:text-secondary-200 mb-1">
              New Dedicated Number
            </h4>
            <p>
              Get a fresh phone number dedicated to your AI receptionist.
              Great for a separate business line, marketing campaigns, or a toll-free number.
              Costs $1.15/month from Twilio.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
