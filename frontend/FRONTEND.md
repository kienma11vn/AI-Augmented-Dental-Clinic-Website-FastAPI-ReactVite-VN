# 🦷 Dental Clinic AI - Frontend — Hệ thống Quản lý Nha khoa Tích hợp AI

Hệ thống Quản lý Phòng khám Nha khoa Tích hợp AI được xây dựng bằng **React**, **Vite**, **Tailwind CSS** và **Axios**.

---

## 📁 Cấu trúc thư mục

Cấu trúc chi tiết của thư mục `frontend/`:

```
frontend/
├── public/                     # Tài nguyên tĩnh không qua đóng gói (favicon, logo, icons)
├── src/
│   ├── api/                    # Tầng giao tiếp API (Axios Client & API Modules)
│   │   ├── axiosClient.js      # Base Axios instance (cấu hình Interceptors, baseURL)
│   │   ├── authApi.js          # API Đăng nhập, Đăng ký, Thông tin cá nhân
│   │   ├── patientsApi.js      # API Quản lý Hồ sơ Bệnh nhân
│   │   ├── doctorsApi.js       # API Bác sĩ & Lịch làm việc
│   │   ├── chairsApi.js        # API Quản lý Ghế khám
│   │   ├── appointmentsApi.js  # API Đặt lịch, Đổi lịch, Hủy lịch
│   │   ├── servicesApi.js      # API Danh mục Dịch vụ Nha khoa
│   │   ├── recordsApi.js       # API Hồ sơ Điều trị Medical Records
│   │   ├── invoicesApi.js      # API Lập Hóa đơn & Thanh toán
│   │   ├── reportsApi.js       # API Báo cáo & Thống kê Doanh thu
│   │   ├── aiApi.js            # API Trợ lý AI Gemini (Tóm tắt, Nhắc lịch, Giải thích)
│   │   └── auditApi.js         # API Truy vấn Nhật ký Hệ thống (Audit Logs)
│   ├── assets/                 # Hình ảnh mã hóa, logo phòng khám, font chữ tĩnh
│   ├── components/             # Reusable UI Components (Header, Navbar, Modal, Button...)
│   ├── context/                # React Contexts (AuthContext.jsx, ThemeContext.jsx)
│   ├── pages/                  # Màn hình giao diện theo vai trò người dùng
│   │   ├── auth/               # Login, Register, ForgotPassword
│   │   ├── admin/              # Dashboard Quản trị, Quản lý Tài khoản, Audit Logs
│   │   ├── doctor/             # Dashboard Lịch khám Bác sĩ, Ghi nhận Hồ sơ Điều trị
│   │   ├── patient/            # Dashboard Tra cứu Lịch sử Khám, Đặt lịch hẹn Cá nhân
│   │   ├── accountant/         # Dashboard Quản lý doanh thu phòng khám
│   │   └── receptionist/       # Dashboard Tiếp đón, Đặt lịch khám, Lập hóa đơn
│   ├── routes/                 # Định tuyến & Phân quyền Tuyến đường (AppRoutes.jsx)
│   ├── App.jsx                 # Root Component chính
│   ├── main.jsx                # Entry point chính của ứng dụng React
│   └── index.css               # Cấu hình Tailwind CSS directives và Global Styles
├── .env                        # Lưu biến môi trường (VITE_API_BASE_URL)
├── index.html                  # HTML Template cho Vite
├── package.json                # Khai báo phụ thuộc (Dependencies) và NPM Scripts
├── tailwind.config.js          # Cấu hình Tailwind CSS theme, plugins
└── vite.config.js              # Cấu hình Server Vite (Port, Proxy, Build Target)
```

---

## 🛠️ Yêu cầu hệ thống
- `Node.js`: Phiên bản v18.0.0 trở lên.
- `npm`: Phiên bản v9.0.0 trở lên (đi kèm Node.js) hoặc yarn / pnpm.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Cách 1: Khởi chạy nhanh bằng Script Batch (`start-frontend.bat`) — Dành cho Windows

Dự án đã tích hợp sẵn file tự động kiểm tra dependencies và khởi chạy server.

1. Truy cập vào thư mục gốc của Frontend.
2. Nhấp đúp vào file **`start-frontend.bat`**.
3. File `.bat` sẽ tự động thực hiện:
   - Kiểm tra thư mục `node_modules`. Nếu chưa có, script sẽ tự động chạy `npm install`.
   - Khởi chạy ứng dụng ở chế độ phát triển (`npm run dev` hoặc `npm start`).
   
### Cách 2: Khởi chạy thủ công (Command Line / macOS / Linux)   

#### Bước 1: Mở thư mục Frontend

Mở terminal và di chuyển vào thư mục frontend:

```DOS
cd frontend
```

#### Bước 2: Cài đặt các thư viện phụ thuộc (Dependencies)

Chạy lệnh sau để cài đặt toàn bộ thư viện cần thiết (`react-router-dom`, `axios`, `tailwindcss`,...) đã thiết lập trong `package.json`:

```DOS
npm install
```

#### Bước 3: Cấu hình Biến môi trường

Tạo file `.env` tại thư mục gốc của `frontend` (hoặc sao chép từ `.env.example`):

```DOS
cp .env.example .env
```

Nội dung file `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1

```

#### Bước 4: Khởi chạy ở môi trường Phát triển (Development)

Chạy lệnh sau để khởi chạy ứng dụng Frontend trên local:

```DOS
npm run dev
# hoặc
npm start
```

Ứng dụng sẽ chạy tại địa chỉ mặc định: `http://localhost:5173`

---

## 📦 Các câu lệnh Script khả dụng

| Câu lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Khởi chạy server phát triển (Development Server) với Hot Reload. |
| `npm run build` | Biến dịch dự án thành các file tĩnh để triển khai sản xuất (Production Build). |
| `npm run preview` | Xem thử bản build production ở môi trường local. |
| `npm run lint` | Kiểm tra cú pháp và chất lượng mã nguồn bằng ESLint. |

---

## 📌 Kiểm tra địa chỉ truy cập

Sau khi khởi chạy thành công, ứng dụng thường sẽ sẵn sàng tại một trong các đường dẫn sau (tùy cấu hình framework):

- Vite / React: http://localhost:5173

- Next.js / Create React App: http://localhost:3000

- Vue CLI / Angular: http://localhost:8080 hoặc http://localhost:4200