import axios from 'axios';

let rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').trim().replace(/\/+$/, '');
if (rawBaseUrl && !rawBaseUrl.endsWith('/api/v1')) {
  if (rawBaseUrl.endsWith('/api')) {
    rawBaseUrl += '/v1';
  } else {
    rawBaseUrl += '/api/v1';
  }
}
const API_BASE_URL = rawBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sri_ruthralaya_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loop on auth routes
    if (
      error.response?.status === 401 &&
      error.response?.data?.code !== 'GATEWAY_AUTH_FAILED' &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const refreshRes = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        if (refreshRes.data.success && refreshRes.data.data?.accessToken) {
          const newToken = refreshRes.data.data.accessToken;
          localStorage.setItem('sri_ruthralaya_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        // Clear local credentials on complete session expiry
        localStorage.removeItem('sri_ruthralaya_token');
        localStorage.removeItem('sri_ruthralaya_user');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
