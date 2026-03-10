'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

// Button Component
export const Button = forwardRef(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    children,
    ...props
  },
  ref
) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary:
      'bg-secondary-200 text-secondary-800 hover:bg-secondary-300 focus:ring-secondary-400 dark:bg-secondary-700 dark:text-secondary-100 dark:hover:bg-secondary-600',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500',
    ghost:
      'bg-transparent hover:bg-secondary-100 dark:hover:bg-secondary-800 focus:ring-secondary-400',
    outline:
      'border border-secondary-300 dark:border-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-800 focus:ring-primary-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      ref={ref}
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

// Input Component
export const Input = forwardRef(function Input(
  { className, type = 'text', error, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={clsx(
        'block w-full rounded-lg border shadow-sm transition-colors',
        'focus:border-primary-500 focus:ring-primary-500 focus:outline-none focus:ring-2',
        'dark:bg-secondary-800 dark:text-white',
        error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
          : 'border-secondary-300 dark:border-secondary-700',
        className
      )}
      {...props}
    />
  );
});

// Textarea Component
export const Textarea = forwardRef(function Textarea(
  { className, error, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        'block w-full rounded-lg border shadow-sm transition-colors resize-none',
        'focus:border-primary-500 focus:ring-primary-500 focus:outline-none focus:ring-2',
        'dark:bg-secondary-800 dark:text-white',
        error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
          : 'border-secondary-300 dark:border-secondary-700',
        className
      )}
      {...props}
    />
  );
});

// Select Component
export const Select = forwardRef(function Select(
  { className, error, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={clsx(
        'block w-full rounded-lg border shadow-sm transition-colors',
        'focus:border-primary-500 focus:ring-primary-500 focus:outline-none focus:ring-2',
        'dark:bg-secondary-800 dark:text-white',
        error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
          : 'border-secondary-300 dark:border-secondary-700',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

// Label Component
export function Label({ className, children, required, ...props }) {
  return (
    <label
      className={clsx(
        'block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-danger-500 ml-1">*</span>}
    </label>
  );
}

// Card Component
export function Card({ className, bordered = false, children, ...props }) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-secondary-800 rounded-xl p-6',
        bordered
          ? 'border border-secondary-200 dark:border-secondary-700'
          : 'shadow-soft',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Badge Component
export function Badge({ className, variant = 'primary', children, ...props }) {
  const variants = {
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    success: 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500',
    warning: 'bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-500',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-700/20 dark:text-danger-500',
    secondary:
      'bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// Spinner Component
export function Spinner({ className, size = 'md' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <svg
      className={clsx('animate-spin text-primary-600', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// Empty State Component
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="mx-auto h-12 w-12 text-secondary-400">
          <Icon className="h-12 w-12" />
        </div>
      )}
      <h3 className="mt-4 text-sm font-medium text-secondary-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// Avatar Component
export function Avatar({ src, name, size = 'md', className }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={clsx('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 flex items-center justify-center font-medium',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

// Skeleton Component
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-md bg-secondary-200 dark:bg-secondary-700',
        className
      )}
      {...props}
    />
  );
}
