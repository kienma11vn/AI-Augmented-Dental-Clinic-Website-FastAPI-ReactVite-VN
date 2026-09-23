import axiosClient from './axiosClient';

const aiApi = {
  /**
   * Tóm tắt hồ sơ điều trị dựa trên ghi chú điều trị (treatment_notes)
   * Backend Endpoint: POST /ai/summarize-record
   * @param {number} medicalRecordId - ID của hồ sơ điều trị
   */
  summarizeRecord: (medicalRecordId) => {
    return axiosClient.post('/ai/summarize-record', {
      medical_record_id: medicalRecordId,
    });
  },

  /**
   * Soạn tin nhắn nhắc lịch tái khám bằng AI
   * Backend Endpoint: POST /ai/reminder
   * @param {Object} payload - { patient_name, next_appointment, service }
   */
  generateReminder: (payload) => {
    return axiosClient.post('/ai/reminder', payload);
  },

  /**
   * Soạn tin nhắn thông báo thay đổi lịch khám (đổi giờ, đổi bác sĩ, hủy lịch) bằng AI
   * Backend Endpoint: POST /ai/generate-change-notice
   * @param {Object} payload - { patient_name, doctor_name, old_time, new_time, change_type, reason }
   */
  generateChangeNotice: (payload) => {
    return axiosClient.post('/ai/generate-change-notice', payload);
  },

  /**
   * Giải thích thông tin dịch vụ nha khoa bằng AI
   * Backend Endpoint: POST /ai/explain-service
   * @param {Object} payload - { service_name, description }
   */
  explainService: (payload) => {
    return axiosClient.post('/ai/explain-service', payload);
  },
};

export default aiApi;