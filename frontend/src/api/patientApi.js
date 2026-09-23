import axiosClient from './axiosClient';

export const patientApi = {
  // Lấy danh sách bệnh nhân
  getAll: () => axiosClient.get('/patients/'),

  // Lấy chi tiết 1 bệnh nhân
  getById: (id) => axiosClient.get(`/patients/${id}`),

  // Tạo bệnh nhân mới
  create: (data) => axiosClient.post('/patients/', data),

  // Cập nhật thông tin bệnh nhân
  update: (id, data) => axiosClient.put(`/patients/${id}`, data),

  // Tạo tài khoản User cho Bệnh nhân
  createUser: (userData) => axiosClient.post('/users/', userData),

  // Cập nhật thông tin tài khoản User (bao gồm đổi mật khẩu)
  updateUser: (userId, userData) => axiosClient.put(`/users/${userId}`, userData),

  // Đổi trạng thái Khóa / Mở tài khoản bệnh nhân
  toggleUserStatus: (userId) => axiosClient.patch(`/users/${userId}/toggle-status`),

  // Lấy danh sách Hồ sơ bệnh lý
  getMedicalRecords: () => axiosClient.get('/records/'),
};