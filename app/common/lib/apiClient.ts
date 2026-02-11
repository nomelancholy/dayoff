import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰 자동 추가
apiClient.interceptors.request.use(
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
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || '알 수 없는 에러가 발생했습니다.';
    console.error('API Error:', message);
    
    // 401 Unauthorized 처리 (로그아웃 등)
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      // window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
