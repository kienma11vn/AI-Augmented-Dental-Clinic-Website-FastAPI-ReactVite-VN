from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/", response_model=list[schemas.DentalServiceOut])
def list_services(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    require_role(current_user, "service:read")
    query = db.query(models.DentalService)
    
    # Lọc theo trạng thái hoạt động nếu truyền tham số is_active
    if is_active is not None:
        query = query.filter(models.DentalService.is_active == is_active)
        
    return query.order_by(models.DentalService.id.desc()).all()


@router.post("/", response_model=schemas.DentalServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(payload: schemas.DentalServiceCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "service:write")
    service = models.DentalService(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/{service_id}", response_model=schemas.DentalServiceOut)
def get_service(service_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "service:read")
    service = db.query(models.DentalService).filter(models.DentalService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Dịch vụ không tồn tại")
    return service


@router.put("/{service_id}", response_model=schemas.DentalServiceOut)
def update_service(service_id: int, payload: schemas.DentalServiceUpdate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "service:write")
    service = db.query(models.DentalService).filter(models.DentalService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Dịch vụ không tồn tại")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", response_model=schemas.DentalServiceOut)
def toggle_service_status(service_id: int, db: Session = Depends(get_db),
                          current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "service:write")
    service = db.query(models.DentalService).filter(models.DentalService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Dịch vụ không tồn tại")
    # Đảo trạng thái hoạt động thay vì xóa cứng
    service.is_active = not service.is_active
    db.commit()
    db.refresh(service)
    return service