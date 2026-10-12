import axiosClient from './axiosClient';

export const sqlChatbotApi = {
  querySql: async (message) => {
    const response = await axiosClient.post('/ai-sql/query-sql', { message });
    return response.data; // Tự động bóc tách dữ liệu JSON từ FastAPI
  },
};