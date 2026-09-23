from enum import Enum
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app import models


class Role(str, Enum):
    ADMIN = "admin"
    RECEPTIONIST = "receptionist"
    DOCTOR = "doctor"
    ACCOUNTANT = "accountant"
    PATIENT = "patient"


PERMISSIONS = {
    "patient:read": [Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.ACCOUNTANT, Role.PATIENT],
    "patient:write": [Role.ADMIN, Role.RECEPTIONIST, Role.PATIENT],
    "doctor:read": [Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.PATIENT],
    "doctor:write": [Role.ADMIN],
    "appointment:read": [Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.ACCOUNTANT, Role.PATIENT],
    "appointment:write": [Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.PATIENT],
    "service:read": [Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.ACCOUNTANT, Role.PATIENT],
    "service:write": [Role.ADMIN],
    "record:read": [Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.ACCOUNTANT, Role.PATIENT],
    "record:write": [Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.ACCOUNTANT, Role.PATIENT],
    "invoice:read": [Role.ADMIN, Role.RECEPTIONIST, Role.ACCOUNTANT, Role.PATIENT, Role.DOCTOR],
    "invoice:write": [Role.ADMIN, Role.RECEPTIONIST, Role.ACCOUNTANT],
    "report:read": [Role.ADMIN, Role.RECEPTIONIST, Role.ACCOUNTANT],
    "ai:use": [Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.PATIENT],
    "user:read": [Role.ADMIN, Role.RECEPTIONIST, Role.PATIENT],
    "user:write": [Role.ADMIN, Role.RECEPTIONIST, Role.PATIENT],
    "user:manage": [Role.ADMIN, Role.RECEPTIONIST],
}


def require_role(current_user: models.User, permission: str):
    allowed = PERMISSIONS.get(permission, [])
    user_role = getattr(current_user.role, "value", str(current_user.role))
    
    if user_role not in [r.value if isinstance(r, Enum) else str(r) for r in allowed]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này.",
        )


def get_role_permissions_mapping():
    """Chuyển đổi dữ liệu từ PERMISSIONS dạng {perm: [roles]} sang {role: [perms]}"""
    role_map = {r.value: [] for r in Role}
    for perm, roles in PERMISSIONS.items():
        for r in roles:
            r_val = r.value if isinstance(r, Enum) else str(r)
            if r_val in role_map and perm not in role_map[r_val]:
                role_map[r_val].append(perm)
    return role_map


def update_role_permissions_mapping(target_role: str, new_permissions: list[str]):
    """Cập nhật lại ma trận quyền cho một Role nhất định"""
    valid_roles = [r.value for r in Role]
    if target_role not in valid_roles:
        raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")

    target_role_enum = Role(target_role)

    for perm_key in PERMISSIONS.keys():
        allowed_list = PERMISSIONS[perm_key]
        # Lọc bỏ target_role khỏi danh sách hiện tại
        PERMISSIONS[perm_key] = [r for r in allowed_list if (r.value if isinstance(r, Enum) else str(r)) != target_role]
        # Nếu perm_key có trong danh sách mới, thêm lại vào
        if perm_key in new_permissions:
            PERMISSIONS[perm_key].append(target_role_enum)


def get_user_by_id(db: Session, user_id: int) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user