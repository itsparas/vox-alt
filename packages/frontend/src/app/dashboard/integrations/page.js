'use client';

import { useState } from 'react';
import { useTenantConfig, useCalendars, useSelectCalendar, useDisconnectGoogle } from '@/hooks/queries';
import { integrationsApi } from '@/lib/api';
import { Card, Badge, Button, Spinner, Select } from '@/components/ui';
import {
  LinkIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const integrations = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync appointments and availability with Google Calendar',
    icon: CalendarIcon,
    category: 'Calendar',
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    description: 'Sync appointments with Microsoft Outlook Calendar',
    icon: CalendarIcon,
    category: 'Calendar',
    comingSoon: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get call notifications and summaries in Slack',
    icon: LinkIcon,
    category: 'Communication',
    comingSoon: true,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect to 5000+ apps with Zapier automation',
    icon: LinkIcon,
    category: 'Automation',
    comingSoon: true,
  },
];

function IntegrationCard({ integration, isConnected, isConnecting, onConnect, onDisconnect, config }) {
  const Icon = integration.icon;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${isConnected ? 'bg-success-100 dark:bg-success-900/30' : 'bg-secondary-100 dark:bg-secondary-800'}`}>
            <Icon className={`h-6 w-6 ${isConnected ? 'text-success-600' : 'text-secondary-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-secondary-900 dark:text-white">
                {integration.name}
              </h3>
              {integration.comingSoon && (
                <Badge variant="secondary">Coming Soon</Badge>
              )}
            </div>
            <p className="text-sm text-secondary-500 mt-1">
              {integration.description}
            </p>
            {isConnected && config?.googleCalendarEmail && (
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-2 flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4 text-success-500" />
                Connected as {config.googleCalendarEmail}
              </p>
            )}
          </div>
        </div>
        <div>
          {integration.comingSoon ? (
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          ) : isConnected ? (
            <Button
              variant="danger"
              onClick={onDisconnect}
              disabled={isConnecting}
              className="flex items-center gap-2"
            >
              {isConnecting ? <Spinner size="sm" /> : <TrashIcon className="h-4 w-4" />}
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-2"
            >
              {isConnecting ? <Spinner size="sm" /> : <PlusIcon className="h-4 w-4" />}
              Connect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function CalendarSelector({ calendars, selectedCalendarId, onSelect, isSelecting }) {
  return (
    <Card className="p-6 mt-4">
      <h3 className="font-semibold text-secondary-900 dark:text-white mb-4">
        Select Calendar for Bookings
      </h3>
      <div className="flex items-center gap-4">
        <Select
          value={selectedCalendarId || ''}
          onChange={(e) => onSelect(e.target.value)}
          disabled={isSelecting}
          className="flex-1"
        >
          <option value="">Select a calendar...</option>
          {calendars?.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.summary} {calendar.primary && '(Primary)'}
            </option>
          ))}
        </Select>
        {isSelecting && <Spinner size="sm" />}
      </div>
      <p className="text-sm text-secondary-500 mt-2">
        New bookings will be added to the selected calendar.
      </p>
    </Card>
  );
}

export default function IntegrationsPage() {
  const { data: config, isLoading: configLoading } = useTenantConfig();
  const { data: calendars, isLoading: calendarsLoading } = useCalendars();
  const selectCalendar = useSelectCalendar();
  const disconnectGoogle = useDisconnectGoogle();
  
  const [connectingId, setConnectingId] = useState(null);

  const isGoogleConnected = !!config?.googleCalendarConnected;

  const handleConnectGoogle = async () => {
    setConnectingId('google_calendar');
    try {
      const response = await integrationsApi.getGoogleAuthUrl();
      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Failed to get Google auth URL:', error);
      alert('Failed to connect to Google. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? This will stop syncing your calendar.')) {
      return;
    }
    setConnectingId('google_calendar');
    try {
      await disconnectGoogle.mutateAsync();
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      alert('Failed to disconnect. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleSelectCalendar = async (calendarId) => {
    try {
      await selectCalendar.mutateAsync(calendarId);
    } catch (error) {
      console.error('Failed to select calendar:', error);
      alert('Failed to select calendar. Please try again.');
    }
  };

  const getIntegrationConfig = (integrationId) => {
    switch (integrationId) {
      case 'google_calendar':
        return {
          isConnected: isGoogleConnected,
          onConnect: handleConnectGoogle,
          onDisconnect: handleDisconnectGoogle,
        };
      default:
        return {
          isConnected: false,
          onConnect: () => {},
          onDisconnect: () => {},
        };
    }
  };

  if (configLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Integrations</h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Connect VoxReception with your favorite tools
        </p>
      </div>

      {/* Connected Integrations Status */}
      <Card className="p-6 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/10 border-primary-200 dark:border-primary-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white dark:bg-secondary-800 rounded-lg shadow-sm">
            <LinkIcon className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-secondary-900 dark:text-white">
              Integration Status
            </h3>
            <p className="text-sm text-secondary-600 dark:text-secondary-400">
              {isGoogleConnected ? (
                <span className="flex items-center gap-1">
                  <CheckCircleIcon className="h-4 w-4 text-success-500" />
                  Google Calendar connected
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircleIcon className="h-4 w-4 text-secondary-400" />
                  No integrations connected
                </span>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Calendar Integrations */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Calendar Integrations
        </h2>
        <div className="space-y-4">
          {integrations
            .filter((i) => i.category === 'Calendar')
            .map((integration) => {
              const integConfig = getIntegrationConfig(integration.id);
              return (
                <div key={integration.id}>
                  <IntegrationCard
                    integration={integration}
                    isConnected={integConfig.isConnected}
                    isConnecting={connectingId === integration.id}
                    onConnect={integConfig.onConnect}
                    onDisconnect={integConfig.onDisconnect}
                    config={config}
                  />
                  {integration.id === 'google_calendar' && isGoogleConnected && (
                    <CalendarSelector
                      calendars={calendars}
                      selectedCalendarId={config?.selectedCalendarId}
                      onSelect={handleSelectCalendar}
                      isSelecting={selectCalendar.isPending}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Other Integrations */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Other Integrations
        </h2>
        <div className="space-y-4">
          {integrations
            .filter((i) => i.category !== 'Calendar')
            .map((integration) => {
              const integConfig = getIntegrationConfig(integration.id);
              return (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  isConnected={integConfig.isConnected}
                  isConnecting={connectingId === integration.id}
                  onConnect={integConfig.onConnect}
                  onDisconnect={integConfig.onDisconnect}
                  config={config}
                />
              );
            })}
        </div>
      </div>

      {/* API Documentation Link */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-secondary-900 dark:text-white">
              API Access
            </h3>
            <p className="text-sm text-secondary-500 mt-1">
              Build custom integrations using our REST API
            </p>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            View API Docs
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
