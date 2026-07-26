import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || '' });

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (username, password) => API.post('/auth/login', { username, password }),
  register: (payload) => API.post('/auth/register', payload),
  me: () => API.get('/auth/me'),
  profileStatus: () => API.get('/auth/profile-status'),
  completeProfile: (payload) => API.post('/auth/complete-profile', payload),
  dismissProfilePrompt: () => API.post('/auth/dismiss-profile-prompt'),
  updateEmail: (email) => API.patch('/auth/me', { email }),
  changePassword: (currentPassword, newPassword) =>
    API.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

export const subjectAPI = {
  list: () => API.get('/subjects'),
  create: (name, code) => API.post('/subjects', { name, code }),
  getDetail: (subjectId) => API.get(`/subjects/${subjectId}`),
  update: (subjectId, name, code) => API.put(`/subjects/${subjectId}`, { name, code }),
  createItem: (subjectId, name) => API.post(`/subjects/${subjectId}/items`, { name }),
  updateItem: (subjectId, itemId, name) => API.put(`/subjects/${subjectId}/items/${itemId}`, { name }),
  deleteItem: (subjectId, itemId) => API.delete(`/subjects/${subjectId}/items/${itemId}`),
};

export const gradingAPI = {
  parseNotebook: (formData) => API.post('/rubric/parse-notebook', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  generateRubric: (answerNotebook, totalScore = 100.0, examTitle = '') => {
    const formData = new FormData();
    formData.append('answer_notebook', answerNotebook);
    formData.append('total_score', totalScore);
    formData.append('exam_title', examTitle);
    return API.post('/grading/generate-rubric', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  startGrading: (formData) => API.post('/grading/start', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  resumeGrading: (sessionId, formData) => API.post(`/grading/resume/${sessionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getSession: (sessionId) => API.get(`/grading/session/${sessionId}`),
  deleteSession: (sessionId) => API.delete(`/grading/session/${sessionId}`),
  cancelSession: (sessionId) => API.post(`/grading/session/${sessionId}/cancel`),
  getResults: (sessionId) => API.get(`/grading/session/${sessionId}/results`),
  downloadExcel: (sessionId) => API.get(`/grading/session/${sessionId}/download`, { responseType: 'blob' }),
  uploadExcelPreview: (sessionId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return API.post(`/grading/session/${sessionId}/upload-preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  applyExcelRevision: (sessionId, previewId) =>
    API.post(`/grading/session/${sessionId}/upload-apply`, { preview_id: previewId }),
  getHistory: () => API.get('/grading/history'),
  updateSessionItem: (sessionId, subjectItemName) =>
    API.patch(`/grading/session/${sessionId}/subject-item`, { subject_item_name: subjectItemName }),
  regradeSession: (sessionId, gradingModel) =>
    API.post(`/grading/session/${sessionId}/regrade`, { grading_model: gradingModel }),
  reviseProblem: (sessionId, payload) => API.patch(`/grading/session/${sessionId}/revise`, payload),
  getStudentDetail: (sessionId, filename) => API.get(`/grading/session/${sessionId}/student`, { params: { filename } }),
  getRevisions: (sessionId) => API.get(`/grading/session/${sessionId}/revisions`),
  getAllRevisions: () => API.get('/grading/all-revisions'),
  getAvailableModels: () => API.get('/grading/available-models'),
  decomposeItem: (item, problemContext = '') => API.post('/rubric/decompose-items', {
    item,
    problem_context: problemContext || null
  }),
};

export const dashboardAPI = {
  summary: () => API.get('/dashboard/summary'),
};

export const adminAPI = {
  getStats: () => API.get('/admin/stats'),
  getUsers: () => API.get('/admin/users'),
  updateUser: (userId, data) => API.put(`/admin/users/${userId}`, data),
  deleteUser: (userId) => API.delete(`/admin/users/${userId}`),
  getSettings: () => API.get('/admin/settings'),
  updateSettings: (data) => API.put('/admin/settings', data),
  getSessions: () => API.get('/admin/sessions'),
  getDbSchema: () => API.get('/admin/db/schema'),
  runDbQuery: (query) => API.post('/admin/db/query', { query }),
};

export default API;
