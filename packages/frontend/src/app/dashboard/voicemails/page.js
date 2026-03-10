'use client';

import { useState, useRef } from 'react';
import { useVoicemails, useVoicemailStats, useMarkVoicemailRead, useArchiveVoicemail, useDeleteVoicemail } from '@/hooks/queries';
import { Card, Badge, Button, Input, Spinner, EmptyState } from '@/components/ui';
import {
  InboxIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ArchiveBoxIcon,
  EnvelopeOpenIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

function formatDuration(ms) {
  if (!ms) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function AudioPlayer({ voicemailId }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={`${apiUrl}/api/voicemails/${voicemailId}/audio`}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button
        onClick={togglePlay}
        className="p-1.5 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
      >
        {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
      </button>
      <div className="flex-1 h-1.5 bg-secondary-200 dark:bg-secondary-700 rounded-full overflow-hidden min-w-[80px]">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-secondary-500 tabular-nums w-10 text-right">
        {duration ? formatDuration(duration * 1000) : '--:--'}
      </span>
    </div>
  );
}

function VoicemailCard({ voicemail, isExpanded, onToggle, onMarkRead, onArchive, onDelete }) {
  return (
    <div
      className={`border rounded-lg transition-colors ${
        !voicemail.isRead
          ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
          : 'bg-white dark:bg-secondary-800 border-secondary-200 dark:border-secondary-700'
      }`}
    >
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* Unread indicator */}
        <div className="flex-shrink-0">
          {!voicemail.isRead ? (
            <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full bg-transparent" />
          )}
        </div>

        {/* Caller info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${!voicemail.isRead ? 'text-secondary-900 dark:text-white' : 'text-secondary-700 dark:text-secondary-300'}`}>
              {voicemail.callerName || voicemail.callerPhone || 'Unknown Caller'}
            </p>
            {voicemail.isUrgent && (
              <Badge variant="danger" size="sm">
                <ExclamationTriangleIcon className="h-3 w-3 mr-0.5" />
                Urgent
              </Badge>
            )}
          </div>
          {voicemail.callerPhone && voicemail.callerName && (
            <p className="text-xs text-secondary-500 mt-0.5">
              <PhoneIcon className="h-3 w-3 inline mr-1" />
              {voicemail.callerPhone}
            </p>
          )}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1 text-xs text-secondary-500">
          <ClockIcon className="h-3.5 w-3.5" />
          {formatDuration(voicemail.durationMs)}
        </div>

        {/* Time */}
        <span className="text-xs text-secondary-500 whitespace-nowrap">
          {formatTime(voicemail.createdAt)}
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-secondary-200 dark:border-secondary-700 pt-3">
          {/* Audio player */}
          <AudioPlayer voicemailId={voicemail.id} />

          {/* Transcript */}
          {voicemail.transcript && (
            <div className="bg-secondary-50 dark:bg-secondary-900 rounded-md p-3">
              <p className="text-xs font-medium text-secondary-500 mb-1">Transcript</p>
              <p className="text-sm text-secondary-700 dark:text-secondary-300">
                {voicemail.transcript}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
            >
              {voicemail.isRead ? (
                <><EnvelopeIcon className="h-4 w-4 mr-1" /> Mark Unread</>
              ) : (
                <><EnvelopeOpenIcon className="h-4 w-4 mr-1" /> Mark Read</>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
            >
              <ArchiveBoxIcon className="h-4 w-4 mr-1" /> Archive
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger-600 hover:text-danger-700"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <TrashIcon className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoicemailsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, urgent
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const limit = 20;

  const queryParams = {
    page,
    limit,
    search: search || undefined,
    ...(filter === 'unread' && { isRead: 'false' }),
    ...(filter === 'urgent' && { isUrgent: 'true' }),
  };

  const { data, isLoading, refetch } = useVoicemails(queryParams);
  const { data: statsData } = useVoicemailStats();
  const markRead = useMarkVoicemailRead();
  const archive = useArchiveVoicemail();
  const deleteMutation = useDeleteVoicemail();

  const voicemails = data?.data || [];
  const pagination = data?.pagination;
  const unreadCount = data?.unreadCount || 0;
  const stats = statsData?.data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Voicemails
            {unreadCount > 0 && (
              <Badge variant="primary" className="ml-2 align-middle">
                {unreadCount} new
              </Badge>
            )}
          </h1>
          <p className="text-sm text-secondary-500 mt-1">
            Listen to and manage incoming voicemail messages
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-secondary-900 dark:text-white">{stats.total || 0}</p>
          <p className="text-xs text-secondary-500">Total</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary-600">{stats.unread || 0}</p>
          <p className="text-xs text-secondary-500">Unread</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-danger-600">{stats.urgent || 0}</p>
          <p className="text-xs text-secondary-500">Urgent</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-success-600">{stats.today || 0}</p>
          <p className="text-xs text-secondary-500">Today</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
          <Input
            placeholder="Search voicemails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'unread', 'urgent'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Voicemail list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : voicemails.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No voicemails"
          description={search ? 'No voicemails match your search.' : 'Your voicemail inbox is empty.'}
        />
      ) : (
        <div className="space-y-2">
          {voicemails.map((vm) => (
            <VoicemailCard
              key={vm.id}
              voicemail={vm}
              isExpanded={expandedId === vm.id}
              onToggle={() => setExpandedId(expandedId === vm.id ? null : vm.id)}
              onMarkRead={() => {
                markRead.mutate(
                  { id: vm.id, isRead: !vm.isRead },
                  { onSuccess: () => refetch() }
                );
              }}
              onArchive={() => {
                archive.mutate(vm.id, { onSuccess: () => refetch() });
              }}
              onDelete={() => {
                if (confirm('Delete this voicemail permanently?')) {
                  deleteMutation.mutate(vm.id, { onSuccess: () => refetch() });
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-secondary-200 dark:border-secondary-700">
          <p className="text-sm text-secondary-500">
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
