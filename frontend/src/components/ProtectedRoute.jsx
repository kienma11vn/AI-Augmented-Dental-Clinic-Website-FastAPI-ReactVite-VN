// frontend/src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // Chuẩn hóa role của user về chữ hoa để so sánh chính xác với Enum (ADMIN, DOCTOR,...)
  const userRole = user.role ? user.role.toUpperCase() : '';

  // Kiểm tra vai trò của user có nằm trong danh sách cho phép không
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowedRoles = allowedRoles.map((r) => r.toUpperCase());
    if (!normalizedAllowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Nếu có children thì hiển thị children, nếu không thì hiển thị <Outlet /> đại diện cho Route con
  return children ? children : <Outlet />;
}