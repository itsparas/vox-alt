'use client';

import { useState, useMemo } from 'react';
import {
  useAnalyticsOverview,
  useAnalyticsVolume,
  useAnalyticsPeakHours,
  useAnalyticsOutcomes,
  useAnalyticsDuration,
  useAnalyticsTrends,
  useCallCapacity,
} from '@/hooks/queries';
import {
  ChartBarIcon,
  PhoneIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-secondary-500 dark:text-secondary-400">{title}</p>
          <p className="text-3xl font-bold text-secondary-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {trend >= 0 ? (
            <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-xs text-secondary-400 ml-1">vs previous period</span>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, maxValue, color = '#3b82f6' }) {
  if (!data?.length) return <p className="text-secondary-400 text-sm">No data available</p>;

  const max = maxValue || Math.max(...data.map((d) => d[valueKey]));

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-secondary-500 w-14 text-right shrink-0">
            {item[labelKey]}
          </span>
          <div className="flex-1 bg-secondary-100 dark:bg-secondary-700 rounded-full h-6 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: max > 0 ? `${(item[valueKey] / max) * 100}%` : '0%',
                backgroundColor: color,
                minWidth: item[valueKey] > 0 ? '8px' : '0px',
              }}
            />
          </div>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 w-10 text-right">
            {item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function OutcomePieChart({ outcomes }) {
  if (!outcomes?.length) return <p className="text-secondary-400 text-sm">No data</p>;

  const colors = {
    completed: '#22c55e',
    missed: '#f59e0b',
    failed: '#ef4444',
    cancelled: '#94a3b8',
  };

  const total = outcomes.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="flex items-center gap-6">
      {/* Visual ring */}
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {(() => {
            let offset = 0;
            return outcomes.map((o) => {
              const pct = total > 0 ? (o.count / total) * 100 : 0;
              const dashArray = `${pct} ${100 - pct}`;
              const el = (
                <circle
                  key={o.status}
                  r="15.9"
                  cx="18"
                  cy="18"
                  fill="none"
                  stroke={colors[o.status] || '#94a3b8'}
                  strokeWidth="3.5"
                  strokeDasharray={dashArray}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += pct;
              return el;
            });
          })()}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-secondary-900 dark:text-white">{total}</span>
          <span className="text-xs text-secondary-500">calls</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {outcomes.map((o) => (
          <div key={o.status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[o.status] || '#94a3b8' }}
            />
            <span className="text-sm text-secondary-600 dark:text-secondary-300 capitalize">
              {o.status}
            </span>
            <span className="text-sm font-medium text-secondary-900 dark:text-white ml-auto">
              {o.count} ({o.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapacityIndicator({ capacity }) {
  if (!capacity) return null;

  const { activeCount, limit, available, queueLength } = capacity;
  const isUnlimited = limit === 'unlimited';
  const utilization = isUnlimited ? 0 : (activeCount / limit) * 100;

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <SignalIcon className="h-5 w-5 text-secondary-500" />
        <h3 className="font-semibold text-secondary-900 dark:text-white">Live Capacity</h3>
        <span className="ml-auto flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-secondary-500">Live</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-secondary-900 dark:text-white">{activeCount}</p>
          <p className="text-xs text-secondary-500">Active</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-secondary-900 dark:text-white">
            {isUnlimited ? '∞' : available}
          </p>
          <p className="text-xs text-secondary-500">Available</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600">{queueLength}</p>
          <p className="text-xs text-secondary-500">Queued</p>
        </div>
      </div>

      {!isUnlimited && (
        <div>
          <div className="flex justify-between text-xs text-secondary-500 mb-1">
            <span>Utilization</span>
            <span>{Math.round(utilization)}%</span>
          </div>
          <div className="w-full bg-secondary-100 dark:bg-secondary-700 rounded-full h-2.5">
            <div
              className={`h-full rounded-full transition-all ${
                utilization >= 90 ? 'bg-red-500' : utilization >= 70 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, utilization)}%` }}
            />
          </div>
          <p className="text-xs text-secondary-400 mt-1">
            {activeCount} of {limit} concurrent calls
          </p>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);

  const dateParams = useMemo(() => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
    return { startDate, endDate };
  }, [period]);

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(dateParams);
  const { data: volume } = useAnalyticsVolume({ ...dateParams, groupBy: period <= 7 ? 'hour' : 'day' });
  const { data: peakHours } = useAnalyticsPeakHours(dateParams);
  const { data: outcomes } = useAnalyticsOutcomes(dateParams);
  const { data: duration } = useAnalyticsDuration(dateParams);
  const { data: trends } = useAnalyticsTrends(period);
  const { data: capacity } = useCallCapacity();

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Analytics</h1>
          <p className="text-secondary-500 dark:text-secondary-400">
            Call performance and insights
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-secondary-800 rounded-lg border border-secondary-200 dark:border-secondary-700 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Calls"
          value={overview?.data?.totalCalls ?? '—'}
          icon={PhoneIcon}
          color="blue"
          trend={trends?.data?.metrics?.totalCalls?.change}
        />
        <StatCard
          title="Completed"
          value={overview?.data?.completedCalls ?? '—'}
          subtitle={`${overview?.data?.completionRate ?? 0}% completion rate`}
          icon={CheckCircleIcon}
          color="green"
          trend={trends?.data?.metrics?.completedCalls?.change}
        />
        <StatCard
          title="Avg Duration"
          value={formatDuration(overview?.data?.avgDuration)}
          icon={ClockIcon}
          color="purple"
        />
        <StatCard
          title="Missed Calls"
          value={overview?.data?.missedCalls ?? '—'}
          icon={ExclamationTriangleIcon}
          color={overview?.data?.missedCalls > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Capacity + Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CapacityIndicator capacity={capacity?.data} />

        <div className="lg:col-span-2 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 p-6">
          <h3 className="font-semibold text-secondary-900 dark:text-white mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-secondary-500" />
            Call Outcomes
          </h3>
          <OutcomePieChart outcomes={outcomes?.data?.outcomes} />
        </div>
      </div>

      {/* Call Volume + Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 p-6">
          <h3 className="font-semibold text-secondary-900 dark:text-white mb-4">
            Call Volume {period <= 7 ? '(Hourly)' : '(Daily)'}
          </h3>
          <div className="max-h-80 overflow-y-auto">
            <BarChart
              data={volume?.data?.slice(-14)}
              labelKey="period"
              valueKey="total"
              color="#3b82f6"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 p-6">
          <h3 className="font-semibold text-secondary-900 dark:text-white mb-2">
            Peak Hours
          </h3>
          {peakHours?.data?.peakHour && (
            <p className="text-sm text-secondary-500 mb-4">
              Busiest hour: <span className="font-medium text-primary-600">{peakHours.data.peakHour}</span> ({peakHours.data.peakCount} calls)
            </p>
          )}
          <div className="max-h-72 overflow-y-auto">
            <BarChart
              data={peakHours?.data?.distribution?.filter((h) => h.count > 0)}
              labelKey="label"
              valueKey="count"
              color="#8b5cf6"
            />
          </div>
        </div>
      </div>

      {/* Duration Analysis */}
      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 p-6">
        <h3 className="font-semibold text-secondary-900 dark:text-white mb-4">
          Call Duration Analysis
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg">
            <p className="text-sm text-secondary-500">Average</p>
            <p className="text-xl font-bold text-secondary-900 dark:text-white">
              {formatDuration(duration?.data?.avgDuration)}
            </p>
          </div>
          <div className="text-center p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg">
            <p className="text-sm text-secondary-500">Median</p>
            <p className="text-xl font-bold text-secondary-900 dark:text-white">
              {formatDuration(duration?.data?.medianDuration)}
            </p>
          </div>
          <div className="text-center p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg">
            <p className="text-sm text-secondary-500">Shortest</p>
            <p className="text-xl font-bold text-secondary-900 dark:text-white">
              {formatDuration(duration?.data?.minDuration)}
            </p>
          </div>
          <div className="text-center p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg">
            <p className="text-sm text-secondary-500">Longest</p>
            <p className="text-xl font-bold text-secondary-900 dark:text-white">
              {formatDuration(duration?.data?.maxDuration)}
            </p>
          </div>
        </div>
        <h4 className="text-sm font-medium text-secondary-600 dark:text-secondary-400 mb-3">
          Duration Distribution
        </h4>
        <BarChart
          data={duration?.data?.durationBuckets}
          labelKey="label"
          valueKey="count"
          color="#22c55e"
        />
      </div>
    </div>
  );
}
