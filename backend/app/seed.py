"""Seed dữ liệu mẫu: 5 tài khoản demo (mỗi vai trò 1), ghế khám, bác sĩ, dịch vụ.

Chạy:  python -m app.seed
"""
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from app.database import Base, SessionLocal, engine
from app import models
from app.security import get_password_hash

DEMO_PASSWORD = "Demo@123"

DEMO_USERS = [
    ("admin@nhakhoa.vn", "Nguyễn Quản Trị", models.UserRole.ADMIN),
    ("letan@nhakhoa.vn", "Trần Lễ Tân", models.UserRole.RECEPTIONIST),
    ("bacsi@nhakhoa.vn", "Lê Văn Bác Sĩ", models.UserRole.DOCTOR),
    ("ketoan@nhakhoa.vn", "Phạm Kế Toán", models.UserRole.ACCOUNTANT),
    ("benhnhan@nhakhoa.vn", "Hoàng Thị Bệnh Nhân", models.UserRole.PATIENT),
]

SERVICES = [
    ("Khám và tư vấn tổng quát", "KHAM01", "Thăm khám, kiểm tra tình trạng răng miệng tổng quát.", 100000),
    ("Lấy cao răng", "CAO01", "Làm sạch vôi răng, đánh bóng bề mặt răng.", 300000),
    ("Trám răng composite", "TRAM01", "Phục hồi răng sâu hoặc sứt bằng vật liệu composite.", 500000),
    ("Điều trị tủy răng", "TUY01", "Làm sạch và trám bít hệ thống ống tủy.", 1500000),
    ("Nhổ răng thường", "NHO01", "Nhổ răng bằng thủ thuật thông thường.", 700000),
    ("Bọc răng sứ", "SU01", "Phục hình răng bằng mão sứ.", 3500000),
    ("Tẩy trắng răng", "TRANG01", "Tẩy trắng răng bằng đèn tại phòng khám.", 2000000),
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users: dict[str, models.User] = {}
        for email, full_name, role in DEMO_USERS:
            user = db.query(models.User).filter(models.User.email == email).first()
            if not user:
                user = models.User(
                    email=email,
                    full_name=full_name,
                    role=role,
                    hashed_password=get_password_hash(DEMO_PASSWORD),
                )
                db.add(user)
                db.flush()
            users[role.value] = user

        # Ghế khám
        for name in ["Ghế 01.A1", "Ghế 02.A1", "Ghế 03.A2"]:
            if not db.query(models.DentalChair).filter(models.DentalChair.name == name).first():
                db.add(models.DentalChair(name=name))

        # Bác sĩ
        doctor_user = users["doctor"]
        doctor = db.query(models.Doctor).filter(models.Doctor.user_id == doctor_user.id).first()
        if not doctor:
            doctor = models.Doctor(
                user_id=doctor_user.id,
                full_name=doctor_user.full_name,
                specialty="Nha khoa tổng quát",
                phone="0901234567",
                license_number="BS-0001",
            )
            db.add(doctor)
            db.flush()
            for day in range(0, 6):
                db.add(models.DoctorSchedule(
                    doctor_id=doctor.id, day_of_week=day,
                    start_time=time(8, 0), end_time=time(17, 0),
                ))

        # Bệnh nhân
        patient_user = users["patient"]
        patient = db.query(models.Patient).filter(models.Patient.user_id == patient_user.id).first()
        if not patient:
            patient = models.Patient(
                user_id=patient_user.id,
                full_name=patient_user.full_name,
                phone="0912345678",
                id_number="079123456789",
                gender="Nữ",
                address="12 Nguyễn Huệ, Quận 1, TP.HCM",
                medical_history="Không có tiền sử dị ứng thuốc.",
            )
            db.add(patient)
            db.flush()

        # Dịch vụ
        for name, code, description, price in SERVICES:
            if not db.query(models.DentalService).filter(models.DentalService.code == code).first():
                db.add(models.DentalService(
                    name=name, code=code, description=description,
                    unit_price=Decimal(price),
                ))

        db.commit()

        # Lịch hẹn mẫu
        chair = db.query(models.DentalChair).first()
        if chair and not db.query(models.Appointment).first():
            start = datetime.now(timezone.utc) + timedelta(days=1)
            start = start.replace(minute=0, second=0, microsecond=0)
            db.add(models.Appointment(
                patient_id=patient.id,
                doctor_id=doctor.id,
                chair_id=chair.id,
                start_time=start,
                end_time=start + timedelta(minutes=45),
                status=models.AppointmentStatus.SCHEDULED,
                note="Khám tổng quát định kỳ.",
            ))
            db.commit()

        print("Seed hoàn tất. Mật khẩu demo cho tất cả tài khoản:", DEMO_PASSWORD)
        for email, _, role in DEMO_USERS:
            print(f"  {role.value:12s} {email}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
