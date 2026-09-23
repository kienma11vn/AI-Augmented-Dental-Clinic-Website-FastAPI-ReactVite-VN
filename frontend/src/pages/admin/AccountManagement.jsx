import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { useAuth } from '../../context/AuthContext';
import { userApi } from '../../api/userApi';
import { doctorApi } from '../../api/doctorApi';
import { patientApi } from '../../api/patientApi';

const ROLE_LABELS = {
  admin: { label: 'Quản trị viên', color: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  receptionist: { label: 'Lễ tân', color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  doctor: { label: 'Bác sĩ', color: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  accountant: { label: 'Kế toán', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  patient: { label: 'Bệnh nhân', color: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-600' },
};

export default function AccountManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Lấy thông tin tài khoản Admin đang đăng nhập từ AuthContext
  const { user: currentUser } = useAuth();
  
  // Phân trang state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State quản lý ẩn/hiện mật khẩu trong modal
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'receptionist',
    password: '',
    is_active: true,
    specialty: '',
    phone: '',
  });

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  // Tự động quay về trang 1 khi tìm kiếm hoặc lọc vai trò
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      const res = await userApi.getAll(params);
      setUsers(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách tài khoản:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Tự động tải lại danh sách tài khoản sau 5 phút không tương tác (tạm dừng khi mở Modal)
	useIdleRefresh(fetchUsers, 5 * 60 * 1000, isModalOpen);

  const handleOpenModal = async (user = null) => {
    setShowPassword(false);
    setModalLoading(true);
    setIsModalOpen(true);

    if (user) {
      setEditingUser(user);
      let specialty = '';
      let phone = '';

      try {
        if (user.role === 'doctor') {
          const docRes = await doctorApi.getAll();
          const doctor = (docRes.data || []).find((d) => d.user_id === user.id);
          if (doctor) specialty = doctor.specialty || '';
        } else if (user.role === 'patient') {
          const patRes = await patientApi.getAll();
          const patient = (patRes.data || []).find((p) => p.user_id === user.id || p.user?.id === user.id);
          if (patient) phone = patient.phone || '';
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin phụ thuộc vai trò:', err);
      }

      setFormData({
        email: user.email || '',
        full_name: user.full_name || '',
        role: user.role || 'receptionist',
        password: '',
        is_active: user.is_active ?? true,
        specialty,
        phone,
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        full_name: '',
        role: 'receptionist',
        password: '',
        is_active: true,
        specialty: '',
        phone: '',
      });
    }
    setModalLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { specialty, phone, ...userPayload } = formData;

      let userId = null;

      if (editingUser) {
        if (!userPayload.password) delete userPayload.password;
        await userApi.update(editingUser.id, userPayload);
        userId = editingUser.id;
      } else {
        const res = await userApi.create(userPayload);
        userId = res.data?.id;
      }

      // Cập nhật thông tin mở rộng tương ứng với Vai trò
      if (userId) {
        if (formData.role === 'doctor') {
          const docRes = await doctorApi.getAll();
          const doctor = (docRes.data || []).find((d) => d.user_id === userId);
          if (doctor) {
            await doctorApi.update(doctor.id, {
              specialty: formData.specialty,
              full_name: formData.full_name,
            });
          }
        } else if (formData.role === 'patient') {
          const patRes = await patientApi.getAll();
          const patient = (patRes.data || []).find((p) => p.user_id === userId || p.user?.id === userId);
          if (patient) {
            await patientApi.update(patient.id, {
              phone: formData.phone,
              full_name: formData.full_name,
            });
          }
        }
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (window.confirm(`Bạn có chắc muốn ${user.is_active ? 'khóa' : 'mở khóa'} tài khoản ${user.email}?`)) {
      try {
        await userApi.toggleStatus(user.id);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.detail || 'Thao tác thất bại');
      }
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-x-auto">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Quản lý Tài khoản</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Danh sách tài khoản nhân viên, bác sĩ và bệnh nhân</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
        >
          + Tạo tài khoản mới
        </button>
      </div>

      {/* Thanh tìm kiếm & lọc */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row gap-4 overflow-x-auto">
        <input
          type="text"
          placeholder="🔍 Tìm theo tên hoặc email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          <option value="">Tất cả vai trò</option>
          <option value="admin">Quản trị viên (Admin)</option>
          <option value="receptionist">Lễ tân</option>
          <option value="doctor">Bác sĩ</option>
          <option value="accountant">Kế toán</option>
          <option value="patient">Bệnh nhân</option>
        </select>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Họ và tên</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Vai trò</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm text-slate-700 dark:text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">Không tìm thấy tài khoản nào.</td>
              </tr>
            ) : (
              paginatedUsers.map((u) => {
                const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300' };
                // Kiểm tra xem dòng tài khoản này có trùng khớp với Admin đang đăng nhập không
                const isSelf = 
					(currentUser?.id && String(u.id) === String(currentUser.id)) ||
					(currentUser?.email && u.email?.toLowerCase() === currentUser.email?.toLowerCase());

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">#{u.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                      {u.full_name} {isSelf && <span className="text-[12px] align-super text-red-600 dark:text-red-400 font-bold ml-0.5">Tôi</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'}`}>
                        {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenModal(u)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-medium transition-all"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={isSelf && u.is_active}
                        title={isSelf && u.is_active ? 'Bạn không thể tự khóa tài khoản của chính mình' : ''}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          u.is_active
                            ? 'border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                            : 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        {u.is_active ? 'Khóa' : 'Mở khóa'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* THANH PHÂN TRANG */}
        {!loading && filteredUsers.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
            <div>
              Hiển thị <span className="font-semibold text-slate-800 dark:text-slate-200">{startIndex + 1}</span> đến{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min(startIndex + itemsPerPage, filteredUsers.length)}
              </span>{' '}
              trong tổng số <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredUsers.length}</span> tài khoản
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-slate-700 dark:text-slate-300 transition-all"
              >
                Trước
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentPage === page
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-slate-700 dark:text-slate-300 transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tạo/Sửa tài khoản */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
              {editingUser ? 'Cập nhật Tài khoản' : 'Tạo Tài khoản mới'}
            </h3>

            {modalLoading ? (
              <div className="py-12 flex items-center justify-center text-slate-500 dark:text-slate-400 gap-2">
                <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Đang tải chi tiết thông tài khoản...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Vai trò *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    <option value="receptionist">Lễ tân</option>
                    <option value="doctor">Bác sĩ</option>
                    <option value="accountant">Kế toán</option>
                    <option value="patient">Bệnh nhân</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>

                {/* Trường Chuyên khoa cho vai trò Bác sĩ */}
                {formData.role === 'doctor' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Chuyên khoa *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Chỉnh nha, Nắn chỉnh răng..."
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                )}

                {/* Trường Số điện thoại cho vai trò Bệnh nhân */}
                {formData.role === 'patient' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Số điện thoại *</label>
                    <input
                      type="tel"
                      required
                      placeholder="VD: 0987654321"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                )}

                {/* Ô Nhập Mật khẩu + Checkbox Hiện mật khẩu */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {editingUser ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu *'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="show_password"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <label htmlFor="show_password" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      Hiện mật khẩu
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="user_is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="user_is_active" className="text-sm text-slate-700 dark:text-slate-200 font-medium cursor-pointer select-none">
                    Hoạt động
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700 flex items-center gap-2 transition-all"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}