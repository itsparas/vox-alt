'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function SocketProvider({ children }) {
  const { user, tenant } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!user || !tenant) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;

      // Join tenant room
      newSocket.emit('join:tenant', { tenantId: tenant.id });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError(err.message);
      reconnectAttempts.current++;

      if (reconnectAttempts.current >= maxReconnectAttempts) {
        newSocket.disconnect();
      }
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      setError(err.message || 'Socket error occurred');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, tenant]);

  const emit = useCallback((event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  }, [socket, connected]);

  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
    return () => {};
  }, [socket]);

  const off = useCallback((event, callback) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  }, [socket]);

  const joinRoom = useCallback((room, roomId) => {
    emit(`join:${room}`, { [`${room}Id`]: roomId });
  }, [emit]);

  const leaveRoom = useCallback((room, roomId) => {
    emit(`leave:${room}`, { [`${room}Id`]: roomId });
  }, [emit]);

  const value = {
    socket,
    connected,
    error,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// Custom hooks for specific socket events
export function useCallEvents(callId) {
  const { on, off, joinRoom, leaveRoom } = useSocket();
  const [callStatus, setCallStatus] = useState(null);
  const [transcript, setTranscript] = useState([]);

  useEffect(() => {
    if (!callId) return;

    joinRoom('call', callId);

    const handleStatusUpdate = (data) => {
      if (data.callId === callId) {
        setCallStatus(data.status);
      }
    };

    const handleTranscriptSegment = (data) => {
      if (data.callId === callId) {
        setTranscript((prev) => [...prev, data.segment]);
      }
    };

    const unsubStatus = on('call:status', handleStatusUpdate);
    const unsubTranscript = on('call:transcript:segment', handleTranscriptSegment);

    return () => {
      leaveRoom('call', callId);
      unsubStatus();
      unsubTranscript();
    };
  }, [callId, on, off, joinRoom, leaveRoom]);

  return { callStatus, transcript, setTranscript };
}

export function useTenantEvents() {
  const { on } = useSocket();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const handleNewCall = (data) => {
      setEvents((prev) => [...prev, { type: 'new_call', data, timestamp: new Date() }]);
    };

    const handleCallEnded = (data) => {
      setEvents((prev) => [...prev, { type: 'call_ended', data, timestamp: new Date() }]);
    };

    const handleNewBooking = (data) => {
      setEvents((prev) => [...prev, { type: 'new_booking', data, timestamp: new Date() }]);
    };

    const unsubNewCall = on('call:new', handleNewCall);
    const unsubCallEnded = on('call:ended', handleCallEnded);
    const unsubNewBooking = on('booking:new', handleNewBooking);

    return () => {
      unsubNewCall();
      unsubCallEnded();
      unsubNewBooking();
    };
  }, [on]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, clearEvents };
}
