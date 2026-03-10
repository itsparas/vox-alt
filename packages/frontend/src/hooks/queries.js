import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  tenantApi,
  usersApi,
  callsApi,
  bookingsApi,
  transcriptsApi,
  billingApi,
  integrationsApi,
  analyticsApi,
  callCapacityApi,
  voicemailsApi,
  knowledgeApi,
  phoneNumbersApi,
} from '@/lib/api';

// Query Keys
export const queryKeys = {
  tenant: ['tenant'],
  tenantConfig: ['tenant', 'config'],
  tenantStats: (start, end) => ['tenant', 'stats', start, end],
  users: (params) => ['users', params],
  user: (id) => ['users', id],
  calls: (params) => ['calls', params],
  call: (id) => ['calls', id],
  activeCalls: ['calls', 'active'],
  escalatedCalls: ['calls', 'escalated'],
  callTranscript: (id) => ['calls', id, 'transcript'],
  bookings: (params) => ['bookings', params],
  booking: (id) => ['bookings', id],
  availability: (date, duration) => ['bookings', 'availability', date, duration],
  transcripts: (params) => ['transcripts', params],
  transcript: (id) => ['transcripts', id],
  subscription: ['billing', 'subscription'],
  usage: (start, end) => ['billing', 'usage', start, end],
  invoices: ['billing', 'invoices'],
  calendars: ['integrations', 'calendars'],
  analyticsOverview: (params) => ['analytics', 'overview', params],
  analyticsVolume: (params) => ['analytics', 'volume', params],
  analyticsPeakHours: (params) => ['analytics', 'peak-hours', params],
  analyticsOutcomes: (params) => ['analytics', 'outcomes', params],
  analyticsDuration: (params) => ['analytics', 'duration', params],
  analyticsTrends: (days) => ['analytics', 'trends', days],
  callCapacity: ['livekit', 'capacity'],
  voicemails: (params) => ['voicemails', params],
  voicemail: (id) => ['voicemails', id],
  voicemailStats: ['voicemails', 'stats'],
  faqs: (params) => ['knowledge', 'faqs', params],
  faq: (id) => ['knowledge', 'faqs', id],
  faqCategories: ['knowledge', 'faqs', 'categories'],
  kbDocuments: (params) => ['knowledge', 'documents', params],
  kbDocument: (id) => ['knowledge', 'documents', id],
  phoneNumbers: (params) => ['phoneNumbers', params],
  phoneNumber: (id) => ['phoneNumbers', id],
};

// Tenant Hooks
export function useTenant() {
  return useQuery({
    queryKey: queryKeys.tenant,
    queryFn: () => tenantApi.get().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTenantConfig() {
  return useQuery({
    queryKey: queryKeys.tenantConfig,
    queryFn: () => tenantApi.getConfig().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTenantConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => tenantApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantConfig });
    },
  });
}

export function useTenantStats(startDate, endDate) {
  return useQuery({
    queryKey: queryKeys.tenantStats(startDate, endDate),
    queryFn: () => tenantApi.getStats(startDate, endDate).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

// User Hooks
export function useUsers(params = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => usersApi.list(params).then((res) => res.data),
    staleTime: 30 * 1000,
  });
}

export function useUser(id) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => usersApi.get(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(id) });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Call Hooks
export function useCalls(params = {}) {
  return useQuery({
    queryKey: queryKeys.calls(params),
    queryFn: () => callsApi.list(params).then((res) => res.data),
    staleTime: 10 * 1000,
  });
}

export function useCall(id) {
  return useQuery({
    queryKey: queryKeys.call(id),
    queryFn: () => callsApi.get(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useActiveCalls() {
  return useQuery({
    queryKey: queryKeys.activeCalls,
    queryFn: () => callsApi.getActive().then((res) => res.data),
    refetchInterval: 5000,
  });
}

export function useCallTranscript(id) {
  return useQuery({
    queryKey: queryKeys.callTranscript(id),
    queryFn: () => callsApi.getTranscript(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useEscalateCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, userId }) => callsApi.escalate(callId, userId),
    onSuccess: (_, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.call(callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeCalls });
      queryClient.invalidateQueries({ queryKey: queryKeys.escalatedCalls });
    },
  });
}

export function useEscalatedCalls() {
  return useQuery({
    queryKey: queryKeys.escalatedCalls,
    queryFn: () => callsApi.getEscalated().then((res) => res.data),
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    staleTime: 0,
  });
}

export function useJoinCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId) => callsApi.join(callId),
    onSuccess: (_, callId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.call(callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.escalatedCalls });
    },
  });
}

export function useEndCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, reason }) => callsApi.end(callId, reason),
    onSuccess: (_, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.call(callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeCalls });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}

// Booking Hooks
export function useBookings(params = {}) {
  return useQuery({
    queryKey: queryKeys.bookings(params),
    queryFn: () => bookingsApi.list(params).then((res) => res.data),
    staleTime: 30 * 1000,
  });
}

export function useBooking(id) {
  return useQuery({
    queryKey: queryKeys.booking(id),
    queryFn: () => bookingsApi.get(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useAvailability(date, duration = 30) {
  return useQuery({
    queryKey: queryKeys.availability(date, duration),
    queryFn: () => bookingsApi.getAvailability(date, duration).then((res) => res.data),
    enabled: !!date,
    staleTime: 60 * 1000,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => bookingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => bookingsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.booking(id) });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => bookingsApi.cancel(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.booking(id) });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => bookingsApi.confirm(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.booking(id) });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// Transcript Hooks
export function useTranscripts(params = {}) {
  return useQuery({
    queryKey: queryKeys.transcripts(params),
    queryFn: () => transcriptsApi.list(params).then((res) => res.data),
    staleTime: 30 * 1000,
  });
}

export function useTranscript(id) {
  return useQuery({
    queryKey: queryKeys.transcript(id),
    queryFn: () => transcriptsApi.get(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useSearchTranscripts(query, params = {}) {
  return useQuery({
    queryKey: ['transcripts', 'search', query, params],
    queryFn: () => transcriptsApi.search(query, params).then((res) => res.data),
    enabled: !!query && query.length > 2,
    staleTime: 60 * 1000,
  });
}

// Billing Hooks
export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: () => billingApi.getSubscription().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsage(startDate, endDate) {
  return useQuery({
    queryKey: queryKeys.usage(startDate, endDate),
    queryFn: () => billingApi.getUsage(startDate, endDate).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: () => billingApi.getInvoices().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (planId) => billingApi.createCheckoutSession(planId),
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => billingApi.createPortalSession(),
  });
}

// Integration Hooks
export function useCalendars() {
  return useQuery({
    queryKey: queryKeys.calendars,
    queryFn: () => integrationsApi.getCalendars().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSelectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (calendarId) => integrationsApi.selectCalendar(calendarId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantConfig });
    },
  });
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.disconnectGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantConfig });
    },
  });
}

// Analytics Hooks
export function useAnalyticsOverview(params = {}) {
  return useQuery({
    queryKey: queryKeys.analyticsOverview(params),
    queryFn: () => analyticsApi.getOverview(params).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useAnalyticsVolume(params = {}) {
  return useQuery({
    queryKey: queryKeys.analyticsVolume(params),
    queryFn: () => analyticsApi.getVolume(params).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useAnalyticsPeakHours(params = {}) {
  return useQuery({
    queryKey: queryKeys.analyticsPeakHours(params),
    queryFn: () => analyticsApi.getPeakHours(params).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useAnalyticsOutcomes(params = {}) {
  return useQuery({
    queryKey: queryKeys.analyticsOutcomes(params),
    queryFn: () => analyticsApi.getOutcomes(params).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useAnalyticsDuration(params = {}) {
  return useQuery({
    queryKey: queryKeys.analyticsDuration(params),
    queryFn: () => analyticsApi.getDuration(params).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useAnalyticsTrends(days = 30) {
  return useQuery({
    queryKey: queryKeys.analyticsTrends(days),
    queryFn: () => analyticsApi.getTrends({ days }).then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useCallCapacity() {
  return useQuery({
    queryKey: queryKeys.callCapacity,
    queryFn: () => callCapacityApi.getCapacity().then((res) => res.data),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

// Voicemail Hooks
export function useVoicemails(params = {}) {
  return useQuery({
    queryKey: queryKeys.voicemails(params),
    queryFn: () => voicemailsApi.list(params).then((res) => res.data),
    staleTime: 10 * 1000,
  });
}

export function useVoicemail(id) {
  return useQuery({
    queryKey: queryKeys.voicemail(id),
    queryFn: () => voicemailsApi.get(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useVoicemailStats() {
  return useQuery({
    queryKey: queryKeys.voicemailStats,
    queryFn: () => voicemailsApi.getStats().then((res) => res.data),
    staleTime: 30 * 1000,
  });
}

export function useMarkVoicemailRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isRead }) =>
      isRead ? voicemailsApi.markUnread(id) : voicemailsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voicemails'] });
    },
  });
}

export function useArchiveVoicemail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => voicemailsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voicemails'] });
    },
  });
}

export function useDeleteVoicemail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => voicemailsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voicemails'] });
    },
  });
}

// Call Disposition Hook
export function useSetCallDisposition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, disposition, notes, sentiment }) =>
      callsApi.setDisposition(callId, { disposition, notes, sentiment }),
    onSuccess: (_, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.call(callId) });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}

// FAQ Hooks
export function useFAQs(params = {}) {
  return useQuery({
    queryKey: queryKeys.faqs(params),
    queryFn: () => knowledgeApi.listFAQs(params).then((res) => res.data),
    staleTime: 30 * 1000,
  });
}

export function useFAQ(id) {
  return useQuery({
    queryKey: queryKeys.faq(id),
    queryFn: () => knowledgeApi.getFAQ(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useFAQCategories() {
  return useQuery({
    queryKey: queryKeys.faqCategories,
    queryFn: () => knowledgeApi.getFAQCategories().then((res) => res.data),
    staleTime: 60 * 1000,
  });
}

export function useCreateFAQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => knowledgeApi.createFAQ(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'faqs'] });
    },
  });
}

export function useUpdateFAQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => knowledgeApi.updateFAQ(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.faq(id) });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'faqs'] });
    },
  });
}

export function useDeleteFAQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => knowledgeApi.deleteFAQ(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'faqs'] });
    },
  });
}

export function useBulkImportFAQs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faqs) => knowledgeApi.bulkImportFAQs(faqs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'faqs'] });
    },
  });
}

// Knowledge Base Document Hooks
export function useKBDocuments(params = {}) {
  return useQuery({
    queryKey: queryKeys.kbDocuments(params),
    queryFn: () => knowledgeApi.listDocuments(params).then((res) => res.data),
    staleTime: 30 * 1000,
  });
}

export function useKBDocument(id) {
  return useQuery({
    queryKey: queryKeys.kbDocument(id),
    queryFn: () => knowledgeApi.getDocument(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateKBDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => knowledgeApi.createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

export function useUpdateKBDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => knowledgeApi.updateDocument(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kbDocument(id) });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

export function useDeleteKBDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => knowledgeApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData) => knowledgeApi.uploadDocument(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

// ============================================
// Phone Number Hooks
// ============================================

export function usePhoneNumbers(params) {
  return useQuery({
    queryKey: queryKeys.phoneNumbers(params),
    queryFn: () => phoneNumbersApi.list(params).then((res) => res.data.data),
  });
}

export function useSetupBYON() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => phoneNumbersApi.setupBYON(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}

export function useProvisionNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phoneNumber) => phoneNumbersApi.provision(phoneNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}

export function useConfirmForwarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => phoneNumbersApi.confirmForwarding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}

export function useReleaseNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => phoneNumbersApi.release(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });
}
