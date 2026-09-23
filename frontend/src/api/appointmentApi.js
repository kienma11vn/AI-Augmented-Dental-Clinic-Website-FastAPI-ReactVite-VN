import axiosClient from './axiosClient';

const appointmentApi = {
  // --- LỊCH HẸN ---
  getAll: () => axiosClient.get('/appointments/'),
  getById: (id) => axiosClient.get(`/appointments/${id}`),
  create: (data) => axiosClient.post('/appointments/', data),
  update: (id, data) => axiosClient.put(`/appointments/${id}`, data),
  updateStatus: (id, status) => axiosClient.put(`/appointments/${id}`, { status }),
  delete: (id) => axiosClient.delete(`/appointments/${id}`),
  
  // Gửi đánh giá / phản hồi cho lịch hoàn thành
  submitFeedback: (id, feedbackData) => axiosClient.put(`/appointments/${id}/feedback`, feedbackData),

  // --- TRUY XUẤT DANH MỤC PHỤ TRỢ ---
  getPatients: () => axiosClient.get('/patients/'),
  getDoctors: () => axiosClient.get('/doctors/'),
  getChairs: () => axiosClient.get('/chairs/'),
  
  // Mặc định chỉ lấy danh sách các dịch vụ đang được cung cấp (is_active = true)
  getServices: (params = {}) => axiosClient.get('/services/', { params: { is_active: true, ...params } }),

  // --- LẤY TẤT CẢ DỮ LIỆU BAN ĐẦU DÙNG CHO PHÂN HỆ ĐẶT LỊCH ---
  getInitialData: async () => {
    try {
      const [appointments, doctors, chairs, patients, services] = await Promise.all([
        axiosClient.get('/appointments/'),
        axiosClient.get('/doctors/'),
        axiosClient.get('/chairs/'),
        axiosClient.get('/patients/'),
        axiosClient.get('/services/', { params: { is_active: true } }),
      ]);

      return {
        appointments: appointments?.data || appointments || [],
        doctors: doctors?.data || doctors || [],
        chairs: chairs?.data || chairs || [],
        patients: patients?.data || patients || [],
        services: services?.data || services || [],
      };
    } catch (error) {
      console.error('Lỗi API getInitialData:', error);
      return { appointments: [], doctors: [], chairs: [], patients: [], services: [] };
    }
  },
};

export default appointmentApi;