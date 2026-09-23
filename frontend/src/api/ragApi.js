import axiosClient from './axiosClient';

export const ragApi = {
  /**
   * Gửi tin nhắn tới RAG Chatbot
   * @param {string} message - Nội dung câu hỏi của người dùng
   * @param {string|null} sessionId - Mã phiên hội thoại (nếu có)
   * @returns {Promise<{response: string, session_id: string}>}
   */
  sendMessage: async (message, sessionId = null) => {
    const payload = { message };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    const response = await axiosClient.post('/rag-chat/', payload);
    return response.data;
  },

  /**
   * Lấy lịch sử hội thoại của một phiên
   * @param {string} sessionId 
   * @returns {Promise<Array<{id: number, sender: string, message: string, created_at: string}>>}
   */
  getHistory: async (sessionId) => {
    const response = await axiosClient.get(`/rag-chat/history/${sessionId}`);
    return response.data;
  },
};

export default ragApi;