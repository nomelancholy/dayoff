import axios, { type AxiosRequestConfig } from 'axios';

const rawClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰 자동 추가
rawClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터: 에러 핸들링
rawClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || '알 수 없는 에러가 발생했습니다.';
    console.error('API Error:', message);
    
    // 401 Unauthorized 처리 (토큰 제거 후 로그인 페이지로)
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

type DataApiClient = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T>;
};

const apiClient: DataApiClient = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    rawClient.get(url, config) as unknown as Promise<T>,
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    rawClient.delete(url, config) as unknown as Promise<T>,
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    rawClient.post(url, data, config) as unknown as Promise<T>,
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    rawClient.patch(url, data, config) as unknown as Promise<T>,
};

export default apiClient;
