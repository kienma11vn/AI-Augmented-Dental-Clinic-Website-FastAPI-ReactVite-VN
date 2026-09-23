import React, { useState, useEffect, useMemo } from 'react';
import appointmentApi from '../../api/appointmentApi';
import medicalRecordApi from '../../api/medicalRecordApi';
import aiApi from '../../api/aiApi';
import notificationApi from '../../api/notificationApi';
import { useLanguage } from '../../context/LanguageContext';
import { useIdleRefresh } from '../../utils/useIdleRefresh';

const AppointmentItem = ({ status }) => {
  const { formatAppointmentStatus } = useLanguage();
  return <span>{formatAppointmentStatus(status)}</span>;
};

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

// Kiểm tra ghế khám có tạm dừng hay không
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
    // Bỏ qua chính lịch hẹn đang chỉnh sửa
    if (excludeAptId && String(apt.id) === String(excludeAptId)) return;
    // Bỏ qua các lịch hẹn đã bị hủy
    if (apt.status === AppointmentStatus.CANCELLED) return;

    const aptStart = new Date(apt.start_time).getTime();
    const aptEnd = new Date(apt.end_time).getTime();

    if (isNaN(aptStart) || isNaN(aptEnd)) return;

    // Hai khoảng thời gian giao nhau khi: (Start_Mới < End_Cũ) VÀ (End_Mới > Start_Cũ)
    const isTimeOverlap = start < aptEnd && end > aptStart;
    if (isTimeOverlap) {
      // Trùng ghế khám (dù cùng hay khác bác sĩ)
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

// Phân tách Dịch vụ, Ghi chú và Lý do hủy từ thông tin lịch khám
const parseAppointmentDetails = (apt, medicalRecords = [], services = []) => {
  if (!apt) return { servicesText: 'Chưa có thông tin dịch vụ', noteText: 'Không có ghi chú.', cancelReasonText: '' };

  let foundServices = [];
  let rawNote = apt.note || '';
  let noteText = rawNote;
  let cancelReasonText = apt.cancel_reason || '';

  // Trích xuất lý do hủy từ ghi chú nếu chưa có cancel_reason riêng
  if (!cancelReasonText && rawNote) {
    const cancelMatch = rawNote.match(/\[([^\]]*hủy)\]\s*(.*)/i);
    if (cancelMatch) {
      const cancelTag = cancelMatch[1].trim();
      const cancelDetail = cancelMatch[2].trim();
      cancelReasonText = cancelDetail ? `${cancelTag}: ${cancelDetail}` : cancelTag;
    }
  }

  // 1. Kiểm tra từ Hồ sơ bệnh lý (nếu có)
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

  // 2. Nếu chưa có từ Hồ sơ bệnh lý, tách từ tag [Dịch vụ: ...] trong ghi chú
  if (foundServices.length === 0 && noteText) {
    const serviceMatch = noteText.match(/\[Dịch vụ:\s*([^\]]+)\]/i);
    if (serviceMatch) {
      foundServices.push(serviceMatch[1].trim());
      noteText = noteText.replace(/\[Dịch vụ:\s*([^\]]+)\]/gi, '').trim();
    }
  }

  // 3. Loại bỏ thông tin hủy lịch khỏi nội dung ghi chú chính
  noteText = noteText.replace(/\|?\s*\[[^\]]*hủy\][\s\S]*/gi, '').trim();
  noteText = noteText.replace(/^\|+|\|+$/g, '').trim();

  return {
    servicesText: foundServices.length > 0 ? foundServices.join(', ') : 'Chưa đăng ký dịch vụ cụ thể',
    noteText: noteText || 'Không có ghi chú.',
    cancelReasonText: cancelReasonText || 'Không có lý do cụ thể (Tự động hủy lịch).',
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
          className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
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
              className="p-2.5 hover:bg-sky-50 dark:hover:bg-sky-950/50 cursor-pointer text-sm border-b border-slate-100 dark:border-slate-700 last:border-b-0 text-slate-700 dark:text-slate-200 flex justify-between items-center"
            >
              <div>
                <span className="font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/40 px-1.5 py-0.5 rounded mr-1.5">
                  ID: #{opt.id}
                </span>
                <span className="font-medium">{opt.title}</span>
                {opt.subTitle && <span className="text-slate-400 dark:text-slate-400 text-xs block mt-0.5">{opt.subTitle}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AppointmentManagement() {
  const { formatAppointmentStatus } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // --- STATE DÀNH CHO TÍNH NĂNG SINH TIN NHẮN TÁI KHÁM AI ---
  const [isAiReminderModalOpen, setIsAiReminderModalOpen] = useState(false);
  const [selectedAptForAi, setSelectedAptForAi] = useState(null);
  const [generatedAiMessage, setGeneratedAiMessage] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  
  const [isExplainingService, setIsExplainingService] = useState(false); // State Giải thích dịch vụ bằng AI

  // Active Tab State (today | completed | upcoming | scheduled | cancelled)
  const [activeTab, setActiveTab] = useState('today');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Filter Droplist States
  const [completedFilter, setCompletedFilter] = useState('30'); // 'today', '7', '30', '90'
  const [upcomingFilter, setUpcomingFilter] = useState('30');   // '7', '30', '90'
  const [cancelledFilter, setCancelledFilter] = useState('30'); // 'today', '7', '30', '90'

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Form & Search States
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    status: '',
    patient_id: '',
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

  // Reset trang về 1 khi chuyển tab hoặc thay đổi bộ lọc thời gian
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, completedFilter, upcomingFilter, cancelledFilter]);

   // Hàm lưu thông báo thay đổi lịch vào CSDL
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
   
  // Lọc thông báo: Chỉ hiển thị những lịch chưa đọc và đã đọc trong vòng 14 ngày, sau 14 ngày tự ẩn
  const visibleNotifications = useMemo(() => {
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return notifications.filter((n) => {
      // Chỉ lấy thông báo thay đổi lịch khám
      if (n.type && n.type !== 'appointment_change') return false;

      // Nếu chưa đọc: luôn hiển thị
      if (!n.is_read) return true;

      // Nếu đã đọc: chỉ hiển thị nếu tạo trong vòng 14 ngày
      const createdTime = new Date(n.created_at || n.time || now).getTime();
      if (isNaN(createdTime)) return true;

      return (now - createdTime) <= FOURTEEN_DAYS_MS;
    });
  }, [notifications]);

  // Kiểm tra có thông báo chưa đọc trong các thông báo hiển thị hay không
  useEffect(() => {
    const unread = visibleNotifications.some((n) => !n.is_read);
    setHasUnreadNotif(unread);
  }, [visibleNotifications]);

  const canCheckIn = (startTimeStr) => {
    if (!startTimeStr) return false;
    const now = new Date();
    const startTime = new Date(startTimeStr);
    const diffMinutes = (startTime - now) / (1000 * 60);
    return diffMinutes <= 10 && diffMinutes >= -45;
  };

  const patientOptions = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    return patients.map((p) => ({
      id: p.id,
      title: p.full_name,
      subTitle: `SĐT: ${p.phone || 'Chưa có'}`,
      displayText: `[ID: ${p.id}] ${p.full_name} (${p.phone || 'N/A'})`,
    }));
  }, [patients]);

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

	// Tải danh sách thông báo từ CSDL bằng Endpoint hỗ trợ sẵn (getMyNotifications)
	  const loadNotificationsFromDB = async () => {
		try {
		  // Thay vì gọi notificationApi.getAll() (Endpoint không tồn tại ở Backend),
		  // Sử dụng Endpoint hỗ trợ sẵn: getMyNotifications()
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

	// Đánh dấu tất cả thông báo hiển thị là đã đọc bằng cách gọi lặp `markAsRead(id)`
	  const handleMarkAllAsRead = async () => {
		const unreadNotifs = visibleNotifications.filter((n) => !n.is_read);
		if (unreadNotifs.length === 0) return;

		try {
		  // Vì Backend không hỗ trợ endpoint /mark-all-read, sử dụng PATCH /{id}/read từng cái
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

  // Mở / Đóng modal thông báo và tự động đánh dấu đã đọc
  const handleToggleNotifications = async () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);

    if (nextState) {
      await handleMarkAllAsRead();
    }
  };

  // Phát hiện và lưu thông báo khi có thay đổi lịch khám
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

            // 1. Thay đổi bệnh nhân
            if (prev.patient_id !== curr.patient_id) {
              const prevPatient = prev.patient?.full_name || `ID: ${prev.patient_id}`;
              const currPatient = curr.patient?.full_name || `ID: ${curr.patient_id}`;
              const title = 'Thay đổi bệnh nhân';
              const content = `Lịch hẹn #${curr.id} đã đổi bệnh nhân từ "${prevPatient}" sang "${currPatient}".`;
              
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

              notificationApi.createNotification({
                patient_id: curr.patient_id,
                appointment_id: curr.id,
                title,
                message: content,
                type: 'appointment_change',
                is_read: false,
              }).catch((e) => console.error('Lỗi khi lưu thông báo thay đổi bệnh nhân:', e));
            }

            // 2. Thay đổi bác sĩ phụ trách
            if (prev.doctor_id !== curr.doctor_id) {
              const prevDoctor = prev.doctor?.full_name || `ID: ${prev.doctor_id}`;
              const currDoctor = curr.doctor?.full_name || `ID: ${curr.doctor_id}`;
              const title = 'Thay đổi bác sĩ phụ trách';
              const content = `Lịch hẹn #${curr.id} đã đổi bác sĩ từ "${prevDoctor}" sang "${currDoctor}".`;
              
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

              notificationApi.createNotification({
                patient_id: curr.patient_id,
                appointment_id: curr.id,
                title,
                message: content,
                type: 'appointment_change',
                is_read: false,
              }).catch((e) => console.error('Lỗi khi lưu thông báo thay đổi bác sĩ:', e));
            }

            // 3. Thay đổi ghế khám
            if (prev.chair_id !== curr.chair_id) {
              const prevChair = prev.chair?.name || `Ghế #${prev.chair_id}`;
              const currChair = curr.chair?.name || `Ghế #${curr.chair_id}`;
              const title = 'Thay đổi ghế khám';
              const content = `Lịch hẹn #${curr.id} đã chuyển từ ${prevChair} sang ${currChair}.`;
              
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

              notificationApi.createNotification({
                patient_id: curr.patient_id,
                appointment_id: curr.id,
                title,
                message: content,
                type: 'appointment_change',
                is_read: false,
              }).catch((e) => console.error('Lỗi khi lưu thông báo thay đổi ghế khám:', e));
            }

            // 4. Thay đổi thời gian khám
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

              const title = 'Thay đổi thời gian khám';
              const content = `Lịch hẹn #${curr.id} đã thay đổi ${timeDetails.join(' và ')}.`;

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

              notificationApi.createNotification({
                patient_id: curr.patient_id,
                appointment_id: curr.id,
                title,
                message: content,
                type: 'appointment_change',
                is_read: false,
              }).catch((e) => console.error('Lỗi khi lưu thông báo thay đổi thời gian:', e));
            }

            // 5. Thay đổi trạng thái lịch khám
            if (prev.status !== curr.status) {
              let msg = `Lịch hẹn #${curr.id} đã chuyển trạng thái từ "${formatAppointmentStatus(prev.status)}" sang "${formatAppointmentStatus(curr.status)}".`;
              if (curr.note && curr.note.includes('[Lễ tân hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Lễ tân hủy với nội dung: ${curr.note.split('[Lễ tân hủy]')[1]?.trim() || ''}`;
              } else if (curr.note && curr.note.includes('[Bệnh nhân hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Bệnh nhân hủy với nội dung: ${curr.note.split('[Bệnh nhân hủy]')[1]?.trim() || ''}`;
              } else if (curr.note && curr.note.includes('[Bác sĩ hủy]')) {
                msg = `Lịch hẹn #${curr.id} đã bị Bác sĩ hủy với nội dung: ${curr.note.split('[Bác sĩ hủy]')[1]?.trim() || ''}`;
              }

              const title = 'Thay đổi trạng thái lịch khám';
              newNotifs.push({
                id: Date.now() + Math.random(),
                aptId: curr.id,
                title,
                content: msg,
                time: currentTimeStr,
                created_at: nowIso,
                is_read: false,
                type: 'appointment_change',
              });

              notificationApi.createNotification({
                patient_id: curr.patient_id,
                appointment_id: curr.id,
                title,
                message: msg,
                type: 'appointment_change',
                is_read: false,
              }).catch((e) => console.error('Lỗi khi lưu thông báo thay đổi trạng thái:', e));
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
  
// Hàm kiểm tra một khung giờ slot có bị trùng lịch hay không
  const isSlotConflict = (slot, isEditMode = false) => {
    const dateVal = formData.start_time ? formData.start_time.split('T')[0] : '';
    if (!dateVal || (!formData.doctor_id && !formData.chair_id)) {
      return false;
    }

    const slotStartIso = new Date(`${dateVal}T${slot}`).toISOString();
    // Quy ước mỗi ca khám kéo dài 60 phút (1 tiếng)
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

      await loadNotificationsFromDB();
      detectAppointmentChanges(rawAppointments);
      await processAutoStatusUpdates(rawAppointments, rawServices);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu:', err);
      setAppointments([]);
      setDoctors([]);
      setChairs([]);
      setPatients([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  	// Kiểm tra có modal nào đang mở không
  const isAnyModalOpen = isCreateOpen || isEditOpen || isCancelModalOpen || isAiReminderModalOpen |isSearchOpen || isDetailOpen;
  useIdleRefresh(fetchData, 3 * 60 * 1000, isAnyModalOpen);

  // Tự động chuyển trạng thái lịch quá hạn
  const processAutoStatusUpdates = async (list, availableServices = services) => {
    const now = new Date();
    const updatedList = [...list];

    for (let item of updatedList) {
      const startTime = new Date(item.start_time);
      const diffMinutes = (now - startTime) / (1000 * 60);

      if (item.status === AppointmentStatus.SCHEDULED && diffMinutes > 0) {
        try {
          await appointmentApi.updateStatus(item.id, AppointmentStatus.CANCELLED);
          item.status = AppointmentStatus.CANCELLED;
        } catch (e) {
          console.error(`Lỗi tự động hủy lịch scheduled quá hạn #${item.id}`, e);
        }
      }

      if (item.status === AppointmentStatus.CONFIRMED && diffMinutes > 45) {
        try {
          await appointmentApi.updateStatus(item.id, AppointmentStatus.CANCELLED);
          item.status = AppointmentStatus.CANCELLED;
        } catch (e) {
          console.error(`Lỗi tự động hủy lịch #${item.id}`, e);
        }
      }

      if (item.status === AppointmentStatus.CHECKIN && diffMinutes > 60) {
        try {
          await appointmentApi.updateStatus(item.id, AppointmentStatus.COMPLETED);
          item.status = AppointmentStatus.COMPLETED;

          try {
            let details = [];
            if (item.note) {
              const serviceMatch = item.note.match(/\[Dịch vụ:\s*([^\]]+)\]/i);
              if (serviceMatch) {
                const serviceName = serviceMatch[1].trim();
                const matchedService = availableServices.find(
                  (s) => s.name.toLowerCase() === serviceName.toLowerCase()
                );
                if (matchedService) {
                  details.push({
                    service_id: matchedService.id,
                    quantity: 1,
                    unit_price: Number(matchedService.unit_price || matchedService.price || 0),
                    note: item.note || '',
                  });
                }
              }
            }

            if (details.length === 0 && availableServices.length > 0) {
              details.push({
                service_id: availableServices[0].id,
                quantity: 1,
                unit_price: Number(availableServices[0].unit_price || availableServices[0].price || 0),
                note: item.note || 'Tự động hoàn thành lượt khám',
              });
            }

            const recordPayload = {
              patient_id: item.patient_id,
              appointment_id: item.id,
              doctor_id: item.doctor_id,
              diagnosis_summary: 'Chẩn đoán tạm thời (Tự động chuyển từ Check-in)',
              treatment_notes: item.note
                ? `Ghi chú ban đầu: ${item.note}`
                : 'Tự động hoàn thành lượt khám sau 60 phút check-in',
              next_appointment_date: null,
              details: details,
            };
            await medicalRecordApi.create(recordPayload);
          } catch (recErr) {
            console.error(`Lỗi tự động tạo hồ sơ bệnh lý cho lịch #${item.id}:`, recErr);
          }
        } catch (e) {
          console.error(`Lỗi tự động hoàn thành lịch #${item.id}`, e);
        }
      }
    }

    setAppointments(updatedList);
  };

  const filteredAppointments = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const getDateRangeStart = (filterType) => {
      if (filterType === 'today') return todayStart;
      const start = new Date();
      const days = parseInt(filterType, 10) || 30;
      start.setDate(now.getDate() - days);
      start.setHours(0, 0, 0, 0);
      return start;
    };

    const getFutureDateRangeEnd = (filterType) => {
      const end = new Date();
      const days = parseInt(filterType, 10) || 30;
      end.setDate(now.getDate() + days);
      end.setHours(23, 59, 59, 999);
      return end;
    };

	const todayApts = appointments.filter((a) => {
      // Cho phép hiển thị cả trạng thái CONFIRMED (Đã xác nhận) và CHECKIN (Đã Check-in)
      const isValidStatus = a.status === AppointmentStatus.CONFIRMED || a.status === AppointmentStatus.CHECKIN;
      if (!isValidStatus) return false;

      const d = new Date(a.start_time);
      return d >= todayStart && d <= todayEnd;
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const completedStart = getDateRangeStart(completedFilter);
    const completedApts = appointments.filter((a) => {
      const isCheckinOrCompleted = a.status === AppointmentStatus.CHECKIN || a.status === AppointmentStatus.COMPLETED;
      if (!isCheckinOrCompleted) return false;
      const d = new Date(a.start_time);
      if (completedFilter === 'today') return d >= todayStart && d <= todayEnd;
      return d >= completedStart && d <= now;
    }).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    const upcomingEnd = getFutureDateRangeEnd(upcomingFilter);
    const upcomingApts = appointments.filter((a) => {
      if (a.status !== AppointmentStatus.CONFIRMED) return false;
      const d = new Date(a.start_time);
      return d > todayEnd && d <= upcomingEnd;
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const scheduledApts = appointments.filter((a) => a.status === AppointmentStatus.SCHEDULED)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const cancelledStart = getDateRangeStart(cancelledFilter);
    const cancelledApts = appointments.filter((a) => {
      if (a.status !== AppointmentStatus.CANCELLED) return false;
      const d = new Date(a.start_time);
      if (cancelledFilter === 'today') return d >= todayStart && d <= todayEnd;
      return d >= cancelledStart;
    }).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    return {
      today: todayApts,
      completed: completedApts,
      upcoming: upcomingApts,
      scheduled: scheduledApts,
      cancelled: cancelledApts,
    };
  }, [appointments, completedFilter, upcomingFilter, cancelledFilter]);

  const currentTabAppointments = filteredAppointments[activeTab] || [];
  const totalPages = Math.ceil(currentTabAppointments.length / ITEMS_PER_PAGE) || 1;

  const paginatedAppointments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTabAppointments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentTabAppointments, currentPage]);

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

  const handleRebook = (apt) => {
    setFormData({
      patient_id: apt.patient_id,
      doctor_id: apt.doctor_id,
      chair_id: '',
      service_id: '',
      start_time: '',
      end_time: '',
      note: '',
    });
    setIsCreateOpen(true);
  };

const handleCreateAppointment = async (e) => {
    e.preventDefault();

    const timeError = validateAppointmentTime(formData.start_time);
    if (timeError) {
      alert(timeError);
      return;
    }
	
    // Kiểm tra trùng lịch hẹn Client-side
    const conflictResult = checkConflictClientSide(appointments, {
      doctorId: formData.doctor_id,
      chairId: formData.chair_id,
      startTime: new Date(formData.start_time).toISOString(),
      endTime: new Date(formData.end_time).toISOString(),
    });
	  
    if (conflictResult.hasConflict) {
      if (conflictResult.isChairBusy) {
        alert('⚠️ Đã có lịch đặt trước tại ghế khám/khung giờ!');
        return;
      }
      if (conflictResult.isDoctorBusy) {
        alert('⚠️ Bác sĩ đã có lịch hẹn khác trong khung giờ này!');
        return;
      }
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

      const payload = {
        patient_id: parseInt(formData.patient_id),
        doctor_id: parseInt(formData.doctor_id),
        chair_id: parseInt(formData.chair_id),
        start_time: startIso,
        end_time: endIso,
        note: finalNote,
        status: AppointmentStatus.CONFIRMED,
      };

      await appointmentApi.create(payload);
      alert('Đặt lịch khám thành công!');
      setIsCreateOpen(false);
      fetchData();
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.status === 409;
      const errorMessage = err.response?.data?.detail || err.detail || err.message;

      if (isConflict) {
        alert('⚠️ Đã có lịch đặt trước tại ghế khám/khung giờ!');
      } else {
        alert(errorMessage || 'Đặt lịch thất bại!');
      }
    }
  };

  const handleSearch = () => {
    let filtered = [...appointments];

    if (searchFilters.status) {
      filtered = filtered.filter((a) => a.status === searchFilters.status);
    }
    if (searchFilters.patient_id) {
      filtered = filtered.filter((a) => a.patient_id === parseInt(searchFilters.patient_id));
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

  const handleUpdateStatus = async (id, newStatus, startTimeStr = null) => {
	  if (newStatus === AppointmentStatus.CHECKIN && startTimeStr) {
		if (!canCheckIn(startTimeStr)) {
		  alert('⚠️ Chưa đến giờ Check-in!');
		  return;
		}
	  }

	  try {
		await appointmentApi.updateStatus(id, newStatus);

		const targetApt = appointments.find((a) => a.id === id);
		if (targetApt) {
		  await saveNotificationToDB({
			patientId: targetApt.patient_id,
			appointmentId: id,
			title: 'Cập nhật trạng thái lịch khám',
			message: `Lịch hẹn #${id} đã chuyển sang trạng thái: ${formatAppointmentStatus(newStatus)}.`,
		  });
		}

		alert(`Đã cập nhật trạng thái lịch hẹn thành: ${formatAppointmentStatus(newStatus)}`);
		fetchData();
	  } catch (err) {
		alert(err.detail || 'Cập nhật trạng thái thất bại');
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
		  ? `${selectedAppointment.note} | [Lễ tân hủy] ${cancelReason}`
		  : `[Lễ tân hủy] ${cancelReason}`;

		await appointmentApi.update(selectedAppointment.id, {
		  status: AppointmentStatus.CANCELLED,
		  note: updatedNote,
		});

		await saveNotificationToDB({
		  patientId: selectedAppointment.patient_id,
		  appointmentId: selectedAppointment.id,
		  title: 'Lịch khám đã bị hủy',
		  message: `Lịch hẹn #${selectedAppointment.id} đã bị hủy. Lý do: ${cancelReason}`,
		});

		alert('Đã hủy lịch khám thành công!');
		setIsCancelModalOpen(false);
		fetchData();
	  } catch (err) {
		console.error(err);
		alert('Hủy lịch khám thất bại!');
	  }
	};

const handleEditSubmit = async (e) => {
    e.preventDefault();
    const timeError = validateAppointmentTime(formData.start_time);
    if (timeError) {
      alert(timeError);
      return;
    }
    
    const conflictResult = checkConflictClientSide(appointments, {
      doctorId: formData.doctor_id,
      chairId: formData.chair_id,
      startTime: new Date(formData.start_time).toISOString(),
      endTime: new Date(formData.end_time).toISOString(),
      excludeAptId: selectedAppointment?.id,
    });
    
    if (conflictResult.hasConflict) {
      if (conflictResult.isChairBusy) {
        alert('⚠️ Đã có lịch đặt trước tại ghế khám/khung giờ!');
        return;
      }
      if (conflictResult.isDoctorBusy) {
        alert('⚠️ Bác sĩ đã có lịch hẹn khác trong khung giờ này!');
        return;
      }
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
      };

      await appointmentApi.update(selectedAppointment.id, payload);

      const notifTitle = 'Thay đổi thông tin lịch khám';
      const notifContent = `Lịch hẹn #${selectedAppointment.id} đã được điều chỉnh thời gian/bác sĩ/ghế khám mới.`;
      await saveNotificationToDB({
        patientId: selectedAppointment.patient_id,
        appointmentId: selectedAppointment.id,
        title: notifTitle,
        message: notifContent,
      });

      alert('Chỉnh sửa lịch hẹn thành công!');
      setIsEditOpen(false);
      fetchData();
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.status === 409;
      const errorMessage = err.response?.data?.detail || err.detail || err.message;

      if (isConflict) {
        alert('⚠️ Đã có lịch đặt trước tại ghế khám/khung giờ!');
      } else {
        alert(errorMessage || 'Chỉnh sửa thất bại!');
      }
    }
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
    setIsDetailOpen(true);
  };

  // --- XỬ LÝ MỞ MODAL VÀ SINH TIN NHẮN TÁI KHÁM AI ---
  const handleOpenAiReminderModal = (apt = null) => {
    if (apt) {
      setSelectedAptForAi(apt);
    } else {
      // Mặc định chọn lịch đầu tiên trong danh sách tái khám / sắp tới
      const available = appointments.filter(
        (a) => a.status === AppointmentStatus.CONFIRMED || a.status === AppointmentStatus.SCHEDULED
      );
      setSelectedAptForAi(available.length > 0 ? available[0] : null);
    }
    setGeneratedAiMessage('');
    setIsAiReminderModalOpen(true);
  };

  const handleGenerateAiReminder = async () => {
    if (!selectedAptForAi) {
      alert('Vui lòng chọn một lịch hẹn tái khám để sinh tin nhắn!');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const patientObj = patients.find((p) => p.id === selectedAptForAi.patient_id);
      const doctorObj = doctors.find((d) => d.id === selectedAptForAi.doctor_id);
      const { servicesText } = parseAppointmentDetails(selectedAptForAi, [], services);

      const patientName = patientObj?.full_name || `Bệnh nhân #${selectedAptForAi.patient_id}`;
      const doctorName = doctorObj?.full_name || `Bác sĩ #${selectedAptForAi.doctor_id}`;
      const formattedTime = new Date(selectedAptForAi.start_time).toLocaleString('vi-VN');

      const payload = {
        patient_name: patientName,
        next_appointment: formattedTime,
        service: servicesText,
      };

      const res = await aiApi.generateReminder(payload);
      const aiText =
        res?.message ||
        res?.data?.message ||
        res?.reminder ||
        (typeof res === 'string' ? res : null);

      if (aiText) {
        setGeneratedAiMessage(aiText);
      } else {
        setGeneratedAiMessage(
          `Kính chào ${patientName},\n` +
          `Phòng khám Nha khoa xin nhắc quý khách về lịch tái khám dịch vụ [${servicesText}] ` +
          `với Bác sĩ ${doctorName} vào lúc ${formattedTime}.\n` +
          `Quý khách vui lòng đến trước 10 phút để chuẩn bị. Trân trọng!`
        );
      }
    } catch (err) {
      console.error('Lỗi khi sinh tin nhắn AI:', err);
      // Fallback khi API chưa sẵn sàng hoặc gặp lỗi
      const patientObj = patients.find((p) => p.id === selectedAptForAi.patient_id);
      const doctorObj = doctors.find((d) => d.id === selectedAptForAi.doctor_id);
      const { servicesText } = parseAppointmentDetails(selectedAptForAi, [], services);
      const patientName = patientObj?.full_name || `Bệnh nhân #${selectedAptForAi.patient_id}`;
      const doctorName = doctorObj?.full_name || `Bác sĩ #${selectedAptForAi.doctor_id}`;
      const formattedTime = new Date(selectedAptForAi.start_time).toLocaleString('vi-VN');

      setGeneratedAiMessage(
        `Kính chào ${patientName},\n` +
        `Phòng khám Nha khoa xin nhắc quý khách về lịch tái khám dịch vụ [${servicesText}] ` +
        `với Bác sĩ ${doctorName} vào lúc ${formattedTime}.\n` +
        `Quý khách vui lòng đến đúng giờ để tiến trình điều trị diễn ra tốt nhất. Trân trọng!`
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSendAiReminder = async () => {
    if (!generatedAiMessage.trim()) {
      alert('Vui lòng sinh hoặc nhập nội dung tin nhắn trước khi gửi!');
      return;
    }
    if (!selectedAptForAi) return;

    setIsSendingNotif(true);
    try {
      const patientObj = patients.find((p) => p.id === selectedAptForAi.patient_id);
      const doctorObj = doctors.find((d) => d.id === selectedAptForAi.doctor_id);
      const { servicesText } = parseAppointmentDetails(selectedAptForAi, [], services);

      // Gọi API lưu thông báo nhắc lịch khám vào backend
      await notificationApi.createNotification({
        patient_id: selectedAptForAi.patient_id,
        appointment_id: selectedAptForAi.id,
        title: 'Nhắc lịch tái khám',
        message: generatedAiMessage,
        type: 'reminder',
        is_read: false,
      });

      const reminderNotif = {
        id: Date.now(),
        appointment_id: selectedAptForAi.id,
        patient_id: selectedAptForAi.patient_id,
        patient_name: patientObj?.full_name || `Bệnh nhân #${selectedAptForAi.patient_id}`,
        doctor_name: doctorObj?.full_name || `Bác sĩ #${selectedAptForAi.doctor_id}`,
        service: servicesText,
        appointment_time: selectedAptForAi.start_time,
        message: generatedAiMessage,
        created_at: new Date().toISOString(),
        is_read: false,
        type: 'reminder', // Tab Nhắc lịch khám của bệnh nhân
      };

      // Lưu tin nhắn vào localStorage để hiển thị đồng bộ bên PatientAppointments.jsx
      const existing = JSON.parse(localStorage.getItem('ai_reminder_notifications') || '[]');
      existing.unshift(reminderNotif);
      localStorage.setItem('ai_reminder_notifications', JSON.stringify(existing));

      // Bắn sự kiện đồng bộ nếu bệnh nhân đang tương tác trên hệ thống
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('ai_reminder_sent', { detail: reminderNotif }));

      alert(`Đã gửi tin nhắn nhắc lịch khám thành công tới bệnh nhân ${reminderNotif.patient_name}!`);
      setIsAiReminderModalOpen(false);
      setGeneratedAiMessage('');
    } catch (err) {
      console.error('Lỗi khi gửi tin nhắn:', err);
      alert('Gửi tin nhắn thất bại, vui lòng thử lại!');
    } finally {
      setIsSendingNotif(false);
    }
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

  return (
    <div className="space-y-6">
      {/* HEADER TỔNG QUAN */}
      <div className="flex flex-col md:flex-row-reverse justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div className="text-left md:text-right">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Quản lý lịch hẹn & Tiếp nhận</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Chức năng hỗ trợ đặt lịch khám, tiếp nhận check-in và tra cứu lượt khám của bệnh nhân.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setFormData({
                patient_id: '',
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

      {/* BANNER TÍNH NĂNG AI - ĐẶT GIỮA HEADER VÀ BẢNG LỊCH KHÁM */}
      <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/90 to-sky-50/90 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-sky-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl shadow-md shadow-indigo-500/20 shrink-0">
            🤖
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Trợ lý AI Tự động Nhắc lịch Tái khám
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                Tính năng AI
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tự động quét danh sách tái khám, soạn nội dung gửi thông báo cá nhân hóa cho bệnh nhân.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAiReminderModal()}
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 hover:scale-[1.01]"
        >
          <span>🤖</span>
          <span>Sinh tin nhắn nhắc lịch khám bằng AI</span>
        </button>
      </div>

      {/* BẢNG TABS & Danh sách */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            {[
              { id: 'today', label: 'Khám hôm nay', count: filteredAppointments.today.length },
              { id: 'completed', label: 'Đã khám', count: filteredAppointments.completed.length },
              { id: 'upcoming', label: 'Sắp tới', count: filteredAppointments.upcoming.length },
              { id: 'scheduled', label: 'Chờ xác nhận', count: filteredAppointments.scheduled.length },
              { id: 'cancelled', label: 'Hủy', count: filteredAppointments.cancelled.length },
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

          <div className="flex items-center gap-3 self-end lg:self-auto w-full lg:w-auto justify-end">
            {activeTab === 'completed' && (
              <select
                value={completedFilter}
                onChange={(e) => setCompletedFilter(e.target.value)}
                className="p-2 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500"
              >
                <option value="today">Hôm nay</option>
                <option value="7">7 ngày qua</option>
                <option value="30">30 ngày qua</option>
                <option value="90">90 ngày qua</option>
              </select>
            )}

            {activeTab === 'upcoming' && (
              <select
                value={upcomingFilter}
                onChange={(e) => setUpcomingFilter(e.target.value)}
                className="p-2 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500"
              >
                <option value="7">7 ngày tới</option>
                <option value="30">30 ngày tới</option>
                <option value="90">90 ngày tới</option>
              </select>
            )}

            {activeTab === 'cancelled' && (
              <select
                value={cancelledFilter}
                onChange={(e) => setCancelledFilter(e.target.value)}
                className="p-2 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500"
              >
                <option value="today">Hôm nay</option>
                <option value="7">7 ngày qua</option>
                <option value="30">30 ngày qua</option>
                <option value="90">90 ngày qua</option>
              </select>
            )}

            <div className="relative">
              <button
                onClick={handleToggleNotifications}
                title="Xem thay đổi lịch khám"
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

              {/* MODAL / DROPDOWN THÔNG BÁO VỚI THANH CUỘN DỌC */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                      <span>🔔</span> Thông báo thay đổi lịch khám
                    </h4>
                    <div className="flex items-center gap-2">
                      {visibleNotifications.some((n) => !n.is_read) && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 font-semibold"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* THÊM THANH CUỘN DỌC THÔNG QUA max-h-72 overflow-y-auto pr-1 */}
                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                    {visibleNotifications.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-400 italic text-center py-4">
                        Chưa có thay đổi lịch hẹn nào mới.
                      </p>
                    ) : (
                      visibleNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                            !n.is_read
                              ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800/80'
                              : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60'
                          }`}
                        >
                          <div className="flex justify-between font-bold text-amber-900 dark:text-amber-300">
                            <span className="flex items-center gap-1.5">
                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" title="Chưa đọc"></span>
                              )}
                              <span>{n.title}</span>
                            </span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal shrink-0">{n.time}</span>
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
        </div>

        {/* NỘI DUNG HIỂN THỊ CỦA BẢNG TƯƠNG ỨNG VỚI TABS */}
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
              {currentTabAppointments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-8 text-slate-400 dark:text-slate-400">
                    Không tìm thấy lịch hẹn nào trong mục này.
                  </td>
                </tr>
              ) : (
                paginatedAppointments.map((apt) => {
                  const eligibleForCheckIn = canCheckIn(apt.start_time);
                  const isCheckInStatus = apt.status === AppointmentStatus.CHECKIN;

                  return (
                    <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">#{apt.id}</td>
                      <td className="p-3 text-slate-800 dark:text-slate-200">{apt.patient?.full_name || `ID: ${apt.patient_id}`}</td>
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
                          {isCheckInStatus ? (
                            <button
                              onClick={() => openDetailModal(apt)}
                              title="Xem chi tiết thông tin lịch khám"
                              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                            >
                              ⓘ
                            </button>
                          ) : (
                            <>
                              {activeTab === 'today' && (
                                <>
                                  <button
                                    onClick={() => openDetailModal(apt)}
                                    title="Xem chi tiết"
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                                  >
                                    ⓘ
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(apt.id, AppointmentStatus.CHECKIN, apt.start_time)}
                                    disabled={!eligibleForCheckIn}
                                    title={!eligibleForCheckIn ? 'Chưa đến giờ Check-in' : 'Sẵn sàng Check-in'}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all ${
                                      eligibleForCheckIn
                                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60'
                                    }`}
                                  >
                                    Check-in
                                  </button>
                                  <button
                                    onClick={() => handleOpenCancelModal(apt)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium"
                                  >
                                    Hủy
                                  </button>
                                </>
                              )}

                              {activeTab === 'completed' && (
                                <button
                                  onClick={() => openDetailModal(apt)}
                                  title="Xem chi tiết"
                                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                                >
                                  ⓘ
                                </button>
                              )}

                              {activeTab === 'upcoming' && (
                                <>
                                  <button
                                    onClick={() => openDetailModal(apt)}
                                    title="Xem chi tiết"
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                                  >
                                    ⓘ
                                  </button>
                                  <button
                                    onClick={() => openEditModal(apt)}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => handleOpenCancelModal(apt)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium"
                                  >
                                    Hủy
                                  </button>
                                </>
                              )}

                              {activeTab === 'scheduled' && (
                                <>
                                  <button
                                    onClick={() => openDetailModal(apt)}
                                    title="Xem chi tiết"
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                                  >
                                    ⓘ
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(apt.id, AppointmentStatus.CONFIRMED)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    onClick={() => openEditModal(apt)}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => handleOpenCancelModal(apt)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium"
                                  >
                                    Hủy
                                  </button>
                                </>
                              )}

                              {activeTab === 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => openDetailModal(apt)}
                                    title="Xem chi tiết"
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                                  >
                                    ⓘ
                                  </button>
                                  <button
                                    onClick={() => handleRebook(apt)}
                                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium"
                                  >
                                    Đặt lại
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* CỤM THANH PHÂN TRANG */}
        {currentTabAppointments.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4 px-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Hiển thị{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.min(currentPage * ITEMS_PER_PAGE, currentTabAppointments.length)}
              </span>{' '}
              trên tổng số{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {currentTabAppointments.length}
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

      {/* MODAL SINH TIN NHẮN NHẮC LỊCH KHÁM AI */}
      {isAiReminderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-base font-bold shadow-md shadow-indigo-500/20">
                  🤖
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Sinh tin nhắn Nhắc lịch tái khám AI
                </h3>
              </div>
              <button
                onClick={() => setIsAiReminderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* BỘ CHỌN LỊCH KHÁM TÁI KHÁM */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Chọn Lịch tái khám/Lịch hẹn cần gửi thông báo
              </label>
              <select
                value={selectedAptForAi?.id || ''}
                onChange={(e) => {
                  const apt = appointments.find((a) => String(a.id) === String(e.target.value));
                  setSelectedAptForAi(apt || null);
                  setGeneratedAiMessage('');
                }}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="">-- Chọn lịch tái khám --</option>
                {appointments
                  .filter(
                    (a) =>
                      a.status === AppointmentStatus.CONFIRMED ||
                      a.status === AppointmentStatus.SCHEDULED
                  )
				  .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                  .map((a) => {
                    const pat = patients.find((p) => p.id === a.patient_id);
                    return (
                      <option key={a.id} value={a.id}>
                        Lịch #{a.id} - Bệnh nhân: {pat?.full_name || `ID: ${a.patient_id}`} - {new Date(a.start_time).toLocaleString('vi-VN')}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* CỤM THÔNG TIN READ-ONLY */}
            {selectedAptForAi ? (
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  📌 Thông tin lịch tái khám (Read-only)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 dark:text-slate-400 font-medium mb-0.5">Bệnh nhân:</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        (() => {
                          const pat = patients.find((p) => p.id === selectedAptForAi.patient_id);
                          return pat
                            ? `${pat.full_name} (${pat.phone || 'SĐT: Chưa có'})`
                            : `ID Bệnh nhân: ${selectedAptForAi.patient_id}`;
                        })()
                      }
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 dark:text-slate-400 font-medium mb-0.5">Bác sĩ phụ trách:</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        (() => {
                          const doc = doctors.find((d) => d.id === selectedAptForAi.doctor_id);
                          return doc ? doc.full_name : `ID Bác sĩ: ${selectedAptForAi.doctor_id}`;
                        })()
                      }
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 dark:text-slate-400 font-medium mb-0.5">Dịch vụ khám:</label>
                    <input
                      type="text"
                      readOnly
                      value={parseAppointmentDetails(selectedAptForAi, [], services).servicesText}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-semibold cursor-not-allowed truncate"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 dark:text-slate-400 font-medium mb-0.5">Ngày & Khung giờ khám:</label>
                    <input
                      type="text"
                      readOnly
                      value={new Date(selectedAptForAi.start_time).toLocaleString('vi-VN')}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-semibold cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
                ⚠️ Vui lòng chọn lịch tái khám để xem thông tin trước khi sinh tin nhắn.
              </div>
            )}

            {/* KHU VỰC SINH VÀ CHỈNH SỬA TIN NHẮN AI */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nội dung tin nhắn nhắc lịch
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiReminder}
                  disabled={!selectedAptForAi || isGeneratingAi}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAi ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Đang tạo nội dung...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Sinh nội dung tin nhắn bằng AI</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                rows="5"
                value={generatedAiMessage}
                onChange={(e) => setGeneratedAiMessage(e.target.value)}
                placeholder="Nhấn nút 'Sinh nội dung tin nhắn bằng AI' ở trên để AI tạo tin nhắn mẫu, hoặc tự gõ chỉnh sửa nội dung tại đây..."
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white leading-relaxed"
              ></textarea>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 italic">
                💡 Lễ tân có thể xem và điều chỉnh nội dung tin nhắn trực tiếp ở trên trước khi bấm gửi tới bệnh nhân.
              </p>
            </div>

            {/* CỤM NÚT THAO TÁC MODAL */}
            <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsAiReminderModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSendAiReminder}
                disabled={!generatedAiMessage.trim() || isSendingNotif}
                className="px-6 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isSendingNotif ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <span>✉️</span>
                    <span>Gửi tin nhắn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỦY LỊCH KHÁM CHO LỄ TÂN */}
      {isCancelModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              ✖ Xác nhận Hủy lịch khám #{selectedAppointment.id}
            </h3>

            <form onSubmit={handleSubmitCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do lễ tân hủy lịch*
                </label>
                <textarea
                  rows="3"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  placeholder="Nhập lý do lễ tân hủy lịch..."
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

      {/* MODAL 1: TÌM KIẾM LỊCH KHÁM */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-7xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">🔍 Tra cứu & Tìm kiếm lịch khám</h3>
              <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Trạng thái lịch</label>
                <select
                  value={searchFilters.status}
                  onChange={(e) => setSearchFilters({ ...searchFilters, status: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                >
                  <option value="">-- Tất cả trạng thái --</option>
                  <option value={AppointmentStatus.SCHEDULED}>Chờ xác nhận (Scheduled)</option>
                  <option value={AppointmentStatus.CONFIRMED}>Đã xác nhận (Confirmed)</option>
                  <option value={AppointmentStatus.CHECKIN}>Đã Check-in (Checkin)</option>
                  <option value={AppointmentStatus.COMPLETED}>Đã hoàn thành (Completed)</option>
                  <option value={AppointmentStatus.CANCELLED}>Đã hủy (Cancelled)</option>
                </select>
              </div>

              <AutocompleteInput
                label="Bệnh nhân"
                placeholder="Nhập Tên, ID hoặc SĐT..."
                options={patientOptions}
                value={searchFilters.patient_id}
                onChange={(val) => setSearchFilters({ ...searchFilters, patient_id: val })}
              />

              <AutocompleteInput
                label="Bác sĩ"
                placeholder="Nhập Tên hoặc ID Bác sĩ..."
                options={doctorOptions}
                value={searchFilters.doctor_id}
                onChange={(val) => setSearchFilters({ ...searchFilters, doctor_id: val })}
              />
			  
			  {/* NGÀY KHÁM */}
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
                      <th className="p-2">Bệnh nhân</th>
                      <th className="p-2">Bác sĩ</th>
                      <th className="p-2">Thời gian</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center p-6 text-slate-400 dark:text-slate-400">
                          Không tìm thấy lịch khám phù hợp.
                        </td>
                      </tr>
                    ) : (
                      searchResults.map((apt) => {
                        const eligibleForCheckIn = canCheckIn(apt.start_time);
                        const isCheckInStatus = apt.status === AppointmentStatus.CHECKIN;
						
						// Kiểm tra ngày khám có phải là ngày hôm nay
						const aptDate = new Date(apt.start_time);
						const today = new Date();
						const isToday =
						  aptDate.getFullYear() === today.getFullYear() &&
						  aptDate.getMonth() === today.getMonth() &&
						  aptDate.getDate() === today.getDate();

						// Điều kiện làm mờ nút Sửa: Trạng thái Confirmed VÀ Ngày khám là hôm nay
						const isEditDisabled = apt.status === AppointmentStatus.CONFIRMED && isToday;

                        return (
                          <tr key={apt.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-800 dark:text-slate-200">
                            <td className="p-2 font-bold">#{apt.id}</td>
                            <td className="p-2">{apt.patient?.full_name || apt.patient_id}</td>
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
                              <div className="flex justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => openDetailModal(apt)}
                                  title="Xem chi tiết"
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-xs font-bold transition-all"
                                >
                                  ⓘ
                                </button>

                                {!isCheckInStatus && (
                                  <>
                                    {apt.status === AppointmentStatus.CONFIRMED && (
                                      <button
                                        onClick={() => handleUpdateStatus(apt.id, AppointmentStatus.CHECKIN, apt.start_time)}
                                        disabled={!eligibleForCheckIn}
                                        title={!eligibleForCheckIn ? 'Chưa đến giờ Check-in' : 'Sẵn sàng Check-in'}
                                        className={`px-2 py-1 text-white rounded text-xs font-medium transition-all ${
                                          eligibleForCheckIn
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60'
                                        }`}
                                      >
                                        Check-in
                                      </button>
                                    )}

                                    {apt.status === AppointmentStatus.SCHEDULED && (
                                      <button
                                        onClick={() => handleUpdateStatus(apt.id, AppointmentStatus.CONFIRMED)}
                                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium"
                                      >
                                        Xác nhận
                                      </button>
                                    )}

                                    {apt.status !== AppointmentStatus.CANCELLED && apt.status !== AppointmentStatus.COMPLETED && (
                                      <>
                                        <button
											onClick={() => openEditModal(apt)}
											disabled={isEditDisabled}
											title={
											  isEditDisabled
												? "Lịch hẹn đã xác nhận trong ngày hôm nay không thể chỉnh sửa"
												: "Chỉnh sửa lịch hẹn"
											}
											className={`px-2 py-1 text-white rounded text-xs font-medium transition-all ${
											  isEditDisabled
												? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60"
												: "bg-amber-500 hover:bg-amber-600"
											}`}
										  >
											Sửa
										  </button>
										
                                        <button
                                          onClick={() => handleOpenCancelModal(apt)}
                                          className="px-2 py-1 bg-rose-600 text-white rounded text-xs font-medium"
                                        >
                                          Hủy
                                        </button>
                                      </>
                                    )}

                                    {apt.status === AppointmentStatus.CANCELLED && (
                                      <button
                                        onClick={() => handleRebook(apt)}
                                        className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-medium transition-all"
                                      >
                                        Đặt lại
                                      </button>
                                    )}
                                  </>
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
              <AutocompleteInput
                label="Bệnh nhân*"
                placeholder="Nhập tên, mã ID hoặc SĐT bệnh nhân..."
                options={patientOptions}
                value={formData.patient_id}
                onChange={(val) => setFormData({ ...formData, patient_id: val })}
                required
              />

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
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Thời gian kết thúc (Trong vòng 1 tiếng)
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={
                    formData.end_time
                      ? `${formData.end_time.split('T')[0]} lúc ${formData.end_time.split('T')[1]}`
                      : ''
                  }
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ghi chú bổ sung</label>
                <textarea
                  rows="2"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  placeholder="Nhập thêm chi tiết triệu chứng hoặc yêu cầu từ bệnh nhân..."
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
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Thời gian kết thúc (Tự động cộng 1 tiếng)
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={
                    formData.end_time
                      ? `${formData.end_time.split('T')[0]} lúc ${formData.end_time.split('T')[1]}`
                      : ''
                  }
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
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
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bệnh nhân:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAppointment.patient?.full_name || `ID: ${selectedAppointment.patient_id}`}
                </span>
              </div>
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
                const { servicesText, noteText, cancelReasonText } = parseAppointmentDetails(selectedAppointment, [], services);
                const isCancelled = selectedAppointment.status === AppointmentStatus.CANCELLED;

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

                    {isCancelled && (
                      <div className="border-b border-slate-100 dark:border-slate-700 pb-3 space-y-1">
                        <span className="text-rose-600 dark:text-rose-400 font-semibold block">⚠️ Lý do hủy lịch:</span>
                        <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 font-medium">
                          {cancelReasonText}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
			  
				{selectedAppointment?.status === AppointmentStatus.COMPLETED && ( 
				 <>
				  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700">
					<h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
					  <span>⭐</span> Đánh giá & Phản hồi từ bệnh nhân
					</h4>

					{selectedAppointment.rating ? (
					  <div className="space-y-2">
						<div className="flex items-center gap-2">
						  <div className="flex text-amber-400 text-base">
							{[1, 2, 3, 4, 5].map((star) => (
							  <span key={star}>{star <= selectedAppointment.rating ? '★' : '☆'}</span>
							))}
						  </div>
						  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
							{selectedAppointment.rating}/5 sao
						  </span>
						</div>
						<div className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200/80 dark:border-slate-600">
						  <p className="italic text-slate-600 dark:text-slate-300">
							"{selectedAppointment.feedback || 'Bệnh nhân không để lại lời nhắn.'}"
						  </p>
						</div>
					  </div>
					) : (
					  <p className="text-xs text-slate-400 dark:text-slate-400 italic">
						Bệnh nhân chưa gửi đánh giá cho lượt khám này.
					  </p>
					)}
				  </div>
				  
				  <div className="border-b border-slate-200 dark:border-slate-700 pt-1"></div>
				 </>
				)}
            </div>

            <div className="flex justify-between items-center pt-2 gap-3">
              {(() => {
                const isAiReminderDisabled = [
                  AppointmentStatus.SCHEDULED,
                  AppointmentStatus.COMPLETED,
                  AppointmentStatus.CHECKIN,
                  AppointmentStatus.CANCELLED,
                ].includes(selectedAppointment.status);

                return (
                  <button
                    type="button"
                    disabled={isAiReminderDisabled}
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenAiReminderModal(selectedAppointment);
                    }}
                    title={
                      isAiReminderDisabled
                        ? 'Chức năng nhắc lịch AI chỉ áp dụng cho lịch đã xác nhận (Confirmed)'
                        : 'Sinh tin nhắn nhắc lịch khám AI'
                    }
                    className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all ${
                      isAiReminderDisabled
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 border border-slate-300 dark:border-slate-600 cursor-not-allowed opacity-60'
                        : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    }`}
                  >
                    🤖 Sinh tin nhắn nhắc lịch khám bằng AI
                  </button>
                );
              })()}
			  
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
    </div>
  );
}