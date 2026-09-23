from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/", response_model=list[schemas.DoctorWithSchedules])
def list_doctors(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:read")
    doctors = db.query(models.Doctor).all()
    return doctors


@router.post("/", response_model=schemas.DoctorOut, status_code=status.HTTP_201_CREATED)
def create_doctor(payload: schemas.DoctorCreate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:write")
    doctor = models.Doctor(**payload.model_dump())
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.get("/me/patients", response_model=list[schemas.PatientOut])
def get_doctor_patients(
    tab: str = Query("tracking", description="Chấp nhận 'tracking' (Đang theo dõi) hoặc 'examined' (Đã khám)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    require_role(current_user, "patient:read")
    
    doctor = db.query(models.Doctor).filter(models.Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Tài khoản này chưa có hồ sơ Bác sĩ trong bảng doctors."
        )

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
    ninety_days_ago = now - timedelta(days=90)

    valid_statuses = [
        "scheduled", "confirmed", "checkin", "completed",
        "SCHEDULED", "CONFIRMED", "CHECKIN", "COMPLETED"
    ]

    # Ép kiểu status sang String để ép SQLAlchemy truyền nguyên bản chuỗi viết thường vào SQL
    query = db.query(models.Patient).join(
        models.Appointment, models.Appointment.patient_id == models.Patient.id
    ).filter(
        models.Appointment.doctor_id == doctor.id,
        cast(models.Appointment.status, String).in_(valid_statuses)
    )

    if tab == "tracking":
        query = query.filter(models.Appointment.start_time >= today_start)
    elif tab == "examined":
        query = query.filter(
            models.Appointment.start_time >= ninety_days_ago,
            models.Appointment.start_time < today_start
        )
    else:
        raise HTTPException(status_code=400, detail="Giá trị tab không hợp lệ.")

    patients = query.distinct().all()
    return patients


@router.get("/{doctor_id}", response_model=list[schemas.DoctorWithSchedules] if False else schemas.DoctorWithSchedules)
def get_doctor(doctor_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:read")
    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Bác sĩ không tồn tại")
    return doctor


@router.put("/{doctor_id}", response_model=schemas.DoctorOut)
def update_doctor(doctor_id: int, payload: schemas.DoctorUpdate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:write")
    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Bác sĩ không tồn tại")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.post("/{doctor_id}/schedules", response_model=schemas.DoctorScheduleOut, status_code=status.HTTP_201_CREATED)
def add_schedule(doctor_id: int, payload: schemas.DoctorScheduleBase, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:write")
    schedule = models.DoctorSchedule(doctor_id=doctor_id, **payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule