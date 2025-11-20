// exam-sync-v2/frontend/src/lib/apiClient.ts

import axios, { AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: new AxiosHeaders({
    'Content-Type': 'application/json',
  }),
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');

    // Ensure headers are an instance of AxiosHeaders
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
