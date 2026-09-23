from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/", response_model=list[schemas.DentalChairOut])
def list_chairs(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "appointment:read")
    return db.query(models.DentalChair).order_by(models.DentalChair.name).all()


@router.post("/", response_model=schemas.DentalChairOut, status_code=status.HTTP_201_CREATED)
def create_chair(payload: schemas.DentalChairBase, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:write")
    if db.query(models.DentalChair).filter(models.DentalChair.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Tên ghế khám đã tồn tại")
    chair = models.DentalChair(**payload.model_dump())
    db.add(chair)
    db.commit()
    db.refresh(chair)
    return chair


@router.put("/{chair_id}", response_model=schemas.DentalChairOut)
def update_chair(chair_id: int, payload: schemas.DentalChairBase, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:write")
    chair = db.query(models.DentalChair).filter(models.DentalChair.id == chair_id).first()
    if not chair:
        raise HTTPException(status_code=404, detail="Ghế khám không tồn tại")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(chair, field, value)
    db.commit()
    db.refresh(chair)
    return chair


@router.delete("/{chair_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chair(chair_id: int, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "doctor:write")
    
    chair = db.query(models.DentalChair).filter(models.DentalChair.id == chair_id).first()
    if not chair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ghế khám không tồn tại")

    try:
        db.delete(chair)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa ghế khám này do đã phát sinh lịch hẹn trong hệ thống."
        )

    return None