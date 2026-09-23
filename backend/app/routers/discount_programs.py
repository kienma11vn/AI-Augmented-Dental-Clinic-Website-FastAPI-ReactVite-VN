from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.routers.auth import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("", response_model=List[schemas.DiscountProgramOut])
def get_discount_programs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.DiscountProgram).order_by(models.DiscountProgram.created_at.desc()).all()


@router.post("", response_model=schemas.DiscountProgramOut, status_code=status.HTTP_201_CREATED)
def create_discount_program(
    program_in: schemas.DiscountProgramCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "invoice:write")
    existing = db.query(models.DiscountProgram).filter(models.DiscountProgram.code == program_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã giảm giá đã tồn tại.")
    
    program = models.DiscountProgram(**program_in.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


@router.get("/{program_id}", response_model=schemas.DiscountProgramOut)
def get_discount_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    program = db.query(models.DiscountProgram).filter(models.DiscountProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình ưu đãi.")
    return program


@router.put("/{program_id}", response_model=schemas.DiscountProgramOut)
def update_discount_program(
    program_id: int,
    program_in: schemas.DiscountProgramUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "invoice:write")
    program = db.query(models.DiscountProgram).filter(models.DiscountProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình ưu đãi.")

    update_data = program_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(program, field, value)

    db.commit()
    db.refresh(program)
    return program


@router.patch("/{program_id}/toggle", response_model=schemas.DiscountProgramOut)
def toggle_discount_program_status(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "invoice:write")
    program = db.query(models.DiscountProgram).filter(models.DiscountProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình ưu đãi.")

    program.is_active = not program.is_active
    db.commit()
    db.refresh(program)
    return program


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "invoice:write")
    program = db.query(models.DiscountProgram).filter(models.DiscountProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình ưu đãi.")

    db.delete(program)
    db.commit()
    return None