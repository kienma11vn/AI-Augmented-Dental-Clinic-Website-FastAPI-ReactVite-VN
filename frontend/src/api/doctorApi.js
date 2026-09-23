import axiosClient from './axiosClient';

export const doctorApi = {
  // Lấy danh sách tất cả bác sĩ
  getAll: () => axiosClient.get('/doctors/'),

  // Cập nhật thông tin hồ sơ bác sĩ (bao gồm specialty)
  update: (id, data) => axiosClient.put(`/doctors/${id}`, data),

  // Lấy danh sách bệnh nhân theo tab: 'tracking' (Đang theo dõi) hoặc 'examined' (Đã khám)
  getPatients: (tab = 'tracking') => axiosClient.get(`/doctors/me/patients?tab=${tab}`),
};