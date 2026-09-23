import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, Response
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user
from app.rbac import Role

router = APIRouter()

@router.get("", response_model=List[schemas.AuditLogOut])
@router.get("/", response_model=List[schemas.AuditLogOut], include_in_schema=False)
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    entity: Optional[str] = None,
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Bảo mật: Chỉ Admin mới có quyền tra cứu Audit Logs
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Chỉ Admin mới có quyền xem nhật ký hệ thống"
        )

    query = db.query(models.AuditLog).options(joinedload(models.AuditLog.user))
    
    if entity:
        query = query.filter(models.AuditLog.entity == entity)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (models.AuditLog.action.ilike(search_filter)) |
            (models.AuditLog.entity.ilike(search_filter)) |
            (models.AuditLog.details.ilike(search_filter))
        )
        
    if startDate:
        try:
            start_dt = datetime.strptime(startDate, "%Y-%m-%d")
            query = query.filter(models.AuditLog.created_at >= start_dt)
        except ValueError:
            pass

    if endDate:
        try:
            end_dt = datetime.strptime(f"{endDate} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(models.AuditLog.created_at <= end_dt)
        except ValueError:
            pass
    
    return query.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    
@router.get("/export")
def export_audit_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Kiểm tra quyền Admin
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Chỉ Admin mới có quyền xuất nhật ký hệ thống"
        )

    # Lấy toàn bộ log sắp xếp từ mới nhất về cũ nhất
    logs = db.query(models.AuditLog)\
        .options(joinedload(models.AuditLog.user))\
        .order_by(models.AuditLog.created_at.desc())\
        .all()

    MAX_CHARACTERS = 50000
    exported_logs = []
    
    # Tính toán kích thước ký tự chuỗi JSON trả về
    current_char_count = 2  # Ký tự [] mở/đóng mảng JSON

    for log in logs:
        item = {
            "id": log.id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_id": log.user_id,
            "user": {
                "id": log.user.id,
                "full_name": log.user.full_name,
                "email": log.user.email,
                "role": log.user.role.value if hasattr(log.user.role, 'value') else str(log.user.role)
            } if log.user else None,
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "details": log.details
        }
        
        item_json = json.dumps(item, ensure_ascii=False)
        added_len = len(item_json) + (1 if exported_logs else 0)  # Thêm dấu phẩy phân cách

        # Dừng lặp nếu vượt quá giới hạn 50,000 ký tự
        if current_char_count + added_len > MAX_CHARACTERS:
            break

        exported_logs.append(item)
        current_char_count += added_len

    content = json.dumps(exported_logs, ensure_ascii=False, indent=2)
    filename = f"audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )