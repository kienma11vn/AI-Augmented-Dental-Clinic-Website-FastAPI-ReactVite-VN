import React, { useState, useEffect, useMemo } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { serviceApi } from '../../api/serviceApi';
import aiApi from '../../api/aiApi';

const ITEMS_PER_PAGE = 10;

export default function PatientServicesList() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // State theo dõi dịch vụ đang được AI giải thích
  const [explainingId, setExplainingId] = useState(null);

  // Reset về trang 1 khi từ khóa tìm kiếm thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Tải danh sách dịch vụ từ API
	const fetchServices = async () => {
	  try {
		setLoading(true);
		setError('');
		const res = await serviceApi.getAll();
		setServices(res.data || []);
	  } catch (err) {
		console.error('Lỗi khi tải danh sách dịch vụ:', err);
		setError('Không thể tải danh sách dịch vụ. Vui lòng thử lại sau!');
	  } finally {
		setLoading(false);
	  }
	};

	useEffect(() => {
	  fetchServices();
	}, []);

	// Tự động làm mới danh sách dịch vụ sau 5 phút không tương tác (tạm dừng khi AI đang phân tích)
	useIdleRefresh(fetchServices, 5 * 60 * 1000, explainingId !== null);

  // Lọc dịch vụ theo tên hoặc mã dịch vụ
  const filteredServices = useMemo(() => {
    if (!searchTerm.trim()) return services;
    const term = searchTerm.toLowerCase().trim();
    return services.filter(
      (item) =>
        item.name?.toLowerCase().includes(term) ||
        item.code?.toLowerCase().includes(term)
    );
  }, [services, searchTerm]);

  // Tính toán dữ liệu phân trang (10 bản ghi / trang)
  const totalPages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE) || 1;

  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredServices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredServices, currentPage]);

  // Định dạng tiền tệ VNĐ
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount || 0);
  };

  // Hàm xử lý gọi AI giải thích dịch vụ và hiển thị Alert tương tự PatientAppointments
  const handleExplainAI = async (service) => {
    if (!service) return;

    setExplainingId(service.id);

    try {
      // Gọi API của AI (aiApi.js) gửi prompt cho Gemini
      const response = await aiApi.explainService({
        service_name: service.name,
        description: service.description || 'Dịch vụ chăm sóc và điều trị nha khoa',
      });

      // Lấy câu trả lời trả về từ Gemini
      const resultText = response?.data?.result || response?.result;

      if (resultText) {
        // Hiển thị ra màn hình dạng thông báo Alert
        alert(`🤖 GIẢI THÍCH DỊCH VỤ NHA KHOA (GEMINI AI):\n\n${resultText}`);
      } else {
        alert('⚠️ Không nhận được phản hồi giải thích từ AI.');
      }
    } catch (error) {
      console.error('Lỗi khi gọi AI giải thích dịch vụ:', error);
      const detailError =
        error.response?.data?.detail ||
        'Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!';
      alert(`❌ Lỗi giải thích dịch vụ: ${detailError}`);
    } finally {
      setExplainingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-6 md:p-8 max-w-6xl mx-auto">
      {/* Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 dark:border-slate-700 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            🦷 Tra cứu dịch vụ nha khoa
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tra cứu bảng giá và thông tin chi tiết các dịch vụ tại phòng khám
          </p>
        </div>
      </div>

      {/* Ô tìm kiếm */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
            🔍
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm dịch vụ theo tên hoặc mã..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
        </div>
      </div>

      {/* Trạng thái Loading / Lỗi */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600"></div>
          <span className="ml-3 text-slate-600 dark:text-slate-300 font-medium">
            Đang tải danh sách dịch vụ...
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-xl mb-6 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Bảng danh sách dịch vụ */}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3.5 px-4">Mã DV</th>
                <th className="py-3.5 px-4">Tên dịch vụ</th>
                <th className="py-3.5 px-4">Mô tả</th>
                <th className="py-3.5 px-4 text-right">Đơn giá</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
              {filteredServices.length > 0 ? (
                paginatedServices.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-sky-700 dark:text-sky-400">
                      {service.code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                      {service.name}
                    </td>
                    <td
                      className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate"
                      title={service.description}
                    >
                      {service.description || 'Chưa có mô tả'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(service.price ?? service.unit_price)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          service.is_active
                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {service.is_active ? 'Đang áp dụng' : 'Ngưng cung cấp'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleExplainAI(service)}
                        disabled={explainingId === service.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {explainingId === service.id ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>Đang phân tích...</span>
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            <span>Giải thích dịch vụ bằng AI</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-400 dark:text-slate-500"
                  >
                    Không tìm thấy dịch vụ nào phù hợp với từ khóa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* THANH PHÂN TRANG */}
          {filteredServices.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                Hiển thị <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> -{' '}
                <strong>
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredServices.length)}
                </strong>{' '}
                trên tổng số <strong>{filteredServices.length}</strong> bản ghi
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
          )}
        </div>
      )}
    </div>
  );
}