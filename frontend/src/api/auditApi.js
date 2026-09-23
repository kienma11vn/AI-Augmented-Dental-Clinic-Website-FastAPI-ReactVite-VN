import axiosClient from './axiosClient';

export const auditApi = {
  getAll: (params) => axiosClient.get('/audit-logs/', { params }),
  export: () => axiosClient.get('/audit-logs/export', { responseType: 'blob' }),
};