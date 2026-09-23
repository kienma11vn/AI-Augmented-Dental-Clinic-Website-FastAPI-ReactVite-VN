import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import invoiceApi from '../../api/invoiceApi';
import { reportApi } from '../../api/reportApi';
import RevenueChartModal from './RevenueChartModal';
import InvoiceChartModal from './InvoiceChartModal';

export default function AccountantReportManagement() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [services, setServices] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [isInvoiceChartModalOpen, setIsInvoiceChartModalOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);

  // Phân trang (5 bản ghi/trang)
  const ITEMS_PER_PAGE = 5;
  const [servicesPage, setServicesPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);

  useEffect(() => {
    fetchAccountantReportData();
  }, [days]);

  const getCustomerName = (inv) => {
    return (
      inv.customerName ||
      inv.customer_name ||
      inv.patientName ||
      inv.patient_name ||
      inv.patient?.full_name ||
      (inv.patient_id ? `Bệnh nhân #${inv.patient_id}` : 'Khách lẻ')
    );
  };

  const fetchAccountantReportData = async () => {
    setLoading(true);
    try {
      const [resOverview, resServices, resInvoices] = await Promise.all([
        reportApi.getOverview(days),
        reportApi.getRevenueByService(days),
        invoiceApi.getInvoices(),
      ]);

      setOverview(resOverview?.data || resOverview || null);
      setServices(Array.isArray(resServices) ? resServices : (resServices?.data || []));

      // Lọc danh sách hóa đơn trong 14 ngày gần nhất
      const rawInvoices = Array.isArray(resInvoices?.data) ? resInvoices.data : (Array.isArray(resInvoices) ? resInvoices : []);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const recentInvoices = rawInvoices.filter((inv) => {
        const createdAt = inv.createdAt || inv.created_at || inv.date;
        if (!createdAt) return false;
        return new Date(createdAt) >= fourteenDaysAgo;
      }).sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

      setInvoices(recentInvoices);
      setServicesPage(1);
      setInvoicesPage(1);
    } catch (err) {
      console.error('Lỗi tải báo cáo tài chính:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useIdleRefresh(fetchAccountantReportData, 5 * 60 * 1000);

  const totalServicesPages = Math.ceil(services.length / ITEMS_PER_PAGE) || 1;
  const paginatedServices = services.slice((servicesPage - 1) * ITEMS_PER_PAGE, servicesPage * ITEMS_PER_PAGE);

  const totalInvoicesPages = Math.ceil(invoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = invoices.slice((invoicesPage - 1) * ITEMS_PER_PAGE, invoicesPage * ITEMS_PER_PAGE);

  // Xuất Báo Cáo Tài Chính Kế Toán (TXT)
  const exportAccountantTxt = () => {
    if (!overview) return;
    const exportDate = new Date().toLocaleDateString('vi-VN');
    let content = `================================================================\n`;
    content += `             BÁO CÁO THỐNG KÊ TÀI CHÍNH KẾ TOÁN\n`;
    content += `================================================================\n`;
    content += `Kỳ báo cáo: ${days} ngày qua | Ngày xuất: ${exportDate}\n\n`;

    content += `1. TỔNG QUAN TÀI CHÍNH\n`;
    content += `- Tổng doanh thu thực nhận: ${(overview?.revenue || 0).toLocaleString('vi-VN')} VNĐ\n`;
    content += `- Công nợ chưa thu hồi: ${(overview?.outstanding || 0).toLocaleString('vi-VN')} VNĐ\n`;
    content += `- Tổng số lượt thanh toán: ${overview?.completed_appointments || 0}\n\n`;

    content += `2. DOANH THU DỊCH VỤ\n`;
    services.forEach((s, idx) => {
      content += `${idx + 1}. ${s.service}: ${s.count ?? 0} lượt khám - ${s.amount.toLocaleString('vi-VN')} VNĐ\n`;
    });

    content += `\n3. HÓA ĐƠN 14 NGÀY GẦN NHẤT\n`;
    invoices.forEach((inv, idx) => {
      const finalVal = Number(inv.final_amount || inv.finalAmount || inv.total_amount || 0);
      content += `${idx + 1}. HĐ #${inv.id} - ${getCustomerName(inv)} - ${finalVal.toLocaleString('vi-VN')} VNĐ - (${inv.status || 'Chưa TT'})\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Tai_Chinh_${days}_ngay_${new Date().toISOString().slice(0, 10)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Xuất Báo Cáo Tài Chính Kế Toán (DOC)
  const exportAccountantDoc = () => {
    if (!overview) return;
    const exportDate = new Date().toLocaleDateString('vi-VN');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Báo cáo Thống kê Tài chính Kế toán</title>
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
          h1 { text-align: center; color: #0f766e; font-size: 16pt; margin-bottom: 5px; }
          .sub-header { text-align: center; font-style: italic; color: #555; margin-bottom: 20px; }
          h2 { color: #0f766e; font-size: 13pt; border-bottom: 1px solid #0f766e; padding-bottom: 3px; margin-top: 15px; }
          ul { margin-top: 5px; }
          li { margin-bottom: 5px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 15px; }
          th, td { border: 1px solid #cccccc; padding: 6px 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <h1>BÁO CÁO THỐNG KÊ TÀI CHÍNH KẾ TOÁN</h1>
        <div class="sub-header">Kỳ báo cáo: ${days} ngày qua | Ngày xuất: ${exportDate}</div>

        <h2>1. TỔNG QUAN TÀI CHÍNH</h2>
        <ul>
          <li><strong>Tổng doanh thu thực nhận:</strong> ${(overview?.revenue || 0).toLocaleString('vi-VN')} VNĐ</li>
          <li><strong>Công nợ chưa thu hồi:</strong> ${(overview?.outstanding || 0).toLocaleString('vi-VN')} VNĐ</li>
          <li><strong>Tổng số lượt thanh toán:</strong> ${overview?.completed_appointments || 0}</li>
        </ul>

        <h2>2. DOANH THU THEO DỊCH VỤ</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">STT</th>
              <th>Tên dịch vụ</th>
              <th class="text-center" style="width: 22%;">Số lượt khám</th>
              <th class="text-right" style="width: 28%;">Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            ${services.length === 0 ? '<tr><td colspan="4" class="text-center">Không có dữ liệu</td></tr>' : 
              services.map((s, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${s.service}</td>
                  <td class="text-center">${s.count ?? 0}</td>
                  <td class="text-right">${s.amount.toLocaleString('vi-VN')} VNĐ</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>

        <h2>3. HÓA ĐƠN 14 NGÀY GẦN NHẤT</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">STT</th>
              <th style="width: 15%;">Mã HĐ</th>
              <th>Khách hàng</th>
              <th class="text-right" style="width: 25%;">Thành tiền</th>
              <th class="text-center" style="width: 20%;">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.length === 0 ? '<tr><td colspan="5" class="text-center">Không có hóa đơn</td></tr>' :
              invoices.map((inv, idx) => {
                const finalVal = Number(inv.final_amount || inv.finalAmount || inv.total_amount || 0);
                return `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td>#${inv.id}</td>
                    <td>${getCustomerName(inv)}</td>
                    <td class="text-right">${finalVal.toLocaleString('vi-VN')} VNĐ</td>
                    <td class="text-center">${inv.status || 'Chưa TT'}</td>
                  </tr>
                `;
              }).join('')
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
    link.setAttribute('download', `Bao_Cao_Tai_Chinh_${days}_ngay_${new Date().toISOString().slice(0, 10)}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Báo cáo Thống kê</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Chuyên biệt theo dõi doanh thu, công nợ và hóa đơn thanh toán
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500/20"
          >
            <option value={7}>7 ngày qua</option>
            <option value={30}>30 ngày qua</option>
            <option value={90}>90 ngày qua</option>
          </select>

          <button
            onClick={exportAccountantTxt}
            disabled={loading || !overview}
            className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <span>📄</span> Xuất TXT Báo cáo
          </button>

          <button
            onClick={exportAccountantDoc}
            disabled={loading || !overview}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <span>📝</span> Xuất DOC Báo cáo
          </button>
        </div>
      </div>

      {/* Thẻ Thống kê Tài chính */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Doanh thu thu về</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? '...' : `${(overview?.revenue || 0).toLocaleString('vi-VN')} VNĐ`}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Công nợ còn nợ</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {loading ? '...' : `${(overview?.outstanding || 0).toLocaleString('vi-VN')} VNĐ`}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase">Số lượt thanh toán</span>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {loading ? '...' : overview?.completed_appointments || 0}
          </p>
        </div>
      </div>

      {/* Bảng Thống kê Dịch vụ & Hóa đơn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doanh thu theo Dịch vụ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col justify-between">
          <div>
            {/* Header tiêu đề có Nút Biểu đồ ở góc trên bên phải */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">
                Doanh thu theo Dịch vụ ({days} ngày qua)
              </h3>
              <button
                onClick={() => setIsChartModalOpen(true)}
                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5 shadow-sm"
                title="Xem biểu đồ cột doanh thu"
              >
                <span>📊</span> Biểu đồ
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 text-xs uppercase">
                    <th className="pb-2">Tên dịch vụ</th>
                    <th className="pb-2 text-center">Số lượt khám</th>
                    <th className="pb-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {services.length === 0 ? (
                    <tr><td colSpan="3" className="py-4 text-center text-slate-400 dark:text-slate-500">Không có dữ liệu</td></tr>
                  ) : (
                    paginatedServices.map((s, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-medium text-slate-700 dark:text-slate-200">{s.service}</td>
                        <td className="py-3 text-center font-semibold text-sky-700 dark:text-sky-400">
                          {s.count ?? 0}
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{s.amount.toLocaleString('vi-VN')} VNĐ</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalServicesPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <span>Trang {servicesPage} / {totalServicesPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={servicesPage === 1}
                  onClick={() => setServicesPage((prev) => prev - 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  disabled={servicesPage === totalServicesPages}
                  onClick={() => setServicesPage((prev) => prev + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bảng Hóa đơn 14 ngày gần nhất */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col justify-between">
          <div>
            {/* Header tiêu đề có Nút Biểu đồ ở góc trên bên phải */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">
                Hóa đơn 14 ngày gần nhất
              </h3>
              <button
                onClick={() => setIsInvoiceChartModalOpen(true)}
                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5 shadow-sm"
                title="Xem biểu đồ tròn trạng thái hóa đơn"
              >
                <span>📊</span> Biểu đồ
              </button>
            </div>
			
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 text-xs uppercase">
                    <th className="pb-2">Mã HĐ</th>
                    <th className="pb-2">Khách hàng</th>
                    <th className="pb-2 text-right">Thành tiền</th>
                    <th className="pb-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {invoices.length === 0 ? (
                    <tr><td colSpan="4" className="py-4 text-center text-slate-400 dark:text-slate-500">Không có hóa đơn</td></tr>
                  ) : (
                    paginatedInvoices.map((inv) => {
                      const totalVal = Number(inv.total_amount || inv.totalAmount || 0);
                      const discVal = Number(inv.discount_amount || inv.discountAmount || 0);
                      const finalVal = Number(inv.final_amount || inv.finalAmount || totalVal - discVal);
						
					  const payments = Array.isArray(inv.payments)
						? inv.payments
						: Array.isArray(inv.payment_history)
						? inv.payment_history
						: Array.isArray(inv.payment_list)
						? inv.payment_list
						: [];

					  const sumFromPayments = payments.reduce(
						(sum, p) => sum + Number(p.amount || p.payment_amount || p.paid_amount || 0),
						0
					  );
					  const paidVal = Math.max(Number(inv.paid_amount || 0), sumFromPayments);	
					  	
					  const isPaid =
						['paid', 'PAID', 'Đã thanh toán'].includes(inv.status) ||
						(finalVal > 0 && paidVal >= finalVal);
					  const isPartial = !isPaid && paidVal > 0 && paidVal < finalVal;	
					 
                      return (
                        <tr key={inv.id}>
                          <td className="py-3 font-bold text-slate-900 dark:text-slate-100">#{inv.id}</td>
                          <td className="py-3 font-medium text-slate-700 dark:text-slate-200">{getCustomerName(inv)}</td>
                          <td className="py-3 text-right font-bold text-sky-700 dark:text-sky-400">{finalVal.toLocaleString('vi-VN')} đ</td>
                          <td className="py-3 text-center">
                            {isPaid ? (
							  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
								ĐÃ THANH TOÁN
							  </span>
							) : isPartial ? (
							  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
								THANH TOÁN 1 PHẦN
							  </span>
							) : (
							  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400">
								CHƯA THANH TOÁN
							  </span>
							)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalInvoicesPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <span>Trang {invoicesPage} / {totalInvoicesPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={invoicesPage === 1}
                  onClick={() => setInvoicesPage((prev) => prev - 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  disabled={invoicesPage === totalInvoicesPages}
                  onClick={() => setInvoicesPage((prev) => prev + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Cửa sổ Biểu đồ cột Doanh thu */}
      <RevenueChartModal
        isOpen={isChartModalOpen}
        onClose={() => setIsChartModalOpen(false)}
        days={days}
        setDays={setDays}
        services={services}
        overview={overview}
        loading={loading}
      />
	  
	  {/* Modal Cửa sổ Biểu đồ tròn Trạng thái Hóa đơn 14 ngày */}
      <InvoiceChartModal
        isOpen={isInvoiceChartModalOpen}
        onClose={() => setIsInvoiceChartModalOpen(false)}
        invoices={invoices}
      />
    </div>
  );
}