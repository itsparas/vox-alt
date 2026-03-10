import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword, newPassword) => 
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Tenant API
export const tenantApi = {
  get: () => api.get('/tenants/me'),
  update: (data) => api.put('/tenants/me', data),
  getConfig: () => api.get('/tenants/me/config'),
  updateConfig: (data) => api.put('/tenants/me/config', data),
  getStats: (startDate, endDate) => 
    api.get('/tenants/me/stats', { params: { startDate, endDate } }),
  getWidgetToken: () => api.get('/tenants/me/widget-token'),
};

// Users API
export const usersApi = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
};

// Calls API
export const callsApi = {
  list: (params) => api.get('/calls', { params }),
  get: (id) => api.get(`/calls/${id}`),
  getActive: () => api.get('/calls/active'),
  getEscalated: () => api.get('/calls/escalated'),
  escalate: (id, userId) => api.post(`/calls/${id}/escalate`, { userId }),
  join: (id) => api.post(`/calls/${id}/join`),
  end: (id, reason) => api.post(`/calls/${id}/end`, { reason }),
  getTranscript: (id) => api.get(`/calls/${id}/transcript`),
  getRecording: (id) => api.get(`/calls/${id}/recording`),
  setDisposition: (id, data) => api.put(`/calls/${id}/disposition`, data),
};

// Bookings API
export const bookingsApi = {
  list: (params) => api.get('/bookings', { params }),
  get: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.put(`/bookings/${id}`, data),
  cancel: (id, reason) => api.post(`/bookings/${id}/cancel`, { reason }),
  confirm: (id) => api.post(`/bookings/${id}/confirm`),
  getAvailability: (date, duration) => 
    api.get('/bookings/availability', { params: { date, duration } }),
};

// Transcripts API
export const transcriptsApi = {
  list: (params) => api.get('/transcripts', { params }),
  get: (id) => api.get(`/transcripts/${id}`),
  search: (query, params) => api.get('/transcripts/search', { params: { query, ...params } }),
  export: (id, format) => api.get(`/transcripts/${id}/export`, { params: { format } }),
};

// Billing API
export const billingApi = {
  getSubscription: () => api.get('/billing/subscription'),
  getUsage: (startDate, endDate) => 
    api.get('/billing/usage', { params: { startDate, endDate } }),
  getInvoices: () => api.get('/billing/invoices'),
  createCheckoutSession: (planId) => api.post('/billing/checkout', { planId }),
  createPortalSession: () => api.post('/billing/portal'),
  updatePaymentMethod: () => api.post('/billing/payment-method'),
};

// Integrations API
export const integrationsApi = {
  getGoogleAuthUrl: () => api.get('/integrations/google/auth-url'),
  completeGoogleAuth: (code) => api.post('/integrations/google/callback', { code }),
  disconnectGoogle: () => api.delete('/integrations/google'),
  getCalendars: () => api.get('/integrations/google/calendars'),
  selectCalendar: (calendarId) => api.post('/integrations/google/calendars', { calendarId }),
};

// Analytics API
export const analyticsApi = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getVolume: (params) => api.get('/analytics/volume', { params }),
  getPeakHours: (params) => api.get('/analytics/peak-hours', { params }),
  getOutcomes: (params) => api.get('/analytics/outcomes', { params }),
  getDuration: (params) => api.get('/analytics/duration', { params }),
  getTrends: (params) => api.get('/analytics/trends', { params }),
};

// Calls API — add capacity + shareable link
export const callCapacityApi = {
  getCapacity: () => api.get('/livekit/capacity'),
};

// LiveKit API
export const livekitApi = {
  getToken: (roomName) => api.post('/livekit/token', { roomName }),
  getRooms: () => api.get('/livekit/rooms'),
  joinCall: (callId) => api.post(`/livekit/calls/${callId}/join`),
};

// Admin API (super admin only)
export const adminApi = {
  listTenants: (params) => api.get('/admin/tenants', { params }),
  getTenant: (id) => api.get(`/admin/tenants/${id}`),
  updateTenant: (id, data) => api.put(`/admin/tenants/${id}`, data),
  suspendTenant: (id, reason) => api.post(`/admin/tenants/${id}/suspend`, { reason }),
  activateTenant: (id) => api.post(`/admin/tenants/${id}/activate`),
  getSystemStats: () => api.get('/admin/stats'),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
};

// Phone Numbers API
export const phoneNumbersApi = {
  searchAvailable: (params) => api.get('/phone-numbers/available', { params }),
  list: (params) => api.get('/phone-numbers', { params }),
  get: (id) => api.get(`/phone-numbers/${id}`),
  provision: (phoneNumber) => api.post('/phone-numbers', { phoneNumber }),
  setupBYON: (data) => api.post('/phone-numbers/byon', data),
  confirmForwarding: (id) => api.put(`/phone-numbers/${id}/confirm-forwarding`),
  getForwardingInstructions: (id) => api.get(`/phone-numbers/${id}/forwarding-instructions`),
  update: (id, data) => api.put(`/phone-numbers/${id}`, data),
  release: (id) => api.delete(`/phone-numbers/${id}`),
};

// Messages API
export const messagesApi = {
  list: (params) => api.get('/messages', { params }),
  get: (id) => api.get(`/messages/${id}`),
  send: (data) => api.post('/messages', data),
  getConversations: () => api.get('/messages/conversations'),
  getThread: (phoneNumber, params) =>
    api.get(`/messages/thread/${encodeURIComponent(phoneNumber)}`, { params }),
  getStats: (params) => api.get('/messages/stats/summary', { params }),
};

// Voicemails API
export const voicemailsApi = {
  list: (params) => api.get('/voicemails', { params }),
  get: (id) => api.get(`/voicemails/${id}`),
  getStats: () => api.get('/voicemails/stats'),
  markRead: (id) => api.put(`/voicemails/${id}/read`),
  markUnread: (id) => api.put(`/voicemails/${id}/unread`),
  archive: (id) => api.put(`/voicemails/${id}/archive`),
  unarchive: (id) => api.put(`/voicemails/${id}/unarchive`),
  delete: (id) => api.delete(`/voicemails/${id}`),
  bulkMarkRead: (ids) => api.post('/voicemails/bulk/read', { ids }),
};

// Knowledge Base / FAQ API
export const knowledgeApi = {
  // FAQs
  listFAQs: (params) => api.get('/knowledge/faqs', { params }),
  getFAQ: (id) => api.get(`/knowledge/faqs/${id}`),
  createFAQ: (data) => api.post('/knowledge/faqs', data),
  updateFAQ: (id, data) => api.put(`/knowledge/faqs/${id}`, data),
  deleteFAQ: (id) => api.delete(`/knowledge/faqs/${id}`),
  searchFAQs: (q, params) => api.get('/knowledge/faqs/search', { params: { q, ...params } }),
  getFAQCategories: () => api.get('/knowledge/faqs/categories'),
  bulkImportFAQs: (faqs) => api.post('/knowledge/faqs/bulk', { faqs }),
  // Knowledge Base Documents
  listDocuments: (params) => api.get('/knowledge/documents', { params }),
  getDocument: (id) => api.get(`/knowledge/documents/${id}`),
  createDocument: (data) => api.post('/knowledge/documents', data),
  updateDocument: (id, data) => api.put(`/knowledge/documents/${id}`, data),
  deleteDocument: (id) => api.delete(`/knowledge/documents/${id}`),
  searchDocuments: (q, params) => api.get('/knowledge/documents/search', { params: { q, ...params } }),
  uploadDocument: (formData) => api.post('/knowledge/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default api;
