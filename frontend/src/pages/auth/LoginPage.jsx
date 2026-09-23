import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { getDashboardByRole } from '../../utils/roleRedirect';
import ThemeToggle from '../../components/common/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      const tokenResponse = await authApi.login(email, password);
      const accessToken = tokenResponse.data.access_token;

      localStorage.setItem('access_token', accessToken);

      const meResponse = await authApi.getMe();
      const currentUser = meResponse.data;

      login(accessToken, currentUser);

      const targetDashboard = getDashboardByRole(currentUser.role);
      navigate(targetDashboard, { replace: true });
    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
      if (err.response && err.response.status === 401) {
        setErrorMsg('Email hoặc mật khẩu không chính xác.');
      } else if (err.response && err.response.data?.detail) {
        setErrorMsg(err.response.data.detail);
      } else {
        setErrorMsg('Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại Backend.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-sky-50/50 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
	{/* 🖼️ Lớp Background Image Mờ */}
    <div 
      className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-15 transition-opacity"
      style={{ backgroundImage: `url('/bg_opacity.jpg')` }}
    />
	
	{/* 🖼️ Thẻ bọc phủ toàn bộ nội dung lên trên background (z-10) */}
    <div className="relative z-10">
	
      {/* Nút Chuyển Dark / Light Mode */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-sky-600/30">
            🦷
          </div>
        </Link>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Đăng nhập Hệ thống
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Phòng khám Nha khoa Tích hợp AI
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Địa chỉ Email <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="account@nhakhoa.vn"
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-400 dark:placeholder-slate-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-400 dark:placeholder-slate-500 text-sm transition-all"
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">Hiện mật khẩu</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">Chưa có tài khoản bệnh nhân? </span>
            <Link to="/register" className="font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300">
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
	</div> {/* Đóng thẻ relative z-10 */}  
    </div>
  );
}