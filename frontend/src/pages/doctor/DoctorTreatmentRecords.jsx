import React, { useState, useEffect, useMemo } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import medicalRecordApi from '../../api/medicalRecordApi';
import appointmentApi from '../../api/appointmentApi';
import aiApi from '../../api/aiApi';

const PAGE_SIZE = 10;

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00'
];

// 1. Kiểm tra ghế khám có tạm dừng / bảo trì hay không
const isChairPaused = (chair) => {
  if (!chair) return false;
  if (chair.is_active === false) return true;
  if (chair.status) {
    const status = String(chair.status).toLowerCase();
    return ['paused', 'tạm dừng', 'inactive', 'maintenance', 'bảo trì'].includes(status);
  }
  return false;
};

// 2. HÀM KIỂM TRA TRÙNG LỊCH HẸN CLIENT-SIDE (Cùng hoặc khác Bác sĩ nhưng trùng Ghế/Khung giờ)
const checkConflictClientSide = (
  appointments,
  { doctorId, chairId, startTime, endTime, excludeAptId = null }
) => {
  if (!startTime || !endTime) {
    return { hasConflict: false, isChairBusy: false, isDoctorBusy: false };
  }

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (isNaN(start) || isNaN(end)) {
    return { hasConflict: false, isChairBusy: false, isDoctorBusy: false };
  }

  let isChairBusy = false;
  let isDoctorBusy = false;

  appointments.forEach((apt) => {
    // Bỏ qua chính lịch hẹn tái khám đang chỉnh sửa
    if (excludeAptId && String(apt.id) === String(excludeAptId)) return;
    
    // Bỏ qua các lịch hẹn đã bị hủy
    if (apt.status === 'cancelled') return;

    const aptStart = new Date(apt.start_time).getTime();
    const aptEnd = new Date(apt.end_time).getTime();

    if (isNaN(aptStart) || isNaN(aptEnd)) return;

    // Hai khoảng thời gian giao nhau khi: (Start_Mới < End_Cũ) VÀ (End_Mới > Start_Cũ)
    const isTimeOverlap = start < aptEnd && end > aptStart;
    
    if (isTimeOverlap) {
      // Trùng ghế khám (Dù cùng hay khác bác sĩ)
      if (chairId && String(apt.chair_id) === String(chairId)) {
        isChairBusy = true;
      }
      // Trùng lịch bác sĩ
      if (doctorId && String(apt.doctor_id) === String(doctorId)) {
        isDoctorBusy = true;
      }
    }
  });

  return {
    hasConflict: isChairBusy || isDoctorBusy,
    isChairBusy,
    isDoctorBusy,
  };
};

export default function DoctorTreatmentRecords() {
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]); // Danh sách lịch hẹn
  const [chairs, setChairs] = useState([]);             // Danh sách ghế khám
  const [services, setServices] = useState([]);         // Danh sách dịch vụ
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab state: 'today' | '14days' | '90days'
  const [activeTab, setActiveTab] = useState('today');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states cho từng tab
  const [pageToday, setPageToday] = useState(1);
  const [page14Days, setPage14Days] = useState(1);
  const [page90Days, setPage90Days] = useState(1);

  // Modal states
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form edit state - Bổ sung chair_id và service_id
  const [editFormData, setEditFormData] = useState({
    diagnosis_summary: '',
    treatment_notes: '',
    follow_up_date: '',
    follow_up_time: '',
    chair_id: '',
    service_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Reset trang về 1 khi đổi Tab hoặc thay đổi từ khóa tìm kiếm
  useEffect(() => {
    setPageToday(1);
    setPage14Days(1);
    setPage90Days(1);
  }, [activeTab, searchTerm]);

  // Fetch dữ liệu Hồ sơ điều trị, Lịch hẹn, Ghế khám & Dịch vụ
  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recRes, initialRes] = await Promise.all([
        medicalRecordApi.getAll(),
        appointmentApi.getInitialData ? appointmentApi.getInitialData() : appointmentApi.getAll(),
      ]);

      setRecords(recRes.data || []);

      if (initialRes?.appointments || initialRes?.chairs || initialRes?.services) {
        setAppointments(Array.isArray(initialRes.appointments) ? initialRes.appointments : (initialRes.appointments?.data || []));
        setChairs(Array.isArray(initialRes.chairs) ? initialRes.chairs : (initialRes.chairs?.data || []));
        setServices(Array.isArray(initialRes.services) ? initialRes.services : (initialRes.services?.data || []));
      } else {
        setAppointments(Array.isArray(initialRes) ? initialRes : (initialRes?.data || []));
      }
    } catch (err) {
      console.error('Lỗi tải danh sách hồ sơ:', err);
      setError('Không thể tải danh sách hồ sơ điều trị. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);
  
  const isAnyModalOpen = isDetailOpen || isEditOpen;
  useIdleRefresh(fetchRecords, 3 * 60 * 1000, isAnyModalOpen);

  // 3. HÀM KIỂM TRA TRÙNG LỊCH THEO KHUNG GIỜ VỚI GHẾ KHÁM ĐƯỢC CHỌN (isSlotConflict)
  const isSlotConflict = (slotTime) => {
    if (!editFormData.follow_up_date || !selectedRecord) return false;

    const dateVal = editFormData.follow_up_date;
    const slotStartIso = new Date(`${dateVal}T${slotTime}`).toISOString();
    const slotEndIso = new Date(new Date(`${dateVal}T${slotTime}`).getTime() + 60 * 60 * 1000).toISOString();

    // Tìm lịch tái khám tương ứng hiện tại để loại trừ khi kiểm tra trùng
    const followUpApt = appointments.find((apt) => {
      const isSamePatient = String(apt.patient_id) === String(selectedRecord.patient_id);
      const isFollowUpNote = apt.note && apt.note.includes(`lượt khám #${selectedRecord.appointment_id}`);
      const isOldTimeMatch = selectedRecord.next_appointment_date && 
        new Date(apt.start_time).getTime() === new Date(selectedRecord.next_appointment_date).getTime();
      return isSamePatient && (isFollowUpNote || isOldTimeMatch);
    });

    // Ưu tiên lấy Ghế khám người dùng vừa chọn từ Form, nếu chưa chọn mới lấy ghế cũ
    const chairId = editFormData.chair_id || followUpApt?.chair_id || selectedRecord?.appointment?.chair_id || selectedRecord?.chair_id;
    const doctorId = selectedRecord?.doctor_id || followUpApt?.doctor_id;

    const conflictResult = checkConflictClientSide(appointments, {
      doctorId,
      chairId,
      startTime: slotStartIso,
      endTime: slotEndIso,
      excludeAptId: followUpApt?.id || null,
    });

    return conflictResult.hasConflict;
  };

  // Filter logic theo khoảng thời gian
  const { todayRecords, records14Days, records90Days } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const todayList = [];
    const list14 = [];
    const list90 = [];

    records.forEach((rec) => {
      if (!rec.created_at) return;
      const recDate = new Date(rec.created_at);
      const recDateStr = recDate.toISOString().slice(0, 10);

      if (recDateStr === todayStr) {
        todayList.push(rec);
      }

      if (recDate >= fourteenDaysAgo && recDate <= now) {
        list14.push(rec);
      }

      if (recDate >= ninetyDaysAgo && recDate <= now) {
        list90.push(rec);
      }
    });

    return {
      todayRecords: todayList,
      records14Days: list14,
      records90Days: list90,
    };
  }, [records]);

  const currentTabRecords = useMemo(() => {
    let source = [];
    if (activeTab === 'today') source = todayRecords;
    else if (activeTab === '14days') source = records14Days;
    else if (activeTab === '90days') source = records90Days;

    if (!searchTerm.trim()) return source;

    const term = searchTerm.toLowerCase();
    return source.filter((rec) => {
      const patientName = rec.patient?.full_name?.toLowerCase() || '';
      const phone = rec.patient?.phone || '';
      const diagnosis = rec.diagnosis_summary?.toLowerCase() || '';
      const recId = String(rec.id);
      return (
        patientName.includes(term) ||
        phone.includes(term) ||
        diagnosis.includes(term) ||
        recId.includes(term)
      );
    });
  }, [activeTab, todayRecords, records14Days, records90Days, searchTerm]);

  const currentPage = activeTab === 'today' ? pageToday : activeTab === '14days' ? page14Days : page90Days;
  const setCurrentPage = activeTab === 'today' ? setPageToday : activeTab === '14days' ? setPage14Days : setPage90Days;

  const displayedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return currentTabRecords.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentTabRecords, currentPage]);

  const handleOpenDetail = (record) => {
    setSelectedRecord(record);
    setIsDetailOpen(true);
  };

  // 4. MỞ MODAL SỬA HỒ SƠ VÀ KHỞI TẠO GIÁ TRỊ BAN ĐẦU DỌC THEO HỒ SƠ / LỊCH KHÁM
  const handleOpenEdit = (record) => {
    setSelectedRecord(record);

    let dateVal = '';
    let timeVal = '';

    if (record.next_appointment_date) {
      const d = new Date(record.next_appointment_date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateVal = `${year}-${month}-${day}`;

      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      timeVal = `${hours}:${minutes}`;
    }

    // Tìm lịch tái khám tương ứng hiện tại để lấy chair_id và service_id ban đầu
    const followUpApt = appointments.find((apt) => {
      const isSamePatient = String(apt.patient_id) === String(record.patient_id);
      const isFollowUpNote = apt.note && apt.note.includes(`lượt khám #${record.appointment_id}`);
      const isOldTimeMatch = record.next_appointment_date && 
        new Date(apt.start_time).getTime() === new Date(record.next_appointment_date).getTime();
      return isSamePatient && (isFollowUpNote || isOldTimeMatch);
    });

    let initialChairId = followUpApt?.chair_id || record?.appointment?.chair_id || record?.chair_id || '';
    let initialServiceId = followUpApt?.service_id || '';

    // Tách mã dịch vụ từ tag [Dịch vụ: ...] trong ghi chú nếu có
    if (!initialServiceId && followUpApt?.note) {
      const serviceMatch = followUpApt.note.match(/\[Dịch vụ:\s*([^\]]+)\]/i);
      if (serviceMatch) {
        const sName = serviceMatch[1].trim();
        const foundS = services.find((s) => s.name.toLowerCase() === sName.toLowerCase());
        if (foundS) initialServiceId = String(foundS.id);
      }
    }

    setEditFormData({
      diagnosis_summary: record.diagnosis_summary || '',
      treatment_notes: record.treatment_notes || '',
      follow_up_date: dateVal,
      follow_up_time: timeVal,
      chair_id: initialChairId ? String(initialChairId) : '',
      service_id: initialServiceId ? String(initialServiceId) : '',
    });
    setIsEditOpen(true);
  };

  // 5. SUBMIT CẬP NHẬT HỒ SƠ & ĐỒNG BỘ LỊCH TÁI KHÁM CÓ KIỂM TRA TRÙNG GHẾ / GIỜ
  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    const { follow_up_date, follow_up_time, chair_id, service_id } = editFormData;

    if ((follow_up_date && !follow_up_time) || (!follow_up_date && follow_up_time)) {
      alert('Vui lòng chọn đầy đủ cả Ngày khám và Giờ khám nếu muốn hẹn tái khám!');
      return;
    }

    if (follow_up_date && follow_up_time && !chair_id) {
      alert('Vui lòng chọn Ghế khám cho lịch tái khám!');
      return;
    }

    try {
      setIsSubmitting(true);
      let nextApptIso = null;
      let followUpStartDate = null;
      let followUpEndDate = null;

      // 1. Tải danh sách lịch hẹn mới nhất từ Backend
      const initialRes = await (appointmentApi.getInitialData ? appointmentApi.getInitialData() : appointmentApi.getAll());
      const allApts = Array.isArray(initialRes?.appointments) ? initialRes.appointments : (initialRes?.appointments?.data || Array.isArray(initialRes) ? initialRes : []);
      setAppointments(allApts);

      // 2. Tìm lịch tái khám tương ứng
      const followUpApt = allApts.find((apt) => {
        const isSamePatient = String(apt.patient_id) === String(selectedRecord.patient_id);
        const isFollowUpNote = apt.note && apt.note.includes(`lượt khám #${selectedRecord.appointment_id}`);
        const isOldTimeMatch = selectedRecord.next_appointment_date && 
          new Date(apt.start_time).getTime() === new Date(selectedRecord.next_appointment_date).getTime();

        return isSamePatient && (isFollowUpNote || isOldTimeMatch);
      });

      // 3. Thực hiện kiểm tra xung đột trùng ghế khám / khung giờ
      if (follow_up_date && follow_up_time) {
        followUpStartDate = new Date(`${follow_up_date}T${follow_up_time}`);
        if (isNaN(followUpStartDate.getTime())) {
          alert('Thời gian tái khám không hợp lệ!');
          setIsSubmitting(false);
          return;
        }
        nextApptIso = followUpStartDate.toISOString();
        followUpEndDate = new Date(followUpStartDate.getTime() + 60 * 60 * 1000).toISOString();

        const targetChairId = chair_id || followUpApt?.chair_id || selectedRecord?.appointment?.chair_id || selectedRecord?.chair_id;
        const targetDoctorId = selectedRecord?.doctor_id || followUpApt?.doctor_id;

        const conflictResult = checkConflictClientSide(allApts, {
          doctorId: targetDoctorId,
          chairId: targetChairId,
          startTime: nextApptIso,
          endTime: followUpEndDate,
          excludeAptId: followUpApt?.id || null,
        });

        // Cảnh báo nếu có trùng ghế hoặc trùng bác sĩ
        if (conflictResult.hasConflict) {
          if (conflictResult.isChairBusy) {
            alert('Đã có lịch đặt trước tại ghế khám/khung giờ!');
            setIsSubmitting(false);
            return;
          }
          if (conflictResult.isDoctorBusy) {
            alert('⚠️ Bác sĩ đã có lịch hẹn khác trong khung giờ này!');
            setIsSubmitting(false);
            return;
          }
        }
      }

      const payload = {
        diagnosis_summary: editFormData.diagnosis_summary,
        treatment_notes: editFormData.treatment_notes,
        next_appointment_date: nextApptIso,
      };

      // 4. Cập nhật Hồ sơ điều trị (Medical Record)
      await medicalRecordApi.update(selectedRecord.id, payload);

      // 5. Cập nhật hoặc Tạo mới Lịch tái khám (Appointment)
      if (nextApptIso) {
        let serviceLabel = '';
        if (service_id) {
          const selectedService = services.find((s) => String(s.id) === String(service_id));
          if (selectedService) {
            serviceLabel = `[Dịch vụ: ${selectedService.name}] `;
          }
        }
        const aptNote = `${serviceLabel}Lịch tái khám cho lượt khám #${selectedRecord.appointment_id}`.trim();

        if (followUpApt) {
          await appointmentApi.update(followUpApt.id, {
            chair_id: parseInt(chair_id || followUpApt.chair_id),
            start_time: nextApptIso,
            end_time: followUpEndDate,
            note: aptNote,
          });
        } else {
          // Tạo mới lịch tái khám nếu chưa tồn tại
          await appointmentApi.create({
            patient_id: selectedRecord.patient_id,
            doctor_id: selectedRecord.doctor_id,
            chair_id: parseInt(chair_id),
            start_time: nextApptIso,
            end_time: followUpEndDate,
            note: aptNote,
            status: 'confirmed',
          });
        }
      }

      alert('Cập nhật hồ sơ và thời gian lịch tái khám thành công!');
      setIsEditOpen(false);
      fetchRecords();
    } catch (err) {
      console.error('Lỗi cập nhật hồ sơ:', err);
      const isConflict = err.response?.status === 409 || err.status === 409;
      if (isConflict) {
        alert('Đã có lịch đặt trước tại ghế khám/khung giờ!');
      } else {
        alert('Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại!');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tạo / cập nhật tóm tắt AI thông qua aiApi
  const handleGenerateAiSummary = async () => {
    if (!selectedRecord) return;
    try {
      setAiLoading(true);
      const res = await aiApi.summarizeRecord(selectedRecord.id);
      const updatedAiSummary = res.data?.result || res.result;
      
      setSelectedRecord((prev) => ({
        ...prev,
        ai_summary: updatedAiSummary,
      }));
      setRecords((prev) =>
        prev.map((r) => (r.id === selectedRecord.id ? { ...r, ai_summary: updatedAiSummary } : r))
      );
    } catch (err) {
      console.error('Lỗi tạo tóm tắt AI:', err);
      const detailMsg = err.response?.data?.detail || 'Không thể tạo tóm tắt AI. Vui lòng kiểm tra lại ghi chú điều trị!';
      alert(detailMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPagination = (totalItems, page, setPage) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (totalItems === 0) return null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
        <div>
          Hiển thị <strong>{(page - 1) * PAGE_SIZE + 1}</strong> - <strong>{Math.min(page * PAGE_SIZE, totalItems)}</strong> trên tổng số <strong>{totalItems}</strong> bản ghi
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs transition-all shadow-sm text-slate-700 dark:text-slate-200"
          >
            Trang trước
          </button>
          <span className="text-xs font-bold px-2">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs transition-all shadow-sm text-slate-700 dark:text-slate-200"
          >
            Trang sau
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>🩺</span> Hồ sơ điều trị của Bác sĩ
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý, xem thông tin chi tiết và cập nhật chẩn đoán/tiến trình điều trị cho bệnh nhân.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Tìm tên, SĐT, chẩn đoán..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 text-sm">🔍</span>
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-3 rounded-t-2xl shadow-sm">
        {[
          { id: 'today', label: 'Hôm nay', count: todayRecords.length, icon: '📅' },
          { id: '14days', label: 'Đang theo dõi (14 ngày)', count: records14Days.length, icon: '⏱️' },
          { id: '90days', label: 'Đã khám (90 ngày)', count: records90Days.length, icon: '📁' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
                isActive
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30 rounded-t-xl'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`ml-1 px-2 py-0.5 text-xs rounded-full font-semibold ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-b-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent mb-2"></div>
            <p>Đang tải dữ liệu hồ sơ điều trị...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 dark:text-rose-400">
            <p>{error}</p>
            <button
              onClick={fetchRecords}
              className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all"
            >
              Thử lại
            </button>
          </div>
        ) : currentTabRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <span className="text-4xl block mb-2">📭</span>
            <p>Không tìm thấy bản ghi hồ sơ điều trị nào trong mốc thời gian này.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Mã HS</th>
                    <th className="p-4 font-semibold">Bệnh nhân</th>
                    <th className="p-4 font-semibold">SĐT</th>
                    <th className="p-4 font-semibold">Ngày tạo</th>
                    <th className="p-4 font-semibold">Chẩn đoán / Mô tả</th>
                    <th className="p-4 font-semibold">Tái khám</th>
                    <th className="p-4 font-semibold text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                  {displayedRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="p-4 font-semibold text-sky-700 dark:text-sky-400">#{record.id}</td>
                      <td className="p-4 font-medium text-slate-800 dark:text-slate-100">
                        {record.patient?.full_name || 'N/A'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{record.patient?.phone || 'N/A'}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{formatDate(record.created_at)}</td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {record.diagnosis_summary || 'Chưa ghi nhận'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {record.next_appointment_date ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 px-2 py-1 rounded-md font-medium">
                            📅 {formatDate(record.next_appointment_date)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">Không có</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDetail(record)}
                            title="Xem chi tiết hồ sơ"
                            className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-600 dark:hover:text-white font-bold flex items-center justify-center transition-all shadow-sm"
                          >
                            ⓘ
                          </button>
                          <button
                            onClick={() => handleOpenEdit(record)}
                            title="Sửa hồ sơ"
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                          >
                            <span>✏️</span> Sửa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {renderPagination(currentTabRecords.length, currentPage, setCurrentPage)}
          </>
        )}
      </div>

      {/* MODAL CHI TIẾT HỒ SƠ */}
      {isDetailOpen && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-lg">
                  📋
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Chi tiết Hồ sơ điều trị #{selectedRecord.id}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tạo lúc: {formatDate(selectedRecord.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-sm">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Thông tin bệnh nhân
                </p>
                <p className="font-bold text-slate-800 dark:text-white">{selectedRecord.patient?.full_name}</p>
                <p className="text-slate-600 dark:text-slate-300">SĐT: {selectedRecord.patient?.phone || 'N/A'}</p>
                <p className="text-slate-600 dark:text-slate-300">
                  Giới tính: {selectedRecord.patient?.gender || 'N/A'} | Ngày sinh:{' '}
                  {selectedRecord.patient?.date_of_birth || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Bác sĩ phụ trách & Lịch hẹn
                </p>
                <p className="font-semibold text-slate-800 dark:text-white">
                  Bác sĩ: {selectedRecord.doctor?.full_name || 'N/A'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">Mã lịch hẹn: #{selectedRecord.appointment_id}</p>
                <p className="text-slate-600 dark:text-slate-300">
                  Tái khám:{' '}
                  {selectedRecord.next_appointment_date ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {formatDate(selectedRecord.next_appointment_date)}
                    </span>
                  ) : (
                    'Chưa hẹn'
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Chẩn đoán / Mô tả triệu chứng:
                </h4>
                <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm border border-slate-100 dark:border-slate-700 whitespace-pre-line">
                  {selectedRecord.diagnosis_summary || 'Chưa có thông tin'}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Ghi chú điều trị / Đơn thuốc:
                </h4>
                <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm border border-slate-100 dark:border-slate-700 whitespace-pre-line">
                  {selectedRecord.treatment_notes || 'Chưa có thông tin'}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 border border-sky-100 dark:border-sky-900/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                    <span>✨</span> Tóm tắt thông minh từ AI:
                  </span>
                  <button
                    onClick={handleGenerateAiSummary}
                    disabled={aiLoading}
                    className="px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
                  >
                    {aiLoading && <span className="animate-spin text-xs">⏳</span>}
                    {aiLoading ? 'Đang phân tích...' : '🤖 Cập nhật AI'}
                  </button>
                </div>
                <p className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed italic">
                  {selectedRecord.ai_summary ||
                    'Chưa có tóm tắt AI. Bấm nút "Cập nhật AI" để tự động tổng hợp nhanh tiến trình điều trị.'}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <span>🦷</span> Các dịch vụ thực hiện (Medical Record Details)
              </h4>
              {selectedRecord.details && selectedRecord.details.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2.5">Dịch vụ</th>
                        <th className="p-2.5 text-center">Số lượng</th>
                        <th className="p-2.5 text-right">Đơn giá</th>
                        <th className="p-2.5 text-right">Thành tiền</th>
                        <th className="p-2.5">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {selectedRecord.details.map((detail) => {
                        const total = Number(detail.unit_price || 0) * (detail.quantity || 1);
                        return (
                          <tr key={detail.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="p-2.5 font-medium text-slate-800 dark:text-slate-100">
                              {detail.service?.name || `Dịch vụ #${detail.service_id}`}
                            </td>
                            <td className="p-2.5 text-center font-semibold text-indigo-700 dark:text-indigo-400">{detail.quantity}</td>
                            <td className="p-2.5 text-right font-semibold text-indigo-700 dark:text-indigo-400">{formatCurrency(detail.unit_price)}</td>
                            <td className="p-2.5 text-right font-bold text-sky-700 dark:text-sky-400">
                              {formatCurrency(total)}
                            </td>
                            <td className="p-2.5 text-slate-500 dark:text-slate-400">{detail.note || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                  Chưa có chi tiết dịch vụ nào được kê trong hồ sơ này.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA HỒ SƠ ĐIỀU TRỊ & ĐẶT LỊCH TÁI KHÁM */}
      {isEditOpen && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✏️</span>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Cập nhật Hồ sơ điều trị #{selectedRecord.id}
                </h3>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block">Bệnh nhân:</span>
                  <strong className="text-slate-800 dark:text-slate-100">{selectedRecord.patient?.full_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block">Mã lịch hẹn gốc:</span>
                  <strong className="text-slate-800 dark:text-slate-100">#{selectedRecord.appointment_id}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Chẩn đoán / Mô tả triệu chứng
                </label>
                <textarea
                  rows={3}
                  value={editFormData.diagnosis_summary}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, diagnosis_summary: e.target.value })
                  }
                  placeholder="Nhập chẩn đoán sơ bộ hoặc triệu chứng..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Ghi chú điều trị / Đơn thuốc
                </label>
                <textarea
                  rows={4}
                  value={editFormData.treatment_notes}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, treatment_notes: e.target.value })
                  }
                  placeholder="Nhập ghi chú tiến trình điều trị, thuốc dặn dò..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* PHẦN LỊCH HẸN TÁI KHÁM: BỔ SUNG GHẾ KHÁM & DỊCH VỤ */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  📅 Lịch hẹn tái khám (Tùy chọn)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* GHẾ KHÁM */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Ghế khám
                    </label>
                    <select
                      value={editFormData.chair_id}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, chair_id: e.target.value })
                      }
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                    >
                      <option value="">-- Chọn ghế khám --</option>
                      {chairs.map((c) => {
                        const paused = isChairPaused(c);
                        return (
                          <option
                            key={c.id}
                            value={c.id}
                            disabled={paused}
                            className={paused ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 italic' : ''}
                          >
                            {c.name} {paused ? '(Tạm dừng)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* DỊCH VỤ TÁI KHÁM */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Dịch vụ tái khám
                    </label>
                    <select
                      value={editFormData.service_id}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, service_id: e.target.value })
                      }
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                    >
                      <option value="">-- Chọn dịch vụ --</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({Number(s.unit_price || s.price || 0).toLocaleString('vi-VN')} VNĐ)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* NGÀY KHÁM */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Ngày khám
                    </label>
                    <input
                      type="date"
                      value={editFormData.follow_up_date}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, follow_up_date: e.target.value })
                      }
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                    />
                  </div>

                  {/* GIỜ KHÁM */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Giờ khám
                    </label>
                    <select
                      value={editFormData.follow_up_time}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, follow_up_time: e.target.value })
                      }
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                    >
                      <option value="">-- Chọn giờ --</option>
                      {TIME_SLOTS.map((slot) => {
                        const disabled = isSlotConflict(slot);
                        return (
                          <option
                            key={slot}
                            value={slot}
                            disabled={disabled}
                            className={disabled ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 italic' : ''}
                          >
                            {slot} {disabled ? '(Ghế/Bác sĩ đã có lịch)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-sky-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}