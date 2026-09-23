from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.post("", response_model=schemas.NotificationOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=schemas.NotificationOut, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: schemas.NotificationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Tạo thông báo mới (Dành cho Lễ tân, Bác sĩ, hoặc Hệ thống tự động gửi khi thay đổi lịch).
    Hỗ trợ các loại thông báo: 'appointment_change', 'reminder', 'general', ...
    """
    patient = db.query(models.Patient).filter(models.Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Bệnh nhân không tồn tại"
        )

    # Nếu có appointment_id truyền vào, kiểm tra tính hợp lệ của lịch khám
    if payload.appointment_id:
        appointment = db.query(models.Appointment).filter(models.Appointment.id == payload.appointment_id).first()
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Lịch hẹn không tồn tại"
            )

    notification = models.Notification(
        patient_id=payload.patient_id,
        appointment_id=payload.appointment_id,
        title=payload.title,
        message=payload.message,
        type=payload.type,
        is_read=payload.is_read if payload.is_read is not None else False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    log_action(db, current_user, "create_notification", "notifications", notification.id)
    return notification


@router.get("", response_model=List[schemas.NotificationOut])
@router.get("/", response_model=List[schemas.NotificationOut])
async def get_all_notifications(
    patient_id: Optional[int] = Query(None, description="Lọc theo mã Bệnh nhân"),
    type: Optional[str] = Query(None, description="Lọc theo loại thông báo (appointment_change, reminder,...)"),
    is_read: Optional[bool] = Query(None, description="Lọc theo trạng thái đã đọc/chưa đọc"),
    limit: int = Query(100, ge=1, le=500, description="Giới hạn số lượng bản ghi trả về"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lấy danh sách tất cả thông báo trong hệ thống (Dành cho Lễ tân/Quản lý tra cứu).
    """
    query = db.query(models.Notification)

    if patient_id is not None:
        query = query.filter(models.Notification.patient_id == patient_id)
    if type is not None:
        query = query.filter(models.Notification.type == type)
    if is_read is not None:
        query = query.filter(models.Notification.is_read == is_read)

    notifications = query.order_by(models.Notification.created_at.desc()).limit(limit).all()
    return notifications


@router.get("/my-notifications", response_model=List[schemas.NotificationOut])
async def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lấy danh sách thông báo cho tài khoản hiện tại:
    - Nếu là Bệnh nhân: Trả về danh sách thông báo cá nhân của bệnh nhân đó.
    - Nếu là Lễ tân / Bác sĩ / Admin: Trả về danh sách thông báo thay đổi lịch khám mới nhất toàn hệ thống.
    """
    patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
    
    if patient:
        # Đối với tài khoản Bệnh nhân
        notifications = (
            db.query(models.Notification)
            .filter(models.Notification.patient_id == patient.id)
            .order_by(models.Notification.created_at.desc())
            .all()
        )
        return notifications

    # Đối với tài khoản Nhân viên / Lễ tân / Bác sĩ / Admin (Không gắn liền với hồ sơ bệnh nhân)
    # Trả về các thông báo gần nhất toàn hệ thống để hiển thị trên bảng điều khiển
    notifications = (
        db.query(models.Notification)
        .order_by(models.Notification.created_at.desc())
        .limit(200)
        .all()
    )
    return notifications


@router.get("/patient/{patient_id}", response_model=List[schemas.NotificationOut])
async def get_patient_notifications(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lấy danh sách thông báo của một bệnh nhân cụ thể theo `patient_id`.
    """
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Bệnh nhân không tồn tại"
        )

    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.patient_id == patient_id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )
    return notifications


@router.patch("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_notifications_as_read(
    patient_id: Optional[int] = Query(None, description="Mã bệnh nhân (tùy chọn)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Đánh dấu hàng loạt tất cả thông báo chưa đọc thành đã đọc.
    """
    query = db.query(models.Notification).filter(models.Notification.is_read == False)
    
    # Nếu truyền patient_id thì chỉ đánh dấu cho bệnh nhân đó, nếu không truyền sẽ kiểm tra profile người dùng
    if patient_id:
        query = query.filter(models.Notification.patient_id == patient_id)
    else:
        patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
        if patient:
            query = query.filter(models.Notification.patient_id == patient.id)

    updated_count = query.update({models.Notification.is_read: True}, synchronize_session=False)
    db.commit()

    return {"message": f"Đã đánh dấu {updated_count} thông báo là đã đọc", "updated_count": updated_count}


@router.patch("/{notification_id}/read", response_model=schemas.NotificationOut)
async def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Đánh dấu 1 thông báo cụ thể là đã đọc.
    """
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Thông báo không tồn tại"
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return notification