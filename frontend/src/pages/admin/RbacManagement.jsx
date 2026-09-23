import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { rbacApi } from '../../api/rbacApi';

const ROLE_LABELS = {
  admin: 'Quản trị viên (Admin)',
  receptionist: 'Lễ tân',
  doctor: 'Bác sĩ',
  accountant: 'Kế toán',
  patient: 'Bệnh nhân',
};

export default function RbacManagement() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [selectedRole, setSelectedRole] = useState('receptionist');
  const [currentSelectedPerms, setCurrentSelectedPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchRbacData();
  }, []);

  useEffect(() => {
    if (rolePermissions[selectedRole]) {
      setCurrentSelectedPerms(rolePermissions[selectedRole]);
    } else {
      setCurrentSelectedPerms([]);
    }
  }, [selectedRole, rolePermissions]);

  const fetchRbacData = async () => {
    setLoading(true);
    try {
      const res = await rbacApi.getRolesAndPermissions();
      const { roles, permissions, role_permissions } = res.data;
      setRoles(roles || []);
      setAllPermissions(permissions || []);
      setRolePermissions(role_permissions || {});
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu RBAC:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Tự động tải lại dữ liệu phân quyền sau 5 phút không tương tác (tạm dừng khi hệ thống đang xử lý lưu)
	useIdleRefresh(fetchRbacData, 5 * 60 * 1000, saving);

  const handleTogglePermission = (permCode) => {
    // Khóa quyền user:manage đối với Admin trên UI
    if (selectedRole === 'admin' && permCode === 'user:manage') return;

    setCurrentSelectedPerms((prev) =>
      prev.includes(permCode)
        ? prev.filter((code) => code !== permCode)
        : [...prev, permCode]
    );
  };

  const handleToggleCategory = (categoryPerms, shouldSelectAll) => {
    const permCodes = categoryPerms.map((p) => p.code);
    if (shouldSelectAll) {
      setCurrentSelectedPerms((prev) => Array.from(new Set([...prev, ...permCodes])));
    } else {
      setCurrentSelectedPerms((prev) =>
        prev.filter((code) => {
          if (selectedRole === 'admin' && code === 'user:manage') return true;
          return !permCodes.includes(code);
        })
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await rbacApi.updateRolePermissions({
        role: selectedRole,
        permissions: currentSelectedPerms,
      });

      setRolePermissions((prev) => ({
        ...prev,
        [selectedRole]: currentSelectedPerms,
      }));

      setMessage({ type: 'success', text: `Cập nhật quyền thành công cho vai trò ${ROLE_LABELS[selectedRole] || selectedRole}` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Lưu thất bại' });
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const cat = perm.category || 'Khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {});

  if (loading) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Đang tải cấu hình phân quyền...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Phân quyền người dùng (RBAC)</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Chọn vai trò để xem và tùy chỉnh danh sách quyền hạn trong hệ thống
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Selector chọn Vai trò (Role) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 space-y-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          1. Chọn Vai trò (Role)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {roles.map((r) => {
            const isSelected = selectedRole === r.code;
            return (
              <button
                key={r.code}
                onClick={() => setSelectedRole(r.code)}
                className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all text-left flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span>{ROLE_LABELS[r.code] || r.name}</span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-normal mt-1">code: {r.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách Quyền (Permissions) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Danh sách Quyền hạn (Permissions)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Đang thiết lập cho: <strong className="text-sky-600 dark:text-sky-400">{ROLE_LABELS[selectedRole]}</strong>
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình phân quyền'}
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([category, perms]) => {
            const allChecked = perms.every((p) => currentSelectedPerms.includes(p.code));
            return (
              <div key={category} className="border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    {category}
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory(perms, !allChecked)}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  >
                    {allChecked ? 'Bỏ chọn tất cả nhóm này' : 'Chọn tất cả nhóm này'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {perms.map((p) => {
                    const checked = currentSelectedPerms.includes(p.code);
                    const isProtectedAdminPerm = selectedRole === 'admin' && p.code === 'user:manage';

                    return (
                      <label
                        key={p.code}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isProtectedAdminPerm
                            ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 cursor-not-allowed'
                            : checked
                            ? 'bg-white dark:bg-slate-800 border-sky-200 dark:border-sky-700 shadow-sm'
                            : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isProtectedAdminPerm}
                          onChange={() => handleTogglePermission(p.code)}
                          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 disabled:opacity-50 dark:bg-slate-900"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {p.label}
                            {isProtectedAdminPerm && (
                              <span className="ml-2 text-[10px] text-amber-700 dark:text-amber-400 font-normal">(Mặc định của Admin)</span>
                            )}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{p.code}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}