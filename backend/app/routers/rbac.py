from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app import models
from app.dependencies import get_current_user
from app.rbac import (
    Role,
    PERMISSIONS,
    require_role,
    get_role_permissions_mapping,
    update_role_permissions_mapping,
)

router = APIRouter()

# Nhãn và phân nhóm quyền hiển thị cho người dùng
PERMISSION_METADATA = {
    "patient:read": {"label": "Xem thông tin bệnh nhân", "category": "Quản lý Bệnh nhân"},
    "patient:write": {"label": "Tạo/Sửa hồ sơ bệnh nhân", "category": "Quản lý Bệnh nhân"},
    "doctor:read": {"label": "Xem danh sách bác sĩ", "category": "Quản lý Bác sĩ"},
    "doctor:write": {"label": "Cập nhật thông tin bác sĩ", "category": "Quản lý Bác sĩ"},
    "appointment:read": {"label": "Xem lịch hẹn", "category": "Quản lý Lịch hẹn"},
    "appointment:write": {"label": "Đặt/Sửa/Hủy lịch hẹn", "category": "Quản lý Lịch hẹn"},
    "service:read": {"label": "Xem danh mục dịch vụ", "category": "Quản lý Dịch vụ"},
    "service:write": {"label": "Cập nhật giá & dịch vụ", "category": "Quản lý Dịch vụ"},
    "record:read": {"label": "Xem bệnh án & chẩn đoán", "category": "Quản lý Bệnh án"},
    "record:write": {"label": "Tạo/Cập nhật bệnh án", "category": "Quản lý Bệnh án"},
    "invoice:read": {"label": "Xem hóa đơn thanh toán", "category": "Quản lý Hóa đơn"},
    "invoice:write": {"label": "Tạo hóa đơn & Thu tiền", "category": "Quản lý Hóa đơn"},
    "report:read": {"label": "Xem báo cáo doanh thu & thống kê", "category": "Báo cáo Thống kê"},
    "ai:use": {"label": "Sử dụng Chức năng AI", "category": "Tính năng AI"},
    "user:read": {"label": "Xem danh sách tài khoản", "category": "Quản lý Tài khoản & RBAC"},
    "user:write": {"label": "Tạo/Khóa tài khoản", "category": "Quản lý Tài khoản & RBAC"},
    "user:manage": {"label": "Toàn quyền cấu hình RBAC", "category": "Quản lý Tài khoản & RBAC"},
}


class UpdateRolePermissionsPayload(BaseModel):
    role: str
    permissions: List[str]


@router.get("/roles-permissions")
def get_roles_and_permissions(current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "user:manage")
    
    roles = [{"code": r.value, "name": r.name} for r in Role]
    permissions_list = [
        {
            "code": perm_key,
            "label": PERMISSION_METADATA.get(perm_key, {}).get("label", perm_key),
            "category": PERMISSION_METADATA.get(perm_key, {}).get("category", "Khác"),
        }
        for perm_key in PERMISSIONS.keys()
    ]
    
    return {
        "roles": roles,
        "permissions": permissions_list,
        "role_permissions": get_role_permissions_mapping(),
    }


@router.put("/roles-permissions")
def update_role_permissions(
    payload: UpdateRolePermissionsPayload,
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "user:manage")
    
    # 1. Kiểm tra vai trò hợp lệ
    valid_roles = [r.value for r in Role]
    if payload.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vai trò '{payload.role}' không tồn tại trong hệ thống."
        )

    # 2. Kiểm tra danh sách mã quyền gửi lên có hợp lệ hay không
    invalid_perms = [p for p in payload.permissions if p not in PERMISSIONS]
    if invalid_perms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Các quyền không hợp lệ: {', '.join(invalid_perms)}"
        )

    # 3. Bảo vệ: Đảm bảo Admin luôn giữ quyền user:manage để không tự khóa hệ thống
    if payload.role == Role.ADMIN.value and "user:manage" not in payload.permissions:
        payload.permissions.append("user:manage")

    update_role_permissions_mapping(payload.role, payload.permissions)
    return {"detail": f"Đã cập nhật phân quyền thành công cho vai trò '{payload.role}'"}