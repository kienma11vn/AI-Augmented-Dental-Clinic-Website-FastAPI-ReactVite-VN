import axiosClient from './axiosClient';

export const userApi = {
  getAll: (params) => axiosClient.get('/users/', { params }),
  create: (data) => axiosClient.post('/users/', data),
  update: (id, data) => axiosClient.put(`/users/${id}`, data),
  toggleStatus: (id) => axiosClient.patch(`/users/${id}/toggle-status`),
};