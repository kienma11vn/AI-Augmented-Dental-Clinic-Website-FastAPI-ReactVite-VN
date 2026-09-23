import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { doctorApi } from '../../api/doctorApi';

export default function DoctorPatientInformation() {
  const [activeTab, setActiveTab] = useState('tracking'); // 'tracking' | 'examined'
  const [trackingList, setTrackingList] = useState([]);
  const [examinedList, setExaminedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchAllPatients();
  }, []);

  const fetchAllPatients = async () => {
    setLoading(true);
    try {
      const [trackingRes, examinedRes] = await Promise.all([
        doctorApi.getPatients('tracking'),
        doctorApi.getPatients('examined'),
      ]);
      setTrackingList(trackingRes.data || trackingRes || []);
      setExaminedList(examinedRes.data || examinedRes || []);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách bệnh nhân bác sĩ:', err);
      setTrackingList([]);
      setExaminedList([]);
    } finally {
      setLoading(false);
    }
  };
  
  useIdleRefresh(fetchAllPatients, 3 * 60 * 1000, isDetailModalOpen);

  // Hàm chuẩn hóa thông tin bệnh nhân để đồng bộ dữ liệu giữa các dạng phản hồi API (phẳng hoặc lồng đối tượng patient/user)
  const getPatientInfo = (item) => {
    if (!item) return {};
    const p = item.patient || item;
    const u = item.user || p.user || {};

    return {
      id: item.id || p.id,
      full_name: p.full_name || u.full_name || item.full_name || 'Chưa cập nhật',
      phone: p.phone || u.phone || item.phone || '',
      date_of_birth: p.date_of_birth || p.dob || item.date_of_birth || null,
      gender: p.gender || item.gender || '',
      address: p.address || item.address || '',
      medical_history: p.medical_history || item.medical_history || '',
    };
  };

  // Tính tuổi từ ngày sinh
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return 'N/A';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? `${age} tuổi` : 'N/A';
  };

  const handleOpenDetail = (patient) => {
    setSelectedPatient(patient);
    setIsDetailModalOpen(true);
  };

  // Lấy danh sách hiển thị theo tab đang chọn
  const patients = activeTab === 'tracking' ? trackingList : examinedList;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">📋 Thông tin bệnh nhân</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Danh sách bệnh nhân do bạn trực tiếp phụ trách khám và điều trị.
          </p>
        </div>
        <button
          onClick={fetchAllPatients}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-all flex items-center gap-2"
        >
          <span>🔄</span> Tải lại dữ liệu
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4">
        <button
          onClick={() => setActiveTab('tracking')}
          className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'tracking'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span>🕒 Đang theo dõi</span>
          <span className="bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-xs px-2 py-0.5 rounded-full font-bold">
            {trackingList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('examined')}
          className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'examined'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span>✅ Đã khám (90 ngày)</span>
          <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
            {examinedList.length}
          </span>
        </button>
      </div>

      {/* Grid Display */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">Đang tải danh sách bệnh nhân...</div>
      ) : patients.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          {activeTab === 'tracking'
            ? 'Không có bệnh nhân nào trong danh sách đang theo dõi hôm nay hoặc tương lai.'
            : 'Không có bệnh nhân nào đã khám trong 90 ngày gần đây.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {patients.map((item) => {
            const patient = getPatientInfo(item);
            return (
              <div
                key={item.id || patient.id}
                className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
              >
                <div className="space-y-1 overflow-hidden pr-2">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base truncate">{patient.full_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>📞</span> {patient.phone || 'Chưa cập nhật SĐT'}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenDetail(item)}
                  title="Xem chi tiết bệnh nhân"
                  className="w-9 h-9 flex-shrink-0 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-500 dark:hover:text-white font-serif text-lg flex items-center justify-center transition-colors border border-sky-200 dark:border-sky-800"
                >
                  ℹ
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail */}
      {isDetailModalOpen && selectedPatient && (() => {
        const patient = getPatientInfo(selectedPatient);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">Chi tiết Thông tin Bệnh nhân</h3>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Họ và tên:</span>
                  <span className="font-bold text-slate-800 dark:text-white text-base">{patient.full_name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-400 block">Tuổi:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{calculateAge(patient.date_of_birth)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-400 block">Giới tính:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{patient.gender || 'Chưa cập nhật'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">SĐT:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.phone || 'Chưa cập nhật'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Địa chỉ:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.address || 'Chưa cập nhật'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block mb-1">Tiền sử bệnh lý:</span>
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300 min-h-[60px] whitespace-pre-line">
                    {patient.medical_history || 'Không có ghi nhận tiền sử bệnh lý.'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}