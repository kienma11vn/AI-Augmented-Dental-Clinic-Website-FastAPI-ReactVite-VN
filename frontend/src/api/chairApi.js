import axiosClient from './axiosClient';

export const chairApi = {
  getAll: () => axiosClient.get('/chairs/'),
  create: (data) => axiosClient.post('/chairs/', data),
  update: (id, data) => axiosClient.put(`/chairs/${id}`, data),
  delete: (id) => axiosClient.delete(`/chairs/${id}`),
};