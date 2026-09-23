import React from 'react';

export default function InvoiceChartModal({ isOpen, onClose, invoices = [] }) {
  if (!isOpen) return null;

  // 1. Phân loại trạng thái hóa đơn theo chuẩn AccountantInvoiceManagement.jsx
  const stats = invoices.reduce(
    (acc, inv) => {
      const total = Number(inv.total_amount || inv.totalAmount || 0);
      const disc = Number(inv.discount_amount || inv.discountAmount || 0);
      const finalAmt = Number(inv.final_amount || inv.finalAmount || (total - disc));

      // Tính tổng số tiền đã trả từ danh sách thanh toán
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
      const paidAmt = Math.max(Number(inv.paid_amount || 0), sumFromPayments);

      // Kiểm tra trạng thái
      const isPaid =
        ['paid', 'PAID', 'Đã thanh toán'].includes(inv.status) ||
        (finalAmt > 0 && paidAmt >= finalAmt);
      const isPartial = !isPaid && paidAmt > 0 && paidAmt < finalAmt;

      if (isPaid) {
        acc.paid.count += 1;
        acc.paid.amount += finalAmt;
      } else if (isPartial) {
        acc.partial.count += 1;
        acc.partial.amount += finalAmt;
      } else {
        acc.unpaid.count += 1;
        acc.unpaid.amount += finalAmt;
      }

      acc.totalCount += 1;
      acc.totalAmount += finalAmt;
      return acc;
    },
    {
      paid: { label: 'Đã thanh toán', count: 0, amount: 0, color: '#10b981', bgClass: 'bg-emerald-500' },
      partial: { label: 'Thanh toán 1 phần', count: 0, amount: 0, color: '#f59e0b', bgClass: 'bg-amber-500' },
      unpaid: { label: 'Chưa thanh toán', count: 0, amount: 0, color: '#f43f5e', bgClass: 'bg-rose-500' },
      totalCount: 0,
      totalAmount: 0,
    }
  );

  const total = stats.totalCount || 1; // Tránh chia cho 0
  const paidPct = Math.round((stats.paid.count / total) * 100);
  const partialPct = Math.round((stats.partial.count / total) * 100);
  const unpaidPct = 100 - paidPct - partialPct; // Đảm bảo tổng bằng 100%

  // 2. Tính tham số SVG Donut/Pie Chart
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.327

  const paidStroke = (paidPct / 100) * circumference;
  const partialStroke = (partialPct / 100) * circumference;
  const unpaidStroke = (unpaidPct / 100) * circumference;

  const paidOffset = 0;
  const partialOffset = -paidStroke;
  const unpaidOffset = -(paidStroke + partialStroke);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 transition-colors">
        {/* Header Modal */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>📊</span> Tỷ lệ Loại Hóa đơn
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Thống kê hóa đơn phát sinh trong 14 ngày gần nhất
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Nội dung Biểu đồ tròn SVG */}
        {stats.totalCount === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm italic">
            Không có dữ liệu hóa đơn trong 14 ngày qua.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Biểu đồ tròn SVG */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Trạng thái 1: Đã thanh toán */}
                  {paidPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={stats.paid.color}
                      strokeWidth="16"
                      strokeDasharray={`${paidStroke} ${circumference}`}
                      strokeDashoffset={paidOffset}
                      className="transition-all duration-500"
                    />
                  )}
                  {/* Trạng thái 2: Thanh toán 1 phần */}
                  {partialPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={stats.partial.color}
                      strokeWidth="16"
                      strokeDasharray={`${partialStroke} ${circumference}`}
                      strokeDashoffset={partialOffset}
                      className="transition-all duration-500"
                    />
                  )}
                  {/* Trạng thái 3: Chưa thanh toán */}
                  {unpaidPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={stats.unpaid.color}
                      strokeWidth="16"
                      strokeDasharray={`${unpaidStroke} ${circumference}`}
                      strokeDashoffset={unpaidOffset}
                      className="transition-all duration-500"
                    />
                  )}
                </svg>

                {/* Nhãn ở tâm biểu đồ */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-800 dark:text-white">
                    {stats.totalCount}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Hóa đơn
                  </span>
                </div>
              </div>

              {/* Chú thích trạng thái (Legend) */}
              <div className="w-full space-y-2.5">
                {/* Đã thanh toán */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">ĐÃ THANH TOÁN</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-2">{stats.paid.count} HĐ</span>
                    <span className="text-slate-400 font-medium">({paidPct}%)</span>
                  </div>
                </div>

                {/* Thanh toán 1 phần */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">THANH TOÁN 1 PHẦN</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-600 dark:text-amber-400 mr-2">{stats.partial.count} HĐ</span>
                    <span className="text-slate-400 font-medium">({partialPct}%)</span>
                  </div>
                </div>

                {/* Chưa thanh toán */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">CHƯA THANH TOÁN</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-600 dark:text-rose-400 mr-2">{stats.unpaid.count} HĐ</span>
                    <span className="text-slate-400 font-medium">({unpaidPct}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chi tiết tổng tiền theo từng nhóm */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700 text-center text-xs">
              <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Thực thu hoàn tất</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  {stats.paid.amount.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">Đang trả góp/nợ lẻ</span>
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  {stats.partial.amount.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">Công nợ chưa trả</span>
                <span className="font-bold text-rose-700 dark:text-rose-300">
                  {stats.unpaid.amount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nút Đóng Modal */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}