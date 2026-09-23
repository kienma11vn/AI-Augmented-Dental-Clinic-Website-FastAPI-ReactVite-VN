import React, { useState, useEffect, useMemo } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import appointmentApi from '../../api/appointmentApi';
import medicalRecordApi from '../../api/medicalRecordApi';
import notificationApi from '../../api/notificationApi';
import { AppointmentStatus } from '../../constants/enums';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 10;

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00'
];

// Hàm kiểm tra ghế khám có đang ở trạng thái Tạm dừng / Không hoạt động hay không
const isChairPaused = (chair) => {
  if (!chair) return false;
  if (chair.is_active === false) return true;
  if (chair.status) {
    const status = String(chair.status).toLowerCase();
    return (
      status === 'paused' ||
      status === 'tạm dừng' ||
      status === 'inactive' ||
      status === 'maintenance' ||
      status === 'bảo trì'
    );
  }
  return false;
};

// Hàm kiểm tra trùng lịch hẹn Client-side
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
    // Bỏ qua chính lịch hẹn đang chỉnh sửa (nếu có)
    if (excludeAptId && String(apt.id) === String(excludeAptId)) return;
    
    // Bỏ qua các lịch hẹn đã bị hủy
    if (apt.status === AppointmentStatus.CANCELLED) return;

    const aptStart = new Date(apt.start_time).getTime();
    const aptEnd = new Date(apt.end_time).getTime();

    if (isNaN(aptStart) || isNaN(aptEnd)) return;

    // Hai khoảng thời gian giao nhau khi: (Start_Mới < End_Cũ) VÀ (End_Mới > Start_Cũ)
    const isTimeOverlap = start < aptEnd && end > aptStart;
    
    if (isTimeOverlap) {
      // 1. Trùng ghế khám (dù cùng bác sĩ hay khác bác sĩ)
      if (chairId && String(apt.chair_id) === String(chairId)) {
        isChairBusy = true;
      }
      // 2. Trùng lịch của bác sĩ
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

// Hàm validate thời gian đặt lịch: Ngăn chọn thời gian quá khứ và ngoài giờ hành chính
const validateAppointmentTime = (startTimeVal) => {
  if (!startTimeVal || startTimeVal.endsWith('T') || startTimeVal.startsWith('T')) {
    return 'Vui lòng chọn đầy đủ ngày khám và khung giờ!';
  }

  const startDate = new Date(startTimeVal);
  const now = new Date();

  if (startDate <= now) {
    return 'Không thể đặt lịch tái khám cho thời gian đã qua!';
  }

  const hours = startDate.getHours();
  if (hours < 8 || hours >= 17) {
    return 'Vui lòng chọn thời gian trong giờ hành chính (từ 08:00 đến 17:00)!';
  }

  return null;
};

// Hàm bổ trợ phân tách Dịch vụ và Ghi chú từ thông tin lịch khám & hồ sơ bệnh lý
const parseAppointmentDetails = (apt, medicalRecords = [], services = []) => {
  if (!apt) return { servicesText: 'Chưa có thông tin dịch vụ', noteText: 'Không có ghi chú.' };

  let foundServices = [];
  let noteText = apt.note || '';

  // 1. Lấy dịch vụ từ Hồ sơ bệnh lý (MedicalRecord) nếu lượt khám đã thực hiện
  const record = medicalRecords.find((r) => r.appointment_id === apt.id);
  if (record && record.details && record.details.length > 0) {
    record.details.forEach((d) => {
      const sName =
        d.service?.name ||
        services.find((s) => String(s.id) === String(d.service_id))?.name ||
        `Dịch vụ #${d.service_id}`;
      foundServices.push(`${sName} (SL: ${d.quantity})`);
    });
  }

  // 2. Nếu chưa có từ Hồ sơ bệnh lý, trích xuất từ tag [Dịch vụ: ...] trong ghi chú
  if (foundServices.length === 0 && noteText) {
    const serviceMatch = noteText.match(/\[Dịch vụ:\s*([^\]]+)\]/i);
    if (serviceMatch) {
      foundServices.push(serviceMatch[1].trim());
      noteText = noteText.replace(/\[Dịch vụ:\s*([^\]]+)\]/i, '').trim();
    }
  }

  // Clean noteText
  if (noteText.startsWith('|')) noteText = noteText.substring(1).trim();
  if (noteText.endsWith('|')) noteText = noteText.substring(0, noteText.length - 1).trim();

  return {
    servicesText: foundServices.length > 0 ? foundServices.join(', ') : 'Chưa đăng ký dịch vụ cụ thể',
    noteText: noteText || 'Không có ghi chú.',
  };
};

export default function DoctorScheduleManagement() {
  const { user } = useAuth();
  const { formatAppointmentStatus } = useLanguage();

  // State Dữ liệu
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [services, setServices] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Tab & Phân trang State
  const [activeTab, setActiveTab] = useState('today');
  const [pageToday, setPageToday] = useState(1);
  const [pageUpcoming, setPageUpcoming] = useState(1);
  const [pageCompleted, setPageCompleted] = useState(1);

  // Reset trang khi đổi tab
  useEffect(() => {
    setPageToday(1);
    setPageUpcoming(1);
    setPageCompleted(1);
  }, [activeTab]);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Modal States
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Form State cho Hoàn thành (Tạo Medical Record & Lịch tái khám)
  const [recordFormData, setRecordFormData] = useState({
    diagnosis_summary: '',
    treatment_notes: '',
    service_id: '',            // Dịch vụ thực hiện (lượt khám này)
    follow_up_service_id: '',  // Dịch vụ tái khám (cho lịch tái khám mới)
    follow_up_date: '',
    follow_up_time: '',
    chair_id: '',
  });

  // Form State cho Hủy lịch
  const [cancelReason, setCancelReason] = useState('');

  // State lưu thông tin Modal xem lịch tái khám
  const [followUpInfo, setFollowUpInfo] = useState({
    date: null,
    patientName: '',
    chairName: '',
    serviceName: '',
  });

  // Kiểm tra khung giờ tái khám trong Form có bị trùng lịch hay không
	const isSlotConflict = (slotTime) => {
	  // 1. Nếu chưa chọn ngày tái khám hoặc chưa có thông tin lượt khám hiện tại
	  if (!recordFormData.follow_up_date || !selectedAppointment) {
		return false;
	  }

	  // 2. Tạo thời gian bắt đầu & kết thúc cho slot đang xét (mặc định ca 60 phút)
	  const fullTimeString = `${recordFormData.follow_up_date}T${slotTime}`;
	  const slotStart = new Date(fullTimeString);
	  if (isNaN(slotStart.getTime())) return false;

	  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

	  // 3. Kiểm tra trùng ghế hoặc trùng bác sĩ
	  const conflictResult = checkConflictClientSide(appointments, {
		doctorId: selectedAppointment.doctor_id,
		chairId: recordFormData.chair_id,
		startTime: slotStart.toISOString(),
		endTime: slotEnd.toISOString(),
	  });

	  return conflictResult.hasConflict;
	};

  // Hàm lưu thông báo thay đổi lịch vào CSDL Backend
  const saveNotificationToDB = async ({ patientId, appointmentId, title, message }) => {
    try {
      await notificationApi.createNotification({
        patient_id: patientId,
        appointment_id: appointmentId,
        title: title,
        message: message,
        type: 'appointment_change',
        is_read: false,
      });
    } catch (error) {
      console.error('Lỗi khi lưu thông báo vào CSDL:', error);
    }
  };

  // Logic lọc thông báo hiển thị: Chưa đọc luôn hiện; Đã đọc chỉ hiện trong vòng 14 ngày
  const visibleNotifications = useMemo(() => {
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return notifications.filter((n) => {
      if (n.type && n.type !== 'appointment_change') return false;

      if (!n.is_read) return true;

      const createdTime = new Date(n.created_at || n.time || now).getTime();
      if (isNaN(createdTime)) return true;

      return (now - createdTime) <= FOURTEEN_DAYS_MS;
    });
  }, [notifications]);

  // Kiểm tra có thông báo chưa đọc hay không để hiện chấm đỏ
  useEffect(() => {
    const unread = visibleNotifications.some((n) => !n.is_read);
    setHasUnreadNotif(unread);
  }, [visibleNotifications]);

  // Tải thông báo từ CSDL
  const loadNotificationsFromDB = async () => {
    try {
      const res = await notificationApi.getMyNotifications();
      const list = Array.isArray(res) ? res : res?.data || [];

      const dbNotifs = list
        .filter((item) => !item.type || item.type === 'appointment_change')
        .map((item) => ({
          id: item.id,
          aptId: item.appointment_id,
          title: item.title || 'Thay đổi lịch khám',
          content: item.message || item.content || '',
          time: item.created_at
            ? new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : '',
          created_at: item.created_at || new Date().toISOString(),
          is_read: Boolean(item.is_read || item.isRead),
          type: item.type || 'appointment_change',
        }));

      setNotifications(dbNotifs);
    } catch (err) {
      console.error('Lỗi khi tải thông báo từ CSDL:', err);
    }
  };

  // Đánh dấu tất cả thông báo hiển thị là đã đọc
  const handleMarkAllAsRead = async () => {
    const unreadNotifs = visibleNotifications.filter((n) => !n.is_read);
    if (unreadNotifs.length === 0) return;

    try {
      await Promise.all(
        unreadNotifs.map((n) => notificationApi.markAsRead(n.id))
      );
    } catch (err) {
      console.error('Lỗi khi đánh dấu thông báo đã đọc:', err);
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );
  };

  // Bật/tắt Cửa sổ Modal thông báo và tự động đánh dấu đã đọc
  const handleToggleNotifications = async () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);

    if (nextState) {
      await handleMarkAllAsRead();
    }
  };

  // Phát hiện thay đổi lịch khám & Lưu vào CSDL
  const detectAppointmentChanges = (latestAppointments) => {
    const snapshotKey = 'doctor_appointments_snapshot'; 
    const cachedData = localStorage.getItem(snapshotKey);
    let newNotifs = [];

    if (cachedData) {
      try {
        const prevList = JSON.parse(cachedData);
        latestAppointments.forEach((curr) => {
          const prev = prevList.find((p) => p.id === curr.id);
          if (prev) {
            const nowIso = new Date().toISOString();
            const currentTimeStr = new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const createNotifObj = (title, content) => {
              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title,
                content,
                time: currentTimeStr,
                created_at: nowIso,
                is_read: false,
                type: 'appointment_change',
              });

              saveNotificationToDB({
                patientId: curr.patient_id,
                appointmentId: curr.id,
                title,
                message: content,
              });
            };

            // 1. Thay đổi Bệnh nhân
            if (prev.patient_id !== curr.patient_id) {
              const prevPatient = prev.patient?.full_name || `ID: ${prev.patient_id}`;
              const currPatient = curr.patient?.full_name || `ID: ${curr.patient_id}`;
              createNotifObj('Thay đổi bệnh nhân', `Lịch hẹn #${curr.id} đã đổi bệnh nhân từ "${prevPatient}" sang "${currPatient}".`);
            }

            // 2. Thay đổi Bác sĩ
            if (prev.doctor_id !== curr.doctor_id) {
              const prevDoctor = prev.doctor?.full_name || `ID: ${prev.doctor_id}`;
              const currDoctor = curr.doctor?.full_name || `ID: ${curr.doctor_id}`;
              createNotifObj('Thay đổi bác sĩ phụ trách', `Lịch hẹn #${curr.id} đã đổi bác sĩ từ "${prevDoctor}" sang "${currDoctor}".`);
            }

            // 3. Thay đổi Ghế khám
            if (prev.chair_id !== curr.chair_id) {
              const prevChair = prev.chair?.name || `Ghế #${prev.chair_id}`;
              const currChair = curr.chair?.name || `Ghế #${curr.chair_id}`;
              createNotifObj('Thay đổi ghế khám', `Lịch hẹn #${curr.id} đã chuyển từ ${prevChair} sang ${currChair}.`);
            }

            // 4. Thay đổi Ngày khám / Giờ khám
            if (prev.start_time !== curr.start_time) {
              const prevDateObj = new Date(prev.start_time);
              const currDateObj = new Date(curr.start_time);

              const prevDate = prevDateObj.toLocaleDateString('vi-VN');
              const currDate = currDateObj.toLocaleDateString('vi-VN');

              const prevTime = prevDateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const currTime = currDateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

              let timeDetails = [];
              if (prevDate !== currDate) {
                timeDetails.push(`ngày khám (${prevDate} ➔ ${currDate})`);
              }
              if (prevTime !== currTime) {
                timeDetails.push(`giờ khám (${prevTime} ➔ ${currTime})`);
              }

              createNotifObj('Thay đổi thời gian khám', `Lịch hẹn #${curr.id} đã thay đổi ${timeDetails.join(' và ')}.`);
            }

            // 5. Thay đổi Trạng thái
            if (prev.status !== curr.status) {
              let msg = `Lịch hẹn #${curr.id} đã chuyển trạng thái từ "${formatAppointmentStatus(prev.status)}" sang "${formatAppointmentStatus(curr.status)}".`;
              if (curr.note && curr.note.includes('[Lễ tân hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Lễ tân hủy với nội dung: ${curr.note.split('[Lễ tân hủy]')[1]?.trim() || ''}`;
              } else if (curr.note && curr.note.includes('[Bệnh nhân hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Bệnh nhân hủy với nội dung: ${curr.note.split('[Bệnh nhân hủy]')[1]?.trim() || ''}`;
              } else if (curr.note && curr.note.includes('[Bác sĩ hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Bác sĩ hủy với nội dung: ${curr.note.split('[Bác sĩ hủy]')[1]?.trim() || ''}`;
              }
              createNotifObj('Thay đổi trạng thái lịch khám', msg);
            }
          }
        });
      } catch (e) {
        console.error('Lỗi đọc snapshot lịch hẹn:', e);
      }
    }

    if (newNotifs.length > 0) {
      setNotifications((prev) => [...newNotifs, ...prev]);
    }

    localStorage.setItem(snapshotKey, JSON.stringify(latestAppointments));
  };
  
  const renderStars = (rating) => {
    const numericRating = Number(rating) || 0;
    if (numericRating === 0) {
      return <span className="text-xs text-slate-400 italic">Chưa có đánh giá</span>;
    }
    return (
      <div className="flex items-center gap-1 text-amber-400">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="text-sm">{i < numericRating ? '★' : '☆'}</span>
        ))}
        <span className="text-xs text-slate-600 dark:text-slate-300 ml-1 font-semibold">
          ({numericRating}/5)
        </span>
      </div>
    );
  };

  // Fetch Dữ liệu ban đầu
  const fetchData = async () => {
    setLoading(true);
    try {
      const [aptRes, recRes, servRes, chairRes] = await Promise.all([
        appointmentApi.getAll(),
        medicalRecordApi.getAll(),
        appointmentApi.getServices(),
        appointmentApi.getChairs(),
      ]);

      const rawApts = Array.isArray(aptRes) ? aptRes : (aptRes?.data || []);
      const rawRecs = Array.isArray(recRes) ? recRes : (recRes?.data || []);
      const rawServs = Array.isArray(servRes) ? servRes : (servRes?.data || []);
      const rawChairs = Array.isArray(chairRes) ? chairRes : (chairRes?.data || []);

      setAppointments(rawApts);
      setMedicalRecords(rawRecs);
      setServices(rawServs);
      setChairs(rawChairs);

      await loadNotificationsFromDB();
      detectAppointmentChanges(rawApts);
    } catch (err) {
      console.error('Lỗi khi tải danh sách lịch khám:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const isAnyModalOpen = isCompleteModalOpen || isCancelModalOpen || isFollowUpModalOpen || isDetailOpen;
  useIdleRefresh(fetchData, 3 * 60 * 1000, isAnyModalOpen);

  const doctorAppointments = useMemo(() => {
    if (!user) return appointments;
    return appointments.filter((apt) => {
      if (user.doctor_id) return apt.doctor_id === user.doctor_id;
      if (apt.doctor?.user_id) return apt.doctor.user_id === user.id;
      return true;
    });
  }, [appointments, user]);

  const todayList = useMemo(() => {
    const todayStr = new Date().toDateString();
    return doctorAppointments.filter((apt) => {
      const aptDateStr = new Date(apt.start_time).toDateString();
      const validStatus =
        apt.status === AppointmentStatus.CONFIRMED ||
        apt.status === AppointmentStatus.CHECKIN;
      return aptDateStr === todayStr && validStatus;
    });
  }, [doctorAppointments]);

  const upcomingList = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const next7DaysEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

    return doctorAppointments.filter((apt) => {
      const aptTime = new Date(apt.start_time);
      const validStatus =
        apt.status === AppointmentStatus.SCHEDULED ||
        apt.status === AppointmentStatus.CONFIRMED ||
        apt.status === AppointmentStatus.CHECKIN;
      return aptTime > todayEnd && aptTime <= next7DaysEnd && validStatus;
    });
  }, [doctorAppointments]);

  const completedList = useMemo(() => {
    const now = new Date();
    const past14DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 0, 0, 0, 0);

    return doctorAppointments.filter((apt) => {
      const aptTime = new Date(apt.start_time);
      return (
        apt.status === AppointmentStatus.COMPLETED &&
        aptTime >= past14DaysStart &&
        aptTime <= now
      );
    });
  }, [doctorAppointments]);

  const paginate = (list, page) => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return list.slice(startIndex, startIndex + PAGE_SIZE);
  };

  const openDetailModal = (apt) => {
    setSelectedAppointment(apt);
    setIsDetailOpen(true);
  };

  const handleOpenCompleteModal = (apt) => {
    setSelectedAppointment(apt);

    // Tự động tìm service_id từ lượt khám hiện tại (apt)
    let autoServiceId = apt.service_id ? String(apt.service_id) : '';

    if (!autoServiceId && apt.note) {
      const match = apt.note.match(/\[Dịch vụ:\s*([^\]]+)\]/i);
      if (match) {
        const sName = match[1].trim();
        const found = services.find((s) => s.name.toLowerCase() === sName.toLowerCase());
        if (found) autoServiceId = String(found.id);
      }
    }

    setRecordFormData({
      diagnosis_summary: '',
      treatment_notes: '',
      service_id: autoServiceId,      // Tự động gán Dịch vụ thực hiện từ lịch khám
      follow_up_service_id: '',       // Để trống cho dịch vụ tái khám (tùy chọn)
      follow_up_date: '',
      follow_up_time: '',
      chair_id: '',
    });
    setIsCompleteModalOpen(true);
  };

  const handleSubmitComplete = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    const { follow_up_date, follow_up_time, chair_id } = recordFormData;
    const hasAnyFollowUp = follow_up_service_id || follow_up_date || follow_up_time || chair_id;
    const hasAllFollowUp = follow_up_service_id && follow_up_date && follow_up_time && chair_id;

    if (hasAnyFollowUp && !hasAllFollowUp) {
      alert('Vui lòng nhập đầy đủ Dịch vụ tái khám, Ngày khám, Giờ khám và Ghế khám nếu muốn hẹn lịch tái khám!');
      return;
    }

    let nextApptIso = null;
    let followUpStartDate = null;
    let followUpEndDate = null;

    if (hasAllFollowUp) {
      const fullTimeString = `${follow_up_date}T${follow_up_time}`;
      
      // 1. Kiểm tra Validate ngày quá khứ & giờ hành chính
      const timeError = validateAppointmentTime(fullTimeString);
      if (timeError) {
        alert(timeError);
        return;
      }

      followUpStartDate = new Date(fullTimeString);
      if (isNaN(followUpStartDate.getTime())) {
        alert('Thời gian tái khám không hợp lệ!');
        return;
      }
      nextApptIso = followUpStartDate.toISOString();
      followUpEndDate = new Date(followUpStartDate.getTime() + 60 * 60 * 1000);

      // 2. Kiểm tra trùng lịch Client-side trước khi gọi API
      const isConflict = checkConflictClientSide(appointments, {
        doctorId: selectedAppointment.doctor_id,
        chairId: chair_id,
        startTime: followUpStartDate.toISOString(),
        endTime: followUpEndDate.toISOString(),
      });

      if (isConflict.hasConflict) {
        alert('⚠️ Trùng lịch hẹn! Bác sĩ hoặc ghế khám đã có lịch trong khung giờ này.');
        return;
      }
    }

	try {
      // 1. Dịch vụ thực hiện (dùng cho Hồ sơ bệnh lý)
      let details = [];
      if (recordFormData.service_id) {
        const performedService = services.find((s) => String(s.id) === String(recordFormData.service_id));
        if (performedService) {
          const unitPrice = Number(performedService.unit_price || performedService.price || 0);
          details.push({
            service_id: parseInt(recordFormData.service_id),
            quantity: 1,
            unit_price: unitPrice,
          });
        }
      }

      // 2. Tên Dịch vụ tái khám (dùng cho Lịch tái khám mới)
      let followUpServiceName = '';
      if (recordFormData.follow_up_service_id) {
        const followUpService = services.find((s) => String(s.id) === String(recordFormData.follow_up_service_id));
        if (followUpService) {
          followUpServiceName = followUpService.name;
        }
      }

      // Tạo hồ sơ bệnh lý (Medical Record)
      const recordPayload = {
        patient_id: selectedAppointment.patient_id,
        appointment_id: selectedAppointment.id,
        doctor_id: selectedAppointment.doctor_id,
        diagnosis_summary: recordFormData.diagnosis_summary,
        treatment_notes: recordFormData.treatment_notes,
        next_appointment_date: nextApptIso,
        details: details,
      };

      await medicalRecordApi.create(recordPayload);

      // Cập nhật trạng thái lịch hiện tại thành COMPLETED
      await appointmentApi.updateStatus(selectedAppointment.id, AppointmentStatus.COMPLETED);

      await saveNotificationToDB({
        patientId: selectedAppointment.patient_id,
        appointmentId: selectedAppointment.id,
        title: 'Hoàn thành lượt khám',
        message: `Lịch hẹn #${selectedAppointment.id} đã hoàn thành khám thành công và cập nhật hồ sơ bệnh lý.`,
      });

      // 3. Tạo lịch khám mới cho lịch tái khám
      if (hasAllFollowUp) {
        // Nối tag [Dịch vụ: ...] theo đúng chuẩn để DoctorTreatmentRecords đọc được
        const noteServiceTag = followUpServiceName ? `[Dịch vụ: ${followUpServiceName}] ` : '';
        const newAppointmentPayload = {
          patient_id: parseInt(selectedAppointment.patient_id),
          doctor_id: parseInt(selectedAppointment.doctor_id),
          chair_id: parseInt(recordFormData.chair_id),
          start_time: followUpStartDate.toISOString(),
          end_time: followUpEndDate.toISOString(),
          note: `${noteServiceTag}Lịch tái khám tự động tạo từ lượt khám #${selectedAppointment.id}`,
          status: AppointmentStatus.CONFIRMED,
        };

        await appointmentApi.create(newAppointmentPayload);
      }

      alert('Đã hoàn thành khám, tạo hồ sơ bệnh lý' + (hasAllFollowUp ? ' và đặt lịch tái khám mới' : '') + ' thành công!');
      setIsCompleteModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const isConflict = err.response?.status === 409 || err.status === 409;
      const errorMessage = err.response?.data?.detail || err.detail || err.message;

      if (isConflict.hasConflict) {
        alert('⚠️ Trùng lịch hẹn! Bác sĩ hoặc ghế khám đã có lịch trong khung giờ này.');
      } else {
        alert(errorMessage || 'Thao tác thất bại! Vui lòng kiểm tra lại.');
      }
    }
  };

  const handleOpenCancelModal = (apt) => {
    setSelectedAppointment(apt);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleSubmitCancel = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    try {
      const updatedNote = selectedAppointment.note
        ? `${selectedAppointment.note} | [Bác sĩ hủy] ${cancelReason}`
        : `[Bác sĩ hủy] ${cancelReason}`;

      await appointmentApi.update(selectedAppointment.id, {
        status: AppointmentStatus.CANCELLED,
        note: updatedNote,
      });

      await saveNotificationToDB({
        patientId: selectedAppointment.patient_id,
        appointmentId: selectedAppointment.id,
        title: 'Lịch khám đã bị hủy',
        message: `Lịch hẹn #${selectedAppointment.id} đã bị Bác sĩ hủy. Lý do: ${cancelReason}`,
      });

      alert('Đã hủy lịch khám thành công!');
      setIsCancelModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Hủy lịch khám thất bại!');
    }
  };

  const handleShowFollowUp = (apt) => {
	  // 1. Tìm hồ sơ bệnh lý tương ứng với lượt khám hiện tại
	  const record = medicalRecords.find((r) => r.appointment_id === apt.id);
	  const nextDate = record?.next_appointment_date || null;

	  // 2. Tìm lịch hẹn tái khám được tạo ra từ lượt khám này
	  const followUpApt = appointments.find((a) => {
		const isSamePatient = String(a.patient_id) === String(apt.patient_id);
		const isFollowUpNote = a.note && a.note.includes(`lượt khám #${apt.id}`);
		const isTimeMatch =
		  nextDate &&
		  new Date(a.start_time).getTime() === new Date(nextDate).getTime();
		return isSamePatient && (isFollowUpNote || isTimeMatch);
	  });

	  // 3. Lấy tên Ghế khám
	  let chairName = 'Chưa xếp ghế';
	  if (followUpApt) {
		const chairObj = chairs.find((c) => String(c.id) === String(followUpApt.chair_id));
		chairName = followUpApt.chair?.name || chairObj?.name || (followUpApt.chair_id ? `Ghế #${followUpApt.chair_id}` : 'Chưa xếp ghế');
	  } else if (apt.chair) {
		chairName = apt.chair.name;
	  }

	  // 4. Lấy tên Dịch vụ tái khám bằng hàm phân tách parseAppointmentDetails
	  let serviceName = 'Chưa đăng ký dịch vụ cụ thể';
	  if (followUpApt) {
		const parsed = parseAppointmentDetails(followUpApt, medicalRecords, services);
		serviceName = parsed.servicesText;
	  }

	  // 5. Cập nhật State cho Modal
	  setFollowUpInfo({
		date: nextDate,
		patientName: apt.patient?.full_name || `ID: ${apt.patient_id}`,
		chairName: chairName,
		serviceName: serviceName,
	  });

	  setIsFollowUpModalOpen(true);
	};

  const renderPagination = (totalItems, currentPage, setPage) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (totalItems === 0) return null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 mt-4">
        <div>
          Hiển thị <strong className="text-slate-900 dark:text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> - <strong className="text-slate-900 dark:text-white">{Math.min(currentPage * PAGE_SIZE, totalItems)}</strong> trên tổng số <strong className="text-slate-900 dark:text-white">{totalItems}</strong> bản ghi
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs transition-all shadow-sm"
          >
            Trang trước
          </button>
          <span className="text-xs font-bold px-2 text-slate-700 dark:text-slate-300">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs transition-all shadow-sm"
          >
            Trang sau
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Quản lý Lịch khám Bác sĩ</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi danh sách lịch hẹn, thực hiện hoàn thành lượt khám và cập nhật hồ sơ bệnh lý.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-all"
        >
          🔄 Tải lại dữ liệu
        </button>
      </div>

      {/* TAB NAVIGATION & NOTIFICATION TOOLBAR */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'today'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span>☀️ Hôm nay</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'today'
                    ? 'bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
                }`}
              >
                {todayList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'upcoming'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span>📅 7 ngày tới</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'upcoming'
                    ? 'bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
                }`}
              >
                {upcomingList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span>✅ Đã khám (14 ngày qua)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'completed'
                    ? 'bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
                }`}
              >
                {completedList.length}
              </span>
            </button>
          </div>

          {/* CỬA SỔ MODAL / DROPDOWN THÔNG BÁO */}
          <div className="relative self-end sm:self-auto">
            <button
              onClick={handleToggleNotifications}
              title="Xem cập nhật thay đổi lịch khám"
              className={`p-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${
                hasUnreadNotif
                  ? 'bg-amber-500 text-white border-amber-600 animate-pulse shadow-md shadow-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >              
              <span className="hidden md:inline">🔔 Thông báo</span>
              {hasUnreadNotif && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <span>🔔</span> Thông báo thay đổi lịch khám
                  </h4>
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2.5">
                  {visibleNotifications.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">
                      Chưa có thay đổi mới nào.
                    </p>
                  ) : (
                    visibleNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 border rounded-xl text-xs space-y-1 ${
                          !n.is_read
                            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                            : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 opacity-80'
                        }`}
                      >
                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span className="flex items-center gap-1.5">
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>}
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{n.time}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BẢNG HIỂN THỊ */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="p-3">Mã lịch</th>
                <th className="p-3">Bệnh nhân</th>
                <th className="p-3">Bác sĩ</th>
                <th className="p-3">Ghế khám</th>
                <th className="p-3">Thời gian khám</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-slate-400 dark:text-slate-500">
                    Đang tải dữ liệu lịch khám...
                  </td>
                </tr>
              ) : activeTab === 'today' ? (
                todayList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-6 text-slate-400 dark:text-slate-500">
                      Không có lịch khám nào trong hôm nay.
                    </td>
                  </tr>
                ) : (
                  paginate(todayList, pageToday).map((apt) => {
                    const isCheckin = apt.status === AppointmentStatus.CHECKIN;
                    return (
                      <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">#{apt.id}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{apt.patient?.full_name || `ID: ${apt.patient_id}`}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{apt.doctor?.full_name || `ID: ${apt.doctor_id}`}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{apt.chair?.name || `Ghế ${apt.chair_id}`}</td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                          {new Date(apt.start_time).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isCheckin
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {formatAppointmentStatus(apt.status)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => openDetailModal(apt)}
                              title="Xem chi tiết thông tin lịch khám"
                              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                            >
                              ⓘ
                            </button>
                            <button
                              onClick={() => handleOpenCompleteModal(apt)}
                              disabled={!isCheckin}
                              title={
                                !isCheckin
                                  ? 'Chỉ lịch hẹn trạng thái Check-in mới có thể hoàn thành'
                                  : 'Sẵn sàng hoàn thành lượt khám'
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                                isCheckin
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                              }`}
                            >
                              ✔ Hoàn thành
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : activeTab === 'upcoming' ? (
                upcomingList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-6 text-slate-400 dark:text-slate-500">
                      Không có lịch khám nào trong 7 ngày tới.
                    </td>
                  </tr>
                ) : (
                  paginate(upcomingList, pageUpcoming).map((apt) => (
                    <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">#{apt.id}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{apt.patient?.full_name || `ID: ${apt.patient_id}`}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{apt.doctor?.full_name || `ID: ${apt.doctor_id}`}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{apt.chair?.name || `Ghế ${apt.chair_id}`}</td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        {new Date(apt.start_time).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          {formatAppointmentStatus(apt.status)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(apt)}
                            title="Xem chi tiết thông tin lịch khám"
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                          >
                            ⓘ
                          </button>
                          <button
                            onClick={() => handleOpenCancelModal(apt)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all"
                          >
                            ✖ Hủy lịch
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : completedList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-slate-400 dark:text-slate-500">
                    Không có lịch hẹn đã khám trong 14 ngày trước đó.
                  </td>
                </tr>
              ) : (
                paginate(completedList, pageCompleted).map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">#{apt.id}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{apt.patient?.full_name || `ID: ${apt.patient_id}`}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{apt.doctor?.full_name || `ID: ${apt.doctor_id}`}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{apt.chair?.name || `Ghế ${apt.chair_id}`}</td>
                    <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                      {new Date(apt.start_time).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                        {formatAppointmentStatus(apt.status)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openDetailModal(apt)}
                          title="Xem chi tiết thông tin lịch khám"
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                        >
                          ⓘ
                        </button>
                        <button
                          onClick={() => handleShowFollowUp(apt)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-all"
                        >
                          📅 Lịch tái khám
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PHÂN TRANG */}
        {activeTab === 'today' && renderPagination(todayList.length, pageToday, setPageToday)}
        {activeTab === 'upcoming' && renderPagination(upcomingList.length, pageUpcoming, setPageUpcoming)}
        {activeTab === 'completed' && renderPagination(completedList.length, pageCompleted, setPageCompleted)}
      </div>

      {/* MODAL 1: HOÀN THÀNH LỊCH KHÁM & TẠO HỒ SƠ BỆNH LÝ */}
      {isCompleteModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                🩺 Lập Hồ sơ bệnh lý - Lịch khám #{selectedAppointment.id}
              </h3>
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitComplete} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-600/50">
                <div>
                  <strong>Bệnh nhân:</strong> {selectedAppointment.patient?.full_name || selectedAppointment.patient_id}
                </div>
                <div>
                  <strong>Bác sĩ:</strong> {selectedAppointment.doctor?.full_name || selectedAppointment.doctor_id}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chẩn đoán sơ bộ (Diagnosis Summary)
                </label>
                <textarea
                  rows="2"
                  value={recordFormData.diagnosis_summary}
                  onChange={(e) =>
                    setRecordFormData({ ...recordFormData, diagnosis_summary: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                  placeholder="Nhập mô tả / chẩn đoán..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú điều trị (Treatment Notes)
                </label>
                <textarea
                  rows="2"
                  value={recordFormData.treatment_notes}
                  onChange={(e) =>
                    setRecordFormData({ ...recordFormData, treatment_notes: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                  placeholder="Quá trình thực hiện, dặn dò bệnh nhân..."
                />
              </div>

			{/* DỊCH VỤ THỰC HIỆN CỦA LƯỢT KHÁM HIỆN TẠI */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dịch vụ thực hiện (Lượt khám hiện tại)
                </label>
                <select
                  disabled
                  value={recordFormData.service_id}
                  onChange={(e) =>
                    setRecordFormData({ ...recordFormData, service_id: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 appearance-none cursor-not-allowed outline-none select-none pointer-events-none"
                >
                  <option value="">-- Chọn dịch vụ thực hiện --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({Number(s.unit_price || s.price || 0).toLocaleString('vi-VN')} VNĐ)
                    </option>
                  ))}
                </select>
              </div>

			{/* CỤM LỊCH HẸN TÁI KHÁM */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                  📅 Lịch hẹn tái khám (Tùy chọn)
                </h4>

                {/* DỊCH VỤ TÁI KHÁM (TÙY CHỌN) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Dịch vụ tái khám (Tùy chọn)
                  </label>
                  <select
                    value={recordFormData.follow_up_service_id}
                    onChange={(e) =>
                      setRecordFormData({ ...recordFormData, follow_up_service_id: e.target.value })
                    }
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Chọn dịch vụ cho lịch tái khám --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({Number(s.unit_price || s.price || 0).toLocaleString('vi-VN')} VNĐ)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Ngày khám</label>
                    <input
                      type="date"
                      value={recordFormData.follow_up_date}
                      onChange={(e) =>
                        setRecordFormData({ ...recordFormData, follow_up_date: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Giờ khám</label>
                    <select
                      value={recordFormData.follow_up_time}
                      onChange={(e) =>
                        setRecordFormData({ ...recordFormData, follow_up_time: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
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
                            {slot} {disabled ? '(Đã có lịch)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Ghế khám tái khám</label>
                  <select
                    value={recordFormData.chair_id}
                    onChange={(e) =>
                      setRecordFormData({ ...recordFormData, chair_id: e.target.value })
                    }
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
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
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                >
                  Hoàn thành & Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: HỦY LỊCH KHÁM */}
      {isCancelModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              ✖ Xác nhận Hủy lịch khám #{selectedAppointment.id}
            </h3>
            <hr/>
            <form onSubmit={handleSubmitCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do bác sĩ hủy lịch*
                </label>
                <textarea
                  rows="3"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500"
                  placeholder="Nhập lý do hủy lịch..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-semibold shadow-md"
                >
                  Xác nhận Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: XEM CHI TIẾT LỊCH KHÁM */}
      {isDetailOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
            
            {/* Tiêu đề Modal */}
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                📋 Chi tiết Lịch khám #{selectedAppointment.id}
              </h3>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">
                ✕
              </button>
            </div>

            {/* Danh sách thông tin chi tiết */}
            <div className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              
              {/* Mục 1: Bệnh nhân */}
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bệnh nhân:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAppointment.patient?.full_name || `ID: ${selectedAppointment.patient_id}`}
                </span>
              </div>

              {/* Mục 2: Bác sĩ */}
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bác sĩ đảm nhận:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAppointment.doctor?.full_name || `ID: ${selectedAppointment.doctor_id}`}
                </span>
              </div>

              {/* Mục 3: Ghế khám */}
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Ghế khám:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAppointment.chair?.name || `Ghế ${selectedAppointment.chair_id}`}
                </span>
              </div>

              {/* Mục 4: Thời gian khám */}
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Thời gian khám:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(selectedAppointment.start_time).toLocaleString('vi-VN')}
                </span>
              </div>

              {/* Mục 5: Trạng thái */}
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Trạng thái:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatAppointmentStatus(selectedAppointment.status)}
                </span>
              </div>

              {/* Mục 6 & 7: Dịch vụ & Ghi chú */}
              {(() => {
                const { servicesText, noteText } = parseAppointmentDetails(selectedAppointment, medicalRecords, services);
                return (
                  <>
                    <div className="py-3 space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 font-medium block">🩺 Dịch vụ đăng ký:</span>
                      <div className="bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/60 text-sky-900 dark:text-sky-200 font-medium">
                        {servicesText}
                      </div>
                    </div>

                    <div className="py-3 space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 font-medium block">📝 Ghi chú lịch khám:</span>
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 italic">
                        {noteText}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Mục 8: Đánh giá & Phản hồi (nếu hoàn thành) */}
              {selectedAppointment?.status === 'completed' && (
                <div className="py-3 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>⭐</span> Đánh giá & Phản hồi từ Bệnh nhân
                  </h4>

                  <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Mức độ hài lòng:</span>
                      {renderStars(selectedAppointment.rating)}
                    </div>

                    <div className="text-xs">
                      <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nhận xét / Phản hồi:</span>
                      <p className="text-slate-700 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed">
                        {selectedAppointment.feedback || selectedAppointment.comment || 'Bệnh nhân chưa để lại nhận xét chi tiết.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer chứa nút Đóng */}
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: XEM LỊCH TÁI KHÁM */}
		{isFollowUpModalOpen && (
		  <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 dark:border-slate-700">
			  
			  {/* Header Modal */}
			  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
				<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
				  <span>📅</span> Thông tin Lịch tái khám
				</h3>
				<button
				  onClick={() => setIsFollowUpModalOpen(false)}
				  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center transition-all"
				>
				  ✕
				</button>
			  </div>

			  {/* Content Modal */}
			  <div className="space-y-3 text-sm">
				<div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700 space-y-3">
				  
				  {/* Tên Bệnh nhân */}
				  <div>
					<span className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold block mb-0.5">
					  Bệnh nhân
					</span>
					<p className="font-bold text-slate-800 dark:text-slate-100 text-base">
					  {followUpInfo.patientName}
					</p>
				  </div>

				  {/* Ngày tái khám */}
				  <div>
					<span className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold block mb-0.5">
					  Thời gian tái khám
					</span>
					<p className="font-semibold text-amber-600 dark:text-amber-400">
					  {followUpInfo.date
						? new Date(followUpInfo.date).toLocaleString('vi-VN', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
						  })
						: 'Chưa có lịch tái khám'}
					</p>
				  </div>

				  {/* Ghế khám */}
				  <div>
					<span className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold block mb-0.5">
					  Ghế khám
					</span>
					<p className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
					  <span>💺</span> {followUpInfo.chairName || 'Chưa xếp ghế'}
					</p>
				  </div>

				  {/* Dịch vụ tái khám */}
				  <div>
					<span className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold block mb-0.5">
					  Dịch vụ tái khám
					</span>
					<p className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
					  <span>🩺</span> {followUpInfo.serviceName || 'Chưa đăng ký dịch vụ cụ thể'}
					</p>
				  </div>

				</div>
			  </div>

			  {/* Footer Modal */}
			  <div className="flex justify-end pt-2">
				<button
				  onClick={() => setIsFollowUpModalOpen(false)}
				  className="px-5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
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