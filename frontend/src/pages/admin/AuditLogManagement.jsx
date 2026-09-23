import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { auditApi } from '../../api/auditApi';

export default function AuditLogManagement() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const limit = 15;

  useEffect(() => {
    fetchAuditLogs();
  }, [page, selectedEntity, startDate, endDate]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await auditApi.getAll({
        skip: page * limit,
        limit: limit,
        ...(selectedEntity && { entity: selectedEntity }),
        ...(searchTerm && { search: searchTerm }),
		...(startDate && { startDate }),
		...(endDate && { endDate }),
      });
      const logList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setLogs(logList);
    } catch (err) {
      console.error('Lỗi tải nhật ký hệ thống:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Tự động tải lại nhật ký hệ thống sau 5 phút không tương tác (tạm dừng khi đang xem Modal chi tiết JSON)
	useIdleRefresh(fetchAuditLogs, 5 * 60 * 1000, !!selectedLog);

  // Hàm xuất file Audit Log (Giới hạn tối đa 50.000 ký tự)
  const handleExportLogs = async () => {
    setExporting(true);
    try {
      const res = await auditApi.export();
    
      // Đảm bảo lấy đúng đối tượng Blob từ res.data nếu res là AxiosResponse
      const blobData = res.data ? res.data : res;
      const blob = new Blob([blobData], { type: 'application/json' });
    
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi xuất file log:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchAuditLogs();
  };

  const getMethodBadge = (action) => {
    if (!action || typeof action !== 'string') return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
    if (action.startsWith('GET')) return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    if (action.startsWith('POST')) return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    if (action.startsWith('PUT') || action.startsWith('PATCH')) return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    if (action.startsWith('DELETE')) return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header & Nút xuất file */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Nhật ký Hệ thống (Audit Logs)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tất cả thao tác API và sự thay đổi dữ liệu của người dùng trong hệ thống
          </p>
        </div>
        <button
          onClick={handleExportLogs}
          disabled={exporting}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 gap-2 shrink-0"
        >
          {exporting ? 'Đang xuất file...' : '📥 Xuất File Log (Max 50k chars)'}
        </button>
      </div>

      {/* Thanh lọc & Tìm kiếm */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between overflow-x-auto">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm theo hành động, chi tiết..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
          >
            Tìm kiếm
          </button>
        </form>

		<div className="flex items-center gap-2 w-full md:w-auto">
			<input
			  type="date"
			  value={startDate}
			  onChange={(e) => setStartDate(e.target.value)}
			  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
			  title="Từ ngày"
			/>
			<span className="text-slate-400 text-xs">-</span>
			<input
			  type="date"
			  value={endDate}
			  onChange={(e) => setEndDate(e.target.value)}
			  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
			  title="Đến ngày"
			/>
			{(startDate || endDate) && (
			  <button
				type="button"
				onClick={() => { setStartDate(''); setEndDate(''); }}
				className="px-2.5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl text-xs hover:bg-slate-200 transition-all shrink-0"
				title="Xóa lọc ngày"
			  >
				✖ Hủy lọc
			  </button>
			)}
		  </div>

        <select
          value={selectedEntity}
          onChange={(e) => {
            setSelectedEntity(e.target.value);
            setPage(0);
          }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
        >
          <option value="">Tất cả Entity</option>
          <option value="patients">Bệnh nhân (Patients)</option>
          <option value="doctors">Bác sĩ (Doctors)</option>
          <option value="appointments">Lịch hẹn (Appointments)</option>
          <option value="records">Bệnh án (Records)</option>
          <option value="invoices">Hóa đơn (Invoices)</option>
          <option value="auth">Xác thực (Auth)</option>
          <option value="ai">Trí tuệ nhân tạo (AI)</option>
        </select>
      </div>

      {/* Bảng Dữ liệu */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Hành động API</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Chi tiết</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                    Đang tải nhật ký...
                  </td>
                </tr>
              ) : !Array.isArray(logs) || logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                    Không tìm thấy bản ghi nhật ký nào.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">#{log.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                      {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {log.user ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{log.user.full_name}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-400">
                            {log.user.email} (ID: #{log.user.id})
                          </span>
                          <span className="inline-block mt-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono w-max uppercase">
                            {log.user.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-xs">Khách / System</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${getMethodBadge(
                          log.action
                        )}`}
                      >
                        {log.action || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 capitalize">{log.entity || '-'}</td>
                    <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-medium transition-all"
                      >
                        Xem JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Nút Điều hướng Phân trang */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Trang {page + 1}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              Trang trước
            </button>
            <button
              disabled={!Array.isArray(logs) || logs.length < limit}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal Xem Chi tiết */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">Chi tiết Nhật ký #{selectedLog.id}</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Thời gian:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString('vi-VN') : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Người thực hiện (User ID):</span>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{selectedLog.user_id || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Hành động:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{selectedLog.action || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-400 block">Entity:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{selectedLog.entity || 'N/A'}</p>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 dark:text-slate-400 block mb-1">Dữ liệu chi tiết (Details Payload):</span>
                <pre className="p-4 bg-slate-900 text-sky-400 dark:bg-slate-950 dark:text-sky-300 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 dark:border-slate-800">
                  {(() => {
                    try {
                      return JSON.stringify(
                        typeof selectedLog.details === 'string'
                          ? JSON.parse(selectedLog.details)
                          : selectedLog.details,
                        null,
                        2
                      );
                    } catch {
                      return selectedLog.details || 'Không có chi tiết';
                    }
                  })()}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-xl transition-all"
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