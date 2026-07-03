import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

const token = localStorage.getItem('lms_token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lms_token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  getUsers: () => api.get('/auth/users'),
  toggleUser: (id, is_active) => api.patch(`/auth/users/${id}`, { is_active }),
};

// Leads
export const leadsAPI = {
  list: (params) => api.get('/leads', { params }),
  get: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
};

// Applications
export const applicationsAPI = {
  list: (params) => api.get('/applications', { params }),
  get: (id) => api.get(`/applications/${id}`),
  create: (data) => api.post('/applications', data),
  update: (id, data) => api.put(`/applications/${id}`, data),
  advance: (id, data) => api.post(`/applications/${id}/advance`, data || {}),
  reject: (id, data) => api.post(`/applications/${id}/reject`, data),
  getBorrowers: (params) => api.get('/applications/borrowers', { params }),
  createBorrower: (data) => api.post('/applications/borrowers', data),
};

// Credit Scoring
export const creditAPI = {
  list: (params) => api.get('/credit-scoring', { params }),
  score: (applicationId, data) => api.post(`/credit-scoring/score/${applicationId}`, data),
  getForApplication: (applicationId) => api.get(`/credit-scoring/application/${applicationId}`),
};

// Loan Accounts
export const accountsAPI = {
  list: (params) => api.get('/loan-accounts', { params }),
  get: (id) => api.get(`/loan-accounts/${id}`),
  disburse: (data) => api.post('/loan-accounts/disburse', data),
  updateStatus: (id, status) => api.patch(`/loan-accounts/${id}/status`, { status }),
};

// Payments
export const paymentsAPI = {
  list: (params) => api.get('/payments', { params }),
  create: (data) => api.post('/payments', data),
};

// Collections
export const collectionsAPI = {
  overdue: () => api.get('/collections/overdue'),
  list: (params) => api.get('/collections', { params }),
  create: (data) => api.post('/collections', data),
  getForAccount: (accountId) => api.get(`/collections/account/${accountId}`),
};

// Reports
export const reportsAPI = {
  summary: () => api.get('/reports/summary'),
  disbursement: (params) => api.get('/reports/disbursement', { params }),
  collectionEfficiency: () => api.get('/reports/collection-efficiency'),
  npa: () => api.get('/reports/npa'),
  funnel: () => api.get('/reports/funnel'),
  audit: (params) => api.get('/reports/audit', { params }),
};

// Documents
export const documentsAPI = {
  list: (params) => api.get('/documents', { params }),
  upload: (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  verify: (id, data) => api.patch(`/documents/${id}/verify`, data),
  delete: (id) => api.delete(`/documents/${id}`),
};

export default api;
