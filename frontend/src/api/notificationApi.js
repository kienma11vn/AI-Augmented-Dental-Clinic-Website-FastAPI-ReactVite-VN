import axiosClient from './axiosClient';

const notificationApi = {
  /**
   * Tạo thông báo mới
   * Backend Endpoint: POST /notifications/
   */
  createNotification: (data) => {
    return axiosClient.post('/notifications/', data);
  },

  /**
   * Lấy danh sách thông báo của một bệnh nhân theo patient_id
   * Backend Endpoint: GET /notifications/patient/:patient_id
   */
  getPatientNotifications: (patientId) => {
    return axiosClient.get(`/notifications/patient/${patientId}`);
  },

  /**
   * Lấy danh sách thông báo của người dùng/bệnh nhân hiện tại
   * Backend Endpoint: GET /notifications/my-notifications
   */
  getMyNotifications: () => {
    return axiosClient.get('/notifications/my-notifications');
  },

  /**
   * Đánh dấu một thông báo cụ thể là đã đọc
   * Backend Endpoint: PATCH /notifications/:id/read
   */
  markAsRead: (id) => {
    return axiosClient.patch(`/notifications/${id}/read`);
  },
};

export default notificationApi;