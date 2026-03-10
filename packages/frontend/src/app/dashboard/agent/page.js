'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEscalatedCalls, useJoinCall } from '@/hooks/queries';
import { useSocket } from '@/contexts/SocketContext';
import { Card, Badge, Button, Spinner, EmptyState } from '@/components/ui';
import {
  PhoneArrowUpRightIcon,
  PhoneIcon,
  UserIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { LiveKitRoom, VideoConference, RoomAudioRenderer, ControlBar } from '@livekit/components-react';
import '@livekit/components-styles';

const urgencyColors = {
  urgent: 'danger',
  high: 'warning',
  normal: 'primary',
  low: 'secondary',
};

function EscalatedCallCard({ call, onJoin, isJoining }) {
  const escalatedTime = call.escalatedAt ? new Date(call.escalatedAt) : new Date(call.createdAt);
  const timeSinceEscalation = Math.floor((Date.now() - escalatedTime.getTime()) / 1000 / 60);

  return (
    <Card className="p-4 border-l-4 border-l-warning-500">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
            <ExclamationTriangleIcon className="h-6 w-6 text-warning-600" />
          </div>
          <div>
            <h3 className="font-medium text-secondary-900 dark:text-white">
              {call.callerName || 'Unknown Caller'}
            </h3>
            <p className="text-sm text-secondary-500">
              {call.callerPhone || 'No phone number'}
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm text-secondary-600">
              <span className="flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                {timeSinceEscalation} min ago
              </span>
              {call.notes && (
                <span className="text-secondary-500">
                  Reason: {call.notes}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={urgencyColors[call.metadata?.urgency] || 'primary'}>
            {call.metadata?.urgency || 'normal'}
          </Badge>
          <Button
            onClick={() => onJoin(call.id)}
            disabled={isJoining}
            className="flex items-center gap-2"
          >
            {isJoining ? (
              <Spinner size="sm" />
            ) : (
              <PhoneArrowUpRightIcon className="h-4 w-4" />
            )}
            Join Call
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ActiveCallView({ roomToken, roomUrl, callId, onLeave }) {
  return (
    <div className="h-[calc(100vh-12rem)]">
      <LiveKitRoom
        token={roomToken}
        serverUrl={roomUrl}
        connect={true}
        onDisconnected={onLeave}
        data-lk-theme="default"
        className="h-full"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 relative">
            <RoomAudioRenderer />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="p-6 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4 inline-block">
                  <PhoneIcon className="h-12 w-12 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
                  Connected to Call
                </h2>
                <p className="text-secondary-500">You are now speaking with the caller</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-secondary-100 dark:bg-secondary-800">
            <ControlBar 
              variation="minimal"
              controls={{
                microphone: true,
                camera: false,
                screenShare: false,
                leave: true,
              }}
            />
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
}

export default function AgentPage() {
  const { data: escalatedCalls, isLoading, refetch } = useEscalatedCalls();
  const joinCallMutation = useJoinCall();
  const socket = useSocket();
  
  const [activeCall, setActiveCall] = useState(null);
  const [joiningCallId, setJoiningCallId] = useState(null);

  // Listen for new escalated calls via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleEscalated = (data) => {
      console.log('Call escalated:', data);
      refetch();
    };

    socket.on('call:escalated', handleEscalated);

    return () => {
      socket.off('call:escalated', handleEscalated);
    };
  }, [socket, refetch]);

  const handleJoinCall = useCallback(async (callId) => {
    setJoiningCallId(callId);
    try {
      const response = await joinCallMutation.mutateAsync(callId);
      setActiveCall({
        callId,
        token: response.data.token,
        url: response.data.url,
        roomName: response.data.roomName,
      });
    } catch (error) {
      console.error('Failed to join call:', error);
      alert('Failed to join call. Please try again.');
    } finally {
      setJoiningCallId(null);
    }
  }, [joinCallMutation]);

  const handleLeaveCall = useCallback(() => {
    setActiveCall(null);
    refetch();
  }, [refetch]);

  if (activeCall) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Active Call</h1>
            <p className="text-secondary-600 dark:text-secondary-400">
              Connected to room: {activeCall.roomName}
            </p>
          </div>
          <Button variant="danger" onClick={handleLeaveCall}>
            Leave Call
          </Button>
        </div>
        <ActiveCallView
          roomToken={activeCall.token}
          roomUrl={activeCall.url}
          callId={activeCall.callId}
          onLeave={handleLeaveCall}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Agent Dashboard</h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Escalated calls waiting for human assistance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900 dark:text-white">
                {escalatedCalls?.length || 0}
              </p>
              <p className="text-sm text-secondary-500">Waiting Calls</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <UserIcon className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900 dark:text-white">Online</p>
              <p className="text-sm text-secondary-500">Your Status</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <PhoneIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900 dark:text-white">Ready</p>
              <p className="text-sm text-secondary-500">Available to Take Calls</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Escalated Calls List */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Escalated Calls
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !escalatedCalls?.length ? (
          <EmptyState
            icon={PhoneIcon}
            title="No escalated calls"
            description="When callers request to speak with a human agent, their calls will appear here."
          />
        ) : (
          <div className="space-y-4">
            {escalatedCalls.map((call) => (
              <EscalatedCallCard
                key={call.id}
                call={call}
                onJoin={handleJoinCall}
                isJoining={joiningCallId === call.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
