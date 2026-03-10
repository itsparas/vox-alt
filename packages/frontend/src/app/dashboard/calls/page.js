'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCalls, useActiveCalls } from '@/hooks/queries';
import { useFilterStore } from '@/store';
import { Card, Badge, Button, Input, Select, Spinner, Avatar, EmptyState } from '@/components/ui';
import {
  PhoneIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PhoneArrowUpRightIcon,
  PhoneXMarkIcon,
} from '@heroicons/react/24/outline';

const statusColors = {
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  MISSED: 'danger',
  ESCALATED: 'warning',
  VOICEMAIL: 'primary',
};

function CallRow({ call }) {
  const startTime = new Date(call.startTime);
  const duration = call.duration
    ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}`
    : '-';

  return (
    <tr className="hover:bg-secondary-50 dark:hover:bg-secondary-800">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <Avatar name={call.callerName || call.callerPhone} size="sm" />
          <div>
            <p className="text-sm font-medium text-secondary-900 dark:text-white">
              {call.callerName || 'Unknown'}
            </p>
            <p className="text-xs text-secondary-500">{call.callerPhone || '-'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={statusColors[call.status] || 'secondary'}>
          {call.status.toLowerCase()}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {startTime.toLocaleDateString()}{' '}
        {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {duration}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {call.outcome || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <Link
          href={`/dashboard/calls/${call.id}`}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

export default function CallsPage() {
  const { callFilters, setCallFilters } = useFilterStore();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: activeCallsData } = useActiveCalls();
  const activeCalls = activeCallsData || [];

  const queryParams = useMemo(() => ({
    page,
    limit,
    status: callFilters.status !== 'all' ? callFilters.status : undefined,
    search: callFilters.search || undefined,
    dateRange: callFilters.dateRange,
  }), [page, callFilters]);

  const { data, isLoading, error } = useCalls(queryParams);
  const calls = data?.calls || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Calls</h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Monitor and manage all incoming calls
          </p>
        </div>
      </div>

      {/* Active calls banner */}
      {activeCalls.length > 0 && (
        <Card className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 dark:bg-success-800 rounded-lg">
                <PhoneIcon className="h-5 w-5 text-success-600 dark:text-success-400 animate-pulse" />
              </div>
              <div>
                <p className="font-medium text-success-800 dark:text-success-200">
                  {activeCalls.length} Active Call{activeCalls.length > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-success-600 dark:text-success-400">
                  Click to view or take over
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {activeCalls.slice(0, 3).map((call) => (
                <Link
                  key={call.id}
                  href={`/dashboard/calls/${call.id}`}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-secondary-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <Avatar name={call.callerName} size="sm" />
                  <span className="text-sm font-medium">{call.callerName || 'Unknown'}</span>
                </Link>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <Input
                type="text"
                placeholder="Search by name or phone..."
                className="pl-10"
                value={callFilters.search}
                onChange={(e) => setCallFilters({ search: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select
              value={callFilters.status}
              onChange={(e) => setCallFilters({ status: e.target.value })}
              className="w-40"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="MISSED">Missed</option>
              <option value="ESCALATED">Escalated</option>
              <option value="VOICEMAIL">Voicemail</option>
            </Select>
            <Select
              value={callFilters.dateRange}
              onChange={(e) => setCallFilters({ dateRange: e.target.value })}
              className="w-40"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </Select>
            <Button variant="outline">
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Calls table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-danger-600">
            Error loading calls. Please try again.
          </div>
        ) : calls.length === 0 ? (
          <EmptyState
            icon={PhoneIcon}
            title="No calls found"
            description="Calls will appear here when customers contact you"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
                <thead className="bg-secondary-50 dark:bg-secondary-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Caller
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Outcome
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-secondary-900 divide-y divide-secondary-200 dark:divide-secondary-700">
                  {calls.map((call) => (
                    <CallRow key={call.id} call={call} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-secondary-200 dark:border-secondary-700">
                <p className="text-sm text-secondary-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
