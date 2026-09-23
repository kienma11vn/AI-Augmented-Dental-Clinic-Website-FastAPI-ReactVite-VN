import json
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app import models, schemas
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import Role
from app.security import create_access_token, get_password_hash, verify_password
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

router = APIRouter()

# Cấu hình SMTP
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True
)


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu sai")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản bị khóa")

    # 1. Tạo session_id mới cho lần đăng nhập này
    new_session_id = str(uuid.uuid4())
    user.session_id = new_session_id  # Cập nhật session_id mới nhất vào DB

    role_str = user.role.value.lower() if hasattr(user.role, 'value') else str(user.role).lower()
    
    # 2. Đưa session_id (sid) vào payload của JWT Token
    access_token = create_access_token(
        data={
            "sub": user.email, 
            "role": role_str, 
            "sid": new_session_id
        },
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    # Ghi nhận AuditLog
    audit_log = models.AuditLog(
        user_id=user.id,
        action="POST /api/v1/auth/login",
        entity="auth",
        entity_id=user.id,
        details=json.dumps({"event": "User login success", "email": user.email}, ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def read_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Chỉ admin được tạo tài khoản")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    user = models.User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/patient-register", status_code=status.HTTP_201_CREATED)
def register_patient(patient_data: schemas.PatientRegister, db: Session = Depends(get_db)):
    # 1. Kiểm tra email đã được đăng ký chưa
    existing_user = db.query(models.User).filter(models.User.email == patient_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email đã được sử dụng."
        )

    # 2. Khởi tạo tài khoản User cho Bệnh nhân
    hashed_password = get_password_hash(patient_data.password)
    new_user = models.User(
        email=patient_data.email,
        hashed_password=hashed_password,
        full_name=patient_data.full_name,
        role=models.UserRole.PATIENT,
        is_active=True
    )
    db.add(new_user)
    db.flush()

    # 3. Khởi tạo hồ sơ Bệnh nhân (Patient) tương ứng
    new_patient = models.Patient(
        user_id=new_user.id,
        full_name=patient_data.full_name,
        phone=patient_data.phone,
        id_number=patient_data.id_number
    )
    db.add(new_patient)
    db.commit()

    return {"message": "Đăng ký tài khoản bệnh nhân thành công"}

    
@router.post("/forgot-password")
async def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Địa chỉ email này chưa được đăng ký trong hệ thống."
        )

    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Ghi nhận AuditLog yêu cầu quên mật khẩu
    audit_log = models.AuditLog(
        user_id=user.id,
        action="POST /api/v1/auth/forgot-password",
        entity="auth",
        entity_id=user.id,
        details=json.dumps({"event": "User requested password reset email", "email": user.email}, ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()

    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"

    html_content = f"""
    <p>Xin chào <b>{user.full_name}</b>,</p>
    <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng bấm vào liên kết dưới đây để hoàn tất (Link có hiệu lực trong 15 phút):</p>
    <p><a href="{reset_link}">Đặt lại mật khẩu ngay</a></p>
    """

    message = MessageSchema(
        subject="[DentalCareAI] Yêu cầu đặt lại mật khẩu",
        recipients=[user.email],
        body=html_content,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)

    return {"message": "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu."}
    

@router.post("/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác."
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    
    # Ghi nhận AuditLog đổi mật khẩu thành công (dùng current_user)
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="POST /api/v1/auth/change-password",
        entity="auth",
        entity_id=current_user.id,
        details=json.dumps({"event": "User change password success", "email": current_user.email}, ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Mật khẩu đã được cập nhật thành công."}

    
@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.reset_token == payload.token,
        models.User.reset_token_expires_at > datetime.now(timezone.utc)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã khôi phục không hợp lệ hoặc đã hết hạn."
        )

    user.hashed_password = get_password_hash(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    
    # Ghi nhận AuditLog đặt lại mật khẩu qua token thành công
    audit_log = models.AuditLog(
        user_id=user.id,
        action="POST /api/v1/auth/reset-password",
        entity="auth",
        entity_id=user.id,
        details=json.dumps({"event": "User reset password via token success", "email": user.email}, ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."}