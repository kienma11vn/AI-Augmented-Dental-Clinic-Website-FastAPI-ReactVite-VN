import { UserRole } from '../constants/enums';

/**
 * Lấy đường dẫn trang điều khiển tương ứng với vai trò người dùng
 * @param {string} role - Vai trò của user (admin, receptionist, doctor, accountant, patient)
 * @returns {string} Routepath tương ứng
 */
export const getDashboardByRole = (role) => {
  switch (role) {
    case UserRole.PATIENT:
      return '/patient/dashboard';
    case UserRole.RECEPTIONIST:
      return '/receptionist/dashboard';
    case UserRole.DOCTOR:
      return '/doctor/dashboard';
    case UserRole.ACCOUNTANT:
      return '/accountant/dashboard';
    case UserRole.ADMIN:
      return '/admin/dashboard';
    default:
      return '/login';
  }
};