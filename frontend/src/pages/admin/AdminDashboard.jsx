import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AccountManagement from './AccountManagement';
import RbacManagement from './RbacManagement';
import ServiceManagement from './ServiceManagement';
import AuditLogManagement from './AuditLogManagement';
import ChairManagement from './ChairManagement';
import ReportManagement from './ReportManagement';
import ChangePassword from '../../components/common/ChangePassword';
import ThemeToggle from '../../components/common/ThemeToggle';
import ErrorBoundary from '../../components/common/ErrorBoundary';

import ChatbotButton from '../../components/ChatbotButton';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('accounts');

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col md:flex-row transition-colors">
      <aside className="w-full md:w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800 dark:border-slate-900">
        <div>
          <div className="p-5 border-b border-slate-800 dark:border-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-xl">
              🦷
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">Dental Care AI</h1>
              <span className="text-xs text-sky-400 font-medium">Admin Portal</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: 'accounts', label: 'Quản lý Tài khoản', icon: '👥' },
              { id: 'rbac', label: 'Phân quyền người dùng (RBAC)', icon: '🛡️' },
              { id: 'services', label: 'Danh mục Dịch vụ', icon: '🛠️' },
              { id: 'chairs', label: 'Danh mục Ghế khám', icon: '🪑' },
              { id: 'reports', label: 'Báo cáo Thống kê', icon: '📊' },
              { id: 'logs', label: 'Nhật ký Hệ thống (Audit Logs)', icon: '📜' },
              { id: 'security', label: 'Đổi mật khẩu', icon: '🔑' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'
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
			
			<div className="p-4 border-t border-slate-800 dark:border-slate-900">
			  <div className="mb-3 px-2">
				<p className="text-xs text-slate-400">Đang đăng nhập:</p>
				<p className="text-sm font-semibold text-white truncate">{user?.full_name || user?.email}</p>
				<span className="text-[10px] bg-sky-900 text-sky-300 px-2 py-0.5 rounded font-bold uppercase">
				  {user?.role}
				</span>
			  </div>
			  <div className="flex items-center gap-2">
				<ThemeToggle />
				<button
				  onClick={logout}
				  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 dark:hover:bg-slate-900 text-slate-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
				>
				  <span>🚪</span> Đăng xuất
				</button>
			  </div>
			</div>
		</div>	
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors">
	  <ErrorBoundary key={activeTab}>
        {/* Tab Quản lý Tài khoản */}
        {activeTab === 'accounts' && <AccountManagement />}
		
        {/* Tab RBAC */}
        {activeTab === 'rbac' && <RbacManagement />}
		
        {/* Tab Quản lý Dịch vụ */}
        {activeTab === 'services' && <ServiceManagement />}

        {/* Tab Quản lý Ghế khám */}
        {activeTab === 'chairs' && <ChairManagement />}

        {/* Tab Báo cáo thống kê */}
        {activeTab === 'reports' && <ReportManagement />}

        {/* Tab Nhật ký hệ thống */}
        {activeTab === 'logs' && <AuditLogManagement />}

        {/* Tab Đổi mật khẩu */}
        {activeTab === 'security' && <ChangePassword />}
	  </ErrorBoundary>	
      </main>
    </div>
  );
}