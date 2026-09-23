from typing import Optional
from sqlalchemy.orm import Session
from app import models


def log_action(
    db: Session,
    user: Optional[models.User],
    action: str,
    entity: str,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    """Ghi audit log cho các thao tác nhạy cảm (hồ sơ, hóa đơn, phân quyền)."""
    entry = models.AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
    db.commit()
