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
  register: (username, email, password) => API.post('/auth/register', { username, email, password }),
  me: () => API.get('/auth/me'),
};

export const subjectAPI = {
  list: () => API.get('/subjects'),
  create: (name, code) => API.post('/subjects', { name, code }),
  getDetail: (subjectId) => API.get(`/subjects/${subjectId}`),
  createItem: (subjectId, name) => API.post(`/subjects/${subjectId}/items`, { name }),
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
  getResults: (sessionId) => API.get(`/grading/session/${sessionId}/results`),
  downloadExcel: (sessionId) => API.get(`/grading/session/${sessionId}/download`, { responseType: 'blob' }),
  getHistory: () => API.get('/grading/history'),
  reviseProblem: (sessionId, payload) => API.patch(`/grading/session/${sessionId}/revise`, payload),
  getRevisions: (sessionId) => API.get(`/grading/session/${sessionId}/revisions`),
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
