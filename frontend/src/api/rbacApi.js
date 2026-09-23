import axiosClient from './axiosClient';

export const rbacApi = {
  getRolesAndPermissions: () => axiosClient.get('/rbac/roles-permissions'),
  updateRolePermissions: (data) => axiosClient.put('/rbac/roles-permissions', data),
};