import React from 'react';

export default function VisitChartModal({ isOpen, onClose, visits }) {
  if (!isOpen) return null;

  // Tính tổng số lượt đến và số lượt hủy trong 14 ngày
  const totalCompleted = visits.reduce((sum, v) => {
    return sum + (v.completed ?? v.completed_appointments ?? 0);
  }, 0);

  const totalCancelled = visits.reduce((sum, v) => {
    return sum + (v.cancelled ?? v.cancelled_appointments ?? 0);
  }, 0);

  const total = totalCompleted + totalCancelled;

  // Tính phần trăm
  const completedPercent = total > 0 ? Math.round((totalCompleted / total) * 100) : 0;
  const cancelledPercent = total > 0 ? 100 - completedPercent : 0;

  // Tính góc SVG cho Biểu đồ tròn
  // Đường tròn có bán kính r = 16, chu vi C = 2 * π * 16 ≈ 100.53
  const circumference = 2 * Math.PI * 16;
  const completedStroke = (completedPercent / 100) * circumference;
  const cancelledStroke = circumference - completedStroke;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📊</span> Biểu đồ Lượt khám 14 ngày qua
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1 rounded-lg transition-all"
          >
            ✕
          </button>
        </div>

        {/* Nội dung Biểu đồ tròn */}
        <div className="flex flex-col items-center justify-center py-2">
          {total === 0 ? (
            <p className="text-slate-400 py-8">Không có dữ liệu lượt khám trong 14 ngày qua</p>
          ) : (
            <>
              {/* Pie Chart SVG */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 42 42">
                  {/* Vòng nền / Lượt hủy (Rose color) */}
                  <circle
                    cx="21"
                    cy="21"
                    r="16"
                    fill="transparent"
                    stroke="#f43f5e"
                    strokeWidth="8"
                  />
                  {/* Vòng Lượt đến (Sky color) */}
                  <circle
                    cx="21"
                    cy="21"
                    r="16"
                    fill="transparent"
                    stroke="#0284c7"
                    strokeWidth="8"
                    strokeDasharray={`${completedStroke} ${circumference}`}
                    strokeDashoffset="0"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Thông tin ở tâm biểu đồ */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Tổng cộng</span>
                  <span className="text-2xl font-bold text-slate-800 dark:text-white">{total}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">lượt</span>
                </div>
              </div>

              {/* Chú thích Legend & Thống kê */}
              <div className="grid grid-cols-2 gap-4 w-full mt-6">
                {/* Lượt đến */}
                <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/60 p-3.5 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full bg-sky-600"></span>
                    <span className="text-xs font-semibold text-sky-900 dark:text-sky-300">Lượt đến</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-sky-700 dark:text-sky-400">{totalCompleted}</span>
                    <span className="text-xs font-medium text-sky-600 dark:text-sky-300">{completedPercent}%</span>
                  </div>
                </div>

                {/* Lượt hủy */}
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 p-3.5 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <span className="text-xs font-semibold text-rose-900 dark:text-rose-300">Lượt hủy</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{totalCancelled}</span>
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-300">{cancelledPercent}%</span>
                  </div>
                </div>
              </div>
            </>
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