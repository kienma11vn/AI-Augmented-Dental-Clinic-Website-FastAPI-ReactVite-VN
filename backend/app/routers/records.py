from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app import models, schemas
from app.ai_guardrails import summarize_treatment_notes
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/", response_model=list[schemas.MedicalRecordOut])
def list_records(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "record:read")
    query = db.query(models.MedicalRecord)
    if current_user.role == "doctor":
        doctor = db.query(models.Doctor).filter(models.Doctor.user_id == current_user.id).first()
        if doctor:
            query = query.filter(models.MedicalRecord.doctor_id == doctor.id)
    elif current_user.role == "patient":
        patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
        if patient:
            query = query.filter(models.MedicalRecord.patient_id == patient.id)
    return query.order_by(models.MedicalRecord.created_at.desc()).all()


@router.post("/", response_model=schemas.MedicalRecordOut, status_code=status.HTTP_201_CREATED)
def create_record(payload: schemas.MedicalRecordCreate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "record:write")

    # 1. Kiểm tra tồn tại hồ sơ bệnh án theo appointment_id (Check-before-insert)
    if payload.appointment_id:
        existing_record = db.query(models.MedicalRecord).filter(
            models.MedicalRecord.appointment_id == payload.appointment_id
        ).first()
        if existing_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lịch hẹn #{payload.appointment_id} đã có hồ sơ bệnh án."
            )

    details = [models.MedicalRecordDetail(**d.model_dump()) for d in payload.details]
    record = models.MedicalRecord(
        patient_id=payload.patient_id,
        appointment_id=payload.appointment_id,
        doctor_id=payload.doctor_id,
        diagnosis_summary=payload.diagnosis_summary,
        treatment_notes=payload.treatment_notes,
        next_appointment_date=payload.next_appointment_date,
        details=details,
    )

    # 2. Xử lý ngoại lệ IntegrityError để đảm bảo an toàn nếu xảy ra race condition
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Lịch hẹn #{payload.appointment_id} đã có hồ sơ bệnh án."
        )

    return record


@router.get("/{record_id}", response_model=schemas.MedicalRecordOut)
def get_record(record_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "record:read")
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Hồ sơ không tồn tại")
    return record


@router.put("/{record_id}", response_model=schemas.MedicalRecordOut)
def update_record(record_id: int, payload: schemas.MedicalRecordUpdate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "record:write")
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Hồ sơ không tồn tại")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/ai-summary", response_model=schemas.AIResponse)
async def generate_ai_summary(record_id: int, db: Session = Depends(get_db),
                            current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "ai:use")
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Hồ sơ không tồn tại")
    notes = record.treatment_notes or ""
    summary = await summarize_treatment_notes(notes)
    record.ai_summary = summary
    db.commit()
    return {"result": summary}