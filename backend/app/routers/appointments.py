from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/", response_model=list[schemas.AppointmentOut])
def list_appointments(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "appointment:read")
    query = db.query(models.Appointment)
    
    user_role = getattr(current_user.role, "value", str(current_user.role))
    if user_role == "doctor":
        doctor = db.query(models.Doctor).filter(models.Doctor.user_id == current_user.id).first()
        if doctor:
            query = query.filter(models.Appointment.doctor_id == doctor.id)
    elif user_role == "patient":
        patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
        if patient:
            query = query.filter(models.Appointment.patient_id == patient.id)
            
    return query.order_by(models.Appointment.start_time.desc()).all()


@router.post("/", response_model=schemas.AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: schemas.AppointmentCreate, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "appointment:write")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
    appointment = models.Appointment(**payload.model_dump())
    db.add(appointment)
    try:
        db.commit()
        db.refresh(appointment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Trùng lịch bác sĩ hoặc ghế khám trong khoảng thời gian này")
    return appointment


@router.get("/{appointment_id}", response_model=schemas.AppointmentOut)
def get_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "appointment:read")
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Lịch hẹn không tồn tại")
    return appointment


@router.put("/{appointment_id}", response_model=schemas.AppointmentOut)
def update_appointment(
    appointment_id: int, 
    payload: schemas.AppointmentUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    require_role(current_user, "appointment:write")
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Lịch hẹn không tồn tại")
    
    update_data = payload.model_dump(exclude_unset=True)

    # Nếu Frontend gửi status là "checkin"
    if update_data.get("status") == models.AppointmentStatus.CHECKIN or update_data.get("status") == "checkin":
        update_data["status"] = models.AppointmentStatus.CONFIRMED
        existing_note = appointment.note or ""
        if "[CHECKIN]" not in existing_note:
            update_data["note"] = f"[CHECKIN] {existing_note}".strip()

    for field, value in update_data.items():
        setattr(appointment, field, value)
        
    db.commit()
    db.refresh(appointment)
    return appointment


# API Bệnh nhân gửi Đánh giá & Phản hồi cho Lịch hẹn
@router.put("/{appointment_id}/feedback", response_model=schemas.AppointmentOut)
def submit_appointment_feedback(
    appointment_id: int,
    payload: schemas.AppointmentFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Lịch hẹn không tồn tại")

    user_role = getattr(current_user.role, "value", str(current_user.role))
    if user_role == "patient":
        patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
        if not patient or appointment.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền đánh giá lịch hẹn này")

    if appointment.status != models.AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Chỉ có thể gửi đánh giá cho các lịch hẹn đã hoàn thành khám")

    appointment.rating = payload.rating
    appointment.feedback = payload.feedback

    db.commit()
    db.refresh(appointment)
    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(appointment_id: int, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "appointment:write")
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Lịch hẹn không tồn tại")
    appointment.status = models.AppointmentStatus.CANCELLED
    db.commit()
    return None