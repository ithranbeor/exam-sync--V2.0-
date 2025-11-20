// exam-sync-v2/frontend/src/lib/apiClient.ts

import axios, { AxiosHeaders, AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

// ✅ Get backend URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

console.log('🌐 API Base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  headers: new AxiosHeaders({
    'Content-Type': 'application/json',
  }),
});

// Request interceptor
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

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  (error: AxiosError) => {
    // Log errors
    if (error.response) {
      console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('❌ No response received:', error.message);
      console.error('Request:', error.config?.url);
    } else {
      console.error('❌ Request setup error:', error.message);
    }

    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      console.warn('🔒 Unauthorized - clearing token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userData');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;