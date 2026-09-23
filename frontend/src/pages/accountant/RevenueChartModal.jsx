import React from 'react';

export default function RevenueChartModal({ isOpen, onClose, days, setDays, services, overview, loading }) {
  if (!isOpen) return null;

  // Tìm doanh thu lớn nhất để tính tỷ lệ phần trăm chiều cao cột
  const maxAmount = services && services.length > 0
    ? Math.max(...services.map((s) => Number(s.amount || 0)), 1)
    : 1;

  // Tính tổng doanh thu từ danh sách dịch vụ hoặc overview
  const totalRevenue = overview?.revenue || services.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📊</span> Biểu đồ Doanh thu thu về
          </h3>
          <div className="flex items-center gap-3">
            {/* Dropdown Lọc dữ liệu 7/30/90 ngày */}
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value={7}>7 ngày qua</option>
              <option value={30}>30 ngày qua</option>
              <option value={90}>90 ngày qua</option>
            </select>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Khối Tổng quan Doanh thu trong Kỳ */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase">
              Tổng Doanh thu ({days} ngày qua)
            </span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totalRevenue.toLocaleString('vi-VN')} VNĐ
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              Số dịch vụ phát sinh: <strong className="font-bold text-emerald-800 dark:text-emerald-200">{services.length}</strong>
            </span>
          </div>
        </div>

        {/* Nội dung Biểu đồ cột */}
        <div className="py-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Đang tải dữ liệu biểu đồ...</div>
          ) : services.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Không có dữ liệu doanh thu trong {days} ngày qua</div>
          ) : (
            <div className="space-y-4">
              {/* Vùng chứa Biểu đồ Cột */}
              <div className="h-64 flex items-end justify-between gap-2 sm:gap-4 pt-8 pb-2 px-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                {services.map((s, idx) => {
                  const amount = Number(s.amount || 0);
                  const heightPercent = Math.round((amount / maxAmount) * 100);

                  return (
                    <div key={idx} className="flex-1 min-w-[54px] flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip khi di chuột qua cột */}
                      <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] py-1 px-2.5 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-md">
                        {s.service}: {amount.toLocaleString('vi-VN')} VNĐ ({s.count ?? 0} lượt)
                      </div>

                      {/* Giá trị hiển thị rút gọn trên đầu cột */}
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 truncate max-w-full">
                        {amount >= 1000000 ? `${(amount / 1000000).toFixed(1)}M` : `${(amount / 1000).toFixed(0)}k`}
                      </span>

                      {/* Cột biểu đồ */}
                      <div className="w-full max-w-[42px] bg-slate-100 dark:bg-slate-700/40 rounded-t-xl overflow-hidden flex items-end h-full">
                        <div
                          style={{ height: `${Math.max(heightPercent, 4)}%` }}
                          className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 hover:from-emerald-500 hover:to-teal-300 rounded-t-xl transition-all duration-500 ease-out shadow-sm"
                        ></div>
                      </div>

                      {/* Tên dịch vụ ở chân cột */}
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-2 truncate max-w-full text-center" title={s.service}>
                        {s.service}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chú thích Biểu đồ */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-600 to-teal-400 inline-block"></span>
                  Cột thể hiện doanh thu dịch vụ (VNĐ)
                </span>
                <span>Trục tung: Tỷ lệ tương quan doanh thu</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}