'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LiveKitRoom,
  useRoomContext,
  useTracks,
  AudioTrack,
  useConnectionState,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

function CallInterface({ onEnd }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const transcriptRef = useRef(null);

  // Track call duration
  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      const interval = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [connectionState]);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  }, [localParticipant, isMuted]);

  // Handle end call
  const handleEndCall = useCallback(() => {
    room?.disconnect();
    onEnd();
  }, [room, onEnd]);

  // Get audio tracks
  const tracks = useTracks([Track.Source.Microphone]);
  
  // Debug: log tracks for troubleshooting
  useEffect(() => {
    console.log('[Widget] All tracks:', tracks.length, tracks.map(t => ({
      source: t.source,
      isLocal: t.participant?.isLocal,
      participantIdentity: t.participant?.identity,
      trackSid: t.publication?.trackSid,
    })));
    const remoteTracks = tracks.filter(t => !t.participant?.isLocal);
    console.log('[Widget] Remote tracks:', remoteTracks.length);
  }, [tracks]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Listen for transcript updates via data channel
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'transcript') {
          setTranscript((prev) => [...prev, data.segment]);
        }
      } catch (e) {
        console.error('Error parsing data:', e);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            {connectionState === ConnectionState.Connected && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </div>
          <div>
            <p className="font-medium">AI Receptionist</p>
            <p className="text-sm text-slate-400">
              {connectionState === ConnectionState.Connected
                ? 'Connected'
                : connectionState === ConnectionState.Connecting
                ? 'Connecting...'
                : 'Disconnected'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono">{formatDuration(callDuration)}</p>
        </div>
      </div>

      {/* Audio visualization / main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {connectionState === ConnectionState.Connected ? (
          <>
            {/* Audio waveform visualization */}
            <div className="relative w-32 h-32 mb-6">
              <div className="absolute inset-0 rounded-full bg-blue-600/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-blue-600/30 animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-blue-600/50 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>

            <p className="text-slate-400 text-center">
              {isMuted ? 'Microphone muted' : 'Speak clearly into your microphone'}
            </p>

            {/* Remote audio tracks */}
            {tracks
              .filter((t) => t.participant.isLocal === false)
              .map((track) => (
                <AudioTrack key={track.participant.sid} trackRef={track} />
              ))}
          </>
        ) : connectionState === ConnectionState.Connecting ? (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Connecting to AI receptionist...</p>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-slate-400">Connection lost</p>
          </div>
        )}
      </div>

      {/* Transcript (collapsible) */}
      {transcript.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-t border-slate-700 p-4" ref={transcriptRef}>
          <p className="text-xs text-slate-500 mb-2">Transcript</p>
          {transcript.map((segment, i) => (
            <div key={i} className={`mb-2 ${segment.speaker === 'user' ? 'text-right' : ''}`}>
              <span
                className={`inline-block px-3 py-1 rounded-lg text-sm ${
                  segment.speaker === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                {segment.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleEndCall}
            className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WidgetEmbedPage() {
  const searchParams = useSearchParams();
  const widgetId = searchParams.get('id');
  const tenantSlug = searchParams.get('tenantSlug');
  
  const [state, setState] = useState('idle'); // idle, requesting, calling, ended
  const [token, setToken] = useState(null);
  const [roomName, setRoomName] = useState(null);
  const [error, setError] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);

  // Fetch tenant info
  useEffect(() => {
    // Skip if no identifier
    if (!widgetId && !tenantSlug) return;

    // For tenantSlug, we'll get info from the widget-token response
    if (tenantSlug) {
      setTenantInfo({ name: 'AI Receptionist' });
      return;
    }

    fetch(`${API_URL}/api/widget/${widgetId}/info`)
      .then((res) => res.json())
      .then((data) => {
        setTenantInfo(data);
      })
      .catch((err) => {
        console.error('Failed to fetch tenant info:', err);
      });
  }, [widgetId, tenantSlug]);

  // Notify parent window of state changes
  useEffect(() => {
    window.parent?.postMessage({ type: `vox:${state}` }, '*');
  }, [state]);

  // Listen for messages from parent
  useEffect(() => {
    const handleMessage = (event) => {
      const { type } = event.data;
      if (type === 'vox:open') {
        // Widget opened
      } else if (type === 'vox:close') {
        // Widget closed - end call if active
        if (state === 'calling') {
          handleEndCall();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state]);

  // Request to start a call
  const startCall = async () => {
    if (!widgetId && !tenantSlug) {
      setError('No widget ID or tenant slug provided');
      return;
    }

    setState('requesting');
    setError(null);

    try {
      let response;
      
      if (tenantSlug) {
        // Use the livekit widget-token endpoint for tenantSlug
        response = await fetch(`${API_URL}/api/livekit/widget-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantSlug }),
        });
      } else {
        // Use the widget endpoint for widgetId
        response = await fetch(`${API_URL}/api/widget/${widgetId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to start call');
      }

      const result = await response.json();
      const data = result.data || result;
      
      setToken(data.token);
      setRoomName(data.roomName);
      
      // Update tenant info from response if available
      if (data.config?.receptionistName) {
        setTenantInfo(prev => ({ ...prev, name: data.config.receptionistName }));
      }
      
      setState('calling');
    } catch (err) {
      console.error('Failed to start call:', err);
      setError(err.message || 'Unable to connect. Please try again.');
      setState('idle');
    }
  };

  // Handle call end
  const handleEndCall = () => {
    setToken(null);
    setState('ended');
  };

  // Handle call disconnect
  const handleDisconnect = () => {
    setToken(null);
    setState('ended');
    window.parent?.postMessage({ type: 'vox:disconnected' }, '*');
  };

  // Render based on state
  if (state === 'calling' && token) {
    return (
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={token}
        connectOptions={{ autoSubscribe: true }}
        audio={true}
        video={false}
        onDisconnected={handleDisconnect}
        style={{ height: '100vh' }}
      >
        <CallInterface onEnd={handleEndCall} />
      </LiveKitRoom>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="font-bold">{tenantInfo?.name?.[0] || 'V'}</span>
          </div>
          <div>
            <p className="font-medium">{tenantInfo?.name || 'VoxReception'}</p>
            <p className="text-sm text-slate-400">AI Receptionist</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {state === 'idle' && (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Talk to our AI Receptionist
            </h2>
            <p className="text-slate-600 mb-6 max-w-xs">
              Get instant answers, book appointments, or leave a message.
            </p>
            <button
              onClick={startCall}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Start Call
            </button>
          </>
        )}

        {state === 'requesting' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-slate-600">Connecting...</p>
          </>
        )}

        {state === 'ended' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Call Ended
            </h2>
            <p className="text-slate-600 mb-6">
              Thank you for calling. We hope we were helpful!
            </p>
            <button
              onClick={() => setState('idle')}
              className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-full transition-colors"
            >
              Start New Call
            </button>
          </>
        )}

        {error && (
          <p className="text-red-600 mt-4">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-slate-400">
        Powered by VoxReception
      </div>
    </div>
  );
}
