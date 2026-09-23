import React, { useState, useEffect, useMemo } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import invoiceApi from '../../api/invoiceApi';
import medicalRecordApi from '../../api/medicalRecordApi';
import discountProgramsApi from '../../api/discountProgramsApi';

const ITEMS_PER_PAGE = 10;

function RecordAutocompleteInput({ label, placeholder, options, value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(
      (opt) =>
        opt.displayText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(opt.id).includes(searchTerm)
    );
  }, [options, searchTerm]);

  return (
    <div className="relative flex-1">
      {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
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
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              onChange('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <li
              key={opt.id}
              onMouseDown={() => {
                onChange(String(opt.id));
                setSearchTerm(String(opt.id));
                setIsOpen(false);
              }}
              className="p-2.5 hover:bg-sky-50 dark:hover:bg-slate-700/60 cursor-pointer text-sm border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 text-slate-700 dark:text-slate-200"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded mr-2">
                    Mã HS: #{opt.id}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{opt.patientName}</span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">{opt.date}</span>
              </div>
              {opt.subTitle && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.subTitle}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InvoiceManagement() {
  const [invoices, setInvoices] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [discountPrograms, setDiscountPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form tạo hóa đơn từ hồ sơ
  const [recordIdInput, setRecordIdInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Tabs & Filter
  const [activeTab, setActiveTab] = useState('today');
  const [paidFilter, setPaidFilter] = useState('30');
  const [unpaidFilter, setUnpaidFilter] = useState('30');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('TIỀN MẶT');
  const [processingPay, setProcessingPay] = useState(false);

  // Quản lý trạng thái Chiết khấu trong Modal Thanh toán
  const [selectedDiscountId, setSelectedDiscountId] = useState('NONE');
  const [customDiscountRate, setCustomDiscountRate] = useState(0);
  const [customDiscountAmount, setCustomDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [resInvoices, resRecords, resDiscounts] = await Promise.all([
        invoiceApi.getInvoices().catch(() => []),
        medicalRecordApi.getAll ? medicalRecordApi.getAll().catch(() => []) : Promise.resolve([]),
        discountProgramsApi.getDiscountPrograms().catch(() => []),
      ]);

      const invList = Array.isArray(resInvoices?.data) ? resInvoices.data : Array.isArray(resInvoices) ? resInvoices : [];
      const recList = Array.isArray(resRecords?.data) ? resRecords.data : Array.isArray(resRecords) ? resRecords : [];
      const discList = Array.isArray(resDiscounts?.data) ? resDiscounts.data : Array.isArray(resDiscounts) ? resDiscounts : [];

      setInvoices(invList);
      setMedicalRecords(recList);
      setDiscountPrograms(discList);
    } catch (err) {
      setError('Không thể tải dữ liệu hóa đơn hoặc hồ sơ bệnh lý.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
   
  useIdleRefresh(fetchData, 300000);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, paidFilter, unpaidFilter]);

  const uninvoicedRecordOptions = useMemo(() => {
    if (!Array.isArray(medicalRecords)) return [];
    const invoicedRecordIds = new Set(
      invoices
        .map((inv) => String(inv.medical_record_id || inv.medicalRecordId || inv.record_id || inv.recordId || ''))
        .filter(Boolean)
    );

    return medicalRecords
      .filter((rec) => !invoicedRecordIds.has(String(rec.id)))
      .map((rec) => {
        const pName = rec.patient?.full_name || rec.patient_name || `Bệnh nhân #${rec.patient_id || ''}`;
        const dStr = rec.created_at || rec.createdAt ? new Date(rec.created_at || rec.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo';
        const diag = rec.diagnosis_summary || rec.diagnosis || 'Chưa ghi chẩn đoán';
        return {
          id: rec.id,
          patientName: pName,
          date: dStr,
          subTitle: `Chẩn đoán: ${diag}`,
          displayText: `[HS #${rec.id}] ${pName} - ${diag}`,
        };
      });
  }, [medicalRecords, invoices]);

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const getStartDate = (daysStr) => {
      const d = new Date();
      d.setDate(now.getDate() - (parseInt(daysStr, 10) || 30));
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const isPaid = (st) => ['paid', 'PAID', 'Đã thanh toán'].includes(String(st || ''));
    const isUnpaidOrPartial = (st) => !isPaid(st);

    const todayList = invoices
      .filter((inv) => {
        const createdAt = new Date(inv.createdAt || inv.created_at || inv.date || Date.now());
        return createdAt >= todayStart && createdAt <= todayEnd;
      })
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

    const paidStart = getStartDate(paidFilter);
    const paidList = invoices
      .filter((inv) => {
        if (!isPaid(inv.status)) return false;
        const createdAt = new Date(inv.createdAt || inv.created_at || inv.date || Date.now());
        return createdAt >= paidStart && createdAt <= now;
      })
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

    const unpaidStart = getStartDate(unpaidFilter);
    const unpaidList = invoices
      .filter((inv) => {
        if (!isUnpaidOrPartial(inv.status)) return false;
        const createdAt = new Date(inv.createdAt || inv.created_at || inv.date || Date.now());
        return createdAt >= unpaidStart && createdAt <= now;
      })
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

    return { today: todayList, paid: paidList, unpaid: unpaidList };
  }, [invoices, paidFilter, unpaidFilter]);

  const currentTabInvoices = filteredInvoices[activeTab] || [];
  const totalPages = Math.ceil(currentTabInvoices.length / ITEMS_PER_PAGE) || 1;

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTabInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentTabInvoices, currentPage]);

  const handleCreateFromRecord = async (e) => {
    e.preventDefault();
    if (!recordIdInput) {
      setError('Vui lòng chọn hoặc nhập Mã hồ sơ chưa lập hóa đơn.');
      return;
    }

    setCreating(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = { note: noteInput };
      const res = await invoiceApi.createInvoiceFromRecord(recordIdInput, payload);
      const newInvoice = res?.data || res;

      setSuccessMsg(`Đã lập thành công hóa đơn #${newInvoice?.id || ''} cho Hồ sơ #${recordIdInput}!`);
      setRecordIdInput('');
      setNoteInput('');
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.detail || 'Lỗi khi tạo hóa đơn từ hồ sơ.');
    } finally {
      setCreating(false);
    }
  };

  const openPayModal = (inv) => {
    setSelectedInvoice(inv);
    const total = Number(inv.total_amount || inv.totalAmount || 0);
    const currentDiscount = Number(inv.discount_amount || inv.discountAmount || 0);
    const currentRate = Number(inv.discount_rate || inv.discountRate || 0);
    const paid = Number(inv.paid_amount || inv.paidAmount || 0);

    setSelectedDiscountId(inv.discount_code || 'NONE');
    setCustomDiscountRate(currentRate);
    setCustomDiscountAmount(currentDiscount);
    setDiscountReason(inv.discount_reason || '');

    const calculatedFinal = Math.max(0, total - currentDiscount);
    const remaining = Math.max(0, calculatedFinal - paid);

    setPayAmount(remaining);
    setIsPayOpen(true);
  };

  const financialSummary = useMemo(() => {
    if (!selectedInvoice) return { total: 0, discRate: 0, discAmt: 0, finalAmt: 0, paid: 0, remainingAmt: 0 };

    const total = Number(selectedInvoice.total_amount || selectedInvoice.totalAmount || 0);
    const paid = Number(selectedInvoice.paid_amount || selectedInvoice.paidAmount || 0);

    let discRate = 0;
    let discAmt = 0;

    const program = discountPrograms.find((p) => String(p.code || p.id) === String(selectedDiscountId));
    if (program && selectedDiscountId !== 'NONE') {
      discRate = Number(program.discount_rate ?? program.rate ?? 0);
      const fixedAmount = Number(program.discount_amount ?? program.amount ?? 0);
      discAmt = fixedAmount > 0 ? fixedAmount : (total * discRate) / 100;
    } else {
      discRate = customDiscountRate;
      discAmt = customDiscountAmount > 0 ? customDiscountAmount : (total * discRate) / 100;
    }

    if (discAmt > total) discAmt = total;

    const finalAmt = Math.max(0, total - discAmt);
    const remainingAmt = Math.max(0, finalAmt - paid);

    return { total, discRate, discAmt, finalAmt, paid, remainingAmt };
  }, [selectedInvoice, selectedDiscountId, customDiscountRate, customDiscountAmount, discountPrograms]);

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessingPay(true);
    setError('');

    try {
      const inputPaidNow = Number(payAmount) || 0;
      const newTotalPaid = financialSummary.paid + inputPaidNow;

      const payload = {
        paid_amount: newTotalPaid,
        discount_amount: financialSummary.discAmt,
        discount_rate: financialSummary.discRate,
        discount_code: selectedDiscountId !== 'NONE' ? selectedDiscountId : null,
        discount_reason: discountReason || null,
        payment_method: payMethod,
      };

      await invoiceApi.updateInvoice(selectedInvoice.id, payload);

      setSuccessMsg(`Thanh toán hóa đơn #${selectedInvoice.id} thành công!`);
      setIsPayOpen(false);
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.detail || 'Thanh toán thất bại.');
    } finally {
      setProcessingPay(false);
    }
  };

  const getCustomerName = (inv) => {
    const recordId = inv.medical_record_id || inv.medicalRecordId || inv.record_id || inv.recordId;
    return (
      inv.customerName ||
      inv.customer_name ||
      inv.patientName ||
      inv.patient_name ||
      inv.customer?.full_name ||
      inv.patient?.full_name ||
      (recordId ? `Hồ sơ #${recordId}` : 'Khách lẻ')
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Lập hóa đơn & Thanh toán</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gợi ý hồ sơ điều trị chưa thanh toán, áp dụng chiết khấu và ghi nhận thu tiền.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition"
        >
          🔄 Làm mới dữ liệu
        </button>
      </div>

      {error && <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl text-sm font-medium">{error}</div>}
      {successMsg && <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium">{successMsg}</div>}

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>🧾</span> Lập hóa đơn mới từ Hồ sơ bệnh lý
        </h2>
        <form onSubmit={handleCreateFromRecord} className="flex flex-col md:flex-row items-end gap-3">
          <RecordAutocompleteInput
            label="Mã hồ sơ bệnh lý (Chưa xuất HĐ)*"
            placeholder="Nhập mã HS hoặc chọn từ gợi ý..."
            options={uninvoicedRecordOptions}
            value={recordIdInput}
            onChange={(val) => setRecordIdInput(val)}
            disabled={creating}
          />

          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ghi chú bổ sung</label>
            <input
              type="text"
              placeholder="Nhập ghi chú cho hóa đơn..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={creating || !recordIdInput}
            className="w-full md:w-auto px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-lg transition disabled:opacity-50 whitespace-nowrap shadow-sm shadow-sky-600/20"
          >
            {creating ? '⏳ Đang tạo...' : '➕ Tạo hóa đơn'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            {[
              { id: 'today', label: 'Hôm nay', count: filteredInvoices.today.length },
              { id: 'paid', label: 'Đã thanh toán', count: filteredInvoices.paid.length },
              { id: 'unpaid', label: 'Chưa thanh toán', count: filteredInvoices.unpaid.length },
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
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-400' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 self-end lg:self-auto">
            {activeTab === 'paid' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thời gian:</span>
                <select
                  value={paidFilter}
                  onChange={(e) => setPaidFilter(e.target.value)}
                  className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="7">7 ngày qua</option>
                  <option value="30">30 ngày qua</option>
                  <option value="90">90 ngày qua</option>
                </select>
              </div>
            )}

            {activeTab === 'unpaid' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thời gian:</span>
                <select
                  value={unpaidFilter}
                  onChange={(e) => setUnpaidFilter(e.target.value)}
                  className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="7">7 ngày qua</option>
                  <option value="30">30 ngày qua</option>
                  <option value="90">90 ngày qua</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs uppercase">
                <th className="p-3">Mã HĐ</th>
                <th className="p-3">Bệnh nhân / Hồ sơ</th>
                <th className="p-3">Tổng tiền</th>
                <th className="p-3">Chiết khấu</th>
                <th className="p-3">Thực thu / Đã trả</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-8 text-slate-400 dark:text-slate-500">
                    Đang tải danh sách hóa đơn...
                  </td>
                </tr>
              ) : currentTabInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-8 text-slate-400 dark:text-slate-500">
                    Không có hóa đơn nào trong mục này.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const finalAmt = Number(inv.final_amount || inv.finalAmount || inv.total_amount || 0);
                  const discAmt = Number(inv.discount_amount || inv.discountAmount || 0);
                  const paidAmt = Number(inv.paid_amount || inv.paidAmount || (['paid', 'PAID', 'Đã thanh toán'].includes(inv.status) ? finalAmt : 0));
                  const isPaidStatus = ['paid', 'PAID', 'Đã thanh toán'].includes(inv.status);
                  const isPartial = ['partial', 'PARTIAL'].includes(inv.status);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-100">#{inv.id}</td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{getCustomerName(inv)}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{finalAmt.toLocaleString('vi-VN')} đ</td>
                      <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">-{discAmt.toLocaleString('vi-VN')} đ</td>
                      <td className="p-3 font-medium text-emerald-700 dark:text-emerald-400">{paidAmt.toLocaleString('vi-VN')} đ</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 text-xs rounded-full font-bold uppercase ${
                            isPaidStatus ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : isPartial ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {isPaidStatus ? 'Đã thanh toán' : isPartial ? 'Thanh toán 1 phần' : 'Chưa thanh toán'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsDetailOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition"
                          >
                            ⓘ
                          </button>
                          {!isPaidStatus && (
                            <button
                              onClick={() => openPayModal(inv)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
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

        {currentTabInvoices.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 px-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Hiển thị <span className="font-semibold text-slate-700 dark:text-slate-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> -{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.min(currentPage * ITEMS_PER_PAGE, currentTabInvoices.length)}</span> trên tổng số{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{currentTabInvoices.length}</span> hóa đơn
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                ◀ Trang trước
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition ${currentPage === pageNum ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                Trang sau ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CHI TIẾT HÓA ĐƠN */}
      {isDetailOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">🧾 Chi tiết Hóa đơn #{selectedInvoice.id}</h3>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Khách hàng / Bệnh nhân:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{getCustomerName(selectedInvoice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Mã hồ sơ bệnh lý:</span>
                  <span className="font-semibold text-sky-700 dark:text-sky-400">
                    #{selectedInvoice.medical_record_id || selectedInvoice.medicalRecordId || selectedInvoice.record_id || selectedInvoice.recordId || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Mã chương trình giảm giá:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{selectedInvoice.discount_code || 'Không có'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Dịch vụ sử dụng trong lượt khám</h4>
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
                              {item.service_name || item.serviceName || item.service?.name || item.name || item.service_title || 'Tên dịch vụ không xác định'}
                            </td>
                            <td className="p-2.5 text-center">{item.quantity || 1}</td>
                            <td className="p-2.5 text-right">{Number(item.price || item.unit_price || 0).toLocaleString('vi-VN')} đ</td>
                            <td className="p-2.5 text-right font-bold">
                              {(Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)).toLocaleString('vi-VN')} đ
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
                  <span>{Number(selectedInvoice.total_amount || selectedInvoice.totalAmount || 0).toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                  <span>Giảm giá / Chiết khấu:</span>
                  <span>-{Number(selectedInvoice.discount_amount || selectedInvoice.discountAmount || 0).toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 text-base pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Tổng thanh toán:</span>
                  <span className="text-sky-700 dark:text-sky-400">{Number(selectedInvoice.final_amount || selectedInvoice.finalAmount || 0).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setIsDetailOpen(false)} className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-semibold">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: THU TIỀN VÀ ÁP DỤNG CHIẾT KHẤU */}
      {isPayOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">💵 Ghi nhận thanh toán Hóa đơn #{selectedInvoice.id}</h3>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">🏷️ Áp dụng chương trình Chiết khấu / Khuyến mãi</label>
                <select
                  value={selectedDiscountId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedDiscountId(id);
                    if (id !== 'NONE') {
                      setCustomDiscountRate(0);
                      setCustomDiscountAmount(0);
                    }
                  }}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="NONE">Không áp dụng chiết khấu</option>
                  {discountPrograms.map((prog) => {
                    const code = prog.code || String(prog.id);
                    const rate = Number(prog.discount_rate ?? prog.rate ?? 0);
                    const amt = Number(prog.discount_amount ?? prog.amount ?? 0);
                    const detailLabel = rate > 0 ? `Giảm ${rate}%` : `Giảm ${amt.toLocaleString('vi-VN')} đ`;
                    return (
                      <option key={prog.id || code} value={code}>
                        {prog.name} ({detailLabel})
                      </option>
                    );
                  })}
                </select>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Tỷ lệ giảm (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={financialSummary.discRate}
                      disabled={selectedDiscountId !== 'NONE'}
                      onChange={(e) => setCustomDiscountRate(Number(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/80 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Số tiền giảm trực tiếp (đ)</label>
                    <input
                      type="number"
                      min="0"
                      value={financialSummary.discAmt}
                      disabled={selectedDiscountId !== 'NONE'}
                      onChange={(e) => setCustomDiscountAmount(Number(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800/80 font-semibold text-rose-600 dark:text-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Lý do chiết khấu</label>
                  <input
                    type="text"
                    placeholder="Nhập lý do chiết khấu (nếu có)..."
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="bg-sky-50/60 dark:bg-sky-950/30 p-3 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Tổng nguyên giá:</span>
                  <span className="font-semibold">{financialSummary.total.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Chiết khấu giảm giá:</span>
                  <span className="font-semibold">-{financialSummary.discAmt.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-slate-800 dark:text-slate-100 font-bold text-sm pt-1 border-t border-sky-200 dark:border-sky-800">
                  <span>Tổng tiền sau chiết khấu:</span>
                  <span className="text-sky-800 dark:text-sky-300">{financialSummary.finalAmt.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Đã thanh toán trước đó:</span>
                  <span>{financialSummary.paid.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-amber-800 dark:text-amber-400 font-bold">
                  <span>Còn nợ chưa thu:</span>
                  <span>{financialSummary.remainingAmt.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Số tiền thu đợt này (VNĐ)*</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={financialSummary.remainingAmt > 0 ? financialSummary.remainingAmt : financialSummary.finalAmt}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-bold text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Hình thức thanh toán*</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  <option value="TIỀN MẶT">Tiền mặt</option>
                  <option value="CHUYỂN KHOẢN">Chuyển khoản / QR Code</option>
                  <option value="THẺ ATM / TÍN DỤNG">Thẻ ATM / Thẻ tín dụng</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={processingPay}
                  className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-md shadow-emerald-600/20"
                >
                  {processingPay ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}