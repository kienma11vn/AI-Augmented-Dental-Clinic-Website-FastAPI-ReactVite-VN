import React from 'react';

export default function RevenueChartModal({ isOpen, onClose, days, setDays, services, overview, loading }) {
  if (!isOpen) return null;

  // Tính giá trị lớn nhất trong cả 3 loại chỉ số của các dịch vụ để làm mốc tỷ lệ chiều cao cột
  const maxAmount = services && services.length > 0
    ? Math.max(
        ...services.map((s) =>
          Math.max(
            Number(s.amount || 0),
            Number(s.discount || 0),
            Number(s.debt || 0)
          )
        ),
        1
      )
    : 1;

  // Tính tổng các chỉ số trong kỳ
  const totalRevenue = overview?.revenue || services.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalDiscount = services.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const totalDebt = overview?.outstanding || services.reduce((sum, s) => sum + Number(s.debt || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-3xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📊</span> Biểu đồ Doanh thu, Chiết khấu & Công nợ
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

        {/* Khối Thống kê Tổng quan các Chỉ số */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 p-3.5 rounded-xl">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase block">
              Doanh thu thực nhận
            </span>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totalRevenue.toLocaleString('vi-VN')} VNĐ
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60 p-3.5 rounded-xl">
            <span className="text-xs font-semibold text-purple-800 dark:text-purple-400 uppercase block">
              Tổng chiết khấu
            </span>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {totalDiscount.toLocaleString('vi-VN')} VNĐ
            </p>
          </div>

          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 p-3.5 rounded-xl">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-400 uppercase block">
              Công nợ còn lại
            </span>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {totalDebt.toLocaleString('vi-VN')} VNĐ
            </p>
          </div>
        </div>

        {/* Nội dung Biểu đồ Cột */}
        <div className="py-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Đang tải dữ liệu biểu đồ...</div>
          ) : services.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Không có dữ liệu trong {days} ngày qua</div>
          ) : (
            <div className="space-y-4">
              {/* Vùng chứa Biểu đồ Cột */}
              <div className="h-72 flex items-end justify-between gap-3 sm:gap-6 pt-10 pb-2 px-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                {services.map((s, idx) => {
                  const amount = Number(s.amount || 0);
                  const discount = Number(s.discount || 0);
                  const debt = Number(s.debt || 0);

                  const heightAmount = Math.round((amount / maxAmount) * 100);
                  const heightDiscount = Math.round((discount / maxAmount) * 100);
                  const heightDebt = Math.round((debt / maxAmount) * 100);

                  return (
                    <div key={idx} className="flex-1 min-w-[100px] flex flex-col items-center h-full justify-end group relative">
                      
                      {/* Tooltip khi di chuột vào nhóm cột */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] py-2 px-3 rounded-xl pointer-events-none whitespace-nowrap z-30 shadow-lg space-y-0.5">
                        <div className="font-bold text-white border-b border-slate-700 pb-1 mb-1">{s.service} ({s.count ?? 0} lượt)</div>
                        <div className="text-emerald-300">Doanh thu: {amount.toLocaleString('vi-VN')} VNĐ</div>
                        <div className="text-purple-300">Chiết khấu: {discount.toLocaleString('vi-VN')} VNĐ</div>
                        <div className="text-rose-300">Nợ: {debt.toLocaleString('vi-VN')} VNĐ</div>
                      </div>

                      {/* Khung chứa 3 Cột nằm sát nhau: Doanh thu (Xanh) - Chiết khấu (Tím) - Nợ (Đỏ) */}
                      <div className="w-full flex items-end justify-center gap-1 h-full bg-slate-50/50 dark:bg-slate-900/30 p-1.5 rounded-t-xl border-t border-x border-slate-100 dark:border-slate-700/50">
                        
                        {/* Cột 1: Doanh thu (Màu Xanh Emerald) */}
                        <div className="flex-1 flex flex-col items-center h-full justify-end">
                          <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5 truncate max-w-full">
                            {amount >= 1000000 ? `${(amount / 1000000).toFixed(1)}M` : amount > 0 ? `${(amount / 1000).toFixed(0)}k` : '0'}
                          </span>
                          <div className="w-full bg-slate-100 dark:bg-slate-700/40 rounded-t-md overflow-hidden flex items-end h-full">
                            <div
                              style={{ height: `${amount > 0 ? Math.max(heightAmount, 4) : 0}%` }}
                              className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 hover:from-emerald-500 hover:to-teal-300 rounded-t-md transition-all duration-500 ease-out shadow-sm"
                            ></div>
                          </div>
                        </div>

                        {/* Cột 2: Chiết khấu (Màu Tím) */}
                        <div className="flex-1 flex flex-col items-center h-full justify-end">
                          <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400 mb-0.5 truncate max-w-full">
                            {discount >= 1000000 ? `${(discount / 1000000).toFixed(1)}M` : discount > 0 ? `${(discount / 1000).toFixed(0)}k` : '0'}
                          </span>
                          <div className="w-full bg-slate-100 dark:bg-slate-700/40 rounded-t-md overflow-hidden flex items-end h-full">
                            <div
                              style={{ height: `${discount > 0 ? Math.max(heightDiscount, 4) : 0}%` }}
                              className="w-full bg-gradient-to-t from-purple-600 to-indigo-400 hover:from-purple-500 hover:to-indigo-300 rounded-t-md transition-all duration-500 ease-out shadow-sm"
                            ></div>
                          </div>
                        </div>

                        {/* Cột 3: Nợ (Màu Đỏ) */}
                        <div className="flex-1 flex flex-col items-center h-full justify-end">
                          <span className="text-[9px] font-semibold text-rose-600 dark:text-rose-400 mb-0.5 truncate max-w-full">
                            {debt >= 1000000 ? `${(debt / 1000000).toFixed(1)}M` : debt > 0 ? `${(debt / 1000).toFixed(0)}k` : '0'}
                          </span>
                          <div className="w-full bg-slate-100 dark:bg-slate-700/40 rounded-t-md overflow-hidden flex items-end h-full">
                            <div
                              style={{ height: `${debt > 0 ? Math.max(heightDebt, 4) : 0}%` }}
                              className="w-full bg-gradient-to-t from-rose-600 to-red-400 hover:from-rose-500 hover:to-red-300 rounded-t-md transition-all duration-500 ease-out shadow-sm"
                            ></div>
                          </div>
                        </div>

                      </div>

                      {/* Tên dịch vụ hiển thị ở chân trục hoành */}
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-2 truncate max-w-full text-center" title={s.service}>
                        {s.service}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chú thích màu sắc (Legend) */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-3 px-1 pt-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-600 to-teal-400 inline-block"></span>
                    Doanh thu
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-purple-600 to-indigo-400 inline-block"></span>
                    Chiết khấu (Tím)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-rose-600 to-red-400 inline-block"></span>
                    Công nợ (Đỏ)
                  </span>
                </div>
                <span>Trục tung: Tỷ lệ quy đổi số tiền (VNĐ)</span>
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