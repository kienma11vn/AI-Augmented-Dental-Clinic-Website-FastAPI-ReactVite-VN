import axiosClient from './axiosClient';

export const serviceApi = {
  // Lấy danh sách dịch vụ từ CSDL (truyền params nếu muốn lọc theo trạng thái)
  getAll: (params) => axiosClient.get('/services/', { params }),

  // Thêm dịch vụ mới
  create: (data) => axiosClient.post('/services/', data),

  // Cập nhật dịch vụ
  update: (id, data) => axiosClient.put(`/services/${id}`, data),

  // Đổi trạng thái / Vô hiệu hóa dịch vụ
  delete: (id) => axiosClient.delete(`/services/${id}`),
};