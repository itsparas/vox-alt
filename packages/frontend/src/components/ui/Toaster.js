'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Toast store
let toasts = [];
let listeners = [];

const notify = () => {
  listeners.forEach((listener) => listener(toasts));
};

export const toast = {
  success: (message, options = {}) => {
    const id = Date.now();
    toasts = [...toasts, { id, type: 'success', message, ...options }];
    notify();
    setTimeout(() => toast.dismiss(id), options.duration || 5000);
    return id;
  },
  error: (message, options = {}) => {
    const id = Date.now();
    toasts = [...toasts, { id, type: 'error', message, ...options }];
    notify();
    setTimeout(() => toast.dismiss(id), options.duration || 5000);
    return id;
  },
  warning: (message, options = {}) => {
    const id = Date.now();
    toasts = [...toasts, { id, type: 'warning', message, ...options }];
    notify();
    setTimeout(() => toast.dismiss(id), options.duration || 5000);
    return id;
  },
  info: (message, options = {}) => {
    const id = Date.now();
    toasts = [...toasts, { id, type: 'info', message, ...options }];
    notify();
    setTimeout(() => toast.dismiss(id), options.duration || 5000);
    return id;
  },
  dismiss: (id) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
  dismissAll: () => {
    toasts = [];
    notify();
  },
};

const icons = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const styles = {
  success: 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500',
  error: 'bg-danger-50 text-danger-700 dark:bg-danger-700/20 dark:text-danger-500',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-500',
  info: 'bg-primary-50 text-primary-700 dark:bg-primary-700/20 dark:text-primary-500',
};

const iconStyles = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-primary-500',
};

function ToastItem({ toast: t, onDismiss }) {
  const Icon = icons[t.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-medium animate-slide-up ${styles[t.type]}`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconStyles[t.type]}`} />
      <p className="text-sm font-medium flex-1">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const [mounted, setMounted] = useState(false);
  const [currentToasts, setCurrentToasts] = useState([]);

  useEffect(() => {
    setMounted(true);
    const listener = (newToasts) => setCurrentToasts([...newToasts]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {currentToasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={toast.dismiss} />
      ))}
    </div>,
    document.body
  );
}
