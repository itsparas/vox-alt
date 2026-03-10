import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// UI State Store
export const useUIStore = create(
  persist(
    (set, get) => ({
      // Sidebar state
      sidebarOpen: true,
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      collapseSidebar: () => set({ sidebarCollapsed: true }),
      expandSidebar: () => set({ sidebarCollapsed: false }),

      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Notifications
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            { id: Date.now(), ...notification },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),

      // Modal state
      activeModal: null,
      modalData: null,
      openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    {
      name: 'voxreception-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);

// Call State Store
export const useCallStore = create((set, get) => ({
  // Active calls
  activeCalls: [],
  selectedCallId: null,

  setActiveCalls: (calls) => set({ activeCalls: calls }),
  addCall: (call) =>
    set((state) => ({
      activeCalls: [...state.activeCalls, call],
    })),
  updateCall: (callId, updates) =>
    set((state) => ({
      activeCalls: state.activeCalls.map((c) =>
        c.id === callId ? { ...c, ...updates } : c
      ),
    })),
  removeCall: (callId) =>
    set((state) => ({
      activeCalls: state.activeCalls.filter((c) => c.id !== callId),
      selectedCallId: state.selectedCallId === callId ? null : state.selectedCallId,
    })),
  selectCall: (callId) => set({ selectedCallId: callId }),

  // Current call state
  currentCall: null,
  callState: 'idle', // idle, connecting, connected, ending
  isMuted: false,
  isOnHold: false,

  setCurrentCall: (call) => set({ currentCall: call }),
  setCallState: (state) => set({ callState: state }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleHold: () => set((state) => ({ isOnHold: !state.isOnHold })),

  // Transcript
  transcriptSegments: [],
  addTranscriptSegment: (segment) =>
    set((state) => ({
      transcriptSegments: [...state.transcriptSegments, segment],
    })),
  clearTranscript: () => set({ transcriptSegments: [] }),

  // Reset all call state
  resetCallState: () =>
    set({
      currentCall: null,
      callState: 'idle',
      isMuted: false,
      isOnHold: false,
      transcriptSegments: [],
    }),
}));

// Booking State Store
export const useBookingStore = create((set, get) => ({
  bookings: [],
  selectedDate: new Date(),
  viewMode: 'week', // day, week, month
  isLoading: false,

  setBookings: (bookings) => set({ bookings }),
  addBooking: (booking) =>
    set((state) => ({
      bookings: [...state.bookings, booking],
    })),
  updateBooking: (bookingId, updates) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === bookingId ? { ...b, ...updates } : b
      ),
    })),
  removeBooking: (bookingId) =>
    set((state) => ({
      bookings: state.bookings.filter((b) => b.id !== bookingId),
    })),

  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Filter/Search State Store
export const useFilterStore = create((set) => ({
  // Call filters
  callFilters: {
    status: 'all',
    dateRange: 'today',
    search: '',
  },
  setCallFilters: (filters) =>
    set((state) => ({
      callFilters: { ...state.callFilters, ...filters },
    })),
  resetCallFilters: () =>
    set({
      callFilters: {
        status: 'all',
        dateRange: 'today',
        search: '',
      },
    }),

  // Booking filters
  bookingFilters: {
    status: 'all',
    dateRange: 'week',
    search: '',
  },
  setBookingFilters: (filters) =>
    set((state) => ({
      bookingFilters: { ...state.bookingFilters, ...filters },
    })),
  resetBookingFilters: () =>
    set({
      bookingFilters: {
        status: 'all',
        dateRange: 'week',
        search: '',
      },
    }),

  // Transcript filters
  transcriptFilters: {
    search: '',
    callId: null,
    dateRange: 'all',
  },
  setTranscriptFilters: (filters) =>
    set((state) => ({
      transcriptFilters: { ...state.transcriptFilters, ...filters },
    })),
  resetTranscriptFilters: () =>
    set({
      transcriptFilters: {
        search: '',
        callId: null,
        dateRange: 'all',
      },
    }),
}));

// LiveKit State Store
export const useLiveKitStore = create((set, get) => ({
  roomName: null,
  token: null,
  isConnecting: false,
  isConnected: false,
  participants: [],
  localTrack: null,
  remoteTrack: null,

  setRoom: (roomName, token) => set({ roomName, token }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setConnected: (isConnected) => set({ isConnected }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),
  removeParticipant: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    })),
  setLocalTrack: (track) => set({ localTrack: track }),
  setRemoteTrack: (track) => set({ remoteTrack: track }),

  reset: () =>
    set({
      roomName: null,
      token: null,
      isConnecting: false,
      isConnected: false,
      participants: [],
      localTrack: null,
      remoteTrack: null,
    }),
}));
