import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../api/patientApi';
import ChangePassword from '../../components/common/ChangePassword';
import ThemeToggle from '../../components/common/ThemeToggle';
import ErrorBoundary from '../../components/common/ErrorBoundary';

import ChatbotButton from '../../components/ChatbotButton';

import PatientAppointments from './PatientAppointments';
import PatientTreatmentHistory from './PatientTreatmentHistory';
import PatientServicesList from './PatientServicesList';
import PatientProfileInfo from './PatientProfileInfo';

export default function PatientDashboard() {
  const auth = useAuth();
  const logout = auth?.logout || (() => {});

  const [currentUser, setCurrentUser] = useState(auth?.user);
  const [activeTab, setActiveTab] = useState('appointments');

  // Hàm đồng bộ dữ liệu người dùng vào LocalStorage
  const syncLocalStorage = (updatedUser) => {
    const keys = ['user', 'authUser', 'userInfo', 'patient_user'];
    keys.forEach((key) => {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          const parsed = JSON.parse(item);
          const newItem = { ...parsed, full_name: updatedUser.full_name };
          localStorage.setItem(key, JSON.stringify(newItem));
        } catch (e) {
          // Bỏ qua nếu không phải chuỗi JSON
        }
      }
    });
  };

  // 1. Lấy thông tin bệnh nhân mới nhất từ API ngay khi trang được tải/refresh (F5)
  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const res = await patientApi.getAll();
        const list = res.data || [];
        if (list.length > 0) {
          const patient = list[0];
          const latestName = patient.full_name || patient.user?.full_name;

          if (latestName) {
            const updatedUser = {
              ...(auth?.user || currentUser),
              full_name: latestName,
            };

            setCurrentUser(updatedUser);

            // Cập nhật lại AuthContext nếu hỗ trợ
            if (typeof auth?.setUser === 'function') {
              auth.setUser(updatedUser);
            } else if (typeof auth?.updateUser === 'function') {
              auth.updateUser(updatedUser);
            }

            syncLocalStorage(updatedUser);
          }
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ thông tin mới nhất:', err);
      }
    };

    fetchLatestProfile();
  }, []);

  // 2. Giữ tên mới nhất khi authContext thay đổi
  useEffect(() => {
    if (auth?.user) {
      setCurrentUser((prev) => ({
        ...auth.user,
        full_name: prev?.full_name || auth.user.full_name,
      }));
    }
  }, [auth?.user]);

  // 3. Callback cập nhật UI ngay lập tức khi vừa bấm Lưu ở Form
  const handleProfileUpdate = (updatedData) => {
    const newName = updatedData.full_name || updatedData.name || currentUser?.full_name;
    const updatedUser = {
      ...currentUser,
      ...updatedData,
      full_name: newName,
    };

    setCurrentUser(updatedUser);

    if (typeof auth?.setUser === 'function') {
      auth.setUser(updatedUser);
    } else if (typeof auth?.updateUser === 'function') {
      auth.updateUser(updatedUser);
    }

    syncLocalStorage(updatedUser);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800 dark:border-slate-800/80">
        <div>
          <div className="p-5 border-b border-slate-800 dark:border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-xl">
              😷
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">Dental Care AI</h1>
              <span className="text-xs text-sky-400 font-medium">Patient Portal</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: 'appointments', label: 'Quản lý lịch hẹn', icon: '📅' },
              { id: 'records', label: 'Lịch sử điều trị', icon: '🩺' },
              { id: 'services', label: 'Tra cứu dịch vụ', icon: '🦷' },
              { id: 'profile', label: 'Thông tin cá nhân', icon: '👤' },
              { id: 'security', label: 'Đổi mật khẩu', icon: '🔑' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:bg-slate-800 dark:hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-left">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

		{/* Khối dưới của Sidebar */}
		<div>
			<ChatbotButton />
			
			<div className="p-4 border-t border-slate-800 dark:border-slate-800/80">
			  <div className="mb-3 px-2">
				<p className="text-xs text-slate-400 dark:text-slate-400">Đang đăng nhập:</p>
				<p className="text-sm font-semibold text-white truncate">
				  {currentUser?.full_name || currentUser?.email || 'N/A'}
				</p>
				<span className="text-[10px] bg-sky-900/80 dark:bg-sky-950 text-sky-300 px-2 py-0.5 rounded font-bold uppercase inline-block mt-1">
				  {currentUser?.role || 'Bệnh nhân'}
				</span>
			  </div>
			  <div className="flex items-center gap-2">
				<ThemeToggle />
				<button
				  onClick={logout}
				  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 dark:hover:bg-slate-800/80 text-slate-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
				>
				  <span>🚪</span> Đăng xuất
				</button>
			  </div>
			</div>
		</div>	
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <ErrorBoundary key={activeTab}>
          {activeTab === 'appointments' && (
            <div>
              <PatientAppointments />
            </div>
          )}
          {activeTab === 'records' && (
            <div>
              <PatientTreatmentHistory />
            </div>
          )}
          {activeTab === 'services' && <PatientServicesList />}
          {activeTab === 'profile' && (
            <PatientProfileInfo onProfileUpdate={handleProfileUpdate} />
          )}
          {activeTab === 'security' && <ChangePassword />}
        </ErrorBoundary>
      </main>
    </div>
  );
}