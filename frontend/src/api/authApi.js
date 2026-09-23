import axiosClient from './axiosClient';

export const authApi = {
  // Đăng nhập hệ thống (Form Data theo chuẩn OAuth2 của FastAPI)
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email); // FastAPI OAuth2 dùng key 'username'
    formData.append('password', password);

    return axiosClient.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },

  // Lấy thông tin tài khoản hiện tại
  getMe: async () => {
    return axiosClient.get('/auth/me');
  },

  // Đăng ký tài khoản bệnh nhân mới (UserCreate Schema)
  registerPatient: async (data) => {
    return axiosClient.post('/auth/register', data);
  },
  
  // Khai báo alias register trỏ về registerPatient để tránh lỗi gõ sai tên hàm
  register: async (data) => {
    return axiosClient.post('/auth/patient-register', data);
  },
  
  // Quên mật khẩu
  forgotPassword: (email) => axiosClient.post('/auth/forgot-password', { email }),
  
  resetPassword: (token, newPassword) =>
    axiosClient.post('/auth/reset-password', {
      token: token,
      new_password: newPassword,
    }),
};