# 🦷 Dental Clinic AI - Hướng Dẫn Cài Đặt & Khởi Chạy Hệ Thống

Tổng hợp cơ bản toàn bộ các bước cài đặt, cấu hình môi trường và khởi chạy cho cả 2 phần (module) **Backend** (Python/FastAPI) và **Frontend** (React/Vite) của hệ thống Quản lý Phòng khám Nha khoa Tích hợp AI.

***Vui lòng đọc `backend/BACKEND.md` và `frontend/FRONTEND.md` để biết chi tiết hơn cách cài đặt & khởi chạy hệ thống cùng cấu trúc mã nguồn hệ thống.***

---

## 1. Yêu cầu môi trường hệ thống

Để hệ thống hoạt động ổn định, máy tính của bạn cần đáp ứng các phiên bản công cụ sau:

- **Python**: Phiên bản `3.11` hoặc `3.12` *(khuyên dùng 3.12 — `psycopg2-binary` chưa có wheel chính thức cho Python 3.13)*.
- **Node.js**: Phiên bản `v18.0.0` trở lên.
- **npm**: Phiên bản `v9.0.0` trở lên (đi kèm với Node.js).
- **PostgreSQL**: Phiên bản `14+` *(Bắt buộc: hệ thống dùng `tstzrange` + `EXCLUDE` constraint để chống trùng lịch bác sĩ/ghế khám)*.
- **Google Gemini** API Key: Lấy tại [Google AI Studio](https://aistudio.google.com/app/apikey).
- **Docker Desktop**: Bản mới nhất nếu chọn phương án chạy qua Docker.

---

## 2. Khởi chạy Project nhanh bằng Script Batch (`start_project.bat`) với Docker — Dành cho Windows

Hệ thống đã tích hợp sẵn script **`start_project.bat`** ở thư mục gốc của dự án, giúp bạn tự động hóa việc khởi chạy đồng thời cả **Backend** (*chạy trên Docker*) và **Frontend** (*Node.js Dev Server*) chỉ với một thao tác.
### Các bước thực hiện:

1. **Chuẩn bị môi trường:**
   - Mở và đảm bảo ứng dụng **Docker Desktop** đang hoạt động.

   - Kiểm tra và đảm bảo các file cấu hình `.env` đã được thiết lập đầy đủ bên trong thư mục `backend/` và `frontend/`.

2. **Khởi chạy script:**
   - Nhấp đúp chuột (Double-click) trực tiếp vào file **`start_project.bat`** ở thư mục gốc của dự án.

   - Hoặc mở **Command Prompt (CMD)** tại thư mục gốc dự án và gõ lệnh:
     ```cmd
     start_project.bat
     ```

### Quy trình tự động xử lý của Script:

1. **Khởi chạy Backend:** Script mở một cửa sổ CMD mới mang tên `"Backend Server"` để tự động chạy `backend/run_docker.bat` (kiểm tra mã nguồn, build và bật Docker containers).

2. **Tạm dừng 5 giây:** Đợi các dịch vụ Backend (Database & FastAPI) bắt đầu khởi tạo.

3. **Khởi chạy Frontend:** Script mở tiếp cửa sổ CMD mới mang tên `"Frontend Server"` để chạy `frontend/start_frontend.bat` (kiểm tra `node_modules`, cài dependencies nếu thiếu và khởi chạy `npm run dev`).

### Kiểm tra sau khi khởi chạy:
Sau khi script hoàn tất, sẽ có **2 cửa sổ Command Prompt riêng biệt** hoạt động song song. Bạn có thể truy cập hệ thống tại:
- **Giao diện Web Frontend**: [http://localhost:5173](http://localhost:5173)
- **Tài liệu Backend API (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 3. Cài đặt & Khởi chạy Backend thủ công

### Bước 3.1: Tạo môi trường ảo & Cài đặt thư viện
Mở terminal và di chuyển vào thư mục `backend`:

#### Trên Windows Command Prompt (CMD):

```DOS
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

#### Trên Windows PowerShell:

```PowerShell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Bước 3.2: Cấu hình Biến môi trường (`.env`)
Chạy lệnh sau trên **Terminal/CMD** để tạo JWT Secret Key (`JWT_SECRET`):

```DOS
python -c "import secrets; print(secrets.token_hex(32))"
```

Tạo file `.env` bên trong thư mục `backend/` với các thông số sau:

```env
DATABASE_URL=postgresql+psycopg2://postgres:your_db_password_here@localhost:5432/dental_clinic_ai
JWT_SECRET=your_jwt_secret_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
CORS_ORIGINS=http://localhost:5173
```

### Bước 3.3: Tạo Database Schema & Nạp Dữ liệu Mẫu (Seed Data)
Chạy các lệnh Alembic và Seed script:

```DOS
alembic upgrade head                 # Áp dụng migration tạo cấu trúc bảng DB
python -m app.seed                   # Nạp dữ liệu mẫu (5 tài khoản demo, dịch vụ, ghế khám...)
```

### Bước 3.4: Khởi chạy Backend Server
Chạy Uvicorn server ở chế độ Development:

```DOS
uvicorn app.main:app --reload --port 8000
```

- **Swagger UI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 4. Chạy Backend bằng Docker Compose

Nếu bạn muốn đóng gói và chạy Backend cùng PostgreSQL qua Docker mà không cần cài Python/PostgreSQL cục bộ:

1. Bật ứng dụng **Docker Desktop**.
2. Đảm bảo file `backend/.env` đã có đầy đủ các biến môi trường cần thiết.
3. Di chuyển vào thư mục `backend` và chạy:

```DOS
cd backend
docker compose up --build
```

`docker-compose.yml` sẽ tự động khởi tạo PostgreSQL 16, thực thi `alembic upgrade head`, chạy seed data và lắng nghe tại địa chỉ `http://localhost:8000`.

---

## 5. Cài đặt & Khởi chạy Frontend thủ công

### Bước 5.1: Di chuyển vào thư mục Frontend
```DOS
cd frontend
```

### Bước 5.2: Cài đặt các gói phụ thuộc (Dependencies)
```DOS
npm install
```

### Bước 5.3: Cấu hình Biến môi trường (`.env`)
Tạo file `.env` tại thư mục gốc `frontend/` (hoặc sao chép từ `.env.example`):

```DOS
cp .env.example .env
```

Nội dung file `.env`:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Bước 5.4: Khởi chạy Server Phát triển (Dev Server)
```DOS
npm run dev
```

Ứng dụng web Frontend sẽ hiển thị tại địa chỉ: **[http://localhost:5173](http://localhost:5173)**

---

## 6. Tài khoản Demo thử nghiệm

Sau khi khởi chạy thành công lệnh `python -m app.seed`, bạn có thể sử dụng các tài khoản sau để đăng nhập vào hệ thống theo từng vai trò:

- **Mật khẩu chung cho tất cả tài khoản**: `Demo@123`

| Vai trò (Role) | Email Đăng Nhập |
| --- | --- |
| **Quản trị viên (Admin)** | `admin@nhakhoa.vn` |
| **Lễ tân (Receptionist)** | `letan@nhakhoa.vn` |
| **Bác sĩ (Doctor)** | `bacsi@nhakhoa.vn` |
| **Kế toán (Accountant)** | `ketoan@nhakhoa.vn` |
| **Bệnh nhân (Patient)** | `benhnhan@nhakhoa.vn` |

---

## 7. Chạy Kiểm thử (Pytest)

Để thực thi kiểm thử tự động cho Backend:

```DOS
pip install pytest pytest-asyncio
pytest -q
```

- Mặc định suite test sẽ chạy trên **SQLite in-memory**.
- Để test đầy đủ cả ràng buộc chống trùng lịch `EXCLUDE` của PostgreSQL, hãy cấu hình môi trường trỏ đến 1 database PostgreSQL rỗng dành riêng cho test:

#### Trên Command Prompt (CMD):

```DOS
set TEST_DATABASE_URL=postgresql+psycopg2://postgres:postgrespass@localhost:5432/dental_test
pytest -q
```

#### Trên PowerShell:

```PowerShell
$env:TEST_DATABASE_URL="postgresql+psycopg2://postgres:postgrespass@localhost:5432/dental_test"
pytest -q
```