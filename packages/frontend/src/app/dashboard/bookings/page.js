'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useBookings, useCreateBooking, useCancelBooking } from '@/hooks/queries';
import { useFilterStore } from '@/store';
import { Card, Badge, Button, Input, Select, Spinner, EmptyState } from '@/components/ui';
import { toast } from '@/components/ui/Toaster';
import {
  CalendarIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const statusColors = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'secondary',
  NO_SHOW: 'danger',
};

function BookingCard({ booking, onCancel }) {
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={statusColors[booking.status] || 'secondary'}>
              {booking.status.toLowerCase()}
            </Badge>
            {booking.googleEventId && (
              <Badge variant="primary">Synced</Badge>
            )}
          </div>
          <h3 className="font-medium text-secondary-900 dark:text-white">
            {booking.title}
          </h3>
          <p className="text-sm text-secondary-500 mt-1">
            {booking.customerName}
            {booking.customerEmail && ` • ${booking.customerEmail}`}
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-secondary-600 dark:text-secondary-400">
            <span>
              {startTime.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span>
              {startTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
              {' - '}
              {endTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
          {booking.notes && (
            <p className="mt-2 text-sm text-secondary-500 line-clamp-2">
              {booking.notes}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/bookings/${booking.id}`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
          {booking.status === 'PENDING' || booking.status === 'CONFIRMED' ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger-600 hover:text-danger-700"
              onClick={() => onCancel(booking.id)}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CalendarView({ bookings, selectedDate, onDateChange }) {
  const daysInMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  ).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getBookingsForDay = (day) => {
    if (!day) return [];
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    return bookings.filter((b) => {
      const bookingDate = new Date(b.startTime);
      return (
        bookingDate.getDate() === day &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const prevMonth = () => {
    onDateChange(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onDateChange(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-secondary-900 dark:text-white">
          {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-secondary-500 py-2"
          >
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const dayBookings = getBookingsForDay(day);
          const isToday =
            day &&
            new Date().toDateString() ===
              new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day).toDateString();

          return (
            <div
              key={index}
              className={`min-h-[80px] p-1 border border-secondary-100 dark:border-secondary-700 rounded ${
                day ? 'bg-white dark:bg-secondary-800' : 'bg-secondary-50 dark:bg-secondary-900'
              }`}
            >
              {day && (
                <>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                      isToday
                        ? 'bg-primary-600 text-white'
                        : 'text-secondary-700 dark:text-secondary-300'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayBookings.slice(0, 2).map((booking) => (
                      <Link
                        key={booking.id}
                        href={`/dashboard/bookings/${booking.id}`}
                        className={`block text-xs truncate px-1 py-0.5 rounded ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                            : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                        }`}
                      >
                        {new Date(booking.startTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        {booking.title}
                      </Link>
                    ))}
                    {dayBookings.length > 2 && (
                      <span className="text-xs text-secondary-500">
                        +{dayBookings.length - 2} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function BookingsPage() {
  const { bookingFilters, setBookingFilters } = useFilterStore();
  const [viewMode, setViewMode] = useState('list'); // list or calendar
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [page, setPage] = useState(1);

  const cancelBooking = useCancelBooking();

  const queryParams = useMemo(() => ({
    page,
    limit: 20,
    status: bookingFilters.status !== 'all' ? bookingFilters.status : undefined,
    search: bookingFilters.search || undefined,
  }), [page, bookingFilters]);

  const { data, isLoading, error } = useBookings(queryParams);
  const bookings = data?.bookings || [];

  const handleCancel = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await cancelBooking.mutateAsync({ id: bookingId, reason: 'Cancelled by user' });
      toast.success('Booking cancelled');
    } catch (error) {
      toast.error('Failed to cancel booking');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Bookings
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Manage appointments and scheduling
          </p>
        </div>
        <Link href="/dashboard/bookings/new">
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <Input
                type="text"
                placeholder="Search bookings..."
                className="pl-10"
                value={bookingFilters.search}
                onChange={(e) => setBookingFilters({ search: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select
              value={bookingFilters.status}
              onChange={(e) => setBookingFilters({ status: e.target.value })}
              className="w-40"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <div className="flex rounded-lg border border-secondary-300 dark:border-secondary-700 overflow-hidden">
              <button
                className={`px-3 py-2 text-sm ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-secondary-800 text-secondary-600'
                }`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
              <button
                className={`px-3 py-2 text-sm ${
                  viewMode === 'calendar'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-secondary-800 text-secondary-600'
                }`}
                onClick={() => setViewMode('calendar')}
              >
                Calendar
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="text-center text-danger-600 py-12">
          Error loading bookings. Please try again.
        </Card>
      ) : viewMode === 'calendar' ? (
        <CalendarView
          bookings={bookings}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarIcon}
            title="No bookings found"
            description="Create your first booking or wait for customers to book"
            action={
              <Link href="/dashboard/bookings/new">
                <Button>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Booking
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
