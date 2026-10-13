import requests

# ⚠️ Thay đổi URL theo địa chỉ Backend thực tế của bạn
BASE_URL = "https://dental-clinic-demo.onrender.com/api/v1/auth/patient-register"

patients_data = [
    {"full_name": "Nguyễn Văn An", "id_number": "001099001101", "email": "patient01@nhakhoa.vn", "phone": "0912345601", "password": "BenhNhan_1234567890@"},
    {"full_name": "Trần Thị Bình", "id_number": "001099001102", "email": "patient02@nhakhoa.vn", "phone": "0912345602", "password": "BenhNhan_1234567890@"},
    {"full_name": "Lê Hoàng Cường", "id_number": "001099001103", "email": "patient03@nhakhoa.vn", "phone": "0912345603", "password": "BenhNhan_1234567890@"},
    {"full_name": "Phạm Thị Dung", "id_number": "001099001104", "email": "patient04@nhakhoa.vn", "phone": "0912345604", "password": "BenhNhan_1234567890@"},
    {"full_name": "Hoàng Minh Em", "id_number": "001099001105", "email": "patient05@nhakhoa.vn", "phone": "0912345605", "password": "BenhNhan_1234567890@"},
    {"full_name": "Vũ Phương Thảo", "id_number": "001099001106", "email": "patient06@nhakhoa.vn", "phone": "0912345606", "password": "BenhNhan_1234567890@"},
    {"full_name": "Đặng Quốc Giang", "id_number": "001099001107", "email": "patient07@nhakhoa.vn", "phone": "0912345607", "password": "BenhNhan_1234567890@"},
    {"full_name": "Bùi Thu Hải", "id_number": "001099001108", "email": "patient08@nhakhoa.vn", "phone": "0912345608", "password": "BenhNhan_1234567890@"},
    {"full_name": "Đỗ Ngọc Khánh", "id_number": "001099001109", "email": "patient09@nhakhoa.vn", "phone": "0912345609", "password": "BenhNhan_1234567890@"},
    {"full_name": "Hồ Đức Lâm", "id_number": "001099001110", "email": "patient10@nhakhoa.vn", "phone": "0912345610", "password": "BenhNhan_1234567890@"},
    {"full_name": "Ngô Thị Minh", "id_number": "001099001111", "email": "patient11@nhakhoa.vn", "phone": "0912345611", "password": "BenhNhan_1234567890@"},
    {"full_name": "Dương Văn Nam", "id_number": "001099001112", "email": "patient12@nhakhoa.vn", "phone": "0912345612", "password": "BenhNhan_1234567890@"},
    {"full_name": "Lý Thị Oanh", "id_number": "001099001113", "email": "patient13@nhakhoa.vn", "phone": "0912345613", "password": "BenhNhan_1234567890@"},
    {"full_name": "Mạc Văn Phúc", "id_number": "001099001114", "email": "patient14@nhakhoa.vn", "phone": "0912345614", "password": "BenhNhan_1234567890@"},
    {"full_name": "Trịnh Như Quỳnh", "id_number": "001099001115", "email": "patient15@nhakhoa.vn", "phone": "0912345615", "password": "BenhNhan_1234567890@"}
]

def run_seed():
    print("🚀 Bắt đầu tự động tạo 15 tài khoản bệnh nhân...\n")
    success, fail = 0, 0

    for idx, p in enumerate(patients_data, start=1):
        try:
            res = requests.post(BASE_URL, json=p)
            if res.status_code in [200, 201]:
                print(f"[{idx}/15] ✅ Thành công: {p['email']} ({p['full_name']})")
                success += 1
            else:
                detail = res.json().get('detail', res.text)
                print(f"[{idx}/15] ❌ Thất bại ({res.status_code}): {p['email']} - {detail}")
                fail += 1
        except Exception as e:
            print(f"[{idx}/15] 💥 Lỗi kết nối: {p['email']} - {str(e)}")
            fail += 1

    print("\n----------------------------------------")
    print(f"🎉 Hoàn tất! Thành công: {success} | Thất bại: {fail}")

if __name__ == "__main__":
    run_seed()