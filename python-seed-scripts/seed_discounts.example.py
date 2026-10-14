import requests

# 1. Cấu hình đường dẫn API Backend & Tài khoản Đăng nhập (Kế toán)
BASE_URL = "https://dental-clinic-demo.onrender.com/api/v1"  # Thay đổi nếu backend chạy trên server khác
LOGIN_URL = f"{BASE_URL}/auth/login"
DISCOUNTS_URL = f"{BASE_URL}/discount-programs"

# Tài khoản demo có quyền quản lý Mã ưu đãi (Kế toán)
AUTH_CREDENTIALS = {
    "username": "ketoan@nhakhoa.vn",
    "password": "ketoan_password_cua_ban"
}

# 2. Danh sách 10 chương trình ưu đãi (kết hợp giảm % và giảm tiền cố định)
NEW_DISCOUNT_PROGRAMS = [
    {
        "code": "HE2026",
        "name": "Nụ cười mùa hè 2026",
        "description": "Ưu đãi chào hè giảm 10% tổng hóa đơn thanh toán.",
        "discount_rate": 10,
        "discount_amount": 0,
        "is_active": True
    },
    {
        "code": "TRIAN500K",
        "name": "Tri ân khách hàng thân thiết",
        "description": "Giảm trực tiếp 500.000 VNĐ cho bệnh nhân tái khám.",
        "discount_rate": 0,
        "discount_amount": 500000,
        "is_active": True
    },
    {
        "code": "SINHNHAT15",
        "name": "Ưu đãi tháng sinh nhật",
        "description": "Giảm 15% tổng chi phí dịch vụ dành riêng cho bệnh nhân có sinh nhật trong tháng.",
        "discount_rate": 15,
        "discount_amount": 0,
        "is_active": True
    },
    {
        "code": "NIENG2M",
        "name": "Đồng hành niềng răng Học sinh - Sinh viên",
        "description": "Giảm ngay 2.000.000 VNĐ khi đăng ký gói niềng răng mắc cài.",
        "discount_rate": 0,
        "discount_amount": 2000000,
        "is_active": True
    },
    {
        "code": "TAYTRANG20",
        "name": "Combo Tẩy trắng răng đôi",
        "description": "Giảm 20% khi làm dịch vụ tẩy trắng răng theo nhóm 2 người trở lên.",
        "discount_rate": 20,
        "discount_amount": 0,
        "is_active": True
    },
    {
        "code": "IMPLANT1M",
        "name": "Khuyến mãi Cấy ghép Implant",
        "description": "Trợ giá 1.000.000 VNĐ cho mỗi trụ Implant Hàn Quốc.",
        "discount_rate": 0,
        "discount_amount": 1000000,
        "is_active": True
    },
    {
        "code": "GIADINH12",
        "name": "Gói chăm sóc răng Gia đình",
        "description": "Giảm 12% cho các dịch vụ chăm sóc & vệ sinh răng miệng gia đình.",
        "discount_rate": 12,
        "discount_amount": 0,
        "is_active": True
    },
    {
        "code": "SUTHAMMY3M",
        "name": "Phục hình Răng sứ Thẩm mỹ VIP",
        "description": "Giảm 3.000.000 VNĐ cho gói bọc răng sứ trọn hàm từ 8 răng.",
        "discount_rate": 0,
        "discount_amount": 3000000,
        "is_active": True
    },
    {
        "code": "VIPCARD05",
        "name": "Thẻ thành viên Nha khoa VIP",
        "description": "Giảm cố định 5% cho tất cả lượt khám của bệnh nhân VIP.",
        "discount_rate": 5,
        "discount_amount": 0,
        "is_active": True
    },
    {
        "code": "CAORANG200K",
        "name": "Trợ giá Lấy cao răng & Hàn răng",
        "description": "Giảm 200.000 VNĐ cho dịch vụ lấy cao răng kết hợp trám răng.",
        "discount_rate": 0,
        "discount_amount": 200000,
        "is_active": True
    }
]


def add_discount_programs():
    session = requests.Session()

    print("🔑 Đang đăng nhập hệ thống để lấy Access Token...")
    try:
        # Gửi dữ liệu đăng nhập chuẩn OAuth2 Form-Data
        login_res = session.post(LOGIN_URL, data=AUTH_CREDENTIALS)
        if login_res.status_code != 200:
            # Dự phòng nếu backend nhận JSON payload
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

        # Thiết lập Header chứa Bearer Token
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    except Exception as e:
        print(f"❌ Lỗi kết nối tới Server: {e}")
        return

    print("\n🚀 Bắt đầu thêm 10 chương trình ưu đãi mới vào CSDL...")
    success_count = 0

    for item in NEW_DISCOUNT_PROGRAMS:
        try:
            res = session.post(DISCOUNTS_URL, json=item, headers=headers)
            if res.status_code in (200, 201):
                data = res.json()
                discount_label = f"Giảm {item['discount_rate']}%" if item['discount_rate'] > 0 else f"Giảm {item['discount_amount']:,}đ"
                print(f"  ✔️  [Thành công] Mã: {item['code']:<12} | Mức giảm: {discount_label:<15} | Tên: {item['name']} (ID: {data.get('id')})")
                success_count += 1
            else:
                detail = res.json().get('detail', res.text)
                print(f"  ⚠️  [Bỏ qua/Lỗi]  Mã: {item['code']:<12} | Chi tiết: {detail}")
        except Exception as err:
            print(f"  ❌  Lỗi khi thêm mã {item['code']}: {err}")

    print(f"\n🎉 Hoàn thành! Đã thêm thành công {success_count}/{len(NEW_DISCOUNT_PROGRAMS)} chương trình ưu đãi.")


if __name__ == "__main__":
    add_discount_programs()