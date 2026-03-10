'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCall, useCallTranscript, useSetCallDisposition } from '@/hooks/queries';
import { callsApi } from '@/lib/api';
import { Card, Badge, Button, Spinner, Avatar } from '@/components/ui';
import {
  ArrowLeftIcon,
  PhoneIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const statusColors = {
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  MISSED: 'danger',
  ESCALATED: 'warning',
  VOICEMAIL: 'primary',
};

function AudioPlayer({ callId }) {
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    loadRecording();
  }, [callId]);

  const loadRecording = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await callsApi.getRecording(callId);
      setRecording(response.data);
      setDuration(response.data.durationMs / 1000);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No recording available');
      } else {
        setError('Failed to load recording');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setPlaying(false);
    const handleLoadedMetadata = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [recording]);

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setPlaying(!playing);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-4">
          <Spinner size="md" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="text-center text-secondary-500 py-4">
          <SpeakerWaveIcon className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Button
          variant="primary"
          className="rounded-full p-3"
          onClick={togglePlay}
        >
          {playing ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="h-6 w-6" />
          )}
        </Button>

        <div className="flex-1">
          <div
            className="h-2 bg-secondary-200 dark:bg-secondary-700 rounded-full cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary-600 rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-secondary-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {recording?.url && (
        <audio ref={audioRef} src={recording.url} preload="metadata" />
      )}
    </Card>
  );
}

function TranscriptView({ transcript }) {
  if (!transcript?.segments?.length) {
    return (
      <div className="text-center text-secondary-500 py-8">
        <DocumentTextIcon className="h-12 w-12 mx-auto mb-2" />
        <p>No transcript available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {transcript.segments.map((segment, index) => (
        <div
          key={index}
          className={`flex gap-3 ${
            segment.speaker === 'assistant' ? 'flex-row' : 'flex-row-reverse'
          }`}
        >
          <Avatar
            name={segment.speaker === 'assistant' ? 'AI' : 'Caller'}
            size="sm"
          />
          <div
            className={`max-w-[80%] p-3 rounded-lg ${
              segment.speaker === 'assistant'
                ? 'bg-primary-100 dark:bg-primary-900/30'
                : 'bg-secondary-100 dark:bg-secondary-800'
            }`}
          >
            <p className="text-sm text-secondary-900 dark:text-white">
              {segment.text}
            </p>
            {segment.timestamp && (
              <p className="text-xs text-secondary-500 mt-1">
                {new Date(segment.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const DISPOSITIONS = [
  'ANSWERED', 'VOICEMAIL', 'MISSED', 'ABANDONED', 'TRANSFERRED',
  'ESCALATED', 'BOOKED', 'MESSAGE_TAKEN', 'INFO_PROVIDED', 'SPAM', 'FOLLOW_UP_NEEDED',
];

const SENTIMENTS = ['positive', 'neutral', 'negative'];

const sentimentColors = {
  positive: 'text-success-600 bg-success-100 dark:bg-success-900/30',
  neutral: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-800',
  negative: 'text-danger-600 bg-danger-100 dark:bg-danger-900/30',
};

function DispositionSection({ call }) {
  const setDisposition = useSetCallDisposition();
  const [editing, setEditing] = useState(false);
  const [disposition, setDisp] = useState(call.disposition || '');
  const [sentiment, setSentiment] = useState(call.sentiment || '');
  const [notes, setNotes] = useState(call.notes || '');

  const handleSave = () => {
    setDisposition.mutate(
      { callId: call.id, disposition, notes, sentiment },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* AI Summary */}
      {call.summary && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-2">AI Summary</h3>
          <p className="text-sm text-secondary-900 dark:text-white">{call.summary}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {call.sentiment && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sentimentColors[call.sentiment] || sentimentColors.neutral}`}>
                {call.sentiment}
              </span>
            )}
            {call.primaryIntent && (
              <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                {call.primaryIntent}
              </span>
            )}
            {call.intents?.map((intent, i) => (
              intent !== call.primaryIntent && (
                <span key={i} className="text-xs bg-secondary-100 dark:bg-secondary-800 text-secondary-600 px-2 py-0.5 rounded-full">
                  {intent}
                </span>
              )
            ))}
          </div>
        </Card>
      )}

      {/* Disposition */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">Disposition</h3>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-secondary-500 block mb-1">Disposition</label>
              <select
                className="w-full rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-sm px-3 py-1.5"
                value={disposition}
                onChange={(e) => setDisp(e.target.value)}
              >
                <option value="">Select...</option>
                {DISPOSITIONS.map((d) => (
                  <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 block mb-1">Sentiment</label>
              <div className="flex gap-2">
                {SENTIMENTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSentiment(s)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      sentiment === s
                        ? sentimentColors[s] + ' border-transparent font-medium'
                        : 'border-secondary-300 dark:border-secondary-600 text-secondary-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 block mb-1">Notes</label>
              <textarea
                className="w-full rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-sm px-3 py-1.5 min-h-[60px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this call..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={handleSave} disabled={!disposition}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {call.disposition ? (
              <Badge variant="primary" className="mb-2">
                {call.disposition.replace(/_/g, ' ')}
              </Badge>
            ) : (
              <p className="text-sm text-secondary-500 italic">No disposition set</p>
            )}
            {call.notes && (
              <p className="text-sm text-secondary-700 dark:text-secondary-300 mt-2">{call.notes}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: call, isLoading: callLoading } = useCall(params.id);
  const { data: transcript } = useCallTranscript(params.id);

  if (callLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
          Call not found
        </h2>
        <Button variant="outline" onClick={() => router.push('/dashboard/calls')} className="mt-4">
          Back to Calls
        </Button>
      </div>
    );
  }

  const startTime = call.startedAt ? new Date(call.startedAt) : new Date(call.createdAt);
  const duration = call.durationSeconds
    ? `${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`
    : '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/calls')}
          className="p-2"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Call Details
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            {call.callerName || call.callerPhone || 'Unknown Caller'}
          </p>
        </div>
        <Badge variant={statusColors[call.status] || 'secondary'} size="lg">
          {call.status}
        </Badge>
      </div>

      {/* Call Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <UserIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Caller</p>
              <p className="font-medium text-secondary-900 dark:text-white">
                {call.callerName || 'Unknown'}
              </p>
              {call.callerPhone && (
                <p className="text-xs text-secondary-500">{call.callerPhone}</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Date & Time</p>
              <p className="font-medium text-secondary-900 dark:text-white">
                {startTime.toLocaleDateString()}
              </p>
              <p className="text-xs text-secondary-500">
                {startTime.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <ClockIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Duration</p>
              <p className="font-medium text-secondary-900 dark:text-white">
                {duration}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
              <PhoneIcon className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Outcome</p>
              <p className="font-medium text-secondary-900 dark:text-white">
                {call.outcome || call.primaryIntent || '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Disposition & Summary */}
      <DispositionSection call={call} />

      {/* Recording */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Recording
        </h2>
        <AudioPlayer callId={params.id} />
      </div>

      {/* Transcript */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Transcript
        </h2>
        <Card className="p-4">
          <TranscriptView transcript={transcript} />
        </Card>
      </div>

      {/* Bookings from this call */}
      {call.bookings?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
            Bookings Created
          </h2>
          <div className="space-y-2">
            {call.bookings.map((booking) => (
              <Card key={booking.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-primary-600" />
                    <div>
                      <p className="font-medium text-secondary-900 dark:text-white">
                        {booking.title || 'Appointment'}
                      </p>
                      <p className="text-sm text-secondary-500">
                        {new Date(booking.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={booking.status === 'CONFIRMED' ? 'success' : 'secondary'}>
                    {booking.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
