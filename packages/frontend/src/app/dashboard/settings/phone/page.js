'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phoneNumbersApi } from '@/lib/api';
import { Card, Button, Input, Label, Badge, Spinner, EmptyState, Select } from '@/components/ui';
import { toast } from '@/components/ui/Toaster';
import {
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

function PhoneNumberCard({ phone, onRelease, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [friendlyName, setFriendlyName] = useState(phone.friendlyName || '');
  const [forwardingNumber, setForwardingNumber] = useState(phone.forwardingNumber || '');

  const handleSave = () => {
    onUpdate(phone.id, { friendlyName, forwardingNumber: forwardingNumber || null });
    setEditing(false);
  };

  return (
    <Card bordered className="relative">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <PhoneIcon className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-secondary-900 dark:text-white">
              {phone.phoneNumber}
            </p>
            <p className="text-sm text-secondary-500">
              {phone.friendlyName || 'No label'}
            </p>
          </div>
        </div>
        <Badge variant={phone.status === 'ACTIVE' ? 'success' : 'danger'}>
          {phone.status}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-secondary-500">
        <span className="flex items-center gap-1">
          {phone.capabilities?.voice ? (
            <CheckCircleIcon className="h-4 w-4 text-success-500" />
          ) : (
            <XCircleIcon className="h-4 w-4 text-secondary-400" />
          )}
          Voice
        </span>
        <span className="flex items-center gap-1">
          {phone.capabilities?.sms ? (
            <CheckCircleIcon className="h-4 w-4 text-success-500" />
          ) : (
            <XCircleIcon className="h-4 w-4 text-secondary-400" />
          )}
          SMS
        </span>
        <span>
          {phone._count?.messages || 0} messages
        </span>
      </div>

      {phone.forwardingNumber && (
        <p className="mt-2 text-sm text-secondary-500">
          Forwarding to: <span className="font-medium">{phone.forwardingNumber}</span>
        </p>
      )}

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-secondary-200 dark:border-secondary-700 pt-4">
          <div>
            <Label>Label</Label>
            <Input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g., Main Line"
            />
          </div>
          <div>
            <Label>Forwarding Number</Label>
            <Input
              value={forwardingNumber}
              onChange={(e) => setForwardingNumber(e.target.value)}
              placeholder="+15551234567 (leave empty to disable)"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2 border-t border-secondary-200 dark:border-secondary-700 pt-4">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Cog6ToothIcon className="h-4 w-4 mr-1" />
            Configure
          </Button>
          {phone.status === 'ACTIVE' && (
            <Button size="sm" variant="danger" onClick={() => onRelease(phone.id)}>
              <TrashIcon className="h-4 w-4 mr-1" />
              Release
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function SearchNumbersModal({ open, onClose, onProvision }) {
  const [country, setCountry] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  const [type, setType] = useState('local');
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ['available-numbers', country, areaCode, type],
    queryFn: () => phoneNumbersApi.searchAvailable({ country, areaCode, type }).then(r => r.data),
    enabled: searchTriggered,
  });

  const handleSearch = () => {
    setSearchTriggered(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Get a Phone Number
          </h2>
          <p className="text-sm text-secondary-500 mt-1">
            Search for available phone numbers to add to your account
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Country</Label>
              <Select value={country} onChange={(e) => { setCountry(e.target.value); setSearchTriggered(false); }}>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </Select>
            </div>
            <div>
              <Label>Area Code</Label>
              <Input
                value={areaCode}
                onChange={(e) => { setAreaCode(e.target.value); setSearchTriggered(false); }}
                placeholder="e.g., 415"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => { setType(e.target.value); setSearchTriggered(false); }}>
                <option value="local">Local</option>
                <option value="tollFree">Toll-Free</option>
              </Select>
            </div>
          </div>

          <Button onClick={handleSearch} loading={isLoading}>
            <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
            Search Numbers
          </Button>

          {results?.data && (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {results.data.length === 0 ? (
                <p className="text-sm text-secondary-500 text-center py-4">
                  No numbers found. Try a different area code or country.
                </p>
              ) : (
                results.data.map((num) => (
                  <div
                    key={num.phoneNumber}
                    className="flex items-center justify-between p-3 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
                  >
                    <div>
                      <p className="font-medium text-secondary-900 dark:text-white">
                        {num.phoneNumber}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {num.locality && `${num.locality}, `}{num.region} · {num.country}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => onProvision(num.phoneNumber)}>
                      Get Number
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-secondary-200 dark:border-secondary-700 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

export default function PhoneSettingsPage() {
  const queryClient = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);

  const { data: phoneNumbers, isLoading } = useQuery({
    queryKey: ['phone-numbers'],
    queryFn: () => phoneNumbersApi.list().then(r => r.data),
  });

  const provisionMutation = useMutation({
    mutationFn: (phoneNumber) => phoneNumbersApi.provision(phoneNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      toast.success('Phone number provisioned successfully!');
      setShowSearch(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to provision number');
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id) => phoneNumbersApi.release(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      toast.success('Phone number released');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to release number');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => phoneNumbersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      toast.success('Phone number updated');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update number');
    },
  });

  const handleRelease = (id) => {
    if (window.confirm('Are you sure you want to release this phone number? This action cannot be undone.')) {
      releaseMutation.mutate(id);
    }
  };

  const handleUpdate = (id, data) => {
    updateMutation.mutate({ id, data });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeNumbers = phoneNumbers?.data?.filter(p => p.status === 'ACTIVE') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Phone Numbers
          </h1>
          <p className="text-secondary-500 mt-1">
            Manage your Twilio phone numbers for calls and SMS
          </p>
        </div>
        <Button onClick={() => setShowSearch(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Get Number
        </Button>
      </div>

      {activeNumbers.length === 0 ? (
        <EmptyState
          icon={PhoneIcon}
          title="No phone numbers"
          description="Get a phone number to start receiving calls and SMS messages"
          action={
            <Button onClick={() => setShowSearch(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Get Your First Number
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeNumbers.map((phone) => (
            <PhoneNumberCard
              key={phone.id}
              phone={phone}
              onRelease={handleRelease}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      <SearchNumbersModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onProvision={(num) => provisionMutation.mutate(num)}
      />
    </div>
  );
}
