from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.middleware.audit import AuditLogMiddleware
from app.routers import (
    ai,
    appointments,
    auth,
    chairs,
    doctors,
    invoices,
    users,
    patients,
    records,
    reports,
    services,
    audit,
    rbac,
    discount_programs,
    notifications,
    rag_chat
)

app = FastAPI(
    title="Hệ thống Quản lý Nha khoa tích hợp AI",
    description="Backend API cho phòng khám nha khoa (FastAPI + SQLAlchemy + PostgreSQL + Gemini)",
    version="1.0.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    allow_credentials=True,
)

app.add_middleware(AuditLogMiddleware)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["Patients"])
app.include_router(doctors.router, prefix="/api/v1/doctors", tags=["Doctors"])
app.include_router(chairs.router, prefix="/api/v1/chairs", tags=["Dental Chairs"])
app.include_router(appointments.router, prefix="/api/v1/appointments", tags=["Appointments"])
app.include_router(services.router, prefix="/api/v1/services", tags=["Services"])
app.include_router(records.router, prefix="/api/v1/records", tags=["Medical Records"])
app.include_router(invoices.router, prefix="/api/v1/invoices", tags=["Invoices"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI"])
app.include_router(audit.router, prefix="/api/v1/audit-logs", tags=["Audit Logs"])
app.include_router(rbac.router, prefix="/api/v1/rbac", tags=["RBAC"])
app.include_router(discount_programs.router, prefix="/api/v1/discount-programs", tags=["Discount Programs"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(rag_chat.router, prefix="/api/v1/rag-chat", tags=["Chatbot"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
