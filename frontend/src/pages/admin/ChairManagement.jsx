import React, { useState, useEffect } from 'react';
import { useIdleRefresh } from '../../utils/useIdleRefresh';
import { chairApi } from '../../api/chairApi';

export default function ChairManagement() {
  const [chairs, setChairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChair, setEditingChair] = useState(null);
  const [formData, setFormData] = useState({ name: '', room: '', is_active: true });

  // Phân trang state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchChairs();
  }, []);

  // Tự động quay về trang 1 khi thay đổi từ khóa tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchChairs = async () => {
    setLoading(true);
    try {
      const res = await chairApi.getAll();
      setChairs(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách ghế khám:', err);
      setChairs([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Tự động tải lại danh sách ghế khám sau 5 phút không tương tác (tạm dừng khi mở Modal)
	useIdleRefresh(fetchChairs, 5 * 60 * 1000, isModalOpen);

  const handleOpenModal = (chair = null) => {
    if (chair) {
      setEditingChair(chair);
      setFormData({ name: chair.name || '', room: chair.room || '', is_active: chair.is_active ?? true });
    } else {
      setEditingChair(null);
      setFormData({ name: '', room: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingChair) {
        await chairApi.update(editingChair.id, formData);
      } else {
        await chairApi.create(formData);
      }
      setIsModalOpen(false);
      fetchChairs();
    } catch (err) {
      alert(err.response?.data?.detail || 'Thao tác thất bại');
    }
  };

  const handleDelete = async (chair) => {
    const isConfirmed = window.confirm(`Bạn có chắc chắn muốn xóa hoàn toàn ghế "${chair.name}" khỏi CSDL? Thao tác này không thể hoàn tác.`);
    if (!isConfirmed) return;

    try {
      await chairApi.delete(chair.id);
      fetchChairs();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể xóa ghế khám này.');
    }
  };

  const filteredChairs = chairs.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.room?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(filteredChairs.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedChairs = filteredChairs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-x-auto">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Quản lý Ghế khám</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Danh mục các ghế khám bệnh và phòng điều trị</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
        >
          + Thêm ghế khám mới
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
        <input
          type="text"
          placeholder="🔍 Tìm kiếm theo tên ghế hoặc phòng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Tên ghế</th>
              <th className="px-6 py-4">Phòng</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm text-slate-700 dark:text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</td>
              </tr>
            ) : filteredChairs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">Không tìm thấy ghế khám nào.</td>
              </tr>
            ) : (
              paginatedChairs.map((chair) => (
                <tr key={chair.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">#{chair.id}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white">{chair.name}</td>
                  <td className="px-6 py-4">{chair.room || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${chair.is_active !== false ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-transparent dark:border-emerald-800/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {chair.is_active !== false ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenModal(chair)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-sky-500 dark:hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(chair)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800 text-xs font-medium transition-all"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* THANH PHÂN TRANG */}
        {!loading && filteredChairs.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
            <div>
              Hiển thị <span className="font-semibold text-slate-800 dark:text-white">{startIndex + 1}</span> đến{' '}
              <span className="font-semibold text-slate-800 dark:text-white">
                {Math.min(startIndex + itemsPerPage, filteredChairs.length)}
              </span>{' '}
              trong tổng số <span className="font-semibold text-slate-800 dark:text-white">{filteredChairs.length}</span> ghế khám
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all text-slate-700 dark:text-slate-300"
              >
                Trước
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentPage === page
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all text-slate-700 dark:text-slate-300"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
              {editingChair ? 'Cập nhật Ghế khám' : 'Thêm Ghế khám mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tên ghế khám *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Phòng / Vị trí</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 dark:bg-slate-900"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300 font-medium">Hoạt động</label>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700 transition-colors"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}