import requests

# 1. Cấu hình đường dẫn API Backend và Tài khoản Login (Admin)
BASE_URL = "http://localhost:8000/api/v1"
LOGIN_URL = f"{BASE_URL}/auth/login"
SERVICES_URL = f"{BASE_URL}/services"

# Tài khoản demo có quyền thêm dịch vụ (Admin)
AUTH_CREDENTIALS = {
    "username": "admin@nhakhoa.vn",
    "password": "Demo@123"
}

# 2. Danh sách 8 dịch vụ nha khoa bổ sung
NEW_SERVICES = [
    {
        "code": "NIENG01",
        "name": "Niềng răng mắc cài kim loại",
        "price": 25000000,
        "description": "Chỉnh nha cố định bằng hệ thống mắc cài kim loại cao cấp."
    },
    {
        "code": "VENEER01",
        "name": "Mặt dán sứ Veneer",
        "price": 6000000,
        "description": "Phục hình dán sứ siêu mỏng bảo tồn tối đa răng thật."
    },
    {
        "code": "IMPLANT01",
        "name": "Cấy ghép Implant Hàn Quốc",
        "price": 15000000,
        "description": "Thay thế chân răng đã mất bằng trụ Implant tích hợp xương nhanh."
    },
    {
        "code": "XQUANG01",
        "name": "Chụp X-quang Panorama",
        "price": 200000,
        "description": "Chụp X-quang toàn cảnh khoang miệng hỗ trợ chẩn đoán chính xác."
    },
    {
        "code": "KHON01",
        "name": "Nhổ răng khôn mọc lệch (Tiểu phẫu)",
        "price": 2000000,
        "description": "Phẫu thuật nhổ răng số 8 mọc lệch, mọc ngầm bằng công nghệ siêu âm."
    },
    {
        "code": "HAN01",
        "name": "Hàn răng sâu thẩm mỹ",
        "price": 400000,
        "description": "Tái tạo hình dáng răng bị sâu rãnh bằng vật liệu trùng màu răng."
    },
    {
        "code": "DA01",
        "name": "Đính đá trên răng thẩm mỹ",
        "price": 800000,
        "description": "Kỹ thuật đính đá cao cấp lên bề mặt răng không xâm lấn."
    },
    {
        "code": "HAM01",
        "name": "Hàm giả tháo lắp dẻo",
        "price": 4000000,
        "description": "Phục hình mất răng nguyên hàm hoặc nhiều răng bằng hàm tháo lắp Biosoft."
    }
]


def add_services():
    session = requests.Session()

    print("🔑 Đang đăng nhập hệ thống để lấy Access Token...")
    try:
        # FastAPI OAuth2 standard yêu cầu gửi data định dạng Form-Data
        login_res = session.post(LOGIN_URL, data=AUTH_CREDENTIALS)
        if login_res.status_code != 200:
            # Nếu auth endpoint nhận JSON
            login_res = session.post(
                LOGIN_URL, 
                json={"email": AUTH_CREDENTIALS["username"], "password": AUTH_CREDENTIALS["password"]}
            )

        if login_res.status_code != 200:
            print(f"❌ Đăng nhập thất bại ({login_res.status_code}): {login_res.text}")
            return

        token_data = login_res.json()
        access_token = token_data.get("access_token")
        print("✅ Đăng nhập thành công!")

        # Gán Header Authorization cho các request tiếp theo
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    except Exception as e:
        print(f"❌ Lỗi kết nối tới Server: {e}")
        return

    print("\n🚀 Bắt đầu thêm 8 dịch vụ mới vào CSDL...")
    success_count = 0

    for item in NEW_SERVICES:
        try:
            res = session.post(SERVICES_URL, json=item, headers=headers)
            if res.status_code in (200, 201):
                data = res.json()
                print(f"  ✔️  [Thành công] Mã: {item['code']:<10} | Tên: {item['name']} (ID: {data.get('id')})")
                success_count += 1
            else:
                detail = res.json().get('detail', res.text)
                print(f"  ⚠️  [Bỏ qua/Lỗi]  Mã: {item['code']:<10} | Chi tiết: {detail}")
        except Exception as err:
            print(f"  ❌  Lỗi khi thêm dịch vụ {item['code']}: {err}")

    print(f"\n🎉 Hoàn thành! Đã thêm thành công {success_count}/{len(NEW_SERVICES)} dịch vụ.")


if __name__ == "__main__":
    add_services()