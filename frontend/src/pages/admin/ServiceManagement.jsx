import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { serviceApi } from '../../api/serviceApi';

export default function ServiceManagement() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // State Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newService, setNewService] = useState({ code: '', name: '', price: '', description: '' });
  const [editingService, setEditingService] = useState(null);

  useEffect(() => {
    fetchServices();
  }, []);

  // Tự động chuyển về trang 1 khi tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Bóc tách thông báo lỗi chi tiết từ FastAPI 422
  const parseErrorMessage = (error, defaultMessage) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((err) => `${err.loc ? err.loc.join(' -> ') + ': ' : ''}${err.msg}`)
        .join('\n');
    }
    return defaultMessage;
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await serviceApi.getAll();
      const dataList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setServices(dataList);
    } catch (error) {
      console.error('Lỗi khi tải danh sách dịch vụ:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

	// Tự động tải lại danh sách dịch vụ sau 5 phút không tương tác (tạm dừng khi đang mở Modal thêm hoặc sửa)
	useIdleRefresh(fetchServices, 5 * 60 * 1000, showAddModal || !!editingService);

  // Thêm dịch vụ mới
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: newService.code.trim(),
        name: newService.name.trim(),
        price: parseFloat(newService.price) || 0,
        description: newService.description?.trim() || null,
      };
      await serviceApi.create(payload);
      setShowAddModal(false);
      setNewService({ code: '', name: '', price: '', description: '' });
      fetchServices();
    } catch (error) {
      console.error('Lỗi thêm dịch vụ:', error?.response?.data);
      alert(parseErrorMessage(error, 'Không thể tạo dịch vụ mới'));
    }
  };

  // Cập nhật thông tin dịch vụ
  const handleUpdateService = async (e) => {
    e.preventDefault();
    if (!editingService) return;
    try {
      const payload = {
        code: editingService.code.trim(),
        name: editingService.name.trim(),
        price: parseFloat(editingService.price) || 0,
        description: editingService.description?.trim() || null,
        is_active: editingService.is_active,
      };
      await serviceApi.update(editingService.id, payload);
      setEditingService(null);
      fetchServices();
    } catch (error) {
      console.error('Lỗi cập nhật dịch vụ:', error?.response?.data);
      alert(parseErrorMessage(error, 'Không thể cập nhật dịch vụ'));
    }
  };

  const handleToggleStatus = async (service) => {
    const actionName = service.is_active ? 'ngừng cung cấp' : 'kích hoạt lại';
    if (window.confirm(`Bạn có chắc muốn ${actionName} dịch vụ này?`)) {
      try {
        await serviceApi.delete(service.id);
        fetchServices();
      } catch (error) {
        alert(parseErrorMessage(error, `Lỗi khi ${actionName} dịch vụ`));
      }
    }
  };

  // Lọc dữ liệu tìm kiếm
  const filteredServices = services.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tính toán dữ liệu cho phân trang
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentServices = filteredServices.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Danh mục Dịch vụ Nha khoa</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý và cập nhật các dịch vụ trực tiếp trong CSDL</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all self-start md:self-auto"
        >
          ➕ Thêm Dịch vụ Mới
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">🔍</span>
          <input
            type="text"
            placeholder="Tìm kiếm theo mã, tên hoặc mô tả dịch vụ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Thanh cuộn ngang bằng overflow-x-auto */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Đang tải dữ liệu từ CSDL...</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 w-28">Mã DV</th>
                  <th className="p-4 w-52">Tên Dịch vụ</th>
                  <th className="p-4">Mô tả</th>
                  <th className="p-4 w-36 text-right">Đơn giá (VNĐ)</th>
                  <th className="p-4 w-40 text-center">Trạng thái</th>
                  <th className="p-4 w-48 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {currentServices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400 dark:text-slate-500">
                      {searchTerm ? 'Không tìm thấy dịch vụ phù hợp' : 'Chưa có dịch vụ nào trong CSDL'}
                    </td>
                  </tr>
                ) : (
                  currentServices.map((s) => (
                    <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${!s.is_active ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''}`}>
                      <td className="p-4 font-bold text-sky-700 dark:text-sky-400 whitespace-nowrap">{s.code}</td>
                      <td className="p-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{s.name}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={s.description || ''}>
                        {s.description || <span className="italic text-slate-300 dark:text-slate-600">Chưa có mô tả</span>}
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200 text-right whitespace-nowrap">
                        {Number(s.price || 0).toLocaleString('vi-VN')} ₫
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {s.is_active ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-transparent dark:border-emerald-800/50">
                            Đang cung cấp
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Đã ngừng cung cấp
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setEditingService({ ...s })}
                          className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium transition-colors border border-amber-200/60 dark:border-amber-800/50"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                            s.is_active
                              ? 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-800/50'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50'
                          }`}
                        >
                          {s.is_active ? '🚫 Ngừng cung cấp' : '🔄 Kích hoạt lại'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Thanh Phân trang (Pagination) */}
        {!loading && filteredServices.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Hiển thị <span className="font-semibold text-slate-700 dark:text-slate-200">{startIndex + 1}</span> -{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.min(startIndex + itemsPerPage, filteredServices.length)}
              </span>{' '}
              trên <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredServices.length}</span> bản ghi
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ◀ Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sau ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm Dịch Vụ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Thêm Dịch vụ Mới</h3>
            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã Dịch vụ</label>
                <input
                  type="text"
                  required
                  value={newService.code}
                  onChange={(e) => setNewService({ ...newService, code: e.target.value })}
                  placeholder="VD: KHAM01"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Dịch vụ</label>
                <input
                  type="text"
                  required
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder="VD: Khám tổng quát"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Đơn giá (VNĐ)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                  placeholder="VD: 150000"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mô tả Dịch vụ</label>
                <textarea
                  rows={3}
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  placeholder="Nhập mô tả chi tiết dịch vụ..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-xl shadow-md"
                >
                  Lưu vào CSDL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Dịch Vụ */}
      {editingService && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Chỉnh sửa Dịch vụ</h3>
            <form onSubmit={handleUpdateService} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã Dịch vụ</label>
                <input
                  type="text"
                  required
                  value={editingService.code || ''}
                  onChange={(e) => setEditingService({ ...editingService, code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Dịch vụ</label>
                <input
                  type="text"
                  required
                  value={editingService.name || ''}
                  onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Đơn giá (VNĐ)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editingService.price ?? ''}
                  onChange={(e) => setEditingService({ ...editingService, price: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mô tả Dịch vụ</label>
                <textarea
                  rows={3}
                  value={editingService.description || ''}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  placeholder="Nhập mô tả chi tiết dịch vụ..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl shadow-md"
                >
                  Cập nhật CSDL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}