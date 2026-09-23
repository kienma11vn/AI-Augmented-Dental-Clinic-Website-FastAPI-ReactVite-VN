# backend/app/middleware/rag_rules.py
from typing import List, Union
from app.models import UserRole

# Định nghĩa danh sách các file được phép đọc theo từng vai trò
ROLE_KNOWLEDGE_FILES = {
    UserRole.ADMIN: "*",  # Lấy tất cả các file .txt
    UserRole.RECEPTIONIST: [
        "common_docs.txt",
        "patient_docs.txt",
        "receptionist_docs.txt",
    ],
    UserRole.PATIENT: [
        "patient_docs.txt",
        "common_docs.txt",
    ],
    UserRole.DOCTOR: [
        "doctor_docs.txt",
        "common_docs.txt",
    ],
    UserRole.ACCOUNTANT: [
        "accountant_docs.txt",
        "common_docs.txt",
    ],
}


def get_allowed_files_for_role(role: Union[UserRole, str]) -> List[str]:
    """Trả về danh sách tên file .txt mà role tương ứng được phép truy cập.
    Nếu role không nằm trong cấu hình, mặc định chỉ được đọc 'common_docs.txt'.
    """
    if isinstance(role, str):
        try:
            role = UserRole(role.lower())
        except ValueError:
            return ["common_docs.txt"]

    files = ROLE_KNOWLEDGE_FILES.get(role, ["common_docs.txt"])
    return files