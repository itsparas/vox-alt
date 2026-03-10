'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useUIStore } from '@/store';
import { Avatar, Badge } from '@/components/ui';
import {
  HomeIcon,
  PhoneIcon,
  CalendarIcon,
  DocumentTextIcon,
  UsersIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  ArrowRightOnRectangleIcon,
  LinkIcon,
  PhoneArrowUpRightIcon,
  ChatBubbleLeftRightIcon,
  InboxIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '@/app/theme-provider';

import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Calls', href: '/dashboard/calls', icon: PhoneIcon },
  { name: 'Phone Numbers', href: '/dashboard/phone-numbers', icon: DevicePhoneMobileIcon },
  { name: 'Agent', href: '/dashboard/agent', icon: PhoneArrowUpRightIcon },
  { name: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpenIcon },
  { name: 'Messages', href: '/dashboard/messages', icon: ChatBubbleLeftRightIcon },
  { name: 'Voicemails', href: '/dashboard/voicemails', icon: InboxIcon },
  { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarIcon },
  { name: 'Transcripts', href: '/dashboard/transcripts', icon: DocumentTextIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
];

const managementNav = [
  { name: 'Users', href: '/dashboard/users', icon: UsersIcon, permission: 'users:read' },
  { name: 'Integrations', href: '/dashboard/integrations', icon: LinkIcon, permission: 'config:read' },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCardIcon, permission: 'billing:read' },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon, permission: 'config:read' },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { user, tenant, logout, hasPermission } = useAuth();
  const { connected } = useSocket();
  const { theme, setTheme } = useTheme();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredManagementNav = managementNav.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-secondary-50 dark:bg-secondary-900">
        {/* Mobile sidebar backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700 transition-transform duration-300 lg:translate-x-0 lg:static',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-secondary-200 dark:border-secondary-700">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">V</span>
                </div>
                <span className="text-lg font-semibold text-secondary-900 dark:text-white">
                  VoxReception
                </span>
              </Link>
              <button
                className="lg:hidden p-1 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={clsx(
                        'sidebar-link',
                        isActive && 'active'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              {filteredManagementNav.length > 0 && (
                <>
                  <div className="mt-8 mb-2">
                    <span className="px-3 text-xs font-semibold uppercase tracking-wider text-secondary-400">
                      Management
                    </span>
                  </div>
                  <div className="space-y-1">
                    {filteredManagementNav.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={clsx(
                            'sidebar-link',
                            isActive && 'active'
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </nav>

            {/* Connection status */}
            <div className="p-4 border-t border-secondary-200 dark:border-secondary-700">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={clsx(
                    'h-2 w-2 rounded-full',
                    connected ? 'bg-success-500' : 'bg-danger-500'
                  )}
                />
                <span className="text-secondary-600 dark:text-secondary-400">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-16 items-center justify-between gap-4 border-b border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 px-4">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>

              {tenant && (
                <div className="hidden sm:block">
                  <h2 className="text-sm font-medium text-secondary-900 dark:text-white">
                    {tenant.name}
                  </h2>
                  <p className="text-xs text-secondary-500">
                    {tenant.plan} plan
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </button>

              {/* Notifications */}
              <button className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 relative">
                <BellIcon className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger-500" />
              </button>

              {/* User menu */}
              <div className="flex items-center gap-3 pl-3 border-l border-secondary-200 dark:border-secondary-700">
                <Avatar name={user?.name} size="sm" />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">
                    {user?.name}
                  </p>
                  <p className="text-xs text-secondary-500">{user?.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
