import axiosClient from './axiosClient';

export const medicalRecordApi = {
  // Lấy tất cả danh sách hồ sơ (Doctor role tự động filter theo doctor_id ở backend)
  getAll: () => axiosClient.get('/records/'),

  // Lấy chi tiết hồ sơ theo ID
  getById: (id) => axiosClient.get(`/records/${id}`),

  // Tạo mới hồ sơ bệnh án
  create: (data) => axiosClient.post('/records/', data),

  // Cập nhật thông tin chẩn đoán, ghi chú điều trị và lịch tái khám
  update: (id, data) => axiosClient.put(`/records/${id}`, data),

  // Yêu cầu AI tóm tắt hồ sơ bệnh án
  generateAiSummary: (id) => axiosClient.post(`/records/${id}/ai-summary`),
};

export default medicalRecordApi;