// exam-sync-v2/frontend/src/lib/apiClient.ts

import axios, { AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

// ✅ Vite exposes env vars at BUILD time
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://exam-sync-v2-0-mwnp.onrender.com/api';

// Debug log (remove after confirming it works)
console.log('🔗 Using API Base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: new AxiosHeaders({
    'Content-Type': 'application/json',
  }),
  withCredentials: true, // ✅ Important for CORS with credentials
  timeout: 30000, // 30 second timeout for Render cold starts
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');

    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }

    if (token) {
      config.headers.set('Authorization', `Token ${token}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;