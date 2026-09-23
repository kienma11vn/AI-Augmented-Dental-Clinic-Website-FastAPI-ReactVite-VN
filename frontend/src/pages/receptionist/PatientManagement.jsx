import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { patientApi } from '../../api/patientApi';

export default function PatientManagement() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');

  // Phân trang state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Selected item state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [latestRecord, setLatestRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    id_number: '',
    date_of_birth: '',
    gender: 'Nam',
    address: '',
    medical_history: '',
  });

  useEffect(() => {
    fetchPatients();
  }, []);  
  
  // Tự động quay về trang 1 khi thay đổi từ khóa hoặc bộ lọc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchCategory]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await patientApi.getAll();
      setPatients(res.data || []);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách bệnh nhân:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useIdleRefresh(fetchPatients, 300000);

  // Tính tuổi từ ngày sinh
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : 'N/A';
  };

  // Lọc danh sách bệnh nhân theo input và dropdown
  const filteredPatients = patients.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const age = calculateAge(p.date_of_birth).toString();
    const userId = (p.user_id || '').toString();

    switch (searchCategory) {
      case 'name':
        return p.full_name?.toLowerCase().includes(term);
      case 'phone':
        return p.phone?.toLowerCase().includes(term);
      case 'age':
        return age.includes(term);
      case 'userId':
        return userId.includes(term);
      case 'idNumber':
        return p.id_number?.toLowerCase().includes(term);
      case 'address':
        return p.address?.toLowerCase().includes(term);
      case 'all':
      default:
        return (
          p.full_name?.toLowerCase().includes(term) ||
          p.phone?.toLowerCase().includes(term) ||
          age.includes(term) ||
          userId.includes(term) ||
          p.id_number?.toLowerCase().includes(term) ||
          p.address?.toLowerCase().includes(term)
        );
    }
  });

  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

  // Mở Modal Chi tiết bệnh nhân
  const handleOpenDetail = (patient) => {
    setSelectedPatient(patient);
    setShowPassword(false);
    setIsDetailModalOpen(true);
  };

  // Mở Modal Sửa bệnh nhân
  const handleOpenEdit = (patient) => {
    setSelectedPatient(patient);
    setShowEditPassword(false);
    setFormData({
      full_name: patient.full_name || '',
      phone: patient.phone || '',
      email: patient.user?.email || '',
      password: '',
      id_number: patient.id_number || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || 'Nam',
      address: patient.address || '',
      medical_history: patient.medical_history || '',
    });
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  // Mở Modal Hồ sơ bệnh lý gần nhất
  const handleOpenMedicalRecord = async (patient) => {
    setSelectedPatient(patient);
    setLoadingRecord(true);
    setLatestRecord(null);
    setIsRecordModalOpen(true);

    try {
      const res = await patientApi.getMedicalRecords();
      const records = res.data || [];
      const patientRecords = records
        .filter((r) => r.patient_id === patient.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (patientRecords.length > 0) {
        setLatestRecord(patientRecords[0]);
      }
    } catch (err) {
      console.error('Lỗi lấy hồ sơ bệnh lý:', err);
    } finally {
      setLoadingRecord(false);
    }
  };

  // Tạo bệnh nhân mới
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      let createdUserId = null;

      if (formData.email && formData.password) {
        const userRes = await patientApi.createUser({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: 'patient',
          is_active: true,
        });
        createdUserId = userRes.data.id;
      }

      await patientApi.create({
        full_name: formData.full_name,
        phone: formData.phone,
        id_number: formData.id_number,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        address: formData.address,
        medical_history: formData.medical_history,
        user_id: createdUserId,
      });

      alert('Tạo bệnh nhân thành công!');
      setIsCreateModalOpen(false);
      resetForm();
      fetchPatients();
    } catch (err) {
      alert(err.response?.data?.detail || 'Tạo bệnh nhân thất bại');
    }
  };

  // Cập nhật thông tin bệnh nhân
  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    try {
      await patientApi.update(selectedPatient.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        id_number: formData.id_number,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        address: formData.address,
        medical_history: formData.medical_history,
      });

      if (selectedPatient.user_id && formData.password) {
        await patientApi.updateUser(selectedPatient.user_id, {
          password: formData.password,
          full_name: formData.full_name,
        });
      }

      alert('Cập nhật thông tin thành công!');
      setIsEditModalOpen(false);
      fetchPatients();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cập nhật thất bại');
    }
  };

  // Khóa / Mở tài khoản bệnh nhân
  const handleToggleStatus = async (patient) => {
    if (!patient.user_id) {
      alert('Bệnh nhân này chưa được liên kết tài khoản User hệ thống.');
      return;
    }

    const currentStatus = patient.user?.is_active ?? true;
    const actionText = currentStatus ? 'khóa' : 'mở khóa';

    if (window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản của bệnh nhân ${patient.full_name}?`)) {
      try {
        await patientApi.toggleUserStatus(patient.user_id);
        fetchPatients();
      } catch (err) {
        alert(err.response?.data?.detail || 'Thao tác thất bại');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      password: '',
      id_number: '',
      date_of_birth: '',
      gender: 'Nam',
      address: '',
      medical_history: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. NÚT THÊM BỆNH NHÂN MỚI (TRÊN CÙNG) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Quản lý Hồ sơ Bệnh nhân</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tra cứu, xem hồ sơ bệnh lý và quản lý thông tin tài khoản người bệnh.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <span>➕</span> Thêm bệnh nhân mới
        </button>
      </div>

      {/* 2. THANH TÌM KIẾM (INPUT TEXT KÈM DROPLIST Ở GIỮA) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row gap-3">
        <select
          value={searchCategory}
          onChange={(e) => setSearchCategory(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200"
        >
          <option value="all">Tất cả trường thông tin</option>
          <option value="name">Tên bệnh nhân</option>
          <option value="phone">Số điện thoại</option>
          <option value="age">Tuổi</option>
          <option value="userId">User ID</option>
          <option value="idNumber">CCCD / CMND</option>
          <option value="address">Địa chỉ</option>
        </select>

        <div className="relative flex-1">
          <input
            type="text"
            placeholder="🔍 Nhập từ khóa tìm kiếm bệnh nhân..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
      </div>

      {/* 3. BẢNG DANH SÁCH BỆNH NHÂN */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              <th className="px-6 py-4">User ID</th>
              <th className="px-6 py-4">Tên bệnh nhân</th>
              <th className="px-6 py-4">Tuổi</th>
              <th className="px-6 py-4">SĐT</th>
              <th className="px-6 py-4">Trạng thái TK</th>
              <th className="px-6 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm text-slate-700 dark:text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                  Đang tải danh sách bệnh nhân...
                </td>
              </tr>
            ) : filteredPatients.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy bệnh nhân nào.
                </td>
              </tr>
            ) : (
              paginatedPatients.map((patient) => {
                const isActive = patient.user?.is_active ?? true;
                return (
                  <tr key={patient.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {patient.user_id ? `#${patient.user_id}` : <span className="text-slate-400 dark:text-slate-500">Chưa tạo TK</span>}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white">{patient.full_name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{calculateAge(patient.date_of_birth)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{patient.phone || '-'}</td>
                    <td className="px-6 py-4">
                      {patient.user_id ? (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {isActive ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenDetail(patient)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-400 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-medium transition-all"
                        >
                          👁️ Chi tiết
                        </button>

                        <button
                          onClick={() => handleOpenMedicalRecord(patient)}
                          className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-xs font-medium transition-all"
                        >
                          🩺 Hồ sơ bệnh lý
                        </button>

                        <button
                          onClick={() => handleToggleStatus(patient)}
                          disabled={!patient.user_id}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                            !patient.user_id
                              ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                              : isActive
                              ? 'border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                              : 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                          }`}
                        >
                          {isActive ? '🔒 Khóa TK' : '🔓 Mở TK'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* PHÂN TRANG */}
        {!loading && filteredPatients.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
            <div>
              Hiển thị <span className="font-semibold text-slate-800 dark:text-white">{startIndex + 1}</span> đến{' '}
              <span className="font-semibold text-slate-800 dark:text-white">
                {Math.min(startIndex + itemsPerPage, filteredPatients.length)}
              </span>{' '}
              trong tổng số <span className="font-semibold text-slate-800 dark:text-white">{filteredPatients.length}</span> bệnh nhân
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all"
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
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: THÊM BỆNH NHÂN MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-lg w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Thêm Bệnh nhân Mới</h3>
            <form onSubmit={handleCreatePatient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Giới tính</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Số CCCD / CMND</label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Địa chỉ liên hệ</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-sky-700 dark:text-sky-400 mb-2">Tài khoản đăng nhập (Tùy chọn)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Email đăng nhập</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Mật khẩu ban đầu</label>
                    <input
                      type="password"
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tiền sử bệnh lý</label>
                <textarea
                  rows="2"
                  value={formData.medical_history}
                  onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                  placeholder="Tiền sử dị ứng, tim mạch, tiểu đường..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700"
                >
                  Lưu bệnh nhân
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHI TIẾT THÔNG TIN CÁ NHÂN & TÀI KHOẢN */}
      {isDetailModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">Thông tin chi tiết Bệnh nhân</h3>
              <span className="text-xs bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-mono px-2.5 py-1 rounded-full font-semibold">
                User ID: #{selectedPatient.user_id || 'Chưa tạo'}
              </span>
            </div>

            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Họ và tên:</span>
                  <span className="font-semibold text-slate-800 dark:text-white">{selectedPatient.full_name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Số điện thoại:</span>
                  <span className="font-semibold text-slate-800 dark:text-white">{selectedPatient.phone || '-'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Tuổi:</span>
                  <span>{calculateAge(selectedPatient.date_of_birth)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Giới tính:</span>
                  <span>{selectedPatient.gender || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">CCCD:</span>
                  <span>{selectedPatient.id_number || '-'}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 dark:text-slate-400 block">Địa chỉ:</span>
                <span>{selectedPatient.address || 'Chưa cập nhật'}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 dark:text-slate-400 block">Tiền sử bệnh lý:</span>
                <p className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {selectedPatient.medical_history || 'Không có ghi nhận tiền sử bệnh lý.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Thông tin Tài khoản Hệ thống</p>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Email đăng nhập:</span>
                  <span className="font-mono text-xs font-semibold text-slate-800 dark:text-white">
                    {selectedPatient.user?.email || 'Chưa tạo email'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Mật khẩu tài khoản:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      readOnly
                      value={selectedPatient.user ? '********' : 'Chưa thiết lập'}
                      className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono w-full text-slate-700 dark:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium"
                    >
                      {showPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  {showPassword && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      Mật khẩu được mã hóa bảo mật. Bấm <b>"Sửa thông tin"</b> để đặt lại mật khẩu mới.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedPatient)}
                className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700 flex items-center gap-1"
              >
                <span>✏️</span> Sửa thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SỬA THÔNG TIN BỆNH NHÂN */}
      {isEditModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-lg w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Sửa Thông tin Bệnh nhân #{selectedPatient.id}</h3>
            <form onSubmit={handleUpdatePatient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Giới tính</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">CCCD / CMND</label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Đặt lại mật khẩu mới (Để trống nếu không muốn đổi)
                </label>
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="checkbox"
                    id="showEditPassword"
                    checked={showEditPassword}
                    onChange={(e) => setShowEditPassword(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="showEditPassword" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    Hiện mật khẩu
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tiền sử bệnh lý</label>
                <textarea
                  rows="2"
                  value={formData.medical_history}
                  onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700"
                >
                  Cập nhật thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: HỒ SƠ BỆNH LÝ BỆNH NHÂN */}
      {isRecordModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">Hồ sơ bệnh lý gần nhất</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Bệnh nhân: {selectedPatient.full_name}</p>
              </div>
              <span className="text-2xl">🩺</span>
            </div>

            {loadingRecord ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">Đang truy xuất hồ sơ bệnh lý...</div>
            ) : !latestRecord ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                Chưa có hồ sơ bệnh lý nào được ghi nhận cho bệnh nhân này.
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex justify-between bg-sky-50 dark:bg-sky-950/40 p-3 rounded-xl border border-sky-100 dark:border-sky-900/60 text-xs">
                  <div>
                    <span className="text-sky-600 dark:text-sky-400 block font-semibold">Mã Hồ sơ: #{latestRecord.id}</span>
                    <span className="text-sky-800 dark:text-sky-300">Mã lịch hẹn: #{latestRecord.appointment_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 dark:text-slate-400 block">Ngày khám:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {new Date(latestRecord.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">Mô tả chẩn đoán</span>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                    {latestRecord.diagnosis_summary || 'Không có mô tả chẩn đoán'}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">Ghi chú điều trị</span>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                    {latestRecord.treatment_notes || 'Không có ghi chú điều trị'}
                  </div>
                </div>

                {latestRecord.ai_summary && (
                  <div>
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase block mb-1">Tóm tắt AI</span>
                    <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-100 dark:border-purple-900/60 text-purple-900 dark:text-purple-200 text-xs leading-relaxed">
                      {latestRecord.ai_summary}
                    </div>
                  </div>
                )}

                {latestRecord.next_appointment_date && (
                  <div className="text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-lg border border-sky-200 dark:border-sky-800">
                    📅 Ngày hẹn tái khám dự kiến:{' '}
                    {new Date(latestRecord.next_appointment_date).toLocaleDateString('vi-VN')}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}