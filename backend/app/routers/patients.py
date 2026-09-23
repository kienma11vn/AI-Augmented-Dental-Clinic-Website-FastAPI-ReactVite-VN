from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/", response_model=list[schemas.PatientOut])
def list_patients(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "patient:read")
    query = db.query(models.Patient).options(joinedload(models.Patient.user))
    if current_user.role == "patient":
        return query.filter(models.Patient.user_id == current_user.id).all()
    return query.all()


@router.post("/", response_model=schemas.PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    require_role(current_user, "patient:write")
    
    # Kiểm tra nếu hồ sơ Patient đã được tự động tạo khi khởi tạo User
    if payload.user_id:
        existing_patient = db.query(models.Patient).filter(models.Patient.user_id == payload.user_id).first()
        if existing_patient:
            for field, value in payload.model_dump(exclude_unset=True).items():
                setattr(existing_patient, field, value)
            db.commit()
            db.refresh(existing_patient)
            return existing_patient

    patient = models.Patient(**payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=schemas.PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "patient:read")
    patient = db.query(models.Patient).options(joinedload(models.Patient.user)).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bệnh nhân không tồn tại")
    if current_user.role.value == "patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xem")
    return patient


@router.put("/{patient_id}", response_model=schemas.PatientOut)
def update_patient(patient_id: int, payload: schemas.PatientUpdate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "patient:write")
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bệnh nhân không tồn tại")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "patient:write")
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bệnh nhân không tồn tại")
    db.delete(patient)
    db.commit()
    return None
