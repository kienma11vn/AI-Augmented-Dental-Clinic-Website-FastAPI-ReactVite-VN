import React, { useState, useEffect, useMemo } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import medicalRecordApi from '../../api/medicalRecordApi';
import invoiceApi from '../../api/invoiceApi';
import aiApi from '../../api/aiApi';

const ITEMS_PER_PAGE = 10;

export default function PatientTreatmentHistory() {
  const [records, setRecords] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab state: '14days' (Đang theo dõi) | '90days' (Đã khám)
  const [activeTab, setActiveTab] = useState('14days');

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Modal detail state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // AI Loading state
  const [aiLoading, setAiLoading] = useState(false);

  // Reset trang về 1 khi chuyển tab hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Fetch dữ liệu hồ sơ điều trị & hóa đơn của bệnh nhân
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recordsRes, invoicesRes] = await Promise.all([
        medicalRecordApi.getAll(),
        invoiceApi.getInvoices(),
      ]);

      setRecords(recordsRes.data || recordsRes || []);
      setInvoices(invoicesRes.data || invoicesRes || []);
    } catch (err) {
      console.error('Lỗi tải lịch sử điều trị:', err);
      setError('Không thể tải dữ liệu lịch sử điều trị. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useIdleRefresh(fetchData, 5 * 60 * 1000, isDetailOpen);

  // Ánh xạ hóa đơn theo mã hồ sơ bệnh lý để tra cứu nhanh
  const invoiceMap = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const recordId = inv.medical_record_id || inv.medicalRecordId || inv.record_id || inv.recordId;
      if (recordId) {
        map[recordId] = inv;
      }
    });
    return map;
  }, [invoices]);

  // Phân loại hồ sơ theo 2 mốc thời gian: 14 ngày & các hồ sơ còn lại trong 90 ngày
  const { records14Days, records90Days } = useMemo(() => {
    const now = new Date();

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const list14 = [];
    const list90 = [];

    records.forEach((rec) => {
      if (!rec.created_at) return;
      const recDate = new Date(rec.created_at);

      // 14 ngày gần đây (Đang theo dõi)
      if (recDate >= fourteenDaysAgo && recDate <= now) {
        list14.push(rec);
      } 
      // Các hồ sơ còn lại trong vòng 90 ngày (Đã khám)
      else if (recDate >= ninetyDaysAgo && recDate < fourteenDaysAgo) {
        list90.push(rec);
      }
    });

    return { records14Days: list14, records90Days: list90 };
  }, [records]);

  // Lọc danh sách theo Tab đang chọn & Từ khóa tìm kiếm
  const currentTabRecords = useMemo(() => {
    const source = activeTab === '14days' ? records14Days : records90Days;

    if (!searchTerm.trim()) return source;

    const term = searchTerm.toLowerCase();
    return source.filter((rec) => {
      const doctorName = rec.doctor?.full_name?.toLowerCase() || '';
      const diagnosis = rec.diagnosis_summary?.toLowerCase() || '';
      const recId = String(rec.id);
      const services = rec.details?.map((d) => d.service?.name?.toLowerCase() || '').join(' ') || '';

      return (
        doctorName.includes(term) ||
        diagnosis.includes(term) ||
        recId.includes(term) ||
        services.includes(term)
      );
    });
  }, [activeTab, records14Days, records90Days, searchTerm]);

  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(currentTabRecords.length / ITEMS_PER_PAGE) || 1;

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTabRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [currentTabRecords, currentPage]);

  // Mở modal Chi tiết
  const handleOpenDetail = (record) => {
    setSelectedRecord(record);
    setIsDetailOpen(true);
  };

  // Hàm sinh / cập nhật tóm tắt AI thông qua aiApi
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
      const detailMsg = err.response?.data?.detail || 'Không thể tạo tóm tắt AI. Vui lòng thử lại!';
      alert(detailMsg);
    } finally {
      setAiLoading(false);
    }
  };

  // Format tiền VNĐ
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  // Format ngày giờ
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

  // Badge hiển thị trạng thái hóa đơn
  const renderInvoiceStatusBadge = (status) => {
    const normalizedStatus = String(status || '').toLowerCase();

    if (['paid', 'đã thanh toán'].includes(normalizedStatus)) {
      return (
        <span className="px-1.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
          Đã thanh toán
        </span>
      );
    }

    if (['partial', 'thanh toán 1 phần'].includes(normalizedStatus)) {
      return (
        <span className="px-1.5 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
          Thanh toán 1 phần
        </span>
      );
    }

    return (
      <span className="px-1.5 py-1 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300">
        Chưa thanh toán
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>🩺</span> Lịch sử điều trị của tôi
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tra cứu thông tin hồ sơ bệnh án, ghi chú điều trị và hóa đơn thanh toán dịch vụ.
          </p>
        </div>

        {/* Tìm kiếm */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Tìm tên bác sĩ, chẩn đoán, mã HS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 text-sm">🔍</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-3 rounded-t-2xl shadow-sm">
        <button
          onClick={() => setActiveTab('14days')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
            activeTab === '14days'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30 rounded-t-xl font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span>⏱️ Đang theo dõi (14 ngày)</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-bold ${
              activeTab === '14days' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {records14Days.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('90days')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all ${
            activeTab === '90days'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30 rounded-t-xl font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span>📁 Đã khám (90 ngày)</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-bold ${
              activeTab === '90days' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {records90Days.length}
          </span>
        </button>
      </div>

      {/* Danh sách Hồ sơ điều trị */}
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
              onClick={fetchData}
              className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all"
            >
              Thử lại
            </button>
          </div>
        ) : currentTabRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <span className="text-4xl block mb-2">📭</span>
            <p>Không có hồ sơ điều trị nào trong khoảng thời gian này.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Mã HS</th>
                    <th className="p-4 font-semibold">Ngày khám</th>
                    <th className="p-4 font-semibold">Bác sĩ phụ trách</th>
                    <th className="p-4 font-semibold">Chẩn đoán / Mô tả</th>
                    <th className="p-4 font-semibold">Trạng thái Hóa đơn</th>
                    <th className="p-4 font-semibold">Lịch hẹn tái khám</th>
                    <th className="p-4 font-semibold text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                  {paginatedRecords.map((record) => {
                    const invoice = invoiceMap[record.id];
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="p-4 font-semibold text-sky-700 dark:text-sky-400">#{record.id}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{formatDate(record.created_at)}</td>
                        <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                          {record.doctor?.full_name || 'Bác sĩ phòng khám'}
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                          {record.diagnosis_summary || 'Chưa ghi nhận'}
                        </td>
                        <td className="p-4">
                          {invoice ? (
                            renderInvoiceStatusBadge(invoice.status)
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa phát hành</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {record.next_appointment_date ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 px-2 py-1 rounded-md font-medium">
                              📅 {formatDate(record.next_appointment_date)}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-xs">Không có</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleOpenDetail(record)}
                            title="Xem chi tiết hồ sơ & hóa đơn"
                            className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-600 dark:hover:bg-sky-600 hover:text-white dark:hover:text-white font-bold flex items-center justify-center transition-all mx-auto shadow-sm"
                          >
                            ⓘ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* THANH PHÂN TRANG */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                Hiển thị <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> - <strong>{Math.min(currentPage * ITEMS_PER_PAGE, currentTabRecords.length)}</strong> trên tổng số <strong>{currentTabRecords.length}</strong> bản ghi
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs transition-all shadow-sm"
                >
                  Trang trước
                </button>
                <span className="text-xs font-bold px-2">
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs transition-all shadow-sm"
                >
                  Trang sau
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL CHI TIẾT HỒ SƠ & HÓA ĐƠN */}
      {isDetailOpen && selectedRecord && (() => {
        const invoice = invoiceMap[selectedRecord.id];
        return (
          <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold text-lg">
                    📋
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                      Chi tiết Hồ sơ điều trị #{selectedRecord.id}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Thời gian khám: {formatDate(selectedRecord.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-sm">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                    Bác sĩ phụ trách
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {selectedRecord.doctor?.full_name || 'Bác sĩ phòng khám'}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 text-xs">Chuyên khoa: {selectedRecord.doctor?.specialty || 'Nha khoa tổng quát'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                    Lịch hẹn tái khám
                  </p>
                  {selectedRecord.next_appointment_date ? (
                    <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span>📅</span> {formatDate(selectedRecord.next_appointment_date)}
                    </p>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">Không có lịch hẹn tái khám</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Chẩn đoán / Mô tả triệu chứng:
                  </h4>
                  <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm border border-slate-100 dark:border-slate-700 whitespace-pre-line">
                    {selectedRecord.diagnosis_summary || 'Chưa có chẩn đoán'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Ghi chú điều trị / Đơn thuốc dặn dò:
                  </h4>
                  <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm border border-slate-100 dark:border-slate-700 whitespace-pre-line">
                    {selectedRecord.treatment_notes || 'Chưa có ghi chú điều trị'}
                  </p>
                </div>

                {/* TÓM TẮT THÔNG MINH TỪ AI */}
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
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <span>🦷</span> Chi tiết dịch vụ đã thực hiện
                </h4>
                {selectedRecord.details && selectedRecord.details.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-600">
                          <th className="p-2.5">Dịch vụ</th>
                          <th className="p-2.5 text-center">Số lượng</th>
                          <th className="p-2.5 text-right">Đơn giá</th>
                          <th className="p-2.5 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {selectedRecord.details.map((detail) => {
                          const total = Number(detail.unit_price || 0) * (detail.quantity || 1);
                          return (
                            <tr key={detail.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                              <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                                {detail.service?.name || detail.service_name || `Dịch vụ #${detail.service_id}`}
                              </td>
                              <td className="p-2.5 text-center">{detail.quantity}</td>
                              <td className="p-2.5 text-right">{formatCurrency(detail.unit_price)}</td>
                              <td className="p-2.5 text-right font-semibold text-sky-700 dark:text-sky-400">
                                {formatCurrency(total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                    Chưa có chi tiết dịch vụ nào trong hồ sơ này.
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <span>💳</span> Hóa đơn thanh toán
                </h4>
                {invoice ? (
                  <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-600 pb-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                        Mã hóa đơn: #{invoice.id}
                      </span>
                      {renderInvoiceStatusBadge(invoice.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                      <div>
                        <span className="text-slate-400 dark:text-slate-400 block">Tổng tiền dịch vụ:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {formatCurrency(invoice.total_amount || invoice.totalAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-400 block">Chiết khấu / Giảm giá:</span>
                        <span className="font-medium text-rose-600 dark:text-rose-400">
                          -{formatCurrency(invoice.discount_amount || invoice.discountAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-400 block">Thành tiền thanh toán:</span>
                        <span className="font-bold text-sky-700 dark:text-sky-400 text-sm">
                          {formatCurrency(invoice.final_amount || invoice.finalAmount || invoice.total_amount || invoice.totalAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-400 block">Đã thanh toán:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(invoice.paid_amount || invoice.paidAmount)}
                        </span>
                      </div>
                    </div>
                    {(invoice.payment_method || invoice.paymentMethod) && (
                      <p className="text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-600 text-[11px]">
                        Hình thức thanh toán: <strong className="text-slate-700 dark:text-slate-300">{invoice.payment_method || invoice.paymentMethod}</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                    Chưa có hóa đơn nào được khởi tạo cho hồ sơ khám này.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
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