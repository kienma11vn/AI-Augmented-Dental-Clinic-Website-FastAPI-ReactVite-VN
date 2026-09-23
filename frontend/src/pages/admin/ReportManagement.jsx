import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import VisitChartModal from './VisitChartModal';
import RevenueChartModal from './RevenueChartModal';
import { reportApi } from '../../api/reportApi';

export default function ReportManagement() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [visits, setVisits] = useState([]);
  const [services, setServices] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  // State quản lý xem chi tiết phản hồi bệnh nhân qua Modal
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Cấu hình số bản ghi mỗi trang = 5
  const ITEMS_PER_PAGE = 5;
  const [servicesPage, setServicesPage] = useState(1);
  const [visitsPage, setVisitsPage] = useState(1);
  const [followupsPage, setFollowupsPage] = useState(1);
  const [feedbacksPage, setFeedbacksPage] = useState(1);
  
  const [isRevenueChartModalOpen, setIsRevenueChartModalOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [days]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [resOverview, resVisits, resServices, resFollowups, resFeedbacks] = await Promise.all([
        reportApi.getOverview(days),
        reportApi.getVisitsByDay(14),
        reportApi.getRevenueByService(days),
        reportApi.getUpcomingFollowups(30),
        reportApi.getPatientFeedbacks(days),
      ]);

      setOverview(resOverview?.data || resOverview || null);
      setVisits(Array.isArray(resVisits) ? resVisits : (resVisits?.data || []));
      setServices(Array.isArray(resServices) ? resServices : (resServices?.data || []));
      setFollowups(Array.isArray(resFollowups) ? resFollowups : (resFollowups?.data || []));
      setFeedbacks(Array.isArray(resFeedbacks) ? resFeedbacks : (resFeedbacks?.data || []));

      // Reset phân trang về 1 khi thay đổi bộ lọc ngày
      setServicesPage(1);
      setVisitsPage(1);
      setFollowupsPage(1);
      setFeedbacksPage(1);
    } catch (err) {
      console.error('Lỗi tải báo cáo:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Tự động tải lại dữ liệu báo cáo sau 5 phút không tương tác (tạm dừng khi đang mở Modal phản hồi)
  useIdleRefresh(fetchReportData, 5 * 60 * 1000, !!selectedFeedback);

  // Tính toán dữ liệu cắt trang cho từng bảng
  const totalServicesPages = Math.ceil(services.length / ITEMS_PER_PAGE) || 1;
  const paginatedServices = services.slice((servicesPage - 1) * ITEMS_PER_PAGE, servicesPage * ITEMS_PER_PAGE);

  const totalVisitsPages = Math.ceil(visits.length / ITEMS_PER_PAGE) || 1;
  const paginatedVisits = visits.slice((visitsPage - 1) * ITEMS_PER_PAGE, visitsPage * ITEMS_PER_PAGE);

  const totalFollowupsPages = Math.ceil(followups.length / ITEMS_PER_PAGE) || 1;
  const paginatedFollowups = followups.slice((followupsPage - 1) * ITEMS_PER_PAGE, followupsPage * ITEMS_PER_PAGE);

  const totalFeedbacksPages = Math.ceil(feedbacks.length / ITEMS_PER_PAGE) || 1;
  const paginatedFeedbacks = feedbacks.slice((feedbacksPage - 1) * ITEMS_PER_PAGE, feedbacksPage * ITEMS_PER_PAGE);

  // Xuất file TXT
  const exportToTxt = () => {
    if (!overview) return;

    const exportDate = new Date().toLocaleDateString('vi-VN');
    let content = `================================================================\n`;
    content += `                    BÁO CÁO THỐNG KÊ NHA KHOA\n`;
    content += `================================================================\n`;
    content += `Kỳ báo cáo: ${days} ngày qua\n`;
    content += `Ngày xuất báo cáo: ${exportDate}\n\n`;

    content += `----------------------------------------------------------------\n`;
    content += `1. TỔNG QUAN HOẠT ĐỘNG\n`;
    content += `----------------------------------------------------------------\n`;
    content += `- Tổng doanh thu: ${(overview?.revenue || 0).toLocaleString('vi-VN')} VNĐ\n`;
    content += `- Công nợ (Chưa thu): ${(overview?.outstanding || 0).toLocaleString('vi-VN')} VNĐ\n`;
    content += `- Tổng số lượt hẹn: ${overview?.total_appointments || 0}\n`;
    content += `- Lượt hẹn hoàn thành: ${overview?.completed_appointments || 0}\n`;
    content += `- Lượt hẹn hủy: ${overview?.cancelled_appointments || 0} (Tỷ lệ hủy: ${((overview?.cancel_rate || 0) * 100).toFixed(2)}%)\n`;
    content += `- Tổng số bệnh nhân: ${overview?.total_patients || 0}\n\n`;

    content += `----------------------------------------------------------------\n`;
    content += `2. DOANH THU THEO DỊCH VỤ (${days} ngày qua)\n`;
    content += `----------------------------------------------------------------\n`;
    if (services.length === 0) {
      content += `Không có dữ liệu\n`;
    } else {
      services.forEach((s, idx) => {
        content += `${idx + 1}. ${s.service}: ${s.amount.toLocaleString('vi-VN')} VNĐ\n`;
      });
    }
    content += `\n`;

    content += `----------------------------------------------------------------\n`;
    content += `3. LƯỢT KHÁM THEO NGÀY (14 NGÀY GẦN NHẤT)\n`;
    content += `----------------------------------------------------------------\n`;
    if (visits.length === 0) {
      content += `Không có dữ liệu\n`;
    } else {
      visits.forEach((v) => {
        const total = v.total ?? v.total_appointments ?? v.count ?? 0;
        const completed = v.completed ?? v.completed_appointments ?? 0;
        const cancelled = v.cancelled ?? v.cancelled_appointments ?? 0;
        content += `- Ngày ${v.day}: ${total} lượt hẹn | ${completed} lượt đến | ${cancelled} lượt hủy\n`;
      });
    }
    content += `\n`;

    content += `----------------------------------------------------------------\n`;
    content += `4. ĐÁNH GIÁ & PHẢN HỒI TỪ BỆNH NHÂN (${days} NGÀY QUA)\n`;
    content += `----------------------------------------------------------------\n`;
    if (feedbacks.length === 0) {
      content += `Chưa có đánh giá hoặc phản hồi\n`;
    } else {
      feedbacks.forEach((fb, idx) => {
        const dateStr = fb.visit_date ? new Date(fb.visit_date).toLocaleDateString('vi-VN') : '-';
        content += `${idx + 1}. [${dateStr}] Bệnh nhân: ${fb.patient_name || '-'} | Bác sĩ: ${fb.doctor_name || '-'} | Dịch vụ: ${fb.service || '-'} | Đánh giá: ${fb.rating ? fb.rating + '/5 sao' : '-'} | Phản hồi: ${fb.feedback || '-'}\n`;
      });
    }
    content += `\n`;

    content += `----------------------------------------------------------------\n`;
    content += `5. LỊCH HẸN TÁI KHÁM SẮP TỚI (30 NGÀY)\n`;
    content += `----------------------------------------------------------------\n`;
    if (followups.length === 0) {
      content += `Không có lịch tái khám\n`;
    } else {
      followups.forEach((f, idx) => {
        const dateStr = f.next_appointment_date
          ? new Date(f.next_appointment_date).toLocaleDateString('vi-VN')
          : '-';
        content += `${idx + 1}. Bệnh nhân: ${f.patient_name || '-'} | SĐT: ${f.phone || '-'} | Ngày tái khám: ${dateStr}\n`;
      });
    }
    content += `\n================================================================\n`;
    content += `                          HẾT BÁO CÁO\n`;
    content += `================================================================\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_thong_ke_${days}_ngay_${new Date().toISOString().slice(0, 10)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Xuất file DOC
  const exportToDoc = () => {
    if (!overview) return;

    const exportDate = new Date().toLocaleDateString('vi-VN');
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Báo cáo thống kê</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 20px; line-height: 1.6; }
          h1 { color: #0d9488; text-align: center; }
          h2 { color: #1e293b; border-bottom: 2px solid #0d9488; padding-bottom: 5px; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; }
          .summary-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
          .meta { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>BÁO CÁO THỐNG KÊ PHÒNG KHÁM NHA KHOA</h1>
        <div class="meta">
          <p><strong>Kỳ báo cáo:</strong> ${days} ngày qua | <strong>Ngày xuất:</strong> ${exportDate}</p>
        </div>

        <h2>1. Tổng quan hoạt động</h2>
        <div class="summary-box">
          <p><strong>Tổng doanh thu thực nhận:</strong> ${(overview?.revenue || 0).toLocaleString('vi-VN')} VNĐ</p>
          <p><strong>Công nợ còn lại:</strong> ${(overview?.outstanding || 0).toLocaleString('vi-VN')} VNĐ</p>
          <p><strong>Tổng số lượt hẹn:</strong> ${overview?.total_appointments || 0}</p>
          <p><strong>Lượt hẹn hoàn thành:</strong> ${overview?.completed_appointments || 0}</p>
          <p><strong>Lượt hẹn bị hủy:</strong> ${overview?.cancelled_appointments || 0} (Tỷ lệ: ${((overview?.cancel_rate || 0) * 100).toFixed(2)}%)</p>
          <p><strong>Tổng số bệnh nhân:</strong> ${overview?.total_patients || 0}</p>
        </div>

        <h2>2. Doanh thu theo dịch vụ (${days} ngày qua)</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tên dịch vụ</th>
              <th style="text-align: right;">Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            ${
              services.length === 0
                ? '<tr><td colspan="3">Không có dữ liệu</td></tr>'
                : services
                    .map(
                      (s, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${s.service}</td>
                <td style="text-align: right;">${s.amount.toLocaleString('vi-VN')} VNĐ</td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <h2>3. Lượt khám 14 ngày gần nhất</h2>
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th style="text-align: center;">Số lượt hẹn</th>
              <th style="text-align: center;">Số lượt đến</th>
              <th style="text-align: center;">Số lượt hủy</th>
            </tr>
          </thead>
          <tbody>
            ${
              visits.length === 0
                ? '<tr><td colspan="4">Không có dữ liệu</td></tr>'
                : visits
                    .map(
                      (v) => `
              <tr>
                <td>${v.day}</td>
                <td style="text-align: center;">${v.total ?? v.total_appointments ?? v.count ?? 0}</td>
                <td style="text-align: center;">${v.completed ?? v.completed_appointments ?? 0}</td>
                <td style="text-align: center;">${v.cancelled ?? v.cancelled_appointments ?? 0}</td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <h2>4. Đánh giá & Phản hồi từ bệnh nhân (${days} ngày qua)</h2>
        <table>
          <thead>
            <tr>
              <th>Ngày khám</th>
              <th>Bệnh nhân</th>
              <th>Bác sĩ</th>
              <th>Dịch vụ</th>
              <th style="text-align: center;">Đánh giá</th>
              <th>Phản hồi</th>
            </tr>
          </thead>
          <tbody>
            ${
              feedbacks.length === 0
                ? '<tr><td colspan="6">Chưa có đánh giá hoặc phản hồi</td></tr>'
                : feedbacks
                    .map(
                      (fb) => `
              <tr>
                <td>${fb.visit_date ? new Date(fb.visit_date).toLocaleDateString('vi-VN') : '-'}</td>
                <td>${fb.patient_name || '-'}</td>
                <td>${fb.doctor_name || '-'}</td>
                <td>${fb.service || '-'}</td>
                <td style="text-align: center;">${fb.rating ? fb.rating + '/5 ⭐' : '-'}</td>
                <td>${fb.feedback || '-'}</td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <h2>5. Lịch hẹn tái khám sắp tới (30 ngày)</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tên bệnh nhân</th>
              <th>Số điện thoại</th>
              <th>Ngày tái khám</th>
            </tr>
          </thead>
          <tbody>
            ${
              followups.length === 0
                ? '<tr><td colspan="4">Không có lịch tái khám</td></tr>'
                : followups
                    .map(
                      (f, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${f.patient_name || '-'}</td>
                <td>${f.phone || '-'}</td>
                <td>${f.next_appointment_date ? new Date(f.next_appointment_date).toLocaleDateString('vi-VN') : '-'}</td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_thong_ke_${days}_ngay_${new Date().toISOString().slice(0, 10)}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Thanh công cụ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Báo cáo Thống kê</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tổng quan doanh thu, lượt khám bệnh và hiệu suất dịch vụ</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          >
            <option value={7}>7 ngày qua</option>
            <option value={30}>30 ngày qua</option>
            <option value={90}>90 ngày qua</option>
          </select>

          <button
            onClick={exportToTxt}
            disabled={loading || !overview}
            className="px-4 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <span>📄</span> Xuất TXT Báo cáo
          </button>

          <button
            onClick={exportToDoc}
            disabled={loading || !overview}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-sky-600/30 flex items-center gap-2 disabled:opacity-50"
          >
            <span>📝</span> Xuất DOC Báo cáo
          </button>
        </div>
      </div>

      {/* Thẻ Thống kê Tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Doanh thu</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? '...' : `${(overview?.revenue || 0).toLocaleString('vi-VN')} VNĐ`}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Tổng lượt hẹn</span>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {loading ? '...' : overview?.total_appointments || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Lượt hoàn thành</span>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {loading ? '...' : overview?.completed_appointments || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Tổng bệnh nhân</span>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {loading ? '...' : overview?.total_patients || 0}
          </p>
        </div>
      </div>

      {/* Bảng Doanh thu Dịch vụ & Lượt khám */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Khu vực 1: Doanh thu theo Dịch vụ (5 bản ghi/trang) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col justify-between">
          <div>
            {/* Header tiêu đề có nút Biểu đồ nằm ở góc trên bên phải */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">
                Doanh thu theo Dịch vụ ({days} ngày qua)
              </h3>
              <button
                onClick={() => setIsRevenueChartModalOpen(true)}
                className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-semibold border border-sky-200 dark:border-sky-800 transition-all flex items-center gap-1.5 shadow-sm"
                title="Xem biểu đồ doanh thu theo dịch vụ"
              >
                <span>📊</span> Biểu đồ
              </button>
            </div>
				
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 text-xs uppercase">
                    <th className="pb-2">Dịch vụ</th>
                    <th className="pb-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {services.length === 0 ? (
                    <tr><td colSpan="2" className="py-4 text-center text-slate-400 dark:text-slate-500">Không có dữ liệu</td></tr>
                  ) : (
                    paginatedServices.map((s, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{s.service}</td>
                        <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">{s.amount.toLocaleString('vi-VN')} VNĐ</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalServicesPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <span>Trang {servicesPage} / {totalServicesPages} ({services.length} bản ghi)</span>
              <div className="flex gap-2">
                <button
                  disabled={servicesPage === 1}
                  onClick={() => setServicesPage((prev) => prev - 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
                >
                  Trước
                </button>
                <button
                  disabled={servicesPage === totalServicesPages}
                  onClick={() => setServicesPage((prev) => prev + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Khu vực 2: Lượt khám 14 ngày gần nhất (5 bản ghi/trang) */}
		<div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col justify-between">
          <div>
            {/* Header tiêu đề có nút Đồ thị ở góc trên bên phải */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Lượt khám 14 ngày gần nhất</h3>
              <button
                onClick={() => setIsChartModalOpen(true)}
                className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-semibold border border-sky-200 dark:border-sky-800 transition-all flex items-center gap-1.5 shadow-sm"
                title="Xem biểu đồ tròn lượt khám"
              >
                <span>📊</span> Biểu đồ
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 text-xs uppercase">
                    <th className="pb-2">Ngày</th>
                    <th className="pb-2 text-center">Số lượt hẹn</th>
                    <th className="pb-2 text-center">Số lượt đến</th>
                    <th className="pb-2 text-center">Số lượt hủy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {visits.length === 0 ? (
                    <tr><td colSpan="4" className="py-4 text-center text-slate-400 dark:text-slate-500">Không có dữ liệu</td></tr>
                  ) : (
                    paginatedVisits.map((v, idx) => {
                      const total = v.total ?? v.total_appointments ?? v.count ?? 0;
                      const completed = v.completed ?? v.completed_appointments ?? 0;
                      const cancelled = v.cancelled ?? v.cancelled_appointments ?? 0;

                      return (
                        <tr key={idx}>
                          <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{v.day}</td>
                          <td className="py-3 text-center font-semibold text-slate-800 dark:text-white">{total}</td>
                          <td className="py-3 text-center font-semibold text-sky-600 dark:text-sky-400">{completed}</td>
                          <td className="py-3 text-center font-semibold text-rose-500 dark:text-rose-400">{cancelled}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalVisitsPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <span>Trang {visitsPage} / {totalVisitsPages} ({visits.length} bản ghi)</span>
              <div className="flex gap-2">
                <button
                  disabled={visitsPage === 1}
                  onClick={() => setVisitsPage((prev) => prev - 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
                >
                  Trước
                </button>
                <button
                  disabled={visitsPage === totalVisitsPages}
                  onClick={() => setVisitsPage((prev) => prev + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Khu vực 3: Đánh giá & Phản hồi từ bệnh nhân (5 bản ghi/trang) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4">
            Đánh giá & Phản hồi từ bệnh nhân ({days} ngày qua)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 text-xs uppercase">
                  <th className="pb-2">Ngày khám</th>
                  <th className="pb-2">Bệnh nhân</th>
                  <th className="pb-2">Bác sĩ</th>
                  <th className="pb-2">Dịch vụ</th>
                  <th className="pb-2 text-center">Đánh giá</th>
                  <th className="pb-2">Phản hồi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-slate-400 dark:text-slate-500">
                      Chưa có đánh giá hoặc phản hồi nào
                    </td>
                  </tr>
                ) : (
                  paginatedFeedbacks.map((fb, idx) => (
                    <tr key={fb.id || idx}>
                      <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                        {fb.visit_date ? new Date(fb.visit_date).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="py-3 font-semibold text-slate-800 dark:text-white">
                        {fb.patient_name || '-'}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {fb.doctor_name || '-'}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {fb.service || '-'}
                      </td>
                      <td className="py-3 text-center">
                        {fb.rating ? (
                          <span className="text-amber-500 font-semibold">
                            {'⭐'.repeat(fb.rating)} ({fb.rating}/5)
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {fb.feedback ? (
                          <button
                            onClick={() => setSelectedFeedback(fb)}
                            className="px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg border border-sky-200 dark:border-sky-800 transition-all inline-flex items-center gap-1"
                            title="Xem chi tiết nội dung phản hồi"
                          >
                            Xem
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalFeedbacksPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            <span>Trang {feedbacksPage} / {totalFeedbacksPages} ({feedbacks.length} bản ghi)</span>
            <div className="flex gap-2">
              <button
                disabled={feedbacksPage === 1}
                onClick={() => setFeedbacksPage((prev) => prev - 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
              >
                Trước
              </button>
              <button
                disabled={feedbacksPage === totalFeedbacksPages}
                onClick={() => setFeedbacksPage((prev) => prev + 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Khu vực 4: Lịch hẹn tái khám sắp tới (5 bản ghi/trang) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4">Lịch hẹn tái khám sắp tới (30 ngày)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 text-xs uppercase">
                  <th className="pb-2">Bệnh nhân</th>
                  <th className="pb-2">Số điện thoại</th>
                  <th className="pb-2 text-right">Ngày hẹn tái khám</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {followups.length === 0 ? (
                  <tr><td colSpan="3" className="py-4 text-center text-slate-400 dark:text-slate-500">Không có lịch tái khám</td></tr>
                ) : (
                  paginatedFollowups.map((f, idx) => (
                    <tr key={f.record_id || idx}>
                      <td className="py-3 font-semibold text-slate-800 dark:text-white">{f.patient_name || '-'}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{f.phone || '-'}</td>
                      <td className="py-3 text-right font-medium text-sky-600 dark:text-sky-400">
                        {f.next_appointment_date ? new Date(f.next_appointment_date).toLocaleDateString('vi-VN') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalFollowupsPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            <span>Trang {followupsPage} / {totalFollowupsPages} ({followups.length} bản ghi)</span>
            <div className="flex gap-2">
              <button
                disabled={followupsPage === 1}
                onClick={() => setFollowupsPage((prev) => prev - 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
              >
                Trước
              </button>
              <button
                disabled={followupsPage === totalFollowupsPages}
                onClick={() => setFollowupsPage((prev) => prev + 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-medium transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Chi tiết Phản hồi bệnh nhân */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 transition-all">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>💬</span> Chi tiết phản hồi
              </h3>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            {/* Content Modal */}
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <div>
                  <span className="text-slate-400 text-xs uppercase block font-semibold mb-0.5">Bệnh nhân</span>
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {selectedFeedback.patient_name || 'Không có thông tin'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs uppercase block font-semibold mb-0.5">Ngày khám</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedFeedback.visit_date ? new Date(selectedFeedback.visit_date).toLocaleDateString('vi-VN') : 'Không có thông tin'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs uppercase block font-semibold mb-0.5">Bác sĩ phụ trách</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedFeedback.doctor_name || 'Không có thông tin'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs uppercase block font-semibold mb-0.5">Dịch vụ</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedFeedback.service || 'Không có thông tin'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-xs uppercase block font-semibold mb-1">Mức độ đánh giá</span>
                {selectedFeedback.rating ? (
                  <span className="text-amber-500 font-semibold text-base">
                    {'⭐'.repeat(selectedFeedback.rating)} ({selectedFeedback.rating}/5)
                  </span>
                ) : (
                  <span className="text-slate-400">Không có đánh giá</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 text-xs uppercase block font-semibold mb-1">Nội dung phản hồi đầy đủ</span>
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl text-slate-700 dark:text-slate-200 whitespace-pre-wrap border border-slate-200/80 dark:border-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                  {selectedFeedback.feedback || 'Không có nội dung phản hồi.'}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setSelectedFeedback(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
	    {/* Modal Biểu đồ Doanh thu theo Dịch vụ */}
		  <RevenueChartModal
			isOpen={isRevenueChartModalOpen}
			onClose={() => setIsRevenueChartModalOpen(false)}
			days={days}
			setDays={setDays}
			services={services}
			overview={overview}
			loading={loading}
		  />
	  
		{/* Modal Biểu đồ tròn Lượt khám 14 ngày */}
		<VisitChartModal
		  isOpen={isChartModalOpen}
		  onClose={() => setIsChartModalOpen(false)}
		  visits={visits}
		/>
    </div>
  );
}