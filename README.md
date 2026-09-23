# 🦷 Dental Clinic AI - Hệ Thống Quản Lý Phòng Khám Nha Khoa Tích Hợp AI

**Dental Clinic AI** là hệ thống quản lý phòng khám nha khoa toàn diện tích hợp trợ lý AI thông minh. Hệ thống được thiết kế theo kiến trúc tách biệt Frontend và Backend, hỗ trợ quản lý toàn bộ quy trình vận hành từ tiếp đón bệnh nhân, xếp lịch hẹn khám, ghi nhận hồ sơ điều trị, lập hóa đơn thanh toán cho đến báo cáo doanh thu và bảo mật dữ liệu PII.

---

## 📌 Tính Năng Nổi Bật & Ràng Buộc Nghiệp Vụ

* **Phân quyền dựa trên vai trò (RBAC):** Hệ thống phân chia 5 vai trò riêng biệt gồm *Quản trị viên (Admin)*, *Lễ tân (Receptionist)*, *Bác sĩ (Doctor)*, *Kế toán (Accountant)* và *Bệnh nhân (Patient)* với ma trận quyền hạn chi tiết.

* **Chống trùng lịch hẹn tuyệt đối:** Sử dụng 2 ràng buộc `EXCLUDE` ở tầng cơ sở dữ liệu PostgreSQL (`no_doctor_overlap` và `no_chair_overlap`) trên kiểu dữ liệu `tstzrange`. Giúp ngăn chặn việc trùng lịch khám của bác sĩ hoặc ghế khám ngay cả khi xảy ra điều kiện tranh chấp (race condition).

* **Bảo mật dữ liệu cá nhân (PII Masking):** Tự động ẩn họ tên, số điện thoại, CCCD thành các token định danh trước khi gửi dữ liệu sang Google Gemini API và khôi phục lại khi nhận kết quả.

* **Trợ lý AI Gemini có Rào chắn (AI Guardrails):** AI đóng vai trò trợ lý hành chính (tóm tắt hồ sơ bệnh án, nhắc lịch hẹn, giải thích dịch vụ), không đưa ra chẩn đoán hay kê đơn y khoa, đi kèm câu cảnh báo bắt buộc.

* **Nhật ký hệ thống (Audit Log):** Tự động ghi lại nhật ký cho toàn bộ các thao tác nhạy cảm (xem/sửa hồ sơ bệnh án, hóa đơn, truy vấn AI).

---

## 🏗️ Kiến Trúc Hệ Thống & Công Nghệ

### 1. Sơ đồ kiến trúc tổng quan

```text
┌─────────────────┐      HTTPS       ┌──────────────────┐
│  Vercel         │ ───────────────▶│  FastAPI Backend │
│  (Frontend)     │   VITE_API_      │  (Docker/VPS)    │
│  React + Vite   │   BASE_URL       │  /api/v1/...     │
└─────────────────┘                  └────────┬─────────┘
                                              │
                                              │ DATABASE_URL
                                              ▼
                                       ┌──────────────────┐
                                       │  PostgreSQL      │
                                       │  (Neon/Supabase) │
                                       └──────────────────┘
```

(Chi tiết mô hình triển khai Production xem tại `PRODUCTION-DEPLOYMENT.md`).

### 2. Công nghệ sử dụng

* **Backend:** Python 3.11/3.12, FastAPI, SQLAlchemy, Alembic, Pydantic, Pytest.

* **Frontend:** React, Vite, Tailwind CSS, Axios, React Router.

* **Database:** PostgreSQL 14+ (hỗ trợ `tstzrange` và `btree_gist` extension).

* **Tích hợp AI:** Google Gemini API (`gemini-2.0-flash` / `gemini-1.5-flash` / `gemini-3.6-flash`).

* **Đóng gói & Chạy nhanh:** Docker Desktop, Docker Compose, Windows Batch Scripts (`.bat`).

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
dental-clinic-ai/
├── start_project.bat           # Script khởi chạy tự động cả Backend & Frontend
├── INSTALLATION-GUIDE.md       # Hướng dẫn cài đặt chi tiết
├── ENV-SETUP-GUIDE.md          # Hướng dẫn thiết lập biến môi trường
├── PRODUCTION-DEPLOYMENT.md    # Hướng dẫn triển khai Production
│
├── backend/                    # Mã nguồn Backend Python / FastAPI
│   ├── app/                    # Module ứng dụng chính (Routers, Models, RBAC, PII, AI)
│   ├── alembic/                # Migration cơ sở dữ liệu
│   ├── tests/                  # Kiểm thử tự động Pytest
│   ├── Dockerfile              # Dockerfile đóng gói Backend
│   ├── docker-compose.yml      # Cấu hình Docker Compose (FastAPI + PostgreSQL)
│   ├── run_docker.bat          # Script khởi chạy Backend bằng Docker
│   └── run_venv.bat            # Script khởi chạy Backend bằng Python venv
│
└── frontend/                   # Mã nguồn Frontend React / Vite
    ├── src/                    # Components, Pages, API Clients, Routes
    ├── package.json            # Thư viện phụ thuộc Node.js
    ├── vite.config.js          # Cấu hình Server Vite
    └── start_frontend.bat      # Script khởi chạy Frontend nhanh
```

---

## ⚙️ Yêu Cầu Môi Trường

Để chạy được ứng dụng, máy tính cần cài đặt sẵn:

* **Python**: `3.11` hoặc `3.12` (Khuyên dùng `3.12`).

* **Node.js**: `v18.0.0` trở lên & **npm**: `v9.0.0` trở lên.

* **PostgreSQL**: `14+` (Trường hợp chạy local không qua Docker).

* **Docker Desktop**: Bản mới nhất (Trường hợp chạy qua Docker).

* **Google Gemini API Key**: Khóa truy cập lấy tại [Google AI Studio](https://aistudio.google.com/app/apikey?utm_source=gemini).

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

### Cách 1: Tự động hóa bằng Script Batch `start_project.bat` với Docker (Dành cho Windows - Khuyên dùng)

1. Bật ứng dụng **Docker Desktop**.

2. Đảm bảo đã thiết lập các file `.env` ở cả thư mục `backend/` và `frontend/`.

3. Nhấp đúp chuột vào file **`start_project.bat`** ở thư mục gốc.

> **Quy trình script tự thực hiện:**
>
> 1. Mở cửa sổ CMD khởi chạy `backend/run_docker.bat` (kiểm tra mã nguồn, build container và bật Docker).
> 
> 2. Chờ 5 giây khởi tạo ứng dụng.
> 
> 3. Mở cửa sổ CMD khởi chạy `frontend/start_frontend.bat` (kiểm tra `node_modules`, cài thư viện và chạy `npm run dev`).

---

### Cách 2: Khởi chạy thủ công từng phần

#### 1. Khởi chạy Backend

* **Chạy bằng Docker Compose:**
```cmd
cd backend
docker compose up --build

```

(Truy cập Swagger UI tại: [http://localhost:8000/docs](http://localhost:8000/docs?utm_source=gemini))

* **Chạy bằng môi trường ảo Python (Local):**

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000

```

#### 2. Khởi chạy Frontend

```cmd
cd frontend
npm install
npm run dev

```

(Giao diện Web hiển thị tại: [http://localhost:5173](http://localhost:5173?utm_source=gemini))

---

## 🔑 Cấu Hình Biến Môi Trường (`.env`)

### 1. Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql+psycopg2://postgres:your_password@localhost:5432/dental_clinic_ai

# Security & Auth
JWT_SECRET=your_32_character_random_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI Config
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Mail Server (Gmail SMTP)
MAIL_USERNAME=example@gmail.com
MAIL_PASSWORD=your_16_digit_app_password
MAIL_FROM=example@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

```

(Chi tiết hướng dẫn lấy API key và tạo `JWT_SECRET` xem thêm tại `ENV-SETUP-GUIDE.md`).

### 2. Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1

```

---

## 👥 Tài Khoản Dùng Thử (Demo Accounts)

Sau khi nạp dữ liệu mẫu bằng câu lệnh `python -m app.seed` (hoặc khởi chạy Docker mặc định), hệ thống cung cấp các tài khoản thử nghiệm tương ứng với từng vai trò:

* **Mật khẩu chung cho tất cả tài khoản**: `Demo@123`

| Vai trò (Role) | Email Đăng Nhập | Nhiệm vụ chính |
| --- | --- | --- |
| **Quản trị viên (Admin)** | `admin@nhakhoa.vn`<br> | Quản lý tài khoản, cấu hình hệ thống, xem Audit Logs|
| **Lễ tân (Receptionist)** | `letan@nhakhoa.vn`<br> | Tiếp đón, xếp lịch hẹn, quản lý ghế khám, lập hóa đơn|
| **Bác sĩ (Doctor)** | `bacsi@nhakhoa.vn`<br> | Xem lịch khám, ghi nhận hồ sơ điều trị, kê đơn/dịch vụ|
| **Kế toán (Accountant)** | `ketoan@nhakhoa.vn`<br> | Quản lý hóa đơn, thanh toán, xem báo cáo doanh thu|
| **Bệnh nhân (Patient)** | `benhnhan@nhakhoa.vn`<br> | Tra cứu lịch sử khám, xem hồ sơ bệnh án cá nhân, đặt lịch|

---

## 🧪 Kiểm Thử Tự Động (Testing)

Hệ thống hỗ trợ kiểm thử tự động cho Backend với `pytest`:

```cmd
cd backend
pip install pytest pytest-asyncio
pytest -q

```

* Mặc định kiểm thử chạy trên **SQLite in-memory**.

* Để kiểm thử đầy đủ các ràng buộc chống trùng lịch `EXCLUDE` của PostgreSQL, cần cấu hình trỏ tới cơ sở dữ liệu PostgreSQL rỗng:

```cmd
set TEST_DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/dental_test
pytest -q

```

---

## 🌐 Danh Sách API Endpoints Chính (`/api/v1`)

| Phân nhóm | Endpoint tiêu biểu | Chức năng chính |
| --- | --- | --- |
| **Auth** | `POST /auth/login`, `GET /auth/me` | Đăng nhập OAuth2 lấy Bearer Token, kiểm tra thông tin phiên|
| **Patients** | `GET/POST /patients/`, `GET/PUT /patients/{id}` | Quản lý danh sách và hồ sơ bệnh nhân|
| **Doctors** | `GET/POST /doctors/`, `GET /doctors/{id}/schedules` | Quản lý bác sĩ và lịch làm việc|
| **Appointments** | `GET/POST /appointments/`, `PUT /appointments/{id}` | Đặt lịch, đổi lịch, hủy lịch hẹn|
| **Records** | `GET/POST /records/`, `PUT /records/{id}` | Lập và cập nhật hồ sơ điều trị y khoa|
| **Invoices** | `POST /invoices/`, `POST /invoices/from-record/{id}` | Lập hóa đơn từ hồ sơ điều trị & thanh toán|
| **AI Assistant** | `POST /ai/summarize-record`, `POST /ai/reminder` | Trợ lý AI tóm tắt bệnh án, tạo tin nhắn nhắc lịch|

---

## 📄 Tài Liệu Tham Khảo Thêm

* **`INSTALLATION-GUIDE.md`**: Hướng dẫn cài đặt & khởi chạy chi tiết từng bước.

* **`ENV-SETUP-GUIDE.md`**: Hướng dẫn chi tiết cách tạo và lấy các biến môi trường nhạy cảm.

* **`PRODUCTION-DEPLOYMENT.md`**: Hướng dẫn tự host hệ thống trên VPS, Vercel, Neon/Supabase và cấu hình Nginx/SSL.

* **`backend/BACKEND.md`**: Tài liệu chuyên sâu về cấu trúc code Backend, Alembic migrations và RBAC.

* **`frontend/FRONTEND.md`**: Tài liệu chi tiết về kiến trúc Frontend React/Vite và luồng gọi API.