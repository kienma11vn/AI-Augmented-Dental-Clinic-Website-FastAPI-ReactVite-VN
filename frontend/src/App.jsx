import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import { UserRole } from './constants/enums';

// Trang chủ & Trang xác thực
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Dashboards
import PatientDashboard from './pages/patient/PatientDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import AccountantDashboard from './pages/accountant/AccountantDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
		<AuthProvider>
			<LanguageProvider>
				<ThemeProvider>	
					<Router>
					  <Routes>
						{/* 1. Trang chủ công khai (Landing Page) */}
						<Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />

						{/* 2. Public Authentication Routes */}
						<Route path="/login" element={<ErrorBoundary>
							<LoginPage />
						</ErrorBoundary>} />
						<Route path="/register" element={<ErrorBoundary>
							<RegisterPage />
						</ErrorBoundary>} />
						<Route path="/unauthorized" element={<ErrorBoundary>
							<UnauthorizedPage />
						</ErrorBoundary>} />

						{/* 3. Role 1: Patient Routes */}
						<Route element={<ProtectedRoute allowedRoles={[UserRole.PATIENT, 'patient']} />}>
						  <Route path="/patient/dashboard" element={<ErrorBoundary>
							<PatientDashboard />
						</ErrorBoundary>} />
						</Route>

						{/* 4. Role 2: Receptionist Routes */}
						<Route element={<ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, 'receptionist', UserRole.ADMIN, 'admin']} />}>
						  <Route path="/receptionist/dashboard" element={<ErrorBoundary>
							<ReceptionistDashboard />
						  </ErrorBoundary>} />
						</Route>

						{/* 5. Role 3: Doctor Routes */}
						<Route element={<ProtectedRoute allowedRoles={[UserRole.DOCTOR, 'doctor', UserRole.ADMIN, 'admin']} />}>
						  <Route path="/doctor/dashboard" element={<ErrorBoundary>
							<DoctorDashboard />
						  </ErrorBoundary>} />
						</Route>

						{/* 6. Role 4: Accountant Routes */}
						<Route element={<ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, 'accountant', UserRole.ADMIN, 'admin']} />}>
						  <Route path="/accountant/dashboard" element={<ErrorBoundary>
							<AccountantDashboard />
						  </ErrorBoundary>} />
						</Route>

						{/* 7. Role 5: Admin Routes */}
						<Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, 'admin']} />}>
						  <Route path="/admin/dashboard" element={<ErrorBoundary>
							<AdminDashboard />
						  </ErrorBoundary>} />
						</Route>

						{/* Quên mật khẩu */}
						<Route path="/forgot-password" element={<ErrorBoundary>
							<ForgotPasswordPage />
						</ErrorBoundary>} />
						<Route path="/reset-password" element={<ErrorBoundary>
							<ResetPasswordPage />
						</ErrorBoundary>} />

						{/* Điều hướng mặc định nếu không khớp route */}
						<Route path="*" element={<Navigate to="/" replace />} />
					  </Routes>
					</Router>
				</ThemeProvider>
		   </LanguageProvider>	
		</AuthProvider>
    </QueryClientProvider>
  );
}