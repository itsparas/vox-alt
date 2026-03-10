'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantStats, useActiveCalls, useBookings } from '@/hooks/queries';
import { Card, Badge, Spinner, Avatar } from '@/components/ui';
import {
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PhoneArrowUpRightIcon,
} from '@heroicons/react/24/outline';

function StatCard({ title, value, change, changeType, icon: Icon, link }) {
  const Wrapper = link ? Link : 'div';
  
  return (
    <Wrapper href={link || '#'} className="block">
      <Card className="hover:shadow-medium transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-secondary-500 dark:text-secondary-400">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">
              {value}
            </p>
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {changeType === 'increase' ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-success-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-danger-500" />
                )}
                <span
                  className={`text-sm font-medium ${
                    changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
                  }`}
                >
                  {change}%
                </span>
                <span className="text-sm text-secondary-500">vs last period</span>
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
        </div>
      </Card>
    </Wrapper>
  );
}

function ActiveCallCard({ call }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700 last:border-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={call.callerName || 'Unknown'} size="sm" />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-success-500 border-2 border-white dark:border-secondary-800 animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-secondary-900 dark:text-white">
            {call.callerName || call.callerPhone || 'Unknown Caller'}
          </p>
          <p className="text-xs text-secondary-500">
            {call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : 'Just started'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={call.status === 'active' ? 'success' : 'warning'}>
          {call.status}
        </Badge>
        <Link
          href={`/dashboard/calls/${call.id}`}
          className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"
        >
          <PhoneArrowUpRightIcon className="h-4 w-4 text-secondary-500" />
        </Link>
      </div>
    </div>
  );
}

function UpcomingBookingCard({ booking }) {
  const date = new Date(booking.startTime);
  
  return (
    <div className="flex items-center gap-4 p-4 border-b border-secondary-200 dark:border-secondary-700 last:border-0">
      <div className="flex-shrink-0 w-12 text-center">
        <p className="text-xs font-medium text-secondary-500 uppercase">
          {date.toLocaleDateString('en-US', { weekday: 'short' })}
        </p>
        <p className="text-lg font-bold text-secondary-900 dark:text-white">
          {date.getDate()}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary-900 dark:text-white truncate">
          {booking.title}
        </p>
        <p className="text-xs text-secondary-500">
          {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {booking.customerName && ` • ${booking.customerName}`}
        </p>
      </div>
      <Badge
        variant={
          booking.status === 'CONFIRMED'
            ? 'success'
            : booking.status === 'PENDING'
            ? 'warning'
            : 'secondary'
        }
      >
        {booking.status.toLowerCase()}
      </Badge>
    </div>
  );
}

export default function DashboardPage() {
  const { tenant } = useAuth();
  
  // Get date range for stats (last 30 days)
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, []);

  const { data: stats, isLoading: statsLoading } = useTenantStats(
    dateRange.startDate,
    dateRange.endDate
  );
  
  const { data: activeCalls, isLoading: callsLoading } = useActiveCalls();
  
  const { data: bookingsData, isLoading: bookingsLoading } = useBookings({
    status: 'upcoming',
    limit: 5,
  });

  const upcomingBookings = bookingsData?.bookings || [];

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Welcome back! Here&apos;s what&apos;s happening with your receptionist.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Calls"
          value={stats?.totalCalls || 0}
          change={stats?.callsChange}
          changeType={stats?.callsChange >= 0 ? 'increase' : 'decrease'}
          icon={PhoneIcon}
          link="/dashboard/calls"
        />
        <StatCard
          title="Bookings Made"
          value={stats?.totalBookings || 0}
          change={stats?.bookingsChange}
          changeType={stats?.bookingsChange >= 0 ? 'increase' : 'decrease'}
          icon={CalendarIcon}
          link="/dashboard/bookings"
        />
        <StatCard
          title="Avg Call Duration"
          value={stats?.avgCallDuration ? `${Math.floor(stats.avgCallDuration / 60)}m` : '0m'}
          icon={ClockIcon}
        />
        <StatCard
          title="Active Users"
          value={stats?.activeUsers || 0}
          icon={UserGroupIcon}
          link="/dashboard/users"
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active calls */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
            <h3 className="font-semibold text-secondary-900 dark:text-white">
              Active Calls
            </h3>
            <Badge variant="primary">{activeCalls?.length || 0}</Badge>
          </div>
          <div className="divide-y divide-secondary-200 dark:divide-secondary-700">
            {callsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : activeCalls?.length > 0 ? (
              activeCalls.map((call) => (
                <ActiveCallCard key={call.id} call={call} />
              ))
            ) : (
              <div className="py-8 text-center text-secondary-500">
                <PhoneIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active calls</p>
              </div>
            )}
          </div>
          <div className="p-4 bg-secondary-50 dark:bg-secondary-900">
            <Link
              href="/dashboard/calls"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all calls →
            </Link>
          </div>
        </Card>

        {/* Upcoming bookings */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
            <h3 className="font-semibold text-secondary-900 dark:text-white">
              Upcoming Bookings
            </h3>
            <Link
              href="/dashboard/bookings/new"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              + Add
            </Link>
          </div>
          <div className="divide-y divide-secondary-200 dark:divide-secondary-700">
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : upcomingBookings.length > 0 ? (
              upcomingBookings.map((booking) => (
                <UpcomingBookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <div className="py-8 text-center text-secondary-500">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming bookings</p>
              </div>
            )}
          </div>
          <div className="p-4 bg-secondary-50 dark:bg-secondary-900">
            <Link
              href="/dashboard/bookings"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all bookings →
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <h3 className="font-semibold text-secondary-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/dashboard/settings"
            className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 mb-2">
              <PhoneIcon className="h-6 w-6 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-secondary-900 dark:text-white">
              Configure AI
            </span>
          </Link>
          <Link
            href="/dashboard/integrations"
            className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 mb-2">
              <CalendarIcon className="h-6 w-6 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-secondary-900 dark:text-white">
              Connect Calendar
            </span>
          </Link>
          <Link
            href="/dashboard/users/invite"
            className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 mb-2">
              <UserGroupIcon className="h-6 w-6 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-secondary-900 dark:text-white">
              Invite Team
            </span>
          </Link>
          <Link
            href="/dashboard/settings/embed"
            className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 mb-2">
              <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-secondary-900 dark:text-white">
              Get Widget Code
            </span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
