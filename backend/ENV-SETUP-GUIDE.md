# Hướng Dẫn Chi Tiết Thiết Lập Biến Môi Trường (.env)

Tài liệu này hướng dẫn từng bước lấy và cấu hình các thông số thực tế cho dự án **Dental Clinic AI**.

## 📋 Danh Sách Cấu Hình Biến Môi Trường (.env)

```
# Database
DATABASE_URL=postgresql+psycopg2://postgres:your_db_password_here@localhost:5432/dental_clinic_ai

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite

# JWT Config
JWT_SECRET=your_jwt_secret_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Mail Server (Gmail SMTP)
MAIL_USERNAME=example@gmail.com
MAIL_PASSWORD=xxxx yyyy zzzz wwww
MAIL_FROM=example@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

## 🛠️ Hướng Dẫn Chi Tiết Từng Mục

### 1. Cấu hình DATABASE_URL (PostgreSQL)

Cấu trúc URL kết nối:

```
postgresql+psycopg2://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DATABASE_NAME]
```

#### LỰA CHỌN A: Sử dụng PostgreSQL cài trên máy cục bộ (Local)

1. **Username**: Mặc định khi cài PostgreSQL thường là `postgres`.

2. **Password**: Mật khẩu bạn đã tạo trong quá trình cài đặt PostgreSQL (hoặc thiết lập trong pgAdmin).

3. **Host & Port**:

   * Host: `localhost` hoặc `127.0.0.1`.

   * Port: Mặc định của PostgreSQL là `5432`.

4. **Tạo Database**:

   * Mở **pgAdmin** hoặc terminal **psql**.

   * Chạy câu lệnh SQL để tạo CSDL:

     ```
     CREATE DATABASE dental_clinic_ai;
     ```

5. **Ví dụ hoàn chỉnh**:

   ```
   DATABASE_URL=postgresql+psycopg2://postgres:Admin123456@localhost:5432/dental_clinic_ai
   ```

#### LỰA CHỌN B: Sử dụng PostgreSQL Cloud (Ví dụ: Supabase / Neon.tech)

1. Tạo tài khoản trên [Supabase](https://supabase.com) hoặc [Neon](https://neon.tech).

2. Tạo dự án mới và sao chép chuỗi **Connection String** dạng `postgresql://...`.

3. Nhớ thêm driver `+psycopg2` vào sau phần `postgresql`.

### 2. Cấu hình GEMINI_API_KEY & GEMINI_MODEL

#### Cách lấy API Key:

1. Truy cập vào [Google AI Studio](https://aistudio.google.com/).

2. Đăng nhập bằng tài khoản Google.

3. Nhấn vào nút **Get API key** ở menu bên trái.

4. Chọn **Create API key in new project** (hoặc chọn project có sẵn).

5. Sao chép chuỗi khóa vừa tạo (dạng `AIzaSy...`).

#### Chọn Model (`GEMINI_MODEL`):

Bạn có thể chọn một trong các mô hình phổ biến hiện tại của Google:

* `gemini-2.0-flash` (Nhanh nhất, đề xuất cho sản phẩm thực tế)

* `gemini-1.5-flash` (Cân bằng giữa tốc độ và chi phí)

* `gemini-1.5-pro` (Phù hợp xử lý tác vụ phức tạp, phân tích chuyên sâu)

**Ví dụ cấu hình:**

```
GEMINI_API_KEY=AIzaSyDxxxxxxxxx_ExampleKey123
GEMINI_MODEL=gemini-3.1-flash-lite
```

### 3. Cấu hình JWT (JSON Web Token)

Chỗi `JWT_SECRET` dùng để mã hóa và xác thực token người dùng. Cần phải đủ dài và bảo mật.

#### Cách tạo chuỗi `JWT_SECRET` ngẫu nhiên bảo mật:

* **Cách 1: Sử dụng Python (Khuyên dùng)**
  Mở Terminal/Command Prompt và chạy lệnh:

  ```
  python -c "import secrets; print(secrets.token_hex(32))"
  ```

  Kết quả trả về sẽ có dạng: `a3f89e21d6b...4e90`

* **Cách 2: Sử dụng OpenSSL (Linux/macOS/Git Bash)**

  ```
  openssl rand -hex 32
  ```

#### Thông số khác:

* `JWT_ALGORITHM`: Giữ nguyên `HS256` (Thuật toán mã hóa đối xứng phổ biến).

* `ACCESS_TOKEN_EXPIRE_MINUTES`: Thời gian hết hạn của Access Token (đơn vị: phút). Ví dụ `60` (1 tiếng) hoặc `1440` (1 ngày).

**Ví dụ cấu hình:**

```
JWT_SECRET=e1c0d5f8123456789abcdef0123456789abcdef0123456789abcdef012345678
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 4. Cấu hình CORS_ORIGINS

CORS định nghĩa những địa chỉ tên miền frontend nào được phép truy cập vào Backend API này.

* **Khi phát triển (Development):**

  * Vite / React mặc định chạy ở: `http://localhost:5173`

  * React App (CRA) / Next.js chạy ở: `http://localhost:3000`

* **Khi triển khai (Production):**

  * Thêm tên miền thực tế của bạn, ví dụ: `https://nhakhoa-ai.com`

*Các tên miền phân cách nhau bằng dấu phẩy `,` (không có khoảng trắng thừa).*

**Ví dụ cấu hình:**

```
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://nhakhoa-ai.com
```

### 5. Cấu hình Gmail SMTP (Gửi Email Tự Động)

Để ứng dụng gửi email xác thực, đặt lịch hẹn qua Gmail, bạn cần tạo **Mật khẩu ứng dụng (App Password)** của Google.

#### Các bước thiết lập Mật khẩu ứng dụng Gmail:

1. **Bật Bật xác minh 2 bước (2-Step Verification):**

   * Truy cập [Quản lý Tài khoản Google](https://myaccount.google.com/).

   * Vào mục **Bảo mật** (Security) -> Tìm **Xác minh 2 bước** và bật lên nếu chưa bật.

2. **Tạo Mật khẩu ứng dụng (App Password):**

   * Trong mục **Bảo mật**, gõ tìm kiếm cụm từ **"Mật khẩu ứng dụng"** (hoặc **"App passwords"**).

   * Đặt tên cho ứng dụng (ví dụ: `Dental Clinic App`).

   * Nhấn **Tạo** (Create).

   * Google sẽ cấp cho bạn một chuỗi **16 ký tự** (ví dụ: `abcd efgh ijkl mnop`).

3. **Điền thông số vào file `.env`:**

   * `MAIL_USERNAME`: Địa chỉ Gmail của bạn.

   * `MAIL_PASSWORD`: Chuỗi 16 ký tự vừa lấy ở trên (xóa hoặc giữ khoảng trắng đều được, nhưng tốt nhất nhập liền nhau: `abcdefghijklmnop`).

   * `MAIL_FROM`: Địa chỉ email hiển thị người gửi (thường giống `MAIL_USERNAME`).

   * `MAIL_PORT`: `587` (Cổng mặc định cho TLS).

   * `MAIL_SERVER`: `smtp.gmail.com`

   * `MAIL_STARTTLS`: `True`

   * `MAIL_SSL_TLS`: `False`

**Ví dụ cấu hình:**

```
MAIL_USERNAME=nhakhoa.ai.service@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
MAIL_FROM=nhakhoa.ai.service@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

## 🔒 LƯU Ý BẢO MẬT QUAN TRỌNG

1. **KHÔNG BAO GIỜ** đẩy (commit) file `.env` lên GitHub/GitLab hoặc bất kỳ kho lưu trữ mã nguồn công khai nào.

2. Hãy đảm bảo tệp `.gitignore` của bạn đã bao gồm dòng sau:

   ```
   .env
   ```

3. Tạo một file `.env.example` chứa danh sách các biến nhưng **không có giá trị nhạy cảm** để chia sẻ cấu trúc cho các thành viên khác trong nhóm.