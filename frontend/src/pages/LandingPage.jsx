import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/common/ThemeToggle';
import { getDashboardByRole } from '../utils/roleRedirect';

export default function LandingPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleGoToDashboard = () => {
    if (user && user.role) {
      navigate(getDashboardByRole(user.role));
    } else {
      navigate('/login');
    }
  };

  // Hàm chuyển đổi vai trò tiếng Anh sang tiếng Việt
  const getRoleLabel = (role) => {
    if (!role) return '';
    const r = String(role).toLowerCase();
    if (r.includes('admin')) return 'Quản trị viên';
    if (r.includes('doctor') || r.includes('bacsi')) return 'Bác sĩ';
    if (r.includes('reception') || r.includes('letan')) return 'Lễ tân';
    if (r.includes('accountant') || r.includes('ketoan')) return 'Kế toán';
    if (r.includes('patient') || r.includes('benhnhan')) return 'Bệnh nhân';
    return role;
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 transition-colors">
      
      {/* 🖼️ Lớp Background Image Mờ toàn trang */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-50 dark:opacity-75 transition-opacity"
        style={{ backgroundImage: `url('/bg_opacity.jpg')` }}
      />

      {/* Nội dung chính phủ lên trên Background */}
      <div className="relative z-10">

        {/* 1. Header Navigation */}
        <header className="sticky top-0 z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[5rem] py-3 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-sky-600/30">
                🦷
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-sky-600 to-cyan-500 dark:from-sky-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  Dental Care AI
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wider uppercase">
                  Hệ thống Nha khoa Thông minh
                </p>
              </div>
            </Link>

            {/* Menu điều hướng */}
            <nav className="hidden md:flex items-center space-x-8 font-medium text-slate-600 dark:text-slate-300">
              <a href="#about" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Giới thiệu</a>
              <a href="#ai-features" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Công nghệ AI</a>
              <a href="#services" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Dịch vụ</a>
              <a href="#contact" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Liên hệ</a>
            </nav>

            {/* Nút hành động Đăng nhập/Chuyển hướng + Câu xin chào */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated ? (
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={handleGoToDashboard}
                      className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm shadow-md shadow-sky-600/20 transition-all flex items-center gap-2"
                    >
                      <span>Vào Trang Quản lý</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                    <button
                      onClick={logout}
                      className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-all"
                    >
                      Đăng xuất
                    </button>
                  </div>
                  {user && (
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50/90 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-sm font-medium shadow-sm backdrop-blur-sm">
                      👋 Xin chào,<strong className="font-bold text-sky-700 dark:text-sky-300"><em className="italic">{getRoleLabel(user.role)}</em>: {user.full_name || user.email}</strong>!
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-xl border border-sky-600 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 font-medium transition-all"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-md shadow-sky-600/20 transition-all"
                  >
                    Đặt lịch khám
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 2. Hero Section (Giới thiệu) */}
        <section id="about" className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-sky-50/40 via-slate-50/60 to-white/70 dark:from-slate-900/60 dark:via-slate-900/80 dark:to-slate-900/90 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Cột trái: Văn bản */}
              <div className="space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-100/80 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 text-xs font-semibold backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-sky-600 dark:bg-sky-400 animate-pulse"></span>
                  Tích hợp Trợ lý Trí tuệ Nhân tạo AI
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight">
                  Chăm sóc nụ cười chuẩn <span className="text-sky-600 dark:text-sky-400">Y khoa Quốc tế</span>
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0">
                  Giải pháp quản lý và khám chữa bệnh nha khoa hiện đại. Tự động hóa lịch hẹn, tóm tắt bệnh án bằng AI, và tối ưu hóa vận hành cho đội ngũ y bác sĩ.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={handleGoToDashboard}
                        className="w-full sm:w-auto px-8 py-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-lg shadow-sky-600/30 transition-all text-center flex items-center justify-center gap-2"
                      >
                        <span>Vào Trang Quản Lý</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                      <button
                        onClick={logout}
                        className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold shadow-sm transition-all text-center"
                      >
                        Đăng xuất
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/register"
                        className="w-full sm:w-auto px-8 py-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-lg shadow-sky-600/30 transition-all text-center"
                      >
                        Đăng ký Khám bệnh
                      </Link>
                      <Link
                        to="/login"
                        className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold shadow-sm transition-all text-center"
                      >
                        Đăng nhập ngay
                      </Link>
                    </>
                  )}
                </div>

                {/* Thống kê nhanh */}
                <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200/80 dark:border-slate-800">
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">100%</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Chuyển đổi Số</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">03+</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Ghế khám Hiện đại</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">AI</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Tóm tắt Bệnh án</div>
                  </div>
                </div>
              </div>

              {/* Cột phải: Hình ảnh minh họa */}
              <div className="relative">
                <div className="absolute -inset-4 bg-sky-500/10 dark:bg-sky-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 transition-colors">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-sky-50/80 dark:bg-sky-950/50 border border-sky-100 dark:border-sky-900/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold">
                          Dr
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">Lịch hẹn sắp tới</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Bác sĩ phòng khám có thâm niên lâu năm và tay nghề cao</div>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                        Đã xác nhận
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-2">
                      <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                        🤖 Gemini AI Summary
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        "Hệ thống tích hợp ứng dụng trí tuệ nhân tạo giúp hỗ trợ và đem lại trải nghiệm tuyệt vời và mới lạ cho người dùng!"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                        <div className="text-xs text-slate-400 dark:text-slate-400">Quản lý Ghế</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">Ghế 01 - Sẵn sàng</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                        <div className="text-xs text-slate-400 dark:text-slate-400">Minh bạch</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">Hóa đơn Điện tử</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Khu vực Tính năng AI */}
        <section id="ai-features" className="py-16 bg-gradient-to-b from-white/80 via-sky-50/30 to-slate-50/80 dark:from-slate-900/80 dark:via-slate-900/90 dark:to-slate-900/95 border-y border-sky-100/60 dark:border-slate-800 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                Ứng dụng Trí tuệ Nhân tạo AI
              </span>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mt-3">
                Tính năng AI Hỗ trợ Khám chữa bệnh
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300 text-base">
                Tối ưu hóa quy trình chăm sóc khách hàng và hỗ trợ chuyên môn y tế với sức mạnh từ Gemini AI.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* AI Feature 1 */}
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-8 rounded-2xl shadow-md hover:shadow-xl border border-slate-100 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-500 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-slate-700 group-hover:bg-sky-600 text-sky-700 dark:text-sky-400 group-hover:text-white flex items-center justify-center text-2xl transition-colors mb-6 shadow-sm">
                  📲
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
                  Sinh & Nhận tin nhắn nhắc lịch tái khám AI
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tự động khởi tạo và gửi tin nhắn nhắc lịch tái khám cá nhân hóa cho từng bệnh nhân, đảm bảo đúng tiến trình điều trị.
                </p>
              </div>

              {/* AI Feature 2 */}
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-8 rounded-2xl shadow-md hover:shadow-xl border border-slate-100 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-500 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-slate-700 group-hover:bg-sky-600 text-sky-700 dark:text-sky-400 group-hover:text-white flex items-center justify-center text-2xl transition-colors mb-6 shadow-sm">
                  💡
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
                  Giải thích dịch vụ nha khoa AI
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Giải thích chi tiết, ngắn gọn và dễ hiểu về các gói dịch vụ, quy trình kỹ thuật cũng như chi phí điều trị cho bệnh nhân.
                </p>
              </div>

              {/* AI Feature 3 */}
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-8 rounded-2xl shadow-md hover:shadow-xl border border-slate-100 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-500 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-slate-700 group-hover:bg-sky-600 text-sky-700 dark:text-sky-400 group-hover:text-white flex items-center justify-center text-2xl transition-colors mb-6 shadow-sm">
                  📋
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
                  Tóm tắt hồ sơ điều trị AI
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tóm tắt tự động quá trình chẩn đoán, tiền sử bệnh lý và kết quả điều trị giúp Bác sĩ cũng như Bệnh nhân theo dõi nhanh chóng.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Dịch vụ nổi bật Section */}
        <section id="services" className="py-20 bg-white/70 dark:bg-slate-900/80 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Dịch vụ Nha khoa Chất lượng cao</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Đội ngũ bác sĩ giàu kinh nghiệm kết hợp cùng quy trình điều trị được tối ưu hóa.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: 'Khám & Tư vấn Tổng quát', code: 'KHAM01', price: '100.000 VNĐ', desc: 'Thăm khám, kiểm tra tình trạng răng miệng tổng quát.' },
                { title: 'Lấy cao răng', code: 'CAO01', price: '300.000 VNĐ', desc: 'Làm sạch vôi răng, đánh bóng bề mặt răng nhẹ nhàng.' },
                { title: 'Trám răng Composite', code: 'TRAM01', price: '500.000 VNĐ', desc: 'Phục hồi răng sâu hoặc sứt bằng vật liệu cao cấp.' },
                { title: 'Điều trị Tủy răng', code: 'TUY01', price: '1.500.000 VNĐ', desc: 'Làm sạch và trám bít hệ thống ống tủy chuẩn y khoa.' },
                { title: 'Tẩy trắng răng', code: 'TRANG01', price: '2.000.000 VNĐ', desc: 'Tẩy trắng răng công nghệ đèn Plasma an toàn.' },
                { title: 'Bọc răng sứ', code: 'SU01', price: '3.500.000 VNĐ', desc: 'Phục hình răng sứ thẩm mỹ tự nhiên, độ bền cao.' },
              ].map((service) => (
                <div key={service.code} className="p-6 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-sky-50/70 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/80 hover:border-sky-200 dark:hover:border-sky-500 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-950 px-2.5 py-1 rounded-lg">
                      {service.code}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{service.price}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{service.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Footer */}
        <footer id="contact" className="bg-slate-900/95 backdrop-blur-md text-slate-400 py-12 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold">
                  🦷
                </div>
                <span className="text-lg font-bold text-white">Dental Care AI Management System</span>
              </div>
              <p className="text-sm text-slate-400 max-w-sm">
                Hệ thống quản lý phòng khám nha khoa tích hợp trí tuệ nhân tạo Gemini, đáp ứng đầy đủ quy trình nghiệp vụ từ Lễ tân, Bác sĩ, Kế toán đến Bệnh nhân.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Liên hệ</h4>
              <ul className="space-y-2 text-sm">
                <li>📍 123 P. Phan Đình Phùng, T. Thái Nguyên</li>
                <li>📞 Hotline: 0901 234 567</li>
                <li>✉️ Email: support@nhakhoa.vn</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Giờ làm việc</h4>
              <ul className="space-y-2 text-sm">
                <li>Thứ 2 - Thứ 7: 08:00 - 17:00</li>
                <li>Chủ nhật: 08:00 - 12:00</li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-slate-800 text-center text-xs text-slate-500">
            © 2026 Dental Care AI System. Tất cả quyền được bảo lưu.
          </div>
        </footer>

      </div>
    </div>
  );
}