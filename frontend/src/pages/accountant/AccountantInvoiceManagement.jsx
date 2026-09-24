import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import invoiceApi from '../../api/invoiceApi';
import discountProgramsApi from '../../api/discountProgramsApi';
import medicalRecordApi from '../../api/medicalRecordApi';
import { doctorApi } from '../../api/doctorApi';
import appointmentApi from '../../api/appointmentApi';

const ITEMS_PER_PAGE = 10;

function AutocompleteInput({ label, placeholder, options, value, onChange, isIdField = false }) {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = options.filter(
    (opt) =>
      opt.displayText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.title && opt.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (opt.subTitle && opt.subTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(opt.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative">
      {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            onChange(val);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-400 dark:placeholder-slate-500"
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
          {filteredOptions.map((opt, idx) => (
            <li
              key={`${opt.id}-${idx}`}
              onMouseDown={() => {
                const selectedVal = isIdField ? String(opt.id) : opt.displayText;
                onChange(selectedVal);
                setSearchTerm(selectedVal);
                setIsOpen(false);
              }}
              className="p-2.5 hover:bg-sky-50 dark:hover:bg-sky-950/50 cursor-pointer text-sm border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 text-slate-700 dark:text-slate-200 flex justify-between items-center"
            >
              <div>
                {isIdField && (
                  <span className="font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/40 px-1.5 py-0.5 rounded mr-1.5 text-xs">
                    HĐ #{opt.id}
                  </span>
                )}
                <span className="font-medium text-slate-800 dark:text-slate-200">{opt.title}</span>
                {opt.subTitle && (
                  <span className="text-slate-400 dark:text-slate-400 text-xs block mt-0.5">
                    {opt.subTitle}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AccountantInvoiceManagement() {
  const [invoices, setInvoices] = useState([]);
  const [discountPrograms, setDiscountPrograms] = useState([]);
  const [doctorsMap, setDoctorsMap] = useState({});
  const [recordsMap, setRecordsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab & Lọc
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Bộ lọc Tìm kiếm nâng cao Modal
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInvoiceId, setSearchInvoiceId] = useState('');
  const [searchPatient, setSearchPatient] = useState('');
  const [searchDoctor, setSearchDoctor] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);

  // Modal Quản lý Mã Giảm Giá
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [discountForm, setDiscountForm] = useState({
    code: '',
    name: '',
    description: '',
    discount_rate: 0,
    discount_amount: 0,
    is_active: true,
  });
  const [savingDiscount, setSavingDiscount] = useState(false);

  // Modal Xem Thông Tin Hóa Đơn & Lịch Sử Thanh Toán
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal Thanh Toán / Cập nhật Chiết khấu
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Tiền mặt');
  const [selectedDiscountCode, setSelectedDiscountCode] = useState('NONE');
  const [customDiscountRate, setCustomDiscountRate] = useState(0);
  const [customDiscountAmount, setCustomDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [processingPay, setProcessingPay] = useState(false);

  const getInvoicePayments = useCallback((inv) => {
    if (!inv) return [];
    if (Array.isArray(inv.payments)) return inv.payments;
    if (Array.isArray(inv.payment_history)) return inv.payment_history;
    if (Array.isArray(inv.payment_list)) return inv.payment_list;
    if (Array.isArray(inv.payment_transactions)) return inv.payment_transactions;
    return [];
  }, []);

  const getInvoicePaidAmount = useCallback((inv) => {
    if (!inv) return 0;
    const payments = getInvoicePayments(inv);
    const sumFromPayments = payments.reduce(
      (acc, p) => acc + Number(p.amount || p.payment_amount || p.paid_amount || 0),
      0
    );
    return Math.max(Number(inv.paid_amount || 0), sumFromPayments);
  }, [getInvoicePayments]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [resInvoices, resDiscounts, resDoctors, resRecords, resPatients] = await Promise.all([
        invoiceApi.getInvoices().catch(() => []),
        discountProgramsApi.getDiscountPrograms().catch(() => []),
        doctorApi.getAll().catch(() => []),
        medicalRecordApi.getAll().catch(() => []),
        appointmentApi.getPatients().catch(() => []),
      ]);

      const invList = Array.isArray(resInvoices?.data) ? resInvoices.data : Array.isArray(resInvoices) ? resInvoices : [];
      const discList = Array.isArray(resDiscounts?.data) ? resDiscounts.data : Array.isArray(resDiscounts) ? resDiscounts : [];
      
      const docList = Array.isArray(resDoctors?.data)
        ? resDoctors.data
        : Array.isArray(resDoctors)
        ? resDoctors
        : Array.isArray(resDoctors?.doctors)
        ? resDoctors.doctors
        : Array.isArray(resDoctors?.data?.doctors)
        ? resDoctors.data.doctors
        : [];

      const recList = Array.isArray(resRecords?.data) ? resRecords.data : Array.isArray(resRecords) ? resRecords : [];
      const patList = Array.isArray(resPatients?.data) ? resPatients.data : Array.isArray(resPatients) ? resPatients : [];

      setDoctors(docList);
      setPatients(patList);

      const docMap = {};
      docList.forEach((d) => {
        if (d.id) {
          docMap[d.id] = d.full_name || d.name || d.user?.full_name || `Bác sĩ #${d.id}`;
        }
      });

      const recMap = {};
      recList.forEach((r) => {
        if (r.id) {
          recMap[r.id] = r;
        }
      });

      setInvoices(invList);
      setDiscountPrograms(discList);
      setDoctorsMap(docMap);
      setRecordsMap(recMap);
    } catch (err) {
      setError('Không thể tải dữ liệu hóa đơn, bác sĩ hoặc chương trình ưu đãi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const isAnyModalOpen = isSearchOpen || isDiscountModalOpen || isDetailOpen || isPayModalOpen;
  useIdleRefresh(fetchData, 5 * 60 * 1000, isAnyModalOpen);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, isFiltered, searchInvoiceId, searchPatient, searchDoctor, searchDate]);

  const getPatientName = (inv) => {
    return (
      inv.patient?.full_name ||
      inv.patient_name ||
      inv.customerName ||
      inv.customer_name ||
      (inv.patient_id ? `Bệnh nhân #${inv.patient_id}` : 'Khách lẻ')
    );
  };

  const getDoctorName = useCallback((inv) => {
    if (inv.medical_record?.doctor?.full_name) return inv.medical_record.doctor.full_name;
    if (inv.doctor_name) return inv.doctor_name;
    if (inv.doctorName) return inv.doctorName;

    if (inv.doctor_id && doctorsMap[inv.doctor_id]) {
      return doctorsMap[inv.doctor_id];
    }

    const recId = inv.medical_record_id || inv.medical_record?.id;
    if (recId && recordsMap[recId]) {
      const rec = recordsMap[recId];
      if (rec.doctor?.full_name) return rec.doctor.full_name;
      if (rec.doctor_name) return rec.doctor_name;
      if (rec.doctor_id && doctorsMap[rec.doctor_id]) {
        return doctorsMap[rec.doctor_id];
      }
    }

    return 'Bác sĩ phòng khám';
  }, [doctorsMap, recordsMap]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('vi-VN');
  };

  const openDetailModal = async (inv) => {
    setSelectedInvoice(inv);
    setIsDetailOpen(true);
    setLoadingDetail(true);
    try {
      const res = await invoiceApi.getInvoiceById(inv.id);
      const detailedInv = res?.data || res;
      if (detailedInv && typeof detailedInv === 'object') {
        setSelectedInvoice((prev) => ({ ...prev, ...detailedInv }));
      }
    } catch (err) {
      console.error('Không thể lấy chi tiết lượt thanh toán từ server:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openPayModal = async (inv) => {
    let currentInv = inv;
    setLoadingDetail(true);
    try {
      const res = await invoiceApi.getInvoiceById(inv.id);
      const detailed = res?.data || res;
      if (detailed && typeof detailed === 'object') {
        currentInv = { ...inv, ...detailed };
      }
    } catch (err) {
      console.error('Không thể cập nhật thông tin đợt thanh toán trước khi thu tiền:', err);
    } finally {
      setLoadingDetail(false);
    }

    setSelectedInvoice(currentInv);
    const total = Number(currentInv.total_amount || 0);
    const disc = Number(currentInv.discount_amount || 0);
    const rate = Number(currentInv.discount_rate || 0);
    const paid = getInvoicePaidAmount(currentInv);

    setSelectedDiscountCode(currentInv.discount_code || 'NONE');
    setCustomDiscountRate(rate);
    setCustomDiscountAmount(disc);
    setDiscountReason(currentInv.discount_reason || '');

    const remaining = Math.max(0, total - disc - paid);
    setPayAmount(remaining);
    setIsPayModalOpen(true);
  };

  const invoiceOptions = useMemo(() => {
    return invoices.map((inv) => ({
      id: String(inv.id),
      title: `Bệnh nhân: ${getPatientName(inv)}`,
      subTitle: `Bác sĩ: ${getDoctorName(inv)} | Ngày: ${formatDate(inv.created_at || inv.createdAt)}`,
      displayText: String(inv.id),
    }));
  }, [invoices, getDoctorName]);

  const patientOptions = useMemo(() => {
    if (Array.isArray(patients) && patients.length > 0) {
      return patients.map((p) => ({
        id: p.full_name || p.name,
        title: p.full_name || p.name,
        subTitle: `Mã BN: #${p.id} | SĐT: ${p.phone || 'Chưa có'}`,
        displayText: p.full_name || p.name,
      }));
    }
	
    const map = new Map();
    invoices.forEach((inv) => {
      const name = getPatientName(inv);
      if (name && !map.has(name)) {
        const phone = inv.patient?.phone || inv.patient_phone || inv.phone;
        const pId = inv.patient?.id || inv.patient_id;
        const subTitle = phone ? `SĐT: ${phone}` : pId ? `Mã BN: #${pId}` : 'Bệnh nhân phòng khám';
        map.set(name, {
          id: name,
          title: name,
          subTitle: subTitle,
          displayText: name,
        });
      }
    });
    return Array.from(map.values());
  }, [patients, invoices]);

  const doctorOptions = useMemo(() => {
    if (Array.isArray(doctors) && doctors.length > 0) {
      return doctors.map((d) => {
        const name = d.full_name || d.name || d.user?.full_name || `Bác sĩ #${d.id}`;
        const specialty = d.specialty || d.specialization || d.user?.specialty;
        const docId = d.id || d.doctor_id;

        return {
          id: name,
          title: name,
          subTitle: [docId ? `Mã BS: #${docId}` : '', specialty ? `Chuyên khoa: ${specialty}` : ''].filter(Boolean).join(' | '),
          displayText: docId ? `[Mã BS: #${docId}] ${name}` : name,
        };
      });
    }

    const map = new Map();
    invoices.forEach((inv) => {
      const name = getDoctorName(inv);
      if (name && name !== 'Bác sĩ phòng khám' && !map.has(name)) {
        // Lấy thông tin bác sĩ từ hóa đơn hoặc hồ sơ bệnh án liên kết (recordsMap)
        const rec = inv.medical_record_id ? recordsMap[inv.medical_record_id] : inv.medical_record;
        const docObj = inv.doctor || inv.medical_record?.doctor || rec?.doctor;

        const specialty =
          docObj?.specialty ||
          docObj?.specialization ||
          inv.doctor_specialty ||
          inv.specialty;

        const docId =
          docObj?.id ||
          inv.doctor_id ||
          rec?.doctor_id;

        const subTitle = [docId ? `Mã BS: #${docId}` : '', specialty ? `Chuyên khoa: ${specialty}` : ''].filter(Boolean).join(' | ') || 'Bác sĩ phòng khám';

        map.set(name, {
          id: name,
          title: name,
          subTitle: subTitle,
          displayText: docId ? `[Mã BS: #${docId}] ${name}` : name,
        });
      }
    });

    return Array.from(map.values());
  }, [doctors, invoices, getDoctorName, recordsMap]);

  const tabCounts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let all = 0;
    let today = 0;
    let paid = 0;
    let unpaid = 0;

    invoices.forEach((inv) => {
      if (isFiltered) {
        if (searchInvoiceId.trim() && String(inv.id) !== searchInvoiceId.trim()) return;
        if (searchPatient.trim() && !getPatientName(inv).toLowerCase().includes(searchPatient.trim().toLowerCase())) return;
        if (searchDoctor.trim() && !getDoctorName(inv).toLowerCase().includes(searchDoctor.trim().toLowerCase())) return;
        if (searchDate.trim()) {
          const createdAt = new Date(inv.created_at || inv.createdAt || Date.now());
          const invIsoDate = createdAt.toISOString().split('T')[0];
          if (invIsoDate !== searchDate.trim()) return;
        }
      }

      all++;
      const createdAt = new Date(inv.created_at || inv.createdAt || Date.now());
      const total = Number(inv.total_amount || 0);
      const disc = Number(inv.discount_amount || 0);
      const finalAmt = Number(inv.final_amount || total - disc);
      const paidAmt = getInvoicePaidAmount(inv);
      const isPaid = ['paid', 'PAID', 'Đã thanh toán'].includes(inv.status) || (finalAmt > 0 && paidAmt >= finalAmt);

      if (createdAt >= todayStart && createdAt <= todayEnd) today++;
      if (isPaid) paid++;
      else unpaid++;
    });

    return { all, today, paid, unpaid };
  }, [invoices, isFiltered, searchInvoiceId, searchPatient, searchDoctor, searchDate, getDoctorName, getInvoicePaidAmount]);

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return invoices.filter((inv) => {
      const createdAt = new Date(inv.created_at || inv.createdAt || Date.now());
      const total = Number(inv.total_amount || 0);
      const disc = Number(inv.discount_amount || 0);
      const finalAmt = Number(inv.final_amount || total - disc);
      const paidAmt = getInvoicePaidAmount(inv);
      const isPaid = ['paid', 'PAID', 'Đã thanh toán'].includes(inv.status) || (finalAmt > 0 && paidAmt >= finalAmt);
      const isUnpaid = !isPaid;

      if (activeTab === 'today' && (createdAt < todayStart || createdAt > todayEnd)) return false;
      if (activeTab === 'paid' && !isPaid) return false;
      if (activeTab === 'unpaid' && !isUnpaid) return false;

      if (isFiltered) {
        if (searchInvoiceId.trim() && String(inv.id) !== searchInvoiceId.trim()) return false;
        if (searchPatient.trim() && !getPatientName(inv).toLowerCase().includes(searchPatient.trim().toLowerCase())) return false;
        if (searchDoctor.trim() && !getDoctorName(inv).toLowerCase().includes(searchDoctor.trim().toLowerCase())) return false;
        if (searchDate.trim()) {
          const invIsoDate = createdAt.toISOString().split('T')[0];
          if (invIsoDate !== searchDate.trim()) return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
  }, [invoices, activeTab, isFiltered, searchInvoiceId, searchPatient, searchDoctor, searchDate, getDoctorName, getInvoicePaidAmount]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  const handleSaveDiscount = async (e) => {
    e.preventDefault();
    setSavingDiscount(true);
    setError('');
    setSuccessMsg('');

    try {
      if (editingDiscount) {
        await discountProgramsApi.updateDiscountProgram(editingDiscount.id, discountForm);
        setSuccessMsg(`Cập nhật mã giảm giá [${discountForm.code}] thành công!`);
      } else {
        await discountProgramsApi.createDiscountProgram(discountForm);
        setSuccessMsg(`Tạo mới mã giảm giá [${discountForm.code}] thành công!`);
      }
      setIsDiscountModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.detail || 'Lỗi khi lưu thông tin mã giảm giá.');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleToggleDiscountStatus = async (id) => {
    try {
      await discountProgramsApi.toggleDiscountProgramStatus(id);
      setSuccessMsg('Đã chuyển đổi trạng thái chương trình ưu đãi.');
      fetchData();
    } catch (err) {
      setError('Lỗi khi thay đổi trạng thái ưu đãi.');
    }
  };

  const payCalculation = useMemo(() => {
    if (!selectedInvoice) return { total: 0, discRate: 0, discAmt: 0, finalAmt: 0, paid: 0, remaining: 0, paymentCount: 0 };

    const total = Number(selectedInvoice.total_amount || 0);
    const paid = getInvoicePaidAmount(selectedInvoice);
    const payments = getInvoicePayments(selectedInvoice);

    let discRate = 0;
    let discAmt = 0;

    const prog = discountPrograms.find((p) => p.code === selectedDiscountCode);
    if (prog && selectedDiscountCode !== 'NONE') {
      discRate = Number(prog.discount_rate || 0);
      const fixedAmt = Number(prog.discount_amount || 0);
      discAmt = fixedAmt > 0 ? fixedAmt : (total * discRate) / 100;
    } else {
      discRate = customDiscountRate;
      discAmt = customDiscountAmount > 0 ? customDiscountAmount : (total * discRate) / 100;
    }

    if (discAmt > total) discAmt = total;
    const finalAmt = Math.max(0, total - discAmt);
    const remaining = Math.max(0, finalAmt - paid);

    return { total, discRate, discAmt, finalAmt, paid, remaining, paymentCount: payments.length };
  }, [selectedInvoice, selectedDiscountCode, customDiscountRate, customDiscountAmount, discountPrograms, getInvoicePaidAmount, getInvoicePayments]);

  const handleConfirmPay = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessingPay(true);
    setError('');

    try {
      const inputPayNow = Number(payAmount) || 0;
      const payload = {
        add_payment_amount: inputPayNow,
        discount_amount: payCalculation.discAmt,
        discount_rate: payCalculation.discRate,
        discount_code: selectedDiscountCode !== 'NONE' ? selectedDiscountCode : null,
        discount_reason: discountReason || null,
        payment_method: payMethod,
        payment_note: `Thu tiền đợt này: ${inputPayNow.toLocaleString('vi-VN')} đ`,
      };

      await invoiceApi.updateInvoice(selectedInvoice.id, payload);
      setSuccessMsg(`Ghi nhận thanh toán thành công cho hóa đơn #${selectedInvoice.id}`);
      setIsPayModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.detail || 'Lỗi khi lưu thanh toán.');
    } finally {
      setProcessingPay(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & THANH CÔNG CỤ */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Quản lý Hóa đơn & Thanh toán</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ghi nhận thanh toán theo đợt, xem chi tiết lịch sử lượt thanh toán và quản lý mã ưu đãi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setEditingDiscount(null);
              setDiscountForm({ code: '', name: '', description: '', discount_rate: 0, discount_amount: 0, is_active: true });
              setIsDiscountModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center gap-2"
          >
            <span>🎁</span> Quản lý Mã giảm giá
          </button>

          {isFiltered ? (
            <button
              onClick={() => {
                setSearchInvoiceId('');
                setSearchPatient('');
                setSearchDoctor('');
                setSearchDate('');
                setIsFiltered(false);
              }}
              className="px-4 py-2.5 bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold rounded-xl text-sm transition flex items-center gap-1.5"
            >
              <span>✖</span> Hủy tìm kiếm
            </button>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center gap-2"
            >
              <span>🔍</span> Tìm kiếm
            </button>
          )}

          <button
            onClick={fetchData}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition flex items-center gap-2"
          >
            <span>🔄</span> Tải lại
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium">{error}</div>}
      {successMsg && <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-medium">{successMsg}</div>}

      {/* DANH SÁCH HÓA ĐƠN & TABS CÓ BADGE SỐ LƯỢNG */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'today', label: 'Hôm nay' },
              { id: 'paid', label: 'Đã thanh toán' },
              { id: 'unpaid', label: 'Chưa thanh toán / Nợ' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-s font-bold transition flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 text-[12px] rounded-full font-black ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tabCounts[tab.id] || 0}
                </span>
              </button>
            ))}
          </div>

          {isFiltered && (
            <div className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-lg font-medium">
              Đang áp dụng bộ lọc nâng cao
            </div>
          )}
        </div>

        {/* BẢNG HIỂN THỊ HÓA ĐƠN */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm text-left border-collapse min-w-[1080px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs uppercase whitespace-nowrap">
                <th className="p-3 w-16 text-center">Mã HĐ</th>
                <th className="p-3">Bệnh nhân</th>
                <th className="p-3">Bác sĩ phụ trách</th>
                <th className="p-3 text-right">Tổng tiền</th>
                <th className="p-3 text-right">Chiết khấu</th>
                <th className="p-3 text-right">Thực thu</th>
                <th className="p-3 text-right">Đã trả (Lượt TT)</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-center">Ngày tạo</th>
                <th className="p-3 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-slate-400 dark:text-slate-500">Đang tải danh sách hóa đơn...</td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-slate-400 dark:text-slate-500">Không tìm thấy hóa đơn phù hợp.</td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const total = Number(inv.total_amount || 0);
                  const disc = Number(inv.discount_amount || 0);
                  const finalAmt = Number(inv.final_amount || total - disc);
                  const paid = getInvoicePaidAmount(inv);
                  const payments = getInvoicePayments(inv);
                  const isPaid = ['paid', 'PAID', 'Đã thanh toán'].includes(inv.status) || (finalAmt > 0 && paid >= finalAmt);
                  const isPartial = paid > 0 && paid < finalAmt;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors whitespace-nowrap">
                      <td className="p-3 font-bold text-slate-900 dark:text-white text-center">#{inv.id}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{getPatientName(inv)}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{getDoctorName(inv)}</td>
                      <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300">{total.toLocaleString('vi-VN')} đ</td>
                      <td className="p-3 text-right font-medium text-rose-600 dark:text-rose-400">{disc > 0 ? `-${disc.toLocaleString('vi-VN')} đ` : '0 đ'}</td>
                      <td className="p-3 text-right font-bold text-sky-700 dark:text-sky-400">{finalAmt.toLocaleString('vi-VN')} đ</td>
                      <td className="p-3 text-right">
                        <div className="font-semibold text-emerald-700 dark:text-emerald-400">{paid.toLocaleString('vi-VN')} đ</div>
                        {payments.length > 0 && (
                          <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-full inline-block mt-0.5">
                            {payments.length} lượt TT
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 text-xs rounded-full font-bold uppercase ${
                            isPaid
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : isPartial
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {isPaid ? 'Đã thanh toán' : isPartial ? 'Thanh toán 1 phần' : 'Chưa thanh toán'}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">{formatDate(inv.created_at || inv.createdAt)}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => openDetailModal(inv)}
                            className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                            title="Xem chi tiết & lịch sử lượt thanh toán"
                          >
                            <span>ⓘ</span>
                          </button>
                          {!isPaid && (
                            <button
                              onClick={() => openPayModal(inv)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                            >
                              Thanh toán
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
        </div>

        {/* PHÂN TRANG */}
        {filteredInvoices.length > 0 && (
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Trang {currentPage} / {totalPages} (Tổng {filteredInvoices.length} hóa đơn)
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                ◀ Trước
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                Sau ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: TÌM KIẾM NÂNG CAO */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 transition-colors">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">🔍 Tìm kiếm Hóa đơn</h3>
              <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">✕</button>
            </div>

            <div className="space-y-3">
              {/* Mã Hóa đơn Autocomplete */}
              <AutocompleteInput
                label="Mã Hóa đơn"
                placeholder="Nhập hoặc chọn mã HĐ..."
                options={invoiceOptions}
                value={searchInvoiceId}
                onChange={(val) => setSearchInvoiceId(val)}
                isIdField={true}
              />

              {/* Tên Bệnh nhân Autocomplete */}
              <AutocompleteInput
                label="Tên Bệnh nhân"
                placeholder="Nhập tên bệnh nhân..."
                options={patientOptions}
                value={searchPatient}
                onChange={(val) => setSearchPatient(val)}
              />

              {/* Bác sĩ phụ trách Autocomplete */}
              <AutocompleteInput
                label="Bác sĩ phụ trách"
                placeholder="Nhập tên bác sĩ..."
                options={doctorOptions}
                value={searchDoctor}
                onChange={(val) => setSearchDoctor(val)}
              />
			  
			  {/* Ngày lập hóa đơn */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngày lập hóa đơn</label>
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsSearchOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setIsFiltered(true);
                  setIsSearchOpen(false);
                }}
                className="px-5 py-2 text-sm bg-sky-600 text-white rounded-xl font-semibold shadow-md hover:bg-sky-700 transition"
              >
                Áp dụng tìm kiếm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUẢN LÝ MÃ GIẢM GIÁ */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col transition-colors">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">🎁 Quản lý Chương trình Ưu đãi (Mã giảm giá)</h3>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              <form onSubmit={handleSaveDiscount} className="bg-slate-50 dark:bg-slate-700/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {editingDiscount ? 'Cập nhật Chương trình Ưu đãi' : 'Tạo mới Chương trình Ưu đãi'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Mã Ưu đãi*</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: KHUYENMAI2026"
                      value={discountForm.code}
                      onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold uppercase bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Tên chương trình*</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Tri ân khách hàng"
                      value={discountForm.name}
                      onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Tỷ lệ giảm (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountForm.discount_rate}
                      onChange={(e) => setDiscountForm({ ...discountForm, discount_rate: Number(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Số tiền giảm trực tiếp (đ)</label>
                    <input
                      type="number"
                      min="0"
                      value={discountForm.discount_amount}
                      onChange={(e) => setDiscountForm({ ...discountForm, discount_amount: Number(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Mô tả chương trình</label>
                    <input
                      type="text"
                      placeholder="VD: Áp dụng cho bệnh nhân điều trị niềng răng..."
                      value={discountForm.description}
                      onChange={(e) => setDiscountForm({ ...discountForm, description: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {editingDiscount && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDiscount(null);
                        setDiscountForm({ code: '', name: '', description: '', discount_rate: 0, discount_amount: 0, is_active: true });
                      }}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
                    >
                      Hủy sửa
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingDiscount}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
                  >
                    {savingDiscount ? 'Đang lưu...' : editingDiscount ? 'Cập nhật mã' : 'Lưu chương trình'}
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto text-xs">
                <table className="w-full text-left min-w-[650px]">
                  <thead className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    <tr>
                      <th className="p-3 w-32">Mã</th>
                      <th className="p-3">Tên chương trình</th>
                      <th className="p-3 w-32">Mức giảm</th>
                      <th className="p-3 text-center w-28">Trạng thái</th>
                      <th className="p-3 text-center w-52">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {discountPrograms.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-slate-400 dark:text-slate-500">Chưa có mã ưu đãi nào trong hệ thống.</td>
                      </tr>
                    ) : (
                      discountPrograms.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors whitespace-nowrap">
                          <td className="p-3 font-bold text-sky-700 dark:text-sky-400">{item.code}</td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                          <td className="p-3 font-semibold text-rose-600 dark:text-rose-400">
                            {Number(item.discount_rate) > 0 ? `Giảm ${item.discount_rate}%` : `Giảm ${Number(item.discount_amount).toLocaleString('vi-VN')} đ`}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.is_active ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                              {item.is_active ? 'Hoạt động' : 'Đã ngừng'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingDiscount(item);
                                  setDiscountForm({
                                    code: item.code,
                                    name: item.name,
                                    description: item.description || '',
                                    discount_rate: Number(item.discount_rate || 0),
                                    discount_amount: Number(item.discount_amount || 0),
                                    is_active: item.is_active,
                                  });
                                }}
                                className="px-3 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 rounded-lg font-semibold border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition"
                              >
                                Sửa
                              </button>
                              <button
                                onClick={() => handleToggleDiscountStatus(item.id)}
                                className={`px-3 py-1 rounded-lg font-semibold border transition ${
                                  item.is_active
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                                }`}
                              >
                                {item.is_active ? 'Ngừng cung cấp' : 'Kích hoạt lại'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setIsDiscountModalOpen(false)} className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHI TIẾT HÓA ĐƠN & BẢNG LỊCH SỬ CÁC LƯỢT THANH TOÁN */}
      {isDetailOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[88vh] transition-colors">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">🧾 Chi tiết Hóa đơn #{selectedInvoice.id}</h3>
                {loadingDetail && <span className="text-xs text-sky-600 dark:text-sky-400 animate-pulse font-medium">(Đang đồng bộ lượt thanh toán...)</span>}
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-2">
              <div className="bg-slate-50 dark:bg-slate-700/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Bệnh nhân:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{getPatientName(selectedInvoice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Bác sĩ điều trị:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{getDoctorName(selectedInvoice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Mã Hồ sơ bệnh án:</span>
                  <span className="font-semibold text-sky-700 dark:text-sky-400">#{selectedInvoice.medical_record_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Mã ưu đãi áp dụng:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{selectedInvoice.discount_code || 'Không có'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2">Chi tiết Dịch vụ Nha khoa</h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">Dịch vụ</th>
                        <th className="p-2.5 text-center">Số lượng</th>
                        <th className="p-2.5 text-right">Đơn giá</th>
                        <th className="p-2.5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 ? (
                        selectedInvoice.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{item.service?.name || item.name || `Dịch vụ #${item.service_id}`}</td>
                            <td className="p-2.5 text-center text-slate-700 dark:text-slate-300">{item.quantity || 1}</td>
                            <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">{Number(item.unit_price || 0).toLocaleString('vi-VN')} đ</td>
                            <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                              {(Number(item.unit_price || 0) * Number(item.quantity || 1)).toLocaleString('vi-VN')} đ
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4" className="p-3 text-center text-slate-400 dark:text-slate-500 italic">Không có chi tiết từng dịch vụ.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LỊCH SỬ CÁC LƯỢT THANH TOÁN CỦA HÓA ĐƠN */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2 flex items-center justify-between">
                  <span>📜 Lịch sử các đợt / lượt thanh toán</span>
                  <span className="text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 px-2.5 py-0.5 rounded-full">
                    Có {getInvoicePayments(selectedInvoice).length} lượt thanh toán
                  </span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto text-xs bg-white dark:bg-slate-900 shadow-sm">
                  <table className="w-full text-left min-w-[580px]">
                    <thead className="bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 border-b border-sky-100 dark:border-sky-900">
                      <tr>
                        <th className="p-2.5 text-left">Lượt #</th>
                        <th className="p-2.5 text-left">Mã giao dịch</th>
                        <th className="p-2.5 text-left">Thời gian thanh toán</th>
                        <th className="p-2.5 text-right">Số tiền</th>
                        <th className="p-2.5 text-center">Phương thức</th>
                        <th className="p-2.5 text-center">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const paymentsList = getInvoicePayments(selectedInvoice);
                        if (paymentsList.length === 0) {
                          return (
                            <tr>
                              <td colSpan="6" className="p-4 text-center text-slate-400 dark:text-slate-500 italic">Chưa ghi nhận lượt thanh toán nào.</td>
                            </tr>
                          );
                        }
                        return paymentsList.map((p, index) => (
                          <tr key={p.id || index} className="hover:bg-sky-50/40 dark:hover:bg-sky-950/30 transition">
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">Lần {index + 1}</td>
							
                            <td className="p-2.5 font-mono text-xs text-sky-700 dark:text-sky-400 font-semibold">{p.id ? `#PAY-${p.id}` : '-'}</td>
							
                            <td className="p-2.5 text-slate-600 dark:text-slate-300 font-medium">{formatDateTime(p.created_at || p.createdAt || p.payment_date || p.date)}</td>
							
                            <td className="p-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                              +{(Number(p.amount || p.payment_amount || p.paid_amount || 0)).toLocaleString('vi-VN')} đ
                            </td>
							
							<td className="p-2.5 text-center">
							  {(() => {
								const rawMethod = p.payment_method || p.method || '';
								
								// Kiểm tra chuỗi có viết hoa toàn bộ không (đặc trưng của Lễ tân)
								const isUppercase = rawMethod && rawMethod === rawMethod.toUpperCase();
								
								// Xác định role: Nếu không viết hoa toàn bộ HOẶC thông tin API xác nhận là accountant
								const isAccountant =
								  !isUppercase ||
								  p.created_by_role === 'accountant' ||
								  p.source === 'accountant' ||
								  p.role === 'accountant' ||
								  p.created_by?.role === 'accountant' ||
								  p.is_accountant;

								return (
								  <span
									title={isAccountant ? 'Kế toán thanh toán' : 'Lễ tân thanh toán'}
									className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
									  isAccountant
										? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
										: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
									}`}
								  >
									{rawMethod.toUpperCase() || 'Tiền mặt'}
								  </span>
								);
							  })()}
							</td>
							
                            <td className="p-2.5 text-slate-500 dark:text-slate-400 italic">{p.note || p.payment_note || '-'}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TỔNG KẾT TÀI CHÍNH LŨY KẾ */}
              {(() => {
                const totalAmt = Number(selectedInvoice.total_amount || 0);
                const discAmt = Number(selectedInvoice.discount_amount || 0);
                const finalAmt = Number(selectedInvoice.final_amount || (totalAmt - discAmt));
                const paidAmt = getInvoicePaidAmount(selectedInvoice);
                const paymentCount = getInvoicePayments(selectedInvoice).length;
                const remainingAmt = Math.max(0, finalAmt - paidAmt);

                return (
                  <div className="bg-sky-50/70 dark:bg-sky-950/40 p-4 rounded-xl border border-sky-200 dark:border-sky-800 text-xs space-y-1.5 shadow-sm">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Tổng tiền nguyên giá dịch vụ:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{totalAmt.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Giảm giá / Chiết khấu:</span>
                      <span className="font-semibold">-{discAmt.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between text-slate-900 dark:text-white font-bold text-sm pt-1.5 border-t border-sky-200 dark:border-sky-800">
                      <span>Thực thu (Nợ cần thu):</span>
                      <span className="text-sky-800 dark:text-sky-300">{finalAmt.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                      <span>Lũy kế đã thanh toán ({paymentCount} lượt):</span>
                      <span>{paidAmt.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between text-amber-800 dark:text-amber-300 font-bold text-xs pt-1.5 border-t border-sky-200 dark:border-sky-800">
                      <span>Số tiền còn thiếu:</span>
                      <span>{remainingAmt.toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setIsDetailOpen(false)} className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: THU TIỀN VÀ ÁP DỤNG MÃ GIẢM GIÁ */}
      {isPayModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto transition-colors">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              💵 Thu tiền Hóa đơn #{selectedInvoice.id} {payCalculation.paymentCount > 0 ? `(Lần ${payCalculation.paymentCount + 1})` : ''}
            </h3>

            <form onSubmit={handleConfirmPay} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">🏷️ Áp dụng Mã giảm giá trong Bảng Ưu đãi</label>
                <select
                  value={selectedDiscountCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedDiscountCode(code);
                    if (code !== 'NONE') {
                      setCustomDiscountRate(0);
                      setCustomDiscountAmount(0);
                    }
                  }}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="NONE">Không chọn mã ưu đãi</option>
                  {discountPrograms.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.code}>
                      [{p.code}] {p.name} ({Number(p.discount_rate) > 0 ? `Giảm ${p.discount_rate}%` : `Giảm ${Number(p.discount_amount).toLocaleString('vi-VN')} đ`})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Tỷ lệ giảm (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={payCalculation.discRate}
                      disabled={selectedDiscountCode !== 'NONE'}
                      onChange={(e) => setCustomDiscountRate(Number(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Tiền giảm trực tiếp (đ)</label>
                    <input
                      type="number"
                      min="0"
                      value={payCalculation.discAmt}
                      disabled={selectedDiscountCode !== 'NONE'}
                      onChange={(e) => setCustomDiscountAmount(Number(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 font-semibold disabled:bg-slate-100 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Lý do chiết khấu</label>
                  <input
                    type="text"
                    placeholder="Nhập lý do chiết khấu..."
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="bg-sky-50 dark:bg-sky-950/40 p-3 rounded-xl border border-sky-100 dark:border-sky-900 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Tổng nguyên giá:</span>
                  <span className="text-slate-800 dark:text-slate-200">{payCalculation.total.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Chiết khấu giảm giá:</span>
                  <span>-{payCalculation.discAmt.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Đã thanh toán ({payCalculation.paymentCount} đợt trước):</span>
                  <span>{payCalculation.paid.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 dark:text-white text-sm border-t border-sky-200 dark:border-sky-800 pt-1">
                  <span>Số tiền còn nợ:</span>
                  <span className="text-sky-800 dark:text-sky-300">{payCalculation.remaining.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Số tiền thu đợt này (VNĐ)*</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={payCalculation.remaining}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-base font-bold text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Phương thức thanh toán*</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Chuyển khoản">Chuyển khoản / QR Code</option>
                  <option value="Thẻ ATM / Tín dụng">Thẻ ATM / Tín dụng</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={processingPay}
                  className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-md transition"
                >
                  {processingPay ? 'Đang lưu...' : 'Xác nhận thu tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}