# app/middleware/audit.py
import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt
from app.database import SessionLocal
from app.models import AuditLog, User
from app.config import settings

class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Bỏ qua ghi log cho docs, openapi, health check, static files
        if request.url.path.startswith(("/docs", "/openapi.json", "/health", "/static")):
            return await call_next(request)

        user_id = None
        auth_header = request.headers.get("Authorization")
        
        # 1. Trích xuất User ID từ Authorization Token
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
                sub = payload.get("sub")
                
                if sub:
                    db = SessionLocal()
                    try:
                        if str(sub).isdigit():
                            user_id = int(sub)
                        else:
                            # Nếu 'sub' chứa email người dùng
                            db_user = db.query(User).filter(User.email == str(sub)).first()
                            if db_user:
                                user_id = db_user.id
                    finally:
                        db.close()
            except Exception:
                # Bắt tất cả ngoại lệ decode JWT để không gây gián đoạn Request
                pass

        response = await call_next(request)

        # 2. Ghi nhật ký vào CSDL
        # Bỏ qua endpoint /api/v1/auth/login vì router auth đã chủ động ghi log kèm User ID
        if request.url.path.startswith("/api/") and request.url.path != "/api/v1/auth/login":
            path_parts = [p for p in request.url.path.split("/") if p]
            entity = path_parts[2] if len(path_parts) > 2 else "system"
            action = f"{request.method} {request.url.path}"
            
            details_data = {
                "method": request.method,
                "status_code": response.status_code,
                "client_ip": request.client.host if request.client else None,
                "query_params": dict(request.query_params),
            }

            db = SessionLocal()
            try:
                log_entry = AuditLog(
                    user_id=user_id,
                    action=action,
                    entity=entity,
                    details=json.dumps(details_data, ensure_ascii=False)
                )
                db.add(log_entry)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

        return response