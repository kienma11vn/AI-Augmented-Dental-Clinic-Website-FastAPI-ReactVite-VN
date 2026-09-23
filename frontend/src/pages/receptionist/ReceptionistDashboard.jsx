import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ChangePassword from '../../components/common/ChangePassword';
import AppointmentManagement from './AppointmentManagement';
import PatientManagement from './PatientManagement';
import InvoiceManagement from './InvoiceManagement';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import ThemeToggle from '../../components/common/ThemeToggle';

import ChatbotButton from '../../components/ChatbotButton';

export default function ReceptionistDashboard() {
  const auth = useAuth();
  const user = auth?.user;
  const logout = auth?.logout || (() => {});
  
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 border-r border-slate-800 dark:border-slate-800/80 flex-shrink-0 flex flex-col justify-between">
        <div>
          <div className="p-5 border-b border-slate-800 dark:border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              🦷
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">Dental Care AI</h1>
              <span className="text-xs text-sky-400 font-medium">Receptionist Portal</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: 'appointments', label: 'Quản lý lịch hẹn & Tiếp nhận', icon: '📅' },
              { id: 'patients', label: 'Quản lý hồ sơ bệnh nhân', icon: '📋' },
              { id: 'invoices', label: 'Lập hóa đơn & Thanh toán', icon: '🧾' },
              { id: 'security', label: 'Đổi mật khẩu', icon: '🔑' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'
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
				<p className="text-xs text-slate-400">Đang đăng nhập:</p>
				<p className="text-sm font-semibold text-white truncate">{user?.full_name || user?.email || 'N/A'}</p>
				<span className="text-[10px] bg-sky-900/80 dark:bg-sky-950 text-sky-300 border border-sky-700/50 dark:border-sky-800 px-2 py-0.5 rounded font-bold uppercase inline-block mt-1">
				  {user?.role || 'Lễ tân'}
				</span>
			  </div>
			  <div className="flex items-center gap-2">
				<ThemeToggle />
				<button
				  onClick={logout}
				  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 dark:border-slate-800 hover:bg-slate-800 dark:hover:bg-slate-900 text-slate-300 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
				>
				  <span>🚪</span> Đăng xuất
				</button>
			  </div>
			</div>
		</div>	
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <ErrorBoundary key={activeTab}>
          {activeTab === 'appointments' && <AppointmentManagement />}
          {activeTab === 'patients' && <PatientManagement />}
          {activeTab === 'invoices' && <InvoiceManagement />}
          {activeTab === 'security' && <ChangePassword />}
        </ErrorBoundary>
      </main>
    </div>
  );
}