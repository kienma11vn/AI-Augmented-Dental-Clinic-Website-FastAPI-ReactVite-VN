import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { patientApi } from '../../api/patientApi';

export default function PatientProfileInfo({ onProfileUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [patientId, setPatientId] = useState(null);
  const [userId, setUserId] = useState(null); // Lưu thêm userId
  const [formData, setFormData] = useState({
    id: '',
    email: '',
    full_name: '',
    phone: '',
    id_number: '',
    date_of_birth: '',
    gender: 'Nam',
    address: '',
    medical_history: '',
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await patientApi.getAll();
      const list = res.data || [];

      if (list.length > 0) {
        const patient = list[0];
        setPatientId(patient.id);
        setUserId(patient.user?.id || patient.user_id || null); // Lấy userId từ thông tin bệnh nhân

        setFormData({
          id: patient.id || '',
          email: patient.user?.email || 'N/A',
          full_name: patient.full_name || '',
          phone: patient.phone || '',
          id_number: patient.id_number || '',
          date_of_birth: patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '',
          gender: patient.gender || 'Nam',
          address: patient.address || '',
          medical_history: patient.medical_history || '',
        });
      } else {
        setError('Không tìm thấy thông tin hồ sơ bệnh nhân.');
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin cá nhân:', err);
      setError('Không thể tải thông tin cá nhân. Vui lòng thử lại sau!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);
  
  useIdleRefresh(fetchProfile, 5 * 60 * 1000, isEditing || saving);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    fetchProfile();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const updatePayload = {
        full_name: formData.full_name,
        phone: formData.phone,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        address: formData.address,
        medical_history: formData.medical_history,
      };

      // 1. Cập nhật thông tin Hồ sơ bệnh nhân
      const res = await patientApi.update(patientId, updatePayload);

      // 2. Cập nhật đồng bộ sang bảng User tài khoản (để khi đăng nhập lại không bị lại tên cũ)
      if (userId) {
        try {
          await patientApi.updateUser(userId, { full_name: formData.full_name });
        } catch (uErr) {
          console.warn('Cập nhật tài khoản User phụ thất bại:', uErr);
        }
      }

      setSuccess('Cập nhật thông tin cá nhân thành công!');
      setIsEditing(false);

      const updatedPatientData = res?.data || { ...formData, ...updatePayload };
      if (onProfileUpdate) {
        onProfileUpdate(updatedPatientData);
      }

      fetchProfile();
    } catch (err) {
      console.error('Lỗi cập nhật thông tin:', err);
      setError(err.response?.data?.detail || 'Cập nhật thông tin thất bại. Vui lòng kiểm tra lại!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300 font-medium">Đang tải thông tin...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 dark:border-slate-700 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            👤 Thông tin cá nhân
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý và cập nhật các thông tin hồ sơ của bạn trên hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isEditing ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'}`}>
            {isEditing ? '✏️ Đang chỉnh sửa' : '🔒 Chế độ xem'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl flex items-center gap-2">
          <span>✅</span> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            🔒 Thông tin định danh & Tài khoản (Không thể thay đổi)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Mã bệnh nhân</label>
              <input
                type="text"
                value={`BN-${String(formData.id).padStart(5, '0')}`}
                disabled
                className="w-full bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email / Tên tài khoản</label>
              <input
                type="text"
                value={formData.email}
                disabled
                className="w-full bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Số CCCD / CMND</label>
              <input
                type="text"
                value={formData.id_number || 'Chưa cập nhật'}
                disabled
                className="w-full bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm rounded-lg px-3 py-2 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            📋 Thông tin cá nhân có thể cập nhật
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Họ và tên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                disabled={!isEditing}
                required
                className={`w-full text-sm rounded-lg px-3 py-2 transition-all ${
                  isEditing
                    ? 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Số điện thoại <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={!isEditing}
                required
                className={`w-full text-sm rounded-lg px-3 py-2 transition-all ${
                  isEditing
                    ? 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ngày sinh</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full text-sm rounded-lg px-3 py-2 transition-all ${
                  isEditing
                    ? 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Giới tính</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full text-sm rounded-lg px-3 py-2 transition-all ${
                  isEditing
                    ? 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Địa chỉ thường trú</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Nhập địa chỉ của bạn..."
              className={`w-full text-sm rounded-lg px-3 py-2 transition-all ${
                isEditing
                  ? 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                  : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tiền sử bệnh lý / Ghi chú sức khỏe
            </label>
            <textarea
              name="medical_history"
              rows={3}
              value={formData.medical_history}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Chưa có thông tin, hãy cập nhật."
              className={`w-full text-sm rounded-lg px-3 py-2 transition-all ${
                isEditing
                  ? 'border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                  : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setSuccess('');
              }}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-600/20 transition-all flex items-center gap-2"
            >
              <span>✏️</span> Cập nhật thông tin
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span> Lưu thay đổi
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}