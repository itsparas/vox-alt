'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
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

function ActiveCallView({ onEnd, config }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [connectionState]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  }, [localParticipant, isMuted]);

  const handleEndCall = useCallback(() => {
    room?.disconnect();
    onEnd();
  }, [room, onEnd]);

  const tracks = useTracks([Track.Source.Microphone]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    if (!room) return;
    const handleDataReceived = (payload) => {
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
    return () => room.off('dataReceived', handleDataReceived);
  }, [room]);

  const primaryColor = config?.primaryColor || '#2563eb';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">{config?.receptionistName || 'AI Receptionist'}</p>
              <p className="text-sm text-slate-400">
                {connectionState === ConnectionState.Connected ? 'Connected' :
                 connectionState === ConnectionState.Connecting ? 'Connecting...' : 'Disconnected'}
              </p>
            </div>
          </div>
          <p className="text-3xl font-mono tabular-nums">{formatDuration(callDuration)}</p>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {connectionState === ConnectionState.Connected ? (
          <>
            <div className="relative w-40 h-40 mb-8">
              <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: `${primaryColor}20` }} />
              <div className="absolute inset-3 rounded-full animate-pulse" style={{ backgroundColor: `${primaryColor}30` }} />
              <div className="absolute inset-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}60` }}>
                <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
            <p className="text-slate-400 text-lg">
              {isMuted ? 'Microphone muted' : 'Speak clearly into your microphone'}
            </p>

            {tracks
              .filter((t) => !t.participant?.isLocal)
              .map((track) => (
                <AudioTrack key={track.participant.sid} trackRef={track} />
              ))}
          </>
        ) : connectionState === ConnectionState.Connecting ? (
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{ borderColor: `${primaryColor}`, borderTopColor: 'transparent' }} />
            <p className="text-slate-300 text-lg">Connecting to {config?.receptionistName || 'AI Receptionist'}...</p>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-20 h-20 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-slate-400 text-lg">Connection lost</p>
          </div>
        )}
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="max-w-2xl mx-auto w-full max-h-48 overflow-y-auto border-t border-white/10 p-4" ref={transcriptRef}>
          <p className="text-xs text-slate-500 mb-2">Live Transcript</p>
          {transcript.map((segment, i) => (
            <div key={i} className={`mb-2 ${segment.speaker === 'user' ? 'text-right' : ''}`}>
              <span className={`inline-block px-3 py-2 rounded-xl text-sm ${
                segment.speaker === 'user' ? 'text-white' : 'bg-slate-700 text-slate-200'
              }`} style={segment.speaker === 'user' ? { backgroundColor: primaryColor } : {}}>
                {segment.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="px-6 py-6 border-t border-white/10">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-6">
          <button
            onClick={toggleMute}
            className={`p-5 rounded-full transition-all ${
              isMuted ? 'bg-red-600 hover:bg-red-700 scale-110' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {isMuted ? (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleEndCall}
            className="p-5 bg-red-600 hover:bg-red-700 rounded-full transition-all hover:scale-105"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicCallPage() {
  const params = useParams();
  const slug = params.slug;

  const [state, setState] = useState('loading'); // loading, idle, requesting, queued, calling, ended, error
  const [businessInfo, setBusinessInfo] = useState(null);
  const [config, setConfig] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [token, setToken] = useState(null);
  const [queueInfo, setQueueInfo] = useState(null);
  const [callerName, setCallerName] = useState('');
  const [error, setError] = useState(null);

  // Fetch business info
  useEffect(() => {
    if (!slug) return;

    fetch(`${API_URL}/api/calls/link/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Business not found');
        return res.json();
      })
      .then((result) => {
        setBusinessInfo(result.data.tenant);
        setConfig(result.data.config);
        setCapacity(result.data.capacity);
        setState('idle');
      })
      .catch((err) => {
        setError(err.message);
        setState('error');
      });
  }, [slug]);

  // Start call
  const startCall = async () => {
    setState('requesting');
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/livekit/widget-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: slug,
          visitorName: callerName || 'Website Visitor',
        }),
      });

      const result = await response.json();

      if (response.status === 202 && result.queued) {
        // Queued
        setQueueInfo(result.data);
        setState('queued');
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to start call');
      }

      const data = result.data;
      setToken(data.token);

      if (data.config?.receptionistName) {
        setConfig((prev) => ({ ...prev, receptionistName: data.config.receptionistName }));
      }

      setState('calling');
    } catch (err) {
      setError(err.message || 'Unable to connect. Please try again.');
      setState('idle');
    }
  };

  const handleEndCall = () => {
    setToken(null);
    setState('ended');
  };

  const handleDisconnect = () => {
    setToken(null);
    setState('ended');
  };

  const primaryColor = config?.primaryColor || '#2563eb';

  // Active call
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
        <ActiveCallView onEnd={handleEndCall} config={config} />
      </LiveKitRoom>
    );
  }

  // Loading
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: primaryColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Error - business not found
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
          <p className="text-slate-600">{error || 'This call link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {businessInfo?.logoUrl ? (
            <img
              src={businessInfo.logoUrl}
              alt={businessInfo.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: primaryColor }}
            >
              {businessInfo?.name?.[0] || 'V'}
            </div>
          )}
          <div>
            <h1 className="font-semibold text-slate-900">{config?.businessName || businessInfo?.name}</h1>
            <p className="text-sm text-slate-500">AI Receptionist</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          {state === 'idle' && (
            <>
              <div className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <svg className="w-12 h-12" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Talk to {config?.receptionistName || 'our AI Receptionist'}
              </h2>
              <p className="text-slate-600 mb-8">
                {config?.welcomeMessage || 'Get instant answers, book appointments, or leave a message.'}
              </p>

              {config?.businessDescription && (
                <p className="text-sm text-slate-500 mb-6">{config.businessDescription}</p>
              )}

              {/* Name input */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ focusRingColor: primaryColor }}
                />
              </div>

              {/* Consent notice */}
              {config?.consentRequired && (
                <p className="text-xs text-slate-400 mb-6">
                  By starting a call, you consent to the recording and processing of this conversation.
                </p>
              )}

              <button
                onClick={startCall}
                className="w-full px-6 py-4 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Start Call
              </button>

              {!capacity?.available && (
                <p className="text-sm text-amber-600 mt-4">
                  All lines are currently busy. You may be placed in a queue.
                </p>
              )}
            </>
          )}

          {state === 'requesting' && (
            <>
              <div className="w-20 h-20 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{ borderColor: primaryColor, borderTopColor: 'transparent' }} />
              <p className="text-slate-600 text-lg">Connecting...</p>
            </>
          )}

          {state === 'queued' && queueInfo && (
            <>
              <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">You&apos;re in the Queue</h2>
              <p className="text-slate-600 mb-4">{queueInfo.message}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 mb-6">
                <p className="text-3xl font-bold text-amber-700">#{queueInfo.position}</p>
                <p className="text-sm text-amber-600">Position in queue</p>
                {queueInfo.estimatedWait > 0 && (
                  <p className="text-sm text-amber-500 mt-1">
                    Estimated wait: ~{Math.ceil(queueInfo.estimatedWait / 60)} min
                  </p>
                )}
              </div>
              <button
                onClick={() => { setState('idle'); setQueueInfo(null); }}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {state === 'ended' && (
            <>
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Call Ended</h2>
              <p className="text-slate-600 mb-8">Thank you for calling {config?.businessName || businessInfo?.name}!</p>
              <button
                onClick={() => setState('idle')}
                className="px-6 py-4 text-white font-semibold rounded-xl transition-all hover:shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                Start New Call
              </button>
            </>
          )}

          {error && <p className="text-red-600 mt-4 text-sm">{error}</p>}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t text-center">
        <p className="text-xs text-slate-400">Powered by VoxReception</p>
      </footer>
    </div>
  );
}
