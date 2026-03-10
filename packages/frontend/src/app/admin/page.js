'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, Spinner, Input, Select, Avatar, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  BuildingOfficeIcon,
  UsersIcon,
  PhoneIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ServerIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

// Admin API
const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getTenants: (params) => api.get('/admin/tenants', { params }),
  getTenant: (id) => api.get(`/admin/tenants/${id}`),
  updateTenant: (id, data) => api.put(`/admin/tenants/${id}`, data),
  deleteTenant: (id) => api.delete(`/admin/tenants/${id}`),
  getUsers: (params) => api.get('/admin/users', { params }),
  getSystemHealth: () => api.get('/admin/health'),
};

function StatCard({ icon: Icon, label, value, subValue, trend, color = 'primary' }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-secondary-500">{label}</p>
          <p className="text-3xl font-bold text-secondary-900 dark:text-white mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-sm text-secondary-500 mt-1">{subValue}</p>
          )}
        </div>
        <div className={`p-3 bg-${color}-100 dark:bg-${color}-900/30 rounded-lg`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center mt-4 text-sm">
          <ArrowTrendingUpIcon className={`h-4 w-4 mr-1 ${trend > 0 ? 'text-success-500' : 'text-danger-500'}`} />
          <span className={trend > 0 ? 'text-success-600' : 'text-danger-600'}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-secondary-500 ml-1">vs last month</span>
        </div>
      )}
    </Card>
  );
}

function TenantRow({ tenant, onView, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-secondary-50 dark:hover:bg-secondary-800">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <Avatar name={tenant.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-secondary-900 dark:text-white">
              {tenant.name}
            </p>
            <p className="text-xs text-secondary-500">{tenant.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={tenant.planId === 'enterprise' ? 'success' : tenant.planId === 'pro' ? 'primary' : 'secondary'}>
          {tenant.planId || 'free'}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {tenant._count?.users || 0}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {tenant._count?.calls || 0}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
        {new Date(tenant.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={tenant.status === 'active' ? 'success' : 'secondary'}>
          {tenant.status || 'active'}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onView(tenant.id)}>
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(tenant.id)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(tenant.id)}>
            <TrashIcon className="h-4 w-4 text-danger-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function RecentCallRow({ call }) {
  return (
    <tr className="hover:bg-secondary-50 dark:hover:bg-secondary-800">
      <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
        {call.tenant || 'Unknown'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge variant={call.status === 'COMPLETED' ? 'success' : call.status === 'ACTIVE' ? 'primary' : 'secondary'}>
          {call.status}
        </Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">
        {call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : '-'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">
        {new Date(call.createdAt).toLocaleString()}
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  // Check if user is super admin
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Fetch admin stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats().then(res => res.data),
    staleTime: 30 * 1000,
  });

  // Fetch tenants
  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['admin', 'tenants', { search: searchTerm, plan: planFilter }],
    queryFn: () => adminApi.getTenants({ search: searchTerm, plan: planFilter }).then(res => res.data),
    staleTime: 30 * 1000,
  });

  const deleteTenant = useMutation({
    mutationFn: (id) => adminApi.deleteTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'tenants']);
      queryClient.invalidateQueries(['admin', 'stats']);
    },
  });

  const handleDeleteTenant = async (id) => {
    if (confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      await deleteTenant.mutateAsync(id);
    }
  };

  const stats = statsData?.data || {};
  const tenants = tenantsData?.data?.tenants || [];

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-secondary-500">You need super admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          System-wide management and monitoring
        </p>
      </div>

      {/* Stats Overview */}
      {statsLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={BuildingOfficeIcon}
            label="Total Tenants"
            value={stats.tenants || 0}
            color="primary"
          />
          <StatCard
            icon={UsersIcon}
            label="Total Users"
            value={stats.users || 0}
            color="success"
          />
          <StatCard
            icon={PhoneIcon}
            label="Total Calls"
            value={stats.calls?.total || 0}
            subValue={`${stats.calls?.active || 0} active`}
            color="warning"
          />
          <StatCard
            icon={CalendarIcon}
            label="Total Bookings"
            value={stats.bookings || 0}
            color="secondary"
          />
        </div>
      )}

      {/* Plans Distribution */}
      {stats.tenantsByPlan && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
            Tenants by Plan
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.tenantsByPlan).map(([plan, count]) => (
              <div key={plan} className="text-center p-4 bg-secondary-50 dark:bg-secondary-800 rounded-lg">
                <p className="text-2xl font-bold text-secondary-900 dark:text-white">{count}</p>
                <p className="text-sm text-secondary-500 capitalize">{plan || 'Free'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      {stats.recentCalls?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
            Recent Calls
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                {stats.recentCalls.map((call) => (
                  <RecentCallRow key={call.id} call={call} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tenant Management */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Tenant Management
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <Input
                type="text"
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </div>
        </div>

        {tenantsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : !tenants.length ? (
          <EmptyState
            icon={BuildingOfficeIcon}
            title="No tenants found"
            description="No tenants match your search criteria."
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
              <thead className="bg-secondary-50 dark:bg-secondary-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Created
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
                {tenants.map((tenant) => (
                  <TenantRow
                    key={tenant.id}
                    tenant={tenant}
                    onView={(id) => router.push(`/admin/tenants/${id}`)}
                    onEdit={(id) => router.push(`/admin/tenants/${id}/edit`)}
                    onDelete={handleDeleteTenant}
                  />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* System Health */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          System Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <ServerIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-900 dark:text-white">API Server</p>
              <p className="text-xs text-success-600">Healthy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <ServerIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-900 dark:text-white">Database</p>
              <p className="text-xs text-success-600">Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <ServerIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-900 dark:text-white">Redis</p>
              <p className="text-xs text-success-600">Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <ServerIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-900 dark:text-white">LiveKit</p>
              <p className="text-xs text-success-600">Connected</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
