import axiosClient from './axiosClient';

const invoiceApi = {
  // Lấy danh sách hóa đơn
  getInvoices: () => {
    return axiosClient.get('/invoices/');
  },

  // Lấy thông tin chi tiết một hóa đơn theo ID
  getInvoiceById: (id) => {
    return axiosClient.get(`/invoices/${id}`);
  },

  // Tạo mới hóa đơn trực tiếp
  createInvoice: (data) => {
    return axiosClient.post('/invoices/', data);
  },

  // Lập hóa đơn từ Hồ sơ bệnh án nháp (Medical Record)
  createInvoiceFromRecord: (recordId, payload = {}) => {
    return axiosClient.post(`/invoices/from-record/${recordId}`, payload);
  },

  // Cập nhật hóa đơn (Thanh toán, Áp dụng chiết khấu, Cập nhật trạng thái)
  updateInvoice: (id, payload) => {
    return axiosClient.put(`/invoices/${id}`, payload);
  },
};

export default invoiceApi;