'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authApi.me();
      const userData = response.data.data;
      setUser(userData);
      setTenant(userData.tenant);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authApi.login(email, password);
      const { accessToken, refreshToken, user: userData } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      setUser(userData);
      setTenant(userData.tenant);

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async (data) => {
    try {
      setError(null);
      const response = await authApi.register(data);
      const { accessToken, refreshToken, user: userData } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      setUser(userData);
      setTenant(userData.tenant);

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setTenant(null);
      router.push('/login');
    }
  };

  const hasRole = (roles) => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const hasPermission = (permission) => {
    if (!user) return false;

    const rolePermissions = {
      SUPER_ADMIN: ['*'],
      TENANT_ADMIN: [
        'tenant:read', 'tenant:write',
        'users:read', 'users:write',
        'calls:read', 'calls:write',
        'bookings:read', 'bookings:write',
        'billing:read', 'billing:write',
        'transcripts:read',
        'config:read', 'config:write',
      ],
      AGENT: [
        'calls:read', 'calls:write',
        'bookings:read', 'bookings:write',
        'transcripts:read',
      ],
      VIEWER: [
        'calls:read',
        'bookings:read',
        'transcripts:read',
      ],
    };

    const permissions = rolePermissions[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  };

  const value = {
    user,
    tenant,
    loading,
    error,
    login,
    register,
    logout,
    hasRole,
    hasPermission,
    refreshUser: fetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function ProtectedRoute({ children, roles, permissions }) {
  const { user, loading, hasRole, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (roles && !hasRole(roles)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">
          Access Denied
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          You don&apos;t have permission to access this page.
        </p>
      </div>
    );
  }

  if (permissions) {
    const permArray = Array.isArray(permissions) ? permissions : [permissions];
    const hasAllPermissions = permArray.every((p) => hasPermission(p));
    if (!hasAllPermissions) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      );
    }
  }

  return children;
}
