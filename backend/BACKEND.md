# 🦷 Dental Clinic AI - Backend — Hệ thống Quản lý Nha khoa Tích hợp AI

REST API viết bằng **Python + FastAPI + SQLAlchemy + Alembic + PostgreSQL**, tích hợp **Google Gemini API** làm trợ lý hành chính.
Backend này cần được host trên máy cá nhân, VPS hoặc nền tảng PaaS theo hướng dẫn bên dưới (chi tiết deploy production xem `../DEPLOYMENT.md`).

---

## 1. Kiến trúc thư mục

```
backend/
  app/
    main.py             # Khởi tạo FastAPI, CORS, mount routers, /health
    config.py           # Pydantic Settings đọc biến môi trường / .env
    database.py         # Engine, SessionLocal, Base, dependency get_db
    models.py           # 12 model SQLAlchemy (11 bảng chính + invoice_items)
    schemas.py          # Pydantic request/response schemas
    security.py         # Băm mật khẩu (bcrypt) + tạo/giải mã JWT
    dependencies.py     # get_current_user (OAuth2 Bearer)
    rbac.py             # 5 vai trò + bảng PERMISSIONS + require_role
    pii.py              # Ẩn/giải ẩn PII (họ tên, SĐT, CCCD)
    ai_guardrails.py    # Gọi Gemini: system prompt, PII masking, disclaimer
    audit.py            # Ghi audit_logs cho thao tác nhạy cảm
    seed.py             # Dữ liệu mẫu: 5 tài khoản demo, ghế, bác sĩ, dịch vụ
    routers/            # auth.py, patients.py, doctors.py, chairs.py, appointments.py,
                        # services.py, records.py, invoices.py, reports.py, ai.py, audit.py
	middleware/			# audit.py		
  alembic/              # Cấu hình + migration versions
  tests/                # pytest: auth/RBAC, lịch hẹn, hồ sơ, hóa đơn, PII, AI
  requirements.txt
  Dockerfile
  docker-compose.yml
  run_venv.bat          # Script khởi chạy nhanh Backend Python / venv
  run_docker.bat        # Script khởi chạy nhanh Docker Compose (Tự động kiểm tra build)  
```

---

## 2. Yêu cầu môi trường

- **Python** 3.11 hoặc 3.12 (khuyến nghị 3.12 — `psycopg2-binary` chưa có wheel cho 3.13).
- **Docker Desktop** (bản mới nhất).
- **PostgreSQL 14+** (bắt buộc: dùng `tstzrange` + `EXCLUDE` constraint chống trùng lịch).
- **Google Gemini** API Key (https://aistudio.google.com/app/apikey).

---

## 3. Cài đặt & chạy local

- Đã cài đặt **Python** (3.11 hoặc 3.12) và **PostgreSQL** (14+).
- Đảm bảo file `.env` trong thư mục `backend/` đã được cấu hình các biến môi trường cần thiết.

### Cách 1: Khởi chạy nhanh bằng Script Batch (`run_venv.bat`) — Dành cho Windows

Chỉ cần nhấp đúp chuột vào file `run_venv.bat` tại thư mục `backend/`. Script sẽ tự động:

- Kích hoạt môi trường ảo Python.

- Chạy tự động cập nhật CSDL qua Alembic (`alembic upgrade head`).

- Khởi chạy Uvicorn Server ở chế độ `--reload` tại địa chỉ `[http://127.0.0.1:8000](http://127.0.0.1:8000)`.

### Cách 2: Chạy thủ công bằng dòng lệnh

#### Trên Command Prompt (CMD):

```DOS
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

alembic upgrade head                 # tạo schema
python -m app.seed                   # nạp dữ liệu mẫu (tùy chọn)
uvicorn app.main:app --reload --port 8000
```

#### Trên PowerShell:

```PowerShell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

alembic upgrade head                 # tạo schema
python -m app.seed                   # nạp dữ liệu mẫu (tùy chọn)
uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

---

## 4. Chạy bằng Docker (Khuyến nghị)

- Khởi dộng **Docker Desktop**.
- Đảm bảo file `.env` trong thư mục `backend/` đã được cấu hình các biến môi trường cần thiết.

### Cách 1: Khởi chạy thông minh bằng Script Batch (`run_docker.bat`)

Click đúp chuột vào file `run_docker.bat`. Script sẽ tự động:

- Tính toán mã **Hash SHA256** của các file mã nguồn (bỏ qua các thư mục tạm `__pycache__` và file `.pyc`).

- So sánh với lần build trước đó:

1. Nếu phát hiện mã nguồn có sự thay đổi: Tự động thực thi `docker compose up --build` và cập nhật mã Hash mới.

2. Nếu không có thay đổi: Bỏ qua bước build lại và thực thi trực tiếp `docker compose up` giúp tiết kiệm thời gian khởi chạy.

### Cách 2: Chạy thủ công lệnh Docker Compose

#### Trên Command Prompt (CMD):

```DOS
cd backend
docker compose up --build         
# hoặc nếu đã build sẵn
docker compose up
```

`docker-compose.yml` khởi tạo PostgreSQL 16, chạy `alembic upgrade head`, seed dữ liệu
rồi bật Uvicorn tại http://localhost:8000.

---

## 5. Tài khoản demo (sau khi `python -m app.seed`)

### Mật khẩu chung: `Demo@123`

| Vai trò | Email |
| --- | --- |
| Admin | `admin@nhakhoa.vn` |
| Lễ tân | `letan@nhakhoa.vn` |
| Bác sĩ | `bacsi@nhakhoa.vn` |
| Kế toán | `ketoan@nhakhoa.vn` |
| Bệnh nhân | `benhnhan@nhakhoa.vn` |

### Biến môi trường (`.env`)

| Biến | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL | `postgresql+psycopg2://postgres:your_db_password_here@localhost:5432/dental_clinic_ai`
| `JWT_SECRET` | Khóa ký JWT (≥32 ký tự random) | `openssl rand -hex 32` |
| `JWT_ALGORITHM` | Thuật toán JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Thời hạn token | `60` |
| `GEMINI_API_KEY` | API key Google Gemini | `AQ.Ab...` |
| `GEMINI_MODEL` | Model Gemini | `gemini-3.6-flash` |
| `CORS_ORIGINS` | Origin frontend, phân cách bằng dấu phẩy | `http://localhost:5173` |

---

## 6. Danh sách endpoint chính (prefix `/api/v1`)

| Nhóm | Endpoint tiêu biểu |
| --- | --- |
| Auth | `POST /auth/login` (form OAuth2), `GET /auth/me`, `POST /auth/register` (admin) |
| Bệnh nhân | `GET/POST /patients/`, `GET/PUT /patients/{id}` |
| Bác sĩ | `GET/POST /doctors/`, lịch làm việc `/doctors/{id}/schedules` |
| Ghế khám | `GET/POST /chairs/` |
| Lịch hẹn | `GET/POST /appointments/`, `PUT /appointments/{id}`, `DELETE` (hủy) |
| Dịch vụ | `GET/POST /services/`, `PUT /services/{id}` |
| Hồ sơ điều trị | `GET/POST /records/`, `PUT /records/{id}` |
| Hóa đơn | `POST /invoices/`, `POST /invoices/from-record/{id}`, `PUT /invoices/{id}` |
| Báo cáo | `GET /reports/overview`, `/reports/appointments-by-day`, `/reports/revenue-by-service` |
| AI | `POST /ai/summarize-record`, `/ai/reminder`, `/ai/explain-service` |

Xác thực: `Authorization: Bearer <access_token>` lấy từ `POST /api/v1/auth/login`.

---

## 7. Ràng buộc nghiệp vụ đã hiện thực

1. **Chống trùng lịch bác sĩ/ghế** — hai `EXCLUDE` constraint ở tầng PostgreSQL
   (`no_doctor_overlap`, `no_chair_overlap`) trên `tstzrange(start_time, end_time)`.
   API trả `409` khi phát hiện trùng, nên không thể lách bằng race condition.
2. **PII masking** — `app/pii.py` thay họ tên/SĐT/CCCD bằng `[PATIENT_NAME_n]`,
   `[PHONE_n]`, `[ID_NUMBER_n]` **trước** khi gửi prompt tới Gemini, và unmask sau khi nhận kết quả.
3. **AI guardrails** — system prompt giới hạn AI ở vai trò trợ lý hành chính
   (không chẩn đoán, không kê đơn) và luôn nối câu cảnh báo:
   *"Thông tin do AI tạo ra chỉ mang tính chất tham khảo hành chính, không thay thế chỉ định chuyên môn của bác sĩ."*
4. **RBAC** — bảng `PERMISSIONS` trong `app/rbac.py` map 5 vai trò với quyền
   `patient/doctor/appointment/service/record/invoice/report/ai/user`.
5. **Audit log** — mọi thao tác nhạy cảm (hồ sơ, hóa đơn, gọi AI) ghi vào `audit_logs`.

---

## 8. Migration (Alembic)

```DOS
alembic upgrade head                                  # áp dụng migration
alembic revision --autogenerate -m "mo ta thay doi"   # tạo migration mới
alembic downgrade -1                                  # lùi 1 bước
```

---

## 9. Kiểm thử

```DOS
pip install pytest pytest-asyncio
pytest -q
```

- Mặc định test chạy trên **SQLite in-memory** (không cần PostgreSQL). Các ràng buộc
  `EXCLUDE` của PostgreSQL bị bỏ qua ở chế độ này nên 2 test trùng lịch sẽ `skip`.
- Muốn kiểm thử đầy đủ cả ràng buộc chống trùng lịch, trỏ tới một database PostgreSQL **rỗng** dành riêng cho test:

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

Phạm vi test: đăng nhập/JWT, phân quyền 5 vai trò, tạo & hủy lịch hẹn, chống trùng
lịch bác sĩ/ghế, hồ sơ điều trị + chi tiết liệu trình, lập hóa đơn từ hồ sơ, thanh
toán một phần/đủ, chặn thu quá số tiền, PII mask/unmask round-trip, prompt gửi lên
Gemini không chứa PII, và disclaimer luôn xuất hiện.