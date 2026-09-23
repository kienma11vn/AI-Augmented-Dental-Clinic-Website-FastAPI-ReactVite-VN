import React, { useState, useEffect, useMemo } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import appointmentApi from '../../api/appointmentApi';
import invoiceApi from '../../api/invoiceApi';
import discountProgramsApi from '../../api/discountProgramsApi';
import notificationApi from '../../api/notificationApi';
import aiApi from '../../api/aiApi';
import { useAuth } from '../../context/AuthContext';
import { formatAppointmentStatus } from '../../constants/translations';
import { getInvoiceStatusInfo } from '../../utils/invoiceStatus';

const ITEMS_PER_PAGE = 10;

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00'
];

const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  CHECKIN: 'checkin',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const isChairPaused = (chair) => {
  if (!chair) return false;
  if (chair.is_active === false) return true;
  if (chair.status) {
    const status = String(chair.status).toLowerCase();
    return ['paused', 'tạm dừng', 'inactive', 'maintenance', 'bảo trì'].includes(status);
  }
  return false;
};

// Hàm kiểm tra trùng lịch hẹn Client-side
const checkConflictClientSide = (
  appointments,
  { doctorId, chairId, startTime, endTime, excludeAptId = null }
) => {
  if (!startTime || !endTime) return { hasConflict: false };
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (isNaN(start) || isNaN(end)) return { hasConflict: false };

  for (const apt of appointments) {
    // Bỏ qua chính lịch hẹn đang chỉnh sửa
    if (excludeAptId && String(apt.id) === String(excludeAptId)) continue;
    // Bỏ qua các lịch hẹn đã bị hủy
    if (apt.status === AppointmentStatus.CANCELLED) continue;

    const aptStart = new Date(apt.start_time).getTime();
    const aptEnd = new Date(apt.end_time).getTime();

    if (isNaN(aptStart) || isNaN(aptEnd)) continue;

    // Khoảng thời gian giao nhau: (Start_Mới < End_Cũ) VÀ (End_Mới > Start_Cũ)
    const isTimeOverlap = start < aptEnd && end > aptStart;
    if (!isTimeOverlap) continue;

    const isDoctorBusy = doctorId && String(apt.doctor_id) === String(doctorId);
    const isChairBusy = chairId && String(apt.chair_id) === String(chairId);

    // Cùng ghế khám và ngày/giờ nhưng KHIẾN KHÁC BÁC SĨ (hoặc trùng ghế nói chung)
    if (isChairBusy) {
      const isDiffDoctor = doctorId && String(apt.doctor_id) !== String(doctorId);
      return {
        hasConflict: true,
        type: isDiffDoctor ? 'CHAIR_DIFFERENT_DOCTOR' : 'CHAIR_CONFLICT',
        message: 'Đã có lịch đặt trước tại ghế khám/khung giờ!',
      };
    }

    // Trùng bác sĩ trong cùng khung giờ
    if (isDoctorBusy) {
      return {
        hasConflict: true,
        type: 'DOCTOR_CONFLICT',
        message: '⚠️ Bác sĩ đã có lịch khám khác trong khung giờ này!',
      };
    }
  }

  return { hasConflict: false };
};

const parseAppointmentDetails = (apt, services = []) => {
  if (!apt) {
    return {
      servicesText: 'Chưa có thông tin dịch vụ',
      noteText: 'Không có ghi chú.',
      cancelReasonText: 'Không có ghi chú lý do hủy.',
    };
  }

  let rawNote = apt.note || '';
  let foundServices = [];
  let cancelReasonText = apt.cancel_reason || '';

  if (rawNote) {
    const serviceMatch = rawNote.match(/\[Dịch vụ:\s*([^\]]+)\]/i);
    if (serviceMatch) {
      foundServices.push(serviceMatch[1].trim());
      rawNote = rawNote.replace(/\[Dịch vụ:\s*([^\]]+)\]/gi, '').trim();
    }
  }

  if (!cancelReasonText && rawNote) {
    const cancelMatch = rawNote.match(/\|?\s*(\[[^\]]*hủy\][\s\S]*)/i);
    if (cancelMatch) {
      cancelReasonText = cancelMatch[1].trim();
      rawNote = rawNote.replace(/\|?\s*\[[^\]]*hủy\][\s\S]*/gi, '').trim();
    }
  }

  let noteText = rawNote.replace(/^\|+|\|+$/g, '').trim();

  return {
    servicesText: foundServices.length > 0 ? foundServices.join(', ') : 'Dịch vụ khám tổng quát',
    noteText: noteText || 'Không có ghi chú.',
    cancelReasonText: cancelReasonText || 'Không có ghi chú lý do hủy (Tự động hủy lịch).',
  };
};

function AutocompleteInput({ label, placeholder, options, value, onChange, required = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => String(opt.id) === String(value));

  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.displayText);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, selectedOption]);

  const filteredOptions = options.filter(
    (opt) =>
      opt.displayText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(opt.id).includes(searchTerm)
  );

  return (
    <div className="relative">
      {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          required={required && !value}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!e.target.value) onChange('');
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setSearchTerm('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <li
              key={opt.id}
              onMouseDown={() => {
                onChange(opt.id);
                setSearchTerm(opt.displayText);
                setIsOpen(false);
              }}
              className="p-2.5 hover:bg-sky-50 dark:hover:bg-slate-700/70 cursor-pointer text-sm border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 flex justify-between items-center"
            >
              <div>
                <span className="font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded mr-1.5">
                  ID: #{opt.id}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{opt.title}</span>
                {opt.subTitle && <span className="text-slate-400 dark:text-slate-400 text-xs block mt-0.5">{opt.subTitle}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PatientAppointments() {
  const auth = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // Tabs State
  const [activeTab, setActiveTab] = useState('confirmed');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Reset trang về 1 khi đổi tab
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Notifications State & Notif Modal Tab
  const [notifications, setNotifications] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]);
  const [aiReminders, setAiReminders] = useState([]);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState('changes');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Form States
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    status: '',
    doctor_id: '',
    date: '',
  });

  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    chair_id: '',
    service_id: '',
    start_time: '',
    end_time: '',
    note: '',
  });

  const [cancelReason, setCancelReason] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const [isExplainingService, setIsExplainingService] = useState(false); // State AI Explain

  const currentPatient = useMemo(() => {
    if (!patients.length || !auth?.user) return null;
    return patients.find((p) => p.user_id === auth.user.id || p.id === auth.user.id) || patients[0];
  }, [patients, auth?.user]);

	// Hàm kiểm tra khung giờ có bị trùng lịch hay không
	const isSlotConflict = (slot, isEditMode = false) => {
	  const dateVal = formData.start_time ? formData.start_time.split('T')[0] : '';
	  if (!dateVal || (!formData.doctor_id && !formData.chair_id)) {
		return false;
	  }

	  const slotStartIso = new Date(`${dateVal}T${slot}`).toISOString();
	  const slotEndIso = new Date(new Date(`${dateVal}T${slot}`).getTime() + 60 * 60 * 1000).toISOString();

	  const conflictResult = checkConflictClientSide(appointments, {
		doctorId: formData.doctor_id,
		chairId: formData.chair_id,
		startTime: slotStartIso,
		endTime: slotEndIso,
		excludeAptId: isEditMode ? selectedAppointment?.id : null,
	  });

	  return conflictResult.hasConflict;
	};

  // Hàm xử lý gọi AI giải thích dịch vụ và hiển thị Alert
	const handleExplainService = async (apt) => {
	  if (!apt) return;

	  // Trích xuất tên dịch vụ từ hàm parseAppointmentDetails
	  const { servicesText } = parseAppointmentDetails(apt, [], services);

	  if (!servicesText || servicesText === 'Chưa đăng ký dịch vụ cụ thể' || servicesText === 'Chưa có thông tin dịch vụ') {
		alert('⚠️ Lịch hẹn này chưa có thông tin dịch vụ cụ thể để AI giải thích!');
		return;
	  }

	  // Tìm mô tả chi tiết của dịch vụ trong danh sách `services` (nếu có)
	  let serviceName = servicesText;
	  let serviceDescription = '';

	  const matchedService = services.find(
		(s) => s.name.toLowerCase() === servicesText.toLowerCase() || servicesText.includes(s.name)
	  );

	  if (matchedService) {
		serviceName = matchedService.name;
		serviceDescription = matchedService.description || '';
	  }

	  setIsExplainingService(true);

	  try {
		// Gọi API của AI (aiApi.js) gửi prompt cho Gemini
		const response = await aiApi.explainService({
		  service_name: serviceName,
		  description: serviceDescription || 'Dịch vụ chăm sóc và điều trị nha khoa',
		});

		// Lấy câu trả lời trả về từ Gemini
		const resultText = response?.data?.result || response?.result;

		if (resultText) {
		  // Hiển thị ra màn hình dạng thông báo Alert
		  alert(`🤖 GIẢI THÍCH DỊCH VỤ NHA KHOA (GEMINI AI):\n\n${resultText}`);
		} else {
		  alert('⚠️ Không nhận được phản hồi giải thích từ AI.');
		}
	  } catch (error) {
		console.error('Lỗi khi gọi AI giải thích dịch vụ:', error);
		const detailError = error.response?.data?.detail || 'Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!';
		alert(`❌ Lỗi giải thích dịch vụ: ${detailError}`);
	  } finally {
		setIsExplainingService(false);
	  }
	};

  // Tải thông báo từ CSDL
  const loadDbNotifications = async (patientId) => {
    try {
      let res;
      try {
        res = await notificationApi.getMyNotifications();
      } catch (err) {
        if (patientId) {
          res = await notificationApi.getPatientNotifications(patientId);
        }
      }
      const rawList = Array.isArray(res) ? res : (res?.data || []);
      const formatted = rawList.map((item) => ({
        id: item.id || Date.now() + Math.random(),
        dbId: item.id,
        aptId: item.appointment_id || item.appointmentId,
        title: item.title || 'Thông báo hệ thống',
        content: item.message || item.content || '',
        time: item.created_at
          ? new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : '',
        date: item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '',
        createdAt: item.created_at || null,
        isRead: item.is_read ?? item.isRead ?? false,
        type: item.type || 'system',
      }));
      setDbNotifications(formatted);
      if (formatted.some((n) => !n.isRead)) {
        setHasUnreadNotif(true);
      }
    } catch (e) {
      console.error('Lỗi khi tải thông báo CSDL:', e);
    }
  };

  // Lọc thông báo CSDL: Nếu đã đọc (isRead === true), chỉ hiển thị nếu được tạo trong vòng 14 ngày
  const validDbNotifications = useMemo(() => {
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    return dbNotifications.filter((n) => {
      if (!n.isRead) return true; // Chưa đọc thì luôn hiển thị
      if (!n.createdAt) return true; // Trường hợp fallback nếu không có ngày
      const createdMs = new Date(n.createdAt).getTime();
      if (isNaN(createdMs)) return true;
      return (nowMs - createdMs) <= FOURTEEN_DAYS_MS;
    });
  }, [dbNotifications]);

  // Kiểm tra thông báo có thuộc loại Nhắc lịch khám hay không
  const isReminderNotif = (n) => {
    const title = (n.title || '').toLowerCase();
    const type = (n.type || '').toLowerCase();
    const content = (n.content || '').toLowerCase();
    return (
      type.includes('reminder') ||
      type.includes('nhac') ||
      title.includes('nhắc') ||
      title.includes('tái khám') ||
      content.includes('nhắc lịch') ||
      content.includes('tái khám')
    );
  };

  // Phân loại thông báo CSDL
  const dbChangeNotifs = useMemo(() => {
    return validDbNotifications.filter((n) => !isReminderNotif(n));
  }, [validDbNotifications]);

  const dbReminderNotifs = useMemo(() => {
    return validDbNotifications.filter((n) => isReminderNotif(n));
  }, [validDbNotifications]);

  const handleMarkAsRead = async (notif) => {
    if (notif.dbId && !notif.isRead) {
      try {
        await notificationApi.markAsRead(notif.dbId);
        setDbNotifications((prev) =>
          prev.map((n) => (n.dbId === notif.dbId ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        console.error('Lỗi đánh dấu đã đọc:', err);
      }
    }
  };

  // Tải & Đồng bộ tin nhắn nhắc lịch tái khám từ AI
  const loadAiReminders = () => {
    try {
      const stored = localStorage.getItem('ai_appointment_reminders');
      if (stored) {
        const parsed = JSON.parse(stored);
        const pId = currentPatient?.id || auth?.user?.id;
        const filtered = parsed.filter(
          (item) => !item.patient_id || String(item.patient_id) === String(pId)
        );
        setAiReminders(filtered);
      } else {
        setAiReminders([]);
      }
    } catch (e) {
      console.error('Lỗi khi tải nhắc lịch AI:', e);
    }
  };

  useEffect(() => {
    loadAiReminders();

    const handleStorageChange = (e) => {
      if (!e.key || e.key === 'ai_appointment_reminders') {
        loadAiReminders();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('ai_reminder_sent', loadAiReminders);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ai_reminder_sent', loadAiReminders);
    };
  }, [currentPatient, auth?.user]);

  const doctorOptions = useMemo(() => {
    if (!Array.isArray(doctors)) return [];
    return doctors.map((d) => ({
      id: d.id,
      title: d.full_name,
      subTitle: d.specialty ? `Chuyên khoa: ${d.specialty}` : '',
      displayText: `[ID: ${d.id}] ${d.full_name} ${d.specialty ? `(${d.specialty})` : ''}`,
    }));
  }, [doctors]);

  const serviceOptions = useMemo(() => {
    if (!Array.isArray(services)) return [];
    return services.map((s) => ({
      id: s.id,
      title: s.name,
      subTitle: `Mã: ${s.code} | Giá: ${Number(s.unit_price || s.price || 0).toLocaleString('vi-VN')} VNĐ`,
      displayText: `[Mã: ${s.code}] ${s.name} - ${Number(s.unit_price || s.price || 0).toLocaleString('vi-VN')} VNĐ`,
    }));
  }, [services]);

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
            const currentTimeStr = new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            if (prev.patient_id !== curr.patient_id) {
              const prevPatient = prev.patient?.full_name || `ID: ${prev.patient_id}`;
              const currPatient = curr.patient?.full_name || `ID: ${curr.patient_id}`;
              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title: 'Thay đổi bệnh nhân',
                content: `Lịch hẹn #${curr.id} đã đổi bệnh nhân từ "${prevPatient}" sang "${currPatient}".`,
                time: currentTimeStr,
              });
            }

            if (prev.doctor_id !== curr.doctor_id) {
              const prevDoctor = prev.doctor?.full_name || `ID: ${prev.doctor_id}`;
              const currDoctor = curr.doctor?.full_name || `ID: ${curr.doctor_id}`;
              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title: 'Thay đổi bác sĩ phụ trách',
                content: `Lịch hẹn #${curr.id} đã đổi bác sĩ từ "${prevDoctor}" sang "${currDoctor}".`,
                time: currentTimeStr,
              });
            }

            if (prev.chair_id !== curr.chair_id) {
              const prevChair = prev.chair?.name || `Ghế #${prev.chair_id}`;
              const currChair = curr.chair?.name || `Ghế #${curr.chair_id}`;
              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title: 'Thay đổi ghế khám',
                content: `Lịch hẹn #${curr.id} đã chuyển từ ${prevChair} sang ${currChair}.`,
                time: currentTimeStr,
              });
            }

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

              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title: 'Thay đổi thời gian khám',
                content: `Lịch hẹn #${curr.id} đã thay đổi ${timeDetails.join(' và ')}.`,
                time: currentTimeStr,
              });
            }

            if (prev.status !== curr.status) {
              let msg = `Lịch hẹn #${curr.id} đã chuyển trạng thái từ "${formatAppointmentStatus(prev.status)}" sang "${formatAppointmentStatus(curr.status)}".`;
              if (curr.note && curr.note.includes('[Lễ tân hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Lễ tân hủy với nội dung: ${curr.note.split('[Lễ tân hủy]')[1]?.trim() || ''}`;
              } else if (curr.note && curr.note.includes('[Bệnh nhân hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Bệnh nhân hủy với nội dung: ${curr.note.split('[Bệnh nhân hủy]')[1]?.trim() || ''}`;
              } else if (curr.note && curr.note.includes('[Bác sĩ hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Bác sĩ hủy với nội dung: ${curr.note.split('[Bác sĩ hủy]')[1]?.trim() || ''}`;
              }
              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title: 'Thay đổi trạng thái lịch khám',
                content: msg,
                time: currentTimeStr,
              });
            }
          }
        });
      } catch (e) {
        console.error('Lỗi đọc snapshot lịch hẹn:', e);
      }
    }

    if (newNotifs.length > 0) {
      setNotifications((prev) => [...newNotifs, ...prev]);
      setHasUnreadNotif(true);
    }

    localStorage.setItem(snapshotKey, JSON.stringify(latestAppointments));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await appointmentApi.getInitialData();

      const rawAppointments = Array.isArray(data?.appointments) ? data.appointments : (data?.appointments?.data || []);
      const rawDoctors = Array.isArray(data?.doctors) ? data.doctors : (data?.doctors?.data || []);
      const rawChairs = Array.isArray(data?.chairs) ? data.chairs : (data?.chairs?.data || []);
      const rawPatients = Array.isArray(data?.patients) ? data.patients : (data?.patients?.data || []);
      const rawServices = Array.isArray(data?.services) ? data.services : (data?.services?.data || []);

      setDoctors(rawDoctors);
      setChairs(rawChairs);
      setPatients(rawPatients);
      setServices(rawServices);
      setAppointments(rawAppointments);

      detectAppointmentChanges(rawAppointments);

      try {
        const invRes = await invoiceApi.getInvoices();
        const invList = Array.isArray(invRes) ? invRes : invRes?.data || [];
        setInvoices(invList);
      } catch (e) {
        console.error('Lỗi tải hóa đơn:', e);
      }

      const pId = rawPatients.find((p) => p.user_id === auth?.user?.id || p.id === auth?.user?.id)?.id || auth?.user?.id;
      if (pId || auth?.user?.id) {
        await loadDbNotifications(pId);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu lịch hẹn:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const isAnyModalOpen =
    isCreateOpen ||
    isSearchOpen ||
    isEditOpen ||
    isDetailOpen ||
    isCancelModalOpen ||
    isInvoiceOpen ||
    isNotifOpen;
	
  useIdleRefresh(fetchData, 5 * 60 * 1000, isAnyModalOpen);

  const filteredAppointments = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return {
      confirmed: appointments.filter((a) => {
        const isConfirmedOrCheckin = a.status === AppointmentStatus.CONFIRMED || a.status === AppointmentStatus.CHECKIN;
        const isFutureOrToday = new Date(a.start_time) >= todayStart;
        return isConfirmedOrCheckin && isFutureOrToday;
      }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),

      scheduled: appointments.filter((a) => a.status === AppointmentStatus.SCHEDULED)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),

      cancelled: appointments.filter((a) => {
        const isCancelled = a.status === AppointmentStatus.CANCELLED;
        const isWithin90Days = new Date(a.start_time) >= ninetyDaysAgo;
        return isCancelled && isWithin90Days;
      }).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),

      completed: appointments.filter((a) => {
        const isCompleted = a.status === AppointmentStatus.COMPLETED;
        const isWithin90Days = new Date(a.start_time) >= ninetyDaysAgo;
        return isCompleted && isWithin90Days;
      }).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
    };
  }, [appointments]);

  const currentTabList = filteredAppointments[activeTab] || [];
  const totalPages = Math.ceil(currentTabList.length / ITEMS_PER_PAGE) || 1;

  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTabList.slice(start, start + ITEMS_PER_PAGE);
  }, [currentTabList, currentPage]);

  const validateAppointmentTime = (startTimeVal) => {
    if (!startTimeVal || startTimeVal.endsWith('T') || startTimeVal.startsWith('T')) {
      return 'Vui lòng chọn đầy đủ ngày khám và khung giờ!';
    }

    const startDate = new Date(startTimeVal);
    const now = new Date();

    if (startDate <= now) {
      return 'Không thể đặt/sửa lịch khám cho thời gian đã qua!';
    }

    const diffHours = (startDate - now) / (1000 * 60 * 60);
    if (diffHours < 8) {
      return 'Vui lòng đặt/sửa lịch khám trước thời gian bắt đầu ít nhất 8 tiếng!';
    }

    const hours = startDate.getHours();
    if (hours < 8 || hours >= 17) {
      return 'Vui lòng chọn thời gian trong giờ hành chính (từ 08:00 đến 17:00)!';
    }

    return null;
  };

  const handleStartTimeChange = (startTimeVal) => {
    if (!startTimeVal || startTimeVal.endsWith('T') || startTimeVal.startsWith('T')) {
      setFormData((prev) => ({ ...prev, start_time: startTimeVal, end_time: '' }));
      return;
    }

    const startDate = new Date(startTimeVal);
    if (isNaN(startDate.getTime())) {
      setFormData((prev) => ({ ...prev, start_time: startTimeVal, end_time: '' }));
      return;
    }

    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const formattedEndDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setFormData((prev) => ({
      ...prev,
      start_time: startTimeVal,
      end_time: formattedEndDate,
    }));
  };

const handleCreateAppointment = async (e) => {
    e.preventDefault();

    const timeError = validateAppointmentTime(formData.start_time);
    if (timeError) {
      alert(timeError);
      return;
    }

    // Kiểm tra trùng lặp Client-side
    const conflictResult = checkConflictClientSide(appointments, {
      doctorId: formData.doctor_id,
      chairId: formData.chair_id,
      startTime: new Date(formData.start_time).toISOString(),
      endTime: new Date(formData.end_time).toISOString(),
    });

    if (conflictResult.hasConflict) {
      alert(conflictResult.message);
      return;
    }

    try {
      let finalNote = formData.note;
      if (formData.service_id) {
        const selectedService = services.find((s) => String(s.id) === String(formData.service_id));
        if (selectedService) {
          const serviceLabel = `[Dịch vụ: ${selectedService.name}]`;
          finalNote = finalNote ? `${serviceLabel} ${finalNote}` : serviceLabel;
        }
      }

      const startIso = new Date(formData.start_time).toISOString();
      const endIso = new Date(formData.end_time).toISOString();

      const patientId = currentPatient?.id || parseInt(formData.patient_id);

      const payload = {
        patient_id: patientId,
        doctor_id: parseInt(formData.doctor_id),
        chair_id: parseInt(formData.chair_id),
        start_time: startIso,
        end_time: endIso,
        note: finalNote,
        status: AppointmentStatus.SCHEDULED, // Giữ nguyên trạng thái Chờ xác nhận
      };

      await appointmentApi.create(payload);
      alert('Đăng ký đặt lịch thành công! Vui lòng chờ phòng khám xác nhận.');
      setIsCreateOpen(false);
      fetchData();
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.status === 409;
      const errorMessage = err.response?.data?.detail || err.detail || err.message;

      if (isConflict) {
        alert('Đã có lịch đặt trước tại ghế khám/khung giờ!');
      } else {
        alert(errorMessage || 'Đặt lịch thất bại!');
      }
    }
  };
  
  // Hàm xử lý gọi AI giải thích dịch vụ khi người dùng chọn dịch vụ trong Form đặt lịch mới
	const handleExplainFormService = async (serviceId) => {
	  if (!serviceId) {
		alert('⚠️ Vui lòng chọn dịch vụ trước khi yêu cầu AI giải thích!');
		return;
	  }

	  // Tìm thông tin dịch vụ được chọn từ mảng services
	  const matchedService = services.find((s) => String(s.id) === String(serviceId));

	  if (!matchedService) {
		alert('⚠️ Không tìm thấy thông tin chi tiết của dịch vụ đã chọn!');
		return;
	  }

	  setIsExplainingService(true);

	  try {
		// Gọi API AI (aiApi.js) gửi dữ liệu dịch vụ sang Gemini
		const response = await aiApi.explainService({
		  service_name: matchedService.name,
		  description: matchedService.description || 'Dịch vụ chăm sóc và điều trị nha khoa',
		});

		const resultText = response?.data?.result || response?.result;

		if (resultText) {
		  alert(`🤖 GIẢI THÍCH DỊCH VỤ NHA KHOA (GEMINI AI):\n\n${resultText}`);
		} else {
		  alert('⚠️ Không nhận được phản hồi giải thích từ AI.');
		}
	  } catch (error) {
		console.error('Lỗi khi gọi AI giải thích dịch vụ:', error);
		const detailError = error.response?.data?.detail || 'Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!';
		alert(`❌ Lỗi giải thích dịch vụ: ${detailError}`);
	  } finally {
		setIsExplainingService(false);
	  }
	};

const handleEditSubmit = async (e) => {
    e.preventDefault();

    const timeError = validateAppointmentTime(formData.start_time);
    if (timeError) {
      alert(timeError);
      return;
    }

    // Kiểm tra trùng lặp Client-side
    const conflictResult = checkConflictClientSide(appointments, {
      doctorId: formData.doctor_id,
      chairId: formData.chair_id,
      startTime: new Date(formData.start_time).toISOString(),
      endTime: new Date(formData.end_time).toISOString(),
      excludeAptId: selectedAppointment?.id,
    });

    if (conflictResult.hasConflict) {
      alert(conflictResult.message);
      return;
    }

    try {
      const startIso = new Date(formData.start_time).toISOString();
      const endIso = new Date(formData.end_time).toISOString();

      const payload = {
        doctor_id: parseInt(formData.doctor_id),
        chair_id: parseInt(formData.chair_id),
        start_time: startIso,
        end_time: endIso,
        note: formData.note,
        status: AppointmentStatus.SCHEDULED, // Giữ nguyên trạng thái Chờ xác nhận
      };

      await appointmentApi.update(selectedAppointment.id, payload);
      alert('Cập nhật thay đổi lịch hẹn thành công!');
      setIsEditOpen(false);
      fetchData();
      if (isSearchOpen) handleSearch();
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.status === 409;
      const errorMessage = err.response?.data?.detail || err.detail || err.message;

      if (isConflict) {
        alert('Đã có lịch đặt trước tại ghế khám/khung giờ!');
      } else {
        alert(errorMessage || 'Chỉnh sửa thất bại!');
      }
    }
  };

  const handleSubmitCancel = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    try {
      const updatedNote = selectedAppointment.note
        ? `${selectedAppointment.note} | [Bệnh nhân hủy] ${cancelReason}`
        : `[Bệnh nhân hủy] ${cancelReason}`;

      await appointmentApi.update(selectedAppointment.id, {
        status: AppointmentStatus.CANCELLED,
        note: updatedNote,
      });

      alert('Đã hủy lịch khám thành công!');
      setIsCancelModalOpen(false);
      fetchData();
      if (isSearchOpen) handleSearch();
    } catch (err) {
      console.error(err);
      alert('Hủy lịch khám thất bại!');
    }
  };

  const handleRebook = (apt) => {
    setFormData({
      patient_id: apt.patient_id,
      doctor_id: apt.doctor_id,
      chair_id: apt.chair_id || '',
      service_id: '',
      start_time: '',
      end_time: '',
      note: '',
    });
    setIsCreateOpen(true);
  };

  const handleSearch = () => {
    let filtered = [...appointments];

    if (searchFilters.status) {
      filtered = filtered.filter((a) => a.status === searchFilters.status);
    }
    if (searchFilters.doctor_id) {
      filtered = filtered.filter((a) => a.doctor_id === parseInt(searchFilters.doctor_id));
    }
    if (searchFilters.date) {
      filtered = filtered.filter(
        (a) => new Date(a.start_time).toDateString() === new Date(searchFilters.date).toDateString()
      );
    }

    const now = new Date();
    filtered.sort((a, b) => Math.abs(new Date(a.start_time) - now) - Math.abs(new Date(b.start_time) - now));

    setSearchResults(filtered);
    setHasSearched(true);
  };

  const openEditModal = (apt) => {
    setSelectedAppointment(apt);
    const startDate = new Date(apt.start_time);
    const endDate = new Date(apt.end_time);

    const startIso = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    const endIso = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setFormData({
      patient_id: apt.patient_id,
      doctor_id: apt.doctor_id,
      chair_id: apt.chair_id,
      service_id: '',
      start_time: startIso,
      end_time: endIso,
      note: apt.note || '',
    });
    setIsEditOpen(true);
  };

  const openDetailModal = (apt) => {
    setSelectedAppointment(apt);
	setRating(apt.rating || 5);
	setFeedback(apt.feedback || '');
    setIsDetailOpen(true);
  };
  
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setIsSubmittingFeedback(true);
    try {
      // Gọi API gửi rating và feedback (Dùng API submitFeedback hoặc update)
      await appointmentApi.submitFeedback(selectedAppointment.id, { rating: Number(rating), feedback: feedback });

      alert('⭐ Cảm ơn bạn đã gửi đánh giá và phản hồi!');

      // Cập nhật lại state trực tiếp để UI cập nhật tức thì
      setSelectedAppointment((prev) => ({
        ...prev,
        rating: Number(rating),
        feedback: feedback,
      }));

      // Tải lại danh sách lịch khám để đồng bộ dữ liệu
      fetchData();
    } catch (err) {
      console.error('Lỗi khi gửi đánh giá:', err);
      const errorMessage = err.response?.data?.detail || 'Gửi đánh giá thất bại!';
      alert(`❌ Lỗi: ${errorMessage}`);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const openInvoiceModal = (apt) => {
    const foundInvoice = invoices.find(
      (inv) => inv.medical_record?.appointment_id === apt.id || inv.appointment_id === apt.id || inv.patient_id === apt.patient_id
    );

    setSelectedAppointment(apt);
    setSelectedInvoice(foundInvoice || null);
    setIsInvoiceOpen(true);
  };

  const changeNotifCount = dbChangeNotifs.length + notifications.length;
  const reminderNotifCount = dbReminderNotifs.length + aiReminders.length;

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4 transition-colors">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Quản lý lịch hẹn khám</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi, đăng ký mới và tra cứu lịch sử khám bệnh của bạn.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setFormData({
                patient_id: currentPatient?.id || '',
                doctor_id: '',
                chair_id: '',
                service_id: '',
                start_time: '',
                end_time: '',
                note: '',
              });
              setIsCreateOpen(true);
            }}
            className="flex-1 md:flex-initial px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-sky-600/20"
          >
            ➕ Đặt lịch khám mới
          </button>

          <button
            onClick={() => {
              setIsSearchOpen(true);
              setHasSearched(false);
              setSearchResults([]);
			  setSearchFilters({
				status: '',
				patient_id: '',
				doctor_id: '',
				date: '',
			  });
            }}
            className="flex-1 md:flex-initial px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold rounded-xl text-sm transition-all shadow-md"
          >
            🔍 Tìm kiếm lịch khám
          </button>
        </div>
      </div>

      {/* TABS HEADER & NOTIFICATION TOOLBAR */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            {[
              { id: 'confirmed', label: 'Lịch khám sắp tới', count: filteredAppointments.confirmed.length },
              { id: 'scheduled', label: 'Chờ phòng khám xác nhận', count: filteredAppointments.scheduled.length },
              { id: 'completed', label: 'Lịch sử khám (90 ngày)', count: filteredAppointments.completed.length },
              { id: 'cancelled', label: 'Lịch đã hủy', count: filteredAppointments.cancelled.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.id 
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300' 
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative self-end lg:self-auto">
            <button
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setHasUnreadNotif(false);
              }}
              title="Xem thông báo"
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                hasUnreadNotif
                  ? 'bg-amber-500 text-white border-amber-600 animate-pulse shadow-md shadow-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span>🔔</span>
              <span className="hidden sm:inline">Thông báo</span>
              {hasUnreadNotif && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <span>🔔</span> Thông báo
                  </h4>
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
                  <button
                    onClick={() => setNotifTab('changes')}
                    className={`pb-2 px-2 text-xs font-semibold border-b-2 transition-all ${
                      notifTab === 'changes'
                        ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Thay đổi lịch ({changeNotifCount})
                  </button>
                  <button
                    onClick={() => setNotifTab('reminders')}
                    className={`pb-2 px-2 text-xs font-semibold border-b-2 transition-all ${
                      notifTab === 'reminders'
                        ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Nhắc lịch khám ({reminderNotifCount})
                  </button>
                </div>

                {/* MODAL DANH SÁCH THÔNG BÁO VỚI THANH CUỘN DỌC */}
                <div className="max-h-[380px] overflow-y-auto pr-1.5 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                  {notifTab === 'changes' ? (
                    dbChangeNotifs.length === 0 && notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-400 italic text-center py-4">
                        Chưa có thông báo hoặc thay đổi lịch hẹn nào mới.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dbChangeNotifs.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkAsRead(n)}
                            className={`p-2.5 rounded-xl text-xs space-y-1 transition-all ${
                              n.isRead
                                ? 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 opacity-80'
                                : 'bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 shadow-xs cursor-pointer'
                            }`}
                          >
                            <div className="flex justify-between items-center font-bold text-amber-900 dark:text-amber-300">
                              <span className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-semibold">
                                  CSDL
                                </span>
                                <span>{n.title}</span>
                              </span>
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">
                                {n.time} {n.date && `(${n.date})`}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300">{n.content}</p>
                          </div>
                        ))}

                        {notifications.map((n) => (
                          <div key={n.id} className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between font-bold text-amber-900 dark:text-amber-300">
                              <span>{n.title}</span>
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">{n.time}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="space-y-2.5 py-1">
                      {dbReminderNotifs.length === 0 && aiReminders.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-400 italic text-center py-4">
                          Chưa có thông báo nhắc lịch khám nào.
                        </p>
                      ) : (
                        <>
                          {dbReminderNotifs.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleMarkAsRead(n)}
                              className={`p-2.5 rounded-xl text-xs space-y-1 transition-all ${
                                n.isRead
                                  ? 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 opacity-80'
                                  : 'bg-purple-50/90 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-700/80 shadow-xs cursor-pointer'
                              }`}
                            >
                              <div className="flex justify-between items-center font-bold text-purple-900 dark:text-purple-300">
                                <span className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-semibold">
                                    CSDL
                                  </span>
                                  <span>{n.title}</span>
                                </span>
                                <span className="text-[10px] text-purple-700 dark:text-purple-400 font-normal">
                                  {n.time} {n.date && `(${n.date})`}
                                </span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300">{n.content}</p>
                            </div>
                          ))}

                          {aiReminders.map((rem) => (
                            <div
                              key={rem.id || rem.timestamp}
                              className="p-3 bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs space-y-2 transition-all hover:shadow-sm"
                            >
                              <div className="flex justify-between items-start font-bold text-purple-900 dark:text-purple-300 gap-2">
                                <span className="flex items-center gap-1.5">
                                  <span>✨</span>
                                  <span>{rem.title || 'Nhắc lịch tái khám AI'}</span>
                                </span>
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal shrink-0">
                                  {rem.time || (rem.timestamp ? new Date(rem.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                                </span>
                              </div>

                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                {rem.message || rem.content || rem.note}
                              </p>

                              <div className="flex justify-between items-center pt-1.5 border-t border-purple-200/60 dark:border-purple-800/40">
                                <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                  {rem.doctor_name ? `Bs. ${rem.doctor_name}` : 'Phòng khám Nha khoa'}
                                </span>
                                <button
                                  onClick={() => {
                                    setIsNotifOpen(false);
                                    setFormData({
                                      patient_id: currentPatient?.id || '',
                                      doctor_id: rem.doctor_id || '',
                                      chair_id: '',
                                      service_id: rem.service_id || '',
                                      start_time: '',
                                      end_time: '',
                                      note: rem.suggested_note || `[Tái khám AI] ${rem.title || ''}`,
                                    });
                                    setIsCreateOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs"
                                >
                                  📅 Đặt lịch ngay
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BẢNG DANH SÁCH LỊCH KHÁM */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="p-3">Mã lịch</th>
                <th className="p-3">Bác sĩ phụ trách</th>
                <th className="p-3">Ghế khám</th>
                <th className="p-3">Thời gian khám</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {currentTabList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-8 text-slate-400 dark:text-slate-400">
                    Không tìm thấy lịch hẹn nào trong mục này.
                  </td>
                </tr>
              ) : (
                paginatedAppointments.map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">#{apt.id}</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">{apt.doctor?.full_name || `ID: ${apt.doctor_id}`}</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">{apt.chair?.name || `Ghế ${apt.chair_id}`}</td>
                    <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                      {new Date(apt.start_time).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          apt.status === AppointmentStatus.CONFIRMED
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                            : apt.status === AppointmentStatus.CHECKIN
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                            : apt.status === AppointmentStatus.SCHEDULED
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                            : apt.status === AppointmentStatus.CANCELLED
                            ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                            : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
                        }`}
                      >
                        {formatAppointmentStatus(apt.status)}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openDetailModal(apt)}
                          title="Xem chi tiết"
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                        >
                          ⓘ
                        </button>

                        {activeTab === 'confirmed' && (
                          <button
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setCancelReason('');
                              setIsCancelModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium"
                          >
                            Hủy
                          </button>
                        )}

                        {activeTab === 'scheduled' && (
                          <>
                            <button
                              onClick={() => openEditModal(apt)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setCancelReason('');
                                setIsCancelModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium"
                            >
                              Hủy
                            </button>
                          </>
                        )}

                        {activeTab === 'completed' && (
                          <button
                            onClick={() => openInvoiceModal(apt)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"
                          >
                            Xem hóa đơn
                          </button>
                        )}

                        {activeTab === 'cancelled' && (
                          <button
                            onClick={() => handleRebook(apt)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium"
                          >
                            Đặt lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PHÂN TRANG */}
        {currentTabList.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4 px-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Hiển thị{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.min(currentPage * ITEMS_PER_PAGE, currentTabList.length)}
              </span>{' '}
              trên tổng số{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {currentTabList.length}
              </span>{' '}
              bản ghi
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ◀ Trang trước
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Trang sau ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: TÌM KIẾM LỊCH KHÁM */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">🔍 Tra cứu lịch khám</h3>
              <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Trạng thái lịch</label>
                <select
                  value={searchFilters.status}
                  onChange={(e) => setSearchFilters({ ...searchFilters, status: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                >
                  <option value="">-- Tất cả trạng thái --</option>
                  <option value={AppointmentStatus.SCHEDULED}>Chờ xác nhận</option>
                  <option value={AppointmentStatus.CONFIRMED}>Đã xác nhận</option>
                  <option value={AppointmentStatus.COMPLETED}>Đã hoàn thành</option>
                  <option value={AppointmentStatus.CANCELLED}>Đã hủy</option>
                </select>
              </div>

              <AutocompleteInput
                label="Bác sĩ phụ trách"
                placeholder="Nhập Tên hoặc ID Bác sĩ..."
                options={doctorOptions}
                value={searchFilters.doctor_id}
                onChange={(val) => setSearchFilters({ ...searchFilters, doctor_id: val })}
              />
			  
				<div>
				  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngày khám</label>
				  <input
					type="date"
					value={searchFilters.date}
					onChange={(e) => setSearchFilters({ ...searchFilters, date: e.target.value })}
					className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
				  />
				</div>

              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-all"
                >
                  Tìm kiếm
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border-t border-slate-100 dark:border-slate-700 pt-4">
              {hasSearched && (
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2">Lịch</th>
                      <th className="p-2">Bác sĩ</th>
                      <th className="p-2">Thời gian</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center p-6 text-slate-400 dark:text-slate-400">
                          Không tìm thấy lịch khám phù hợp.
                        </td>
                      </tr>
                    ) : (
                      searchResults.map((apt) => {
                        const isPast = new Date(apt.start_time) <= new Date();

                        return (
                          <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-800 dark:text-slate-200">
                            <td className="p-2 font-bold">#{apt.id}</td>
                            <td className="p-2">{apt.doctor?.full_name || apt.doctor_id}</td>
                            <td className="p-2 text-xs">
                              {new Date(apt.start_time).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {formatAppointmentStatus(apt.status)}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex justify-center items-center gap-1.5">
                                <button
                                  onClick={() => openDetailModal(apt)}
                                  title="Xem chi tiết"
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-xs font-bold transition-all"
                                >
                                  ⓘ
                                </button>

                                {apt.status === AppointmentStatus.SCHEDULED && (
                                  <>
                                    <button
                                      onClick={() => openEditModal(apt)}
                                      disabled={isPast}
                                      title={isPast ? "Không thể chỉnh sửa lịch đã qua" : "Sửa lịch khám"}
                                      className={`px-2.5 py-1 text-xs font-medium rounded text-white transition-all ${
                                        isPast
                                          ? 'bg-amber-400 opacity-50 cursor-not-allowed'
                                          : 'bg-amber-500 hover:bg-amber-600'
                                      }`}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedAppointment(apt);
                                        setCancelReason('');
                                        setIsCancelModalOpen(true);
                                      }}
                                      disabled={isPast}
                                      title={isPast ? "Không thể hủy lịch đã qua" : "Hủy lịch khám"}
                                      className={`px-2.5 py-1 text-xs font-medium rounded text-white transition-all ${
                                        isPast
                                          ? 'bg-rose-400 opacity-50 cursor-not-allowed'
                                          : 'bg-rose-600 hover:bg-rose-700'
                                      }`}
                                    >
                                      Hủy
                                    </button>
                                  </>
                                )}

                                {(apt.status === AppointmentStatus.CONFIRMED || apt.status === AppointmentStatus.CHECKIN) && (
                                  <button
                                    onClick={() => {
                                      setSelectedAppointment(apt);
                                      setCancelReason('');
                                      setIsCancelModalOpen(true);
                                    }}
                                    disabled={isPast || apt.status === AppointmentStatus.CHECKIN}
                                    title={
                                      apt.status === AppointmentStatus.CHECKIN
                                        ? "Không thể hủy lịch đã check-in"
                                        : isPast
                                        ? "Không thể hủy lịch đã qua"
                                        : "Hủy lịch khám"
                                    }
                                    className={`px-2.5 py-1 text-xs font-medium rounded text-white transition-all ${
                                      isPast || apt.status === AppointmentStatus.CHECKIN
                                        ? 'bg-rose-400 opacity-50 cursor-not-allowed'
                                        : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                                  >
                                    Hủy
                                  </button>
                                )}

                                {apt.status === AppointmentStatus.COMPLETED && (
                                  <button
                                    onClick={() => openInvoiceModal(apt)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-all"
                                  >
                                    Xem hóa đơn
                                  </button>
                                )}

                                {apt.status === AppointmentStatus.CANCELLED && (
                                  <button
                                    onClick={() => handleRebook(apt)}
                                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-medium transition-all"
                                  >
                                    Đặt lại
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ĐẶT LỊCH KHÁM MỚI */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-visible max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">➕ Đặt lịch khám mới</h3>
            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <AutocompleteInput
                  label="Bác sĩ phụ trách*"
                  placeholder="Nhập tên hoặc mã ID bác sĩ..."
                  options={doctorOptions}
                  value={formData.doctor_id}
                  onChange={(val) => setFormData({ ...formData, doctor_id: val })}
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ghế khám*</label>
                  <select
                    required
                    value={formData.chair_id}
                    onChange={(e) => setFormData({ ...formData, chair_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    <option value="">-- Chọn ghế --</option>
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

              <div className="space-y-1.5">
				  <div className="flex items-center justify-between">
					<label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
					  Dịch vụ khám*
					</label>
					<button
					  type="button"
					  disabled={isExplainingService || !formData.service_id}
					  onClick={() => handleExplainFormService(formData.service_id)}
					  className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 hover:scale-[1.02]"
					>
					  {isExplainingService ? (
						<>
						  <span className="animate-spin">⏳</span>
						  <span>Đang phân tích...</span>
						</>
					  ) : (
						<>
						  <span>🤖</span>
						  <span>Giải thích dịch vụ bằng AI</span>
						</>
					  )}
					</button>
				  </div>

				  <AutocompleteInput
					placeholder="Tìm và chọn dịch vụ..."
					options={serviceOptions}
					value={formData.service_id}
					onChange={(val) => setFormData({ ...formData, service_id: val })}
					required
				  />
				</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngày khám*</label>
                  <input
                    type="date"
                    required
                    value={formData.start_time ? formData.start_time.split('T')[0] : ''}
                    onChange={(e) => {
                      const dateVal = e.target.value;
                      const timeVal = formData.start_time ? formData.start_time.split('T')[1] : '';
                      if (dateVal && timeVal) {
                        handleStartTimeChange(`${dateVal}T${timeVal}`);
                      } else if (dateVal) {
                        setFormData((prev) => ({ ...prev, start_time: `${dateVal}T` }));
                      } else {
                        setFormData((prev) => ({ ...prev, start_time: '', end_time: '' }));
                      }
                    }}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Khung giờ bắt đầu*</label>
					<select
					  required
					  value={formData.start_time ? formData.start_time.split('T')[1] || '' : ''}
					  onChange={(e) => {
						const timeVal = e.target.value;
						const dateVal = formData.start_time
						  ? formData.start_time.split('T')[0]
						  : new Date().toISOString().slice(0, 10);
						if (timeVal) {
						  handleStartTimeChange(`${dateVal}T${timeVal}`);
						}
					  }}
					  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
					>
					  <option value="">-- Chọn giờ --</option>
					  {TIME_SLOTS.map((slot) => {
						const isBusy = isSlotConflict(slot, false);
						return (
						  <option
							key={slot}
							value={slot}
							disabled={isBusy}
							className={isBusy ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 italic' : ''}
						  >
							{slot} {isBusy ? '(Bác sĩ/Ghế đã có lịch)' : ''}
						  </option>
						);
					  })}
					</select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ghi chú bổ sung</label>
                <textarea
                  rows="2"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  placeholder="Nhập thêm chi tiết triệu chứng hoặc yêu cầu..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-sky-600 text-white rounded-xl hover:bg-sky-700"
                >
                  Xác nhận đặt lịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SỬA THÔNG TIN LỊCH KHÁM */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              ✏️ Sửa lịch khám #{selectedAppointment?.id}
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <AutocompleteInput
                  label="Bác sĩ phụ trách"
                  placeholder="Tìm tên hoặc ID Bác sĩ..."
                  options={doctorOptions}
                  value={formData.doctor_id}
                  onChange={(val) => setFormData({ ...formData, doctor_id: val })}
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ghế khám</label>
                  <select
                    value={formData.chair_id}
                    onChange={(e) => setFormData({ ...formData, chair_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    <option value="">-- Chọn ghế --</option>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngày khám*</label>
                  <input
                    type="date"
                    required
                    value={formData.start_time ? formData.start_time.split('T')[0] : ''}
                    onChange={(e) => {
                      const dateVal = e.target.value;
                      const timeVal = formData.start_time ? formData.start_time.split('T')[1] : '';
                      if (dateVal && timeVal) {
                        handleStartTimeChange(`${dateVal}T${timeVal}`);
                      } else if (dateVal) {
                        setFormData((prev) => ({ ...prev, start_time: `${dateVal}T` }));
                      } else {
                        setFormData((prev) => ({ ...prev, start_time: '', end_time: '' }));
                      }
                    }}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Khung giờ bắt đầu*</label>
					<select
					  required
					  value={formData.start_time ? formData.start_time.split('T')[1] || '' : ''}
					  onChange={(e) => {
						const timeVal = e.target.value;
						const dateVal = formData.start_time
						  ? formData.start_time.split('T')[0]
						  : new Date().toISOString().slice(0, 10);
						if (timeVal) {
						  handleStartTimeChange(`${dateVal}T${timeVal}`);
						}
					  }}
					  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
					>
					  <option value="">-- Chọn giờ --</option>
					  {TIME_SLOTS.map((slot) => {
						const isBusy = isSlotConflict(slot, true);
						return (
						  <option
							key={slot}
							value={slot}
							disabled={isBusy}
							className={isBusy ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 italic' : ''}
						  >
							{slot} {isBusy ? '(Bác sĩ/Ghế đã có lịch)' : ''}
						  </option>
						);
					  })}
					</select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ghi chú</label>
                <textarea
                  rows="2"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HỦY LỊCH */}
      {isCancelModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              ✖ Xác nhận Hủy lịch khám #{selectedAppointment.id}
            </h3>

            <form onSubmit={handleSubmitCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do hủy lịch*
                </label>
                <textarea
                  rows="3"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  placeholder="Vui lòng nhập lý do hủy lịch..."
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
                  className="px-5 py-2 text-sm bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-semibold"
                >
                  Xác nhận Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: XEM CHI TIẾT LỊCH KHÁM */}
      {isDetailOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                📋 Chi tiết Lịch khám #{selectedAppointment.id}
              </h3>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bác sĩ đảm nhận:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAppointment.doctor?.full_name || `ID: ${selectedAppointment.doctor_id}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Ghế khám:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAppointment.chair?.name || `Ghế ${selectedAppointment.chair_id}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Thời gian khám:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(selectedAppointment.start_time).toLocaleString('vi-VN')}
                </span>
              </div>

              {(() => {
                const { servicesText, noteText, cancelReasonText } = parseAppointmentDetails(selectedAppointment, services);
                return (
                  <>
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium block">🩺 Dịch vụ:</span>
                        <button
						  type="button"
						  disabled={isExplainingService}
						  onClick={() => handleExplainService(selectedAppointment)}
						  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 hover:scale-[1.02]"
						>
						  {isExplainingService ? (
							<>
							  <span className="animate-spin">⏳</span>
							  <span>Đang phân tích...</span>
							</>
						  ) : (
							<>
							  <span>🤖</span>
							  <span>Giải thích dịch vụ bằng AI</span>
							</>
						  )}
						</button>
                      </div>
                      <div className="bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-100 dark:border-sky-800/60 text-sky-900 dark:text-sky-300 font-medium">
                        {servicesText}
                      </div>
                    </div>

                    <div className="border-b border-slate-100 dark:border-slate-700 pb-3 space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 font-medium block">📝 Ghi chú lịch khám:</span>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 italic">
                        {noteText}
                      </div>
                    </div>

                    {selectedAppointment.status === AppointmentStatus.CANCELLED && (
                      <div className="border-b border-slate-100 dark:border-slate-700 pb-3 space-y-1">
                        <span className="text-rose-600 dark:text-rose-400 font-medium block">❌ Lý do hủy lịch:</span>
                        <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 italic">
                          {cancelReasonText}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
			
			{/* === THÊM MỤC ĐÁNH GIÁ (RATING 1-5) VÀ FEEDBACK KHI LỊCH KHÁM ĐÃ HOÀN THÀNH === */}
            {selectedAppointment.status === AppointmentStatus.COMPLETED && (
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-2 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
                  ⭐ Đánh giá & Phản hồi dịch vụ
                </h4>

                <form onSubmit={handleSubmitFeedback} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Đánh giá mức độ hài lòng (1 đến 5 điểm):
                    </label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {[5, 4, 3, 2, 1].map((num) => (
                        <option key={num} value={num}>
                          {num} điểm {num === 5 ? '⭐ (Rất tuyệt vời)' : num >= 4 ? '⭐ (Rất hài lòng)' : num >= 2 ? '⭐ (Bình thường)' : '⭐ (Chưa hài lòng)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Nhận xét / Phản hồi chi tiết:
                    </label>
                    <textarea
                      rows="3"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Nhập cảm nhận của bạn về bác sĩ, thái độ phục vụ hoặc kết quả khám..."
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingFeedback ? '⏳ Đang gửi...' : '💾 Lưu đánh giá & Phản hồi'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="flex justify-end pt-2">
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

      {/* MODAL 5: XEM HÓA ĐƠN KHI ĐÃ HOÀN THÀNH LỊCH KHÁM */}
      {isInvoiceOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700 gap-3">
              <div className="flex items-center justify-between flex-1">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {selectedInvoice ? `🧾 Chi tiết Hóa đơn #${selectedInvoice.id}` : `🧾 Chi tiết Hóa đơn`}
                </h3>
                {selectedInvoice && (() => {
                  const status = selectedInvoice.status || selectedInvoice.payment_status || selectedInvoice.paymentStatus;
                  const statusInfo = getInvoiceStatusInfo(status);
                  const label = typeof statusInfo === 'string' ? statusInfo : (statusInfo?.label || statusInfo?.text || status);
                  const badgeClass = typeof statusInfo === 'object' ? (statusInfo?.className || statusInfo?.badgeClass || statusInfo?.color || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300') : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';

                  return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={() => setIsInvoiceOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold pl-2"
              >
                ✕
              </button>
            </div>

            {selectedInvoice ? (
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Khách hàng / Bệnh nhân:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedInvoice.customerName ||
                        selectedInvoice.customer_name ||
                        selectedInvoice.patientName ||
                        selectedInvoice.patient_name ||
                        selectedInvoice.customer?.full_name ||
                        selectedInvoice.patient?.full_name ||
                        selectedAppointment?.patient?.full_name ||
                        'Khách lẻ'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Mã hồ sơ bệnh lý:</span>
                    <span className="font-semibold text-sky-700 dark:text-sky-400">
                      #{selectedInvoice.medical_record_id || selectedInvoice.medicalRecordId || selectedInvoice.record_id || selectedInvoice.recordId || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Mã chương trình giảm giá:</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {selectedInvoice.discount_code || 'Không có'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    Dịch vụ sử dụng trong lượt khám
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5">Dịch vụ</th>
                          <th className="p-2.5 text-center">SL</th>
                          <th className="p-2.5 text-right">Đơn giá</th>
                          <th className="p-2.5 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-200">
                        {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 ? (
                          selectedInvoice.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-medium">
                                {item.service_name ||
                                  item.serviceName ||
                                  item.service?.name ||
                                  item.name ||
                                  item.service_title ||
                                  'Tên dịch vụ không xác định'}
                              </td>
                              <td className="p-2.5 text-center">{item.quantity || 1}</td>
                              <td className="p-2.5 text-right">
                                {Number(item.price || item.unit_price || 0).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="p-2.5 text-right font-bold">
                                {(
                                  Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)
                                ).toLocaleString('vi-VN')}{' '}
                                đ
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="p-3 text-center text-slate-400 dark:text-slate-500 italic">
                              Không có chi tiết từng mục dịch vụ.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Tổng tiền dịch vụ:</span>
                    <span>
                      {Number(selectedInvoice.total_amount || selectedInvoice.totalAmount || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                    <span>Giảm giá / Chiết khấu:</span>
                    <span>
                      -{Number(selectedInvoice.discount_amount || selectedInvoice.discountAmount || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 text-base pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>Tổng thanh toán:</span>
                    <span className="text-sky-700 dark:text-sky-400">
                      {Number(
                        selectedInvoice.final_amount || selectedInvoice.finalAmount || selectedInvoice.total_amount || 0
                      ).toLocaleString('vi-VN')}{' '}
                      đ
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm italic">
                Chưa có thông tin hóa đơn được liên kết với lượt khám này.
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setIsInvoiceOpen(false)}
                className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition"
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