# Hướng dẫn triển khai Production — Hệ thống Quản lý Nha khoa tích hợp AI

Hướng dẫn tự host toàn bộ hệ thống: **PostgreSQL (Neon/Supabase)**, **Backend FastAPI trên Docker**, **Frontend React + Vite trên Vercel**, kèm cấu hình CORS và `VITE_API_BASE_URL`.

---

## 1. Kiến trúc triển khai tổng quan

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

  <img width="973" height="114" alt="ArchitectureDiagram drawio" src="https://github.com/user-attachments/assets/2a2ec20b-24db-4b0f-85db-199e200a0416" />

- **Frontend**: React + Vite + Tailwind CSS + React Query, deploy trên **Vercel**.
- **Backend**: Python FastAPI + SQLAlchemy + Alembic, chạy trong **Docker** trên VPS/Render/Railway hoặc local server.
- **Database**: **PostgreSQL** trên Neon hoặc Supabase (bắt buộc hỗ trợ `tstzrange` và `EXCLUDE` constraint).
- **AI**: Google Gemini API, backend gọi trực tiếp bằng `GEMINI_API_KEY`.

---

## 2. Chuẩn bị

Bạn cần chuẩn bị trước:

1. **Tài khoản & dịch vụ**:
   - [Neon](https://neon.tech) hoặc [Supabase](https://supabase.com) — PostgreSQL hosted.
   - [Vercel](https://vercel.com) — deploy frontend.
   - VPS/Render/Railway hoặc máy chủ có Docker — chạy backend.
   - [Google AI Studio](https://aistudio.google.com/app/apikey) — lấy `GEMINI_API_KEY`.

2. **Domain (khuyến nghị)**:
   - Mua domain riêng (VD: `nhakhoa.example.com` cho backend, `app.nhakhoa.example.com` cho frontend).
   - Nếu chưa có domain, có thể dùng subdomain Vercel + IP public/Railway Render URL tạm thời.

3. **Mã nguồn**:
   - Thư mục `backend/` trong repo này chứa toàn bộ backend.
   - Mã nguồn frontend (React + Vite) nằm ở thư mục gốc (`src/`, `package.json`, `vite.config.ts`, `index.html`, `public/`...). Bạn có thể sao chép phần frontend sang một repo Git riêng để deploy Vercel, hoặc deploy từ repo hiện tại nhưng chỉ build phần frontend.

---

## 3. Database PostgreSQL

### 3.1. Tùy chọn A: Neon

1. Đăng ký/đăng nhập [Neon Console](https://console.neon.tech).
2. Tạo **New Project** → đặt tên `dental-clinic`.
3. Tạo database `dental_clinic` (hoặc dùng database mặc định `neondb`).
4. Vào **Connection Details** → chọn định dạng **psycopg2 / SQLAlchemy**.
5. Copy connection string, dạng:

   ```text
   postgresql+psycopg2://<user>:<password>@<endpoint>.neon.tech/<db>?sslmode=require
   ```

6. Lưu vào biến `DATABASE_URL` của backend.

### 3.2. Tùy chọn B: Supabase

1. Đăng nhập [Supabase Dashboard](https://app.supabase.com).
2. Tạo project mới → chọn region gần backend nhất (Singapore/Frankfurt...).
3. Vào **Project Settings → Database**.
4. Trong mục **Connection string**, chọn định dạng **SQLAlchemy** / **psycopg2**.
5. Copy connection string. Lưu ý:
   - Dùng **Direct connection** nếu backend chạy ở cloud có IP tĩnh/có thể whitelist.
   - Dùng **Connection Pooler** (`postgresql+psycopg2://.../db?pgbouncer=true&sslmode=require`) nếu backend có nhiều worker/connection.
6. Lưu vào biến `DATABASE_URL`.

### 3.3. Khởi tạo schema

Sau khi backend có `DATABASE_URL`, chạy Alembic để tạo bảng:

```bash
cd backend
# Tạo/tùy chỉnh .env trước (xem mục 4.2)
alembic upgrade head
```

Hoặc với Docker:

```bash
cd backend
docker run --rm --env-file .env ghcr.io/<your-org>/dental-backend:latest \
  alembic upgrade head
```

Nếu dùng Supabase và gặp lỗi quyền tạo extension `btree_gist`, hãy chạy trước trong SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Sau đó chạy lại `alembic upgrade head`.

### 3.4. Seed dữ liệu mẫu (tùy chọn)

```bash
cd backend
python -m app.seed
```

Với Docker:

```bash
docker run --rm --env-file .env ghcr.io/<your-org>/dental-backend:latest \
  python -m app.seed
```

Tài khoản demo sau seed:

| Vai trò   | Email                | Mật khẩu |
|-----------|----------------------|----------|
| Admin     | admin@nhakhoa.vn     | Demo@123 |
| Lễ tân    | letan@nhakhoa.vn     | Demo@123 |
| Bác sĩ    | bacsi@nhakhoa.vn     | Demo@123 |
| Kế toán   | ketoan@nhakhoa.vn    | Demo@123 |
| Bệnh nhân | benhnhan@nhakhoa.vn  | Demo@123 |

---

## 4. Backend FastAPI

### 4.1. Build Docker image

Từ thư mục `backend/`:

```bash
docker build -t dental-backend:latest .
```

Hoặc đẩy lên registry (Docker Hub / GitHub Container Registry / GitLab):

```bash
docker tag dental-backend:latest ghcr.io/<your-org>/dental-backend:latest
docker push ghcr.io/<your-org>/dental-backend:latest
```

### 4.2. File `.env` production mẫu

Tạo file `backend/.env` trên server:

```bash
# === Database ===
DATABASE_URL=postgresql+psycopg2://<user>:<pass>@<neon-or-supabase-host>/<db>?sslmode=require

# === Security ===
JWT_SECRET=<thay-bằng-64-ký-tự-ngẫu-nhiên>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# === AI ===
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-flash

# === CORS: domain frontend production ===
CORS_ORIGINS=https://app-nhakhoa.vercel.app
```

> **JWT_SECRET**: tạo bằng lệnh:
>
> ```bash
> openssl rand -hex 32
> ```

### 4.3. Chạy backend bằng Docker Compose (khuyến nghị)

Nếu bạn muốn chạy cả PostgreSQL local và backend trên cùng một server, dùng file `backend/docker-compose.yml` có sẵn:

```bash
cd backend
export JWT_SECRET=$(openssl rand -hex 32)
export GEMINI_API_KEY=AIza...
docker compose up --build -d
```

Truy cập:

- API docs: `http://<server-ip>:8000/docs`
- Health: `http://<server-ip>:8000/health`

> Nếu dùng **Neon/Supabase thay cho PostgreSQL local**, hãy sửa `docker-compose.yml` bỏ service `db` và trỏ `DATABASE_URL` đến database hosted.

### 4.4. Triển khai lên VPS với Docker + reverse proxy

#### Bước 1: Cài đặt Docker trên VPS

```bash
# Ubuntu 22.04/24.04
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
```

#### Bước 2: Tạo file compose trên VPS

Tạo thư mục `/opt/dental-backend` và file `docker-compose.yml`:

```yaml
services:
  api:
    image: ghcr.io/<your-org>/dental-backend:latest
    container_name: dental-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Bước 3: Cấu hình Nginx + HTTPS

Tạo `/etc/nginx/sites-available/dental-api`:

```nginx
server {
    listen 80;
    server_name api.nhakhoa.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Kích hoạt và cài SSL:

```bash
sudo ln -s /etc/nginx/sites-available/dental-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.nhakhoa.example.com
```

Backend production URL sẽ là:

```text
https://api.nhakhoa.example.com
```

#### Bước 4: Cập nhật CORS

Sau khi có domain frontend, sửa `.env`:

```bash
CORS_ORIGINS=https://app.nhakhoa.example.com
```

Rồi restart container:

```bash
cd /opt/dental-backend
docker compose up -d --force-recreate
```

### 4.5. Triển khai lên Render / Railway (PaaS)

**Render**:
1. Tạo **New Web Service** → kết nối repo GitHub/GitLab.
2. Root directory: `backend`.
3. Build command: `pip install -r requirements.txt`.
4. Start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Thêm Environment Variables từ mục 4.2.
6. Lưu ý: Render cung cấp HTTPS tự động, domain dạng `https://dental-api.onrender.com`.

**Railway**:
1. Tạo project mới, deploy từ repo.
2. Thêm PostgreSQL service (hoặc dùng external `DATABASE_URL`).
3. Set variables trong **Variables** tab.
4. Start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.

---

## 5. Frontend React + Vite

### 5.1. Chuẩn bị mã nguồn frontend

Mã nguồn frontend nằm ở thư mục gốc:

```text
src/
package.json
vite.config.ts
tailwind.config.ts (nếu có)
index.html
public/
```

Bạn có thể:

- **Cách 1**: Sao chép toàn bộ file frontend sang một repo GitHub/GitLab riêng để deploy Vercel.
- **Cách 2**: Triển khai từ repo hiện tại, nhưng cấu hình Vercel chỉ build phần frontend (ít phổ biến vì repo chứa cả backend).

Khuyến nghị **Cách 1** để tách biệt frontend và backend.

### 5.2. Cấu hình `VITE_API_BASE_URL`

Frontend gọi API qua biến môi trường `VITE_API_BASE_URL`. Trong code frontend, bạn sử dụng:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL;
```

Tạo file `.env.production` trong thư mục frontend:

```bash
VITE_API_BASE_URL=https://api.nhakhoa.example.com/api/v1
```

> **Lưu ý**: Vite chỉ expose biến bắt đầu bằng `VITE_` vào bundle. Đảm bảo tên biến đúng là `VITE_API_BASE_URL`.

### 5.3. Triển khai lên Vercel

#### Bước 1: Kết nối repo

1. Đăng nhập [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New Project** → import repo chứa frontend.
3. Framework preset: chọn **Vite**.

#### Bước 2: Cấu hình build

| Cài đặt         | Giá trị                  |
|-----------------|--------------------------|
| Build Command   | `npm run build`          |
| Output Directory| `dist`                   |
| Install Command | `npm install`            |
| Root Directory  | (để trống hoặc `./`)     |

#### Bước 3: Thêm Environment Variables

Vào **Settings → Environment Variables**, thêm:

```text
VITE_API_BASE_URL=https://api.nhakhoa.example.com/api/v1
```

Sau đó redeploy.

#### Bước 4: Kiểm tra

Mở URL Vercel (VD: `https://app-nhakhoa.vercel.app`).

Trong DevTools → Console/Network, kiểm tra các request đến backend có domain đúng không.

### 5.4. Custom domain trên Vercel (khuyến nghị)

1. Vào **Project Settings → Domains**.
2. Thêm domain: `app.nhakhoa.example.com`.
3. Làm theo hướng dẫn thêm bản ghi CNAME trên DNS provider.
4. Sau khi domain hoạt động, cập nhật `VITE_API_BASE_URL` và `CORS_ORIGINS` cho phù hợp.

---

## 6. CORS và kết nối Frontend ↔ Backend

### 6.1. CORS_ORIGINS phải khớp domain frontend

Backend chỉ cho phép các origin trong `CORS_ORIGINS`. Cấu hình đúng:

```bash
# Ví dụ nếu frontend chạy trên Vercel domain mặc định
CORS_ORIGINS=https://app-nhakhoa.vercel.app

# Hoặc nhiều origin, phân cách bằng dấu phẩy (không có khoảng trắng)
CORS_ORIGINS=https://app.nhakhoa.example.com,https://app-nhakhoa.vercel.app
```

> Không để `CORS_ORIGINS=*` trong production vì gây rủi ro bảo mật.

### 6.2. Ví dụ kết hợp đầy đủ

| Thành phần | Domain                              | Biến môi trường                          |
|------------|-------------------------------------|------------------------------------------|
| Frontend   | `https://app.nhakhoa.example.com` | `VITE_API_BASE_URL=https://api.nhakhoa.example.com/api/v1` |
| Backend    | `https://api.nhakhoa.example.com`   | `CORS_ORIGINS=https://app.nhakhoa.example.com` |

### 6.3. Lưu ý với HTTPS

- Backend phải chạy HTTPS (qua Nginx/Caddy/Render/Railway).
- Frontend Vercel luôn chạy HTTPS.
- Nếu frontend HTTPS gọi backend HTTP sẽ bị **Mixed Content** block. Bắt buộc backend có SSL.

### 6.4. Caddy làm reverse proxy (lựa chọn thay cho Nginx)

Nếu bạn muốn cấu hình đơn giản hơn, dùng Caddy:

```bash
sudo apt install caddy
```

Tạo `/etc/caddy/Caddyfile`:

```caddy
api.nhakhoa.example.com {
    reverse_proxy localhost:8000
}
```

Rồi reload:

```bash
sudo systemctl reload caddy
```

Caddy tự động cấp SSL từ Let's Encrypt.

---

## 7. Kiểm tra sau khi deploy

### 7.1. Kiểm tra backend

```bash
# Health check
curl https://api.nhakhoa.example.com/health

# Đăng nhập demo
curl -X POST https://api.nhakhoa.example.com/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@nhakhoa.vn&password=Demo@123"
```

### 7.2. Kiểm tra CORS từ browser

Mở frontend → DevTools → Console. Nếu thấy lỗi:

```text
Access to fetch at 'https://api...' from origin 'https://app...' has been blocked by CORS policy
```

→ Kiểm tra lại `CORS_ORIGINS` backend đã chứa đúng domain frontend chưa, sau đó restart backend container.

### 7.3. Kiểm tra API docs

Mở `https://api.nhakhoa.example.com/docs` để xem Swagger UI.

---

## 8. Checklist bảo mật production

- [ ] `JWT_SECRET` là chuỗi ngẫu nhiên ≥ 32 byte, không commit vào Git.
- [ ] `GEMINI_API_KEY` chỉ lưu trong backend `.env`, không đưa vào frontend.
- [ ] `DATABASE_URL` không chứa mật khẩu mặc định `postgres/postgres`.
- [ ] `CORS_ORIGINS` không để `*` trong production.
- [ ] Database connection dùng SSL (`sslmode=require` hoặc tương đương).
- [ ] Backend chạy HTTPS qua reverse proxy.
- [ ] Tắt debug mode, không expose traceback lỗi ra ngoài.
- [ ] Giới hạn IP truy cập PostgreSQL trên Neon/Supabase (nếu có tùy chọn).
- [ ] Bật backup tự động trên Neon/Supabase.
- [ ] Theo dõi log container (`docker logs dental-api`) và audit log trong ứng dụng.

---

## 9. Cập nhật & rollback

### Cập nhật backend

```bash
cd /opt/dental-backend
docker compose pull
docker compose up -d --force-recreate
```

### Rollback database (nếu migration mới gây lỗi)

```bash
cd backend
alembic downgrade -1
```

### Cập nhật frontend

Push code mới lên repo → Vercel tự động redeploy. Hoặc redeploy thủ công trong Vercel Dashboard.

---

## 10. Troubleshooting thường gặp

| Vấn đề | Nguyên nhân | Cách xử lý |
|--------|-------------|------------|
| `CORS error` | `CORS_ORIGINS` chưa khớp domain frontend | Sửa `.env` và restart backend |
| `Failed to connect to database` | `DATABASE_URL` sai hoặc firewall chặn | Kiểm tra connection string, SSL, whitelist IP backend |
| `Mixed Content` | Frontend HTTPS gọi backend HTTP | Cấu hình SSL cho backend |
| `alembic upgrade head` lỗi `btree_gist` | Database chưa có extension | Chạy `CREATE EXTENSION IF NOT EXISTS btree_gist;` trên Supabase/Neon |
| Frontend không nhận env | Sai tên biến hoặc không có `VITE_` prefix | Đảm bảo `VITE_API_BASE_URL` |
| Build frontend lỗi | Thiếu dependency hoặc TypeScript lỗi | Chạy `npm install && npm run build` local trước khi deploy |
| Backend container restart liên tục | `DATABASE_URL` sai hoặc thiếu env | Kiểm tra `docker logs dental-api` |

---

## 11. Tóm tắt lệnh triển khai nhanh

```bash
# 1. Database: tạo PostgreSQL trên Neon/Supabase, lấy DATABASE_URL

# 2. Backend (trên VPS có Docker)
git clone <repo>
cd dental-clinic/backend
cp .env.example .env
# sửa .env với DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, CORS_ORIGINS
docker build -t dental-backend .
docker compose up -d

# 3. Seed demo
python -m app.seed

# 4. Frontend (repo frontend riêng)
cd ../frontend
cp .env.example .env.production
# sửa VITE_API_BASE_URL=https://<backend-domain>/api/v1
npm install
npm run build
# deploy lên Vercel, thêm VITE_API_BASE_URL trong Environment Variables
```

Sau cùng, hệ thống của bạn sẽ hoạt động với:

- Frontend: `https://app.nhakhoa.example.com`
- Backend API: `https://api.nhakhoa.example.com/api/v1`
- API docs: `https://api.nhakhoa.example.com/docs`
- Health check: `https://api.nhakhoa.example.com/health`
