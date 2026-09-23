import axiosClient from './axiosClient';

const discountProgramsApi = {
  getDiscountPrograms: () => axiosClient.get('/discount-programs'),
  getDiscountProgramById: (id) => axiosClient.get(`/discount-programs/${id}`),
  createDiscountProgram: (data) => axiosClient.post('/discount-programs', data),
  updateDiscountProgram: (id, data) => axiosClient.put(`/discount-programs/${id}`, data),
  toggleDiscountProgramStatus: (id) => axiosClient.patch(`/discount-programs/${id}/toggle`),
  deleteDiscountProgram: (id) => axiosClient.delete(`/discount-programs/${id}`),
};

export default discountProgramsApi;