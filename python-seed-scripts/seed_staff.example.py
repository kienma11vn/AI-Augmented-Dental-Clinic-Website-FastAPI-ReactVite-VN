import requests

# ⚠️ Cấu hình đường dẫn API Backend
BASE_URL = "https://dental-clinic-demo.onrender.com/api/v1"

# ⚠️ Cấu hình tài khoản Admin dùng để đăng nhập lấy Quyền khởi tạo
ADMIN_EMAIL = "admin@nhakhoa.vn"
ADMIN_PASSWORD = "admin_password_cua_ban"

# Danh sách 6 tài khoản nhân viên cần khởi tạo
STAFF_DATA = [
    # 2 Lễ tân
    {
        "full_name": "Nguyễn Thị Mai",
        "email": "receptionist01@nhakhoa.vn",
        "role": "receptionist",
        "password": "Staff123@",
    },
    {
        "full_name": "Trần Thu Hà",
        "email": "receptionist02@nhakhoa.vn",
        "role": "receptionist",
        "password": "Staff123@",
    },
    # 3 Bác sĩ (Kèm chuyên khoa)
    {
        "full_name": "BS. Nguyễn Văn An",
        "email": "doctor01@nhakhoa.vn",
        "role": "doctor",
        "password": "Staff123@",
        "specialty": "Chỉnh nha & Niềng răng",
    },
    {
        "full_name": "BS. Trần Thị Bích",
        "email": "doctor02@nhakhoa.vn",
        "role": "doctor",
        "password": "Staff123@",
        "specialty": "Nha khoa Tổng quát",
    },
    {
        "full_name": "BS. Lê Hoàng Cường",
        "email": "doctor03@nhakhoa.vn",
        "role": "doctor",
        "password": "Staff123@",
        "specialty": "Phục hình Răng Sứ & Implant",
    },
    # 1 Kế toán
    {
        "full_name": "Phạm Văn Dũng",
        "email": "accountant01@nhakhoa.vn",
        "role": "accountant",
        "password": "Staff123@",
    },
]


def run_seed_staff():
    print("🔑 1. Đang đăng nhập tài khoản Admin...")
    login_res = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )

    if login_res.status_code != 200:
        print(f"❌ Đăng nhập Admin thất bại ({login_res.status_code}): {login_res.text}")
        print("💡 Vui lòng kiểm tra lại ADMIN_EMAIL và ADMIN_PASSWORD trong script!")
        return

    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Đăng nhập Admin thành công!\n")

    print("🚀 2. Bắt đầu khởi tạo các tài khoản nhân viên...\n")
    success, fail = 0, 0

    for idx, user in enumerate(STAFF_DATA, start=1):
        specialty = user.pop("specialty", None)
        try:
            # Gọi API tạo tài khoản User
            res = requests.post(f"{BASE_URL}/users/", json=user, headers=headers)

            if res.status_code in [200, 201]:
                user_id = res.json().get("id")
                print(f"[{idx}/6] ✅ Tạo User [{user['role'].upper()}]: {user['email']} ({user['full_name']})")
                
                # Nếu là Bác sĩ, cập nhật thông tin Chuyên khoa
                if user["role"] == "doctor" and specialty and user_id:
                    doc_res = requests.get(f"{BASE_URL}/doctors/", headers=headers)
                    if doc_res.status_code == 200:
                        doctors = doc_res.json()
                        doctor_item = next((d for d in doctors if d.get("user_id") == user_id), None)
                        if doctor_item:
                            requests.put(
                                f"{BASE_URL}/doctors/{doctor_item['id']}",
                                json={"specialty": specialty, "full_name": user["full_name"]},
                                headers=headers,
                            )
                            print(f"       └─ 🩺 Đã gán chuyên khoa: {specialty}")
                success += 1
            else:
                detail = res.json().get("detail", res.text)
                print(f"[{idx}/6] ❌ Thất bại ({res.status_code}): {user['email']} - {detail}")
                fail += 1

        except Exception as e:
            print(f"[{idx}/6] 💥 Lỗi kết nối: {user['email']} - {str(e)}")
            fail += 1

    print("\n----------------------------------------")
    print(f"🎉 Hoàn tất! Thành công: {success} | Thất bại: {fail}")


if __name__ == "__main__":
    run_seed_staff()