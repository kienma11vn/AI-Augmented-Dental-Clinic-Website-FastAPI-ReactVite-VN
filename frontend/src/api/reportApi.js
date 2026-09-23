import axiosClient from './axiosClient';

export const reportApi = {
  getOverview: (days = 30) => axiosClient.get('/reports/overview', { params: { days } }),

  getVisitsByDay: async (days = 14) => {
    try {
      const res = await axiosClient.get('/reports/visits-by-day', { params: { days } });
      const rawData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

      return rawData.map((item) => ({
        day: item.day || item.date || '',
        total: item.total ?? item.count ?? 0,
        completed: item.completed ?? 0,
        cancelled: item.cancelled ?? 0,
      }));
    } catch (error) {
      console.error('Lỗi khi tải thống kê lượt khám theo ngày:', error);
      return [];
    }
  },

  getRevenueByService: async (days = 90) => {
    try {
      const res = await axiosClient.get('/reports/revenue-by-service', { params: { days } });
      const rawData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

      return rawData.map((item) => ({
        service: item.service || item.service_name || item.name || 'Dịch vụ',
        count: Number(item.count ?? item.visits ?? item.total_visits ?? item.quantity ?? 0),
        amount: Number(item.amount ?? item.revenue ?? item.total_revenue ?? 0),
        discount: Number(item.discount ?? item.discount_amount ?? item.total_discount ?? 0),
        debt: Number(item.debt ?? item.debt_amount ?? item.outstanding ?? item.total_debt ?? 0),
      }));
    } catch (error) {
      console.error('Lỗi khi tải doanh thu theo dịch vụ:', error);
      return [];
    }
  },

  getUpcomingFollowups: (days = 30) => axiosClient.get('/reports/upcoming-followups', { params: { days } }),
  
  getPatientFeedbacks: async (days = 30) => {
    try {
      const res = await axiosClient.get('/reports/feedbacks', { params: { days } });
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Lỗi khi tải đánh giá bệnh nhân:', error);
      return [];
    }
  },
};