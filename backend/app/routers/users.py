from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role
from app.security import get_password_hash

router = APIRouter()


@router.get("/", response_model=list[schemas.UserOut])
def list_users(
    role: Optional[models.UserRole] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "user:read")
    query = db.query(models.User)
    
    if role:
        query = query.filter(models.User.role == role)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (models.User.full_name.ilike(term)) | (models.User.email.ilike(term))
        )
    return query.order_by(models.User.id.desc()).all()


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "user:write")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    user = models.User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Tự động đồng bộ liên kết bảng Doctor hoặc Patient tương ứng
    if payload.role == models.UserRole.DOCTOR:
        if not db.query(models.Doctor).filter(models.Doctor.user_id == user.id).first():
            db.add(models.Doctor(user_id=user.id, full_name=user.full_name))
            db.commit()
    elif payload.role == models.UserRole.PATIENT:
        if not db.query(models.Patient).filter(models.Patient.user_id == user.id).first():
            db.add(models.Patient(user_id=user.id, full_name=user.full_name, phone=""))
            db.commit()

    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "user:write")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

    update_data = payload.model_dump(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        user.hashed_password = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/toggle-status", response_model=schemas.UserOut)
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "user:write")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản của chính mình")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user