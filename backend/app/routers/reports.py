from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.get("/overview")
def overview(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "report:read")
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_appointments = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.start_time >= since
    ).scalar() or 0
    cancelled = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.start_time >= since,
        models.Appointment.status == models.AppointmentStatus.CANCELLED,
    ).scalar() or 0
    completed = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.start_time >= since,
        models.Appointment.status == models.AppointmentStatus.COMPLETED,
    ).scalar() or 0
    
    # Doanh thu thực nhận từ paid_amount
    revenue = db.query(func.coalesce(func.sum(models.Invoice.paid_amount), 0)).filter(
        models.Invoice.created_at >= since
    ).scalar() or 0
    
    outstanding = db.query(
        func.coalesce(func.sum(models.Invoice.final_amount - models.Invoice.paid_amount), 0)
    ).filter(models.Invoice.created_at >= since).scalar() or 0
    patients = db.query(func.count(models.Patient.id)).scalar() or 0

    return {
        "period_days": days,
        "total_appointments": total_appointments,
        "completed_appointments": completed,
        "cancelled_appointments": cancelled,
        "cancel_rate": round(cancelled / total_appointments, 4) if total_appointments else 0,
        "revenue": float(revenue),
        "outstanding": float(outstanding),
        "total_patients": patients,
    }


@router.get("/visits-by-day")
def visits_by_day(days: int = Query(14, ge=1, le=180), db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "report:read")
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            func.date(models.Appointment.start_time).label("day"),
            func.count(models.Appointment.id).label("total"),
            func.sum(case((models.Appointment.status == models.AppointmentStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((models.Appointment.status == models.AppointmentStatus.CANCELLED, 1), else_=0)).label("cancelled"),
        )
        .filter(models.Appointment.start_time >= since)
        .group_by(func.date(models.Appointment.start_time))
        .order_by(func.date(models.Appointment.start_time))
        .all()
    )
    return [
        {
            "day": str(r.day),
            "total": r.total or 0,
            "completed": int(r.completed or 0),
            "cancelled": int(r.cancelled or 0),
        }
        for r in rows
    ]


@router.get("/revenue-by-service")
def revenue_by_service(days: int = Query(90, ge=1, le=365), db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "report:read")
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Tổng tiền chưa giảm giá của dòng dịch vụ đó
    service_item_total = models.InvoiceItem.unit_price * models.InvoiceItem.quantity

    # Phân bổ theo tỷ lệ tổng tiền của Hóa đơn (total_amount)
    service_paid_amount = (
        service_item_total * (models.Invoice.paid_amount / models.Invoice.total_amount)
    )
    service_discount_amount = (
        service_item_total * (models.Invoice.discount_amount / models.Invoice.total_amount)
    )
    service_debt_amount = (
        service_item_total * ((models.Invoice.final_amount - models.Invoice.paid_amount) / models.Invoice.total_amount)
    )

    rows = (
        db.query(
            models.DentalService.name.label("service"),
            func.coalesce(func.sum(models.InvoiceItem.quantity), 0).label("count"),
            # Doanh thu thực thu
            func.coalesce(
                func.sum(
                    case(
                        (models.Invoice.total_amount > 0, service_paid_amount),
                        else_=0
                    )
                ), 0
            ).label("amount"),
            # Chiết khấu phân bổ
            func.coalesce(
                func.sum(
                    case(
                        (models.Invoice.total_amount > 0, service_discount_amount),
                        else_=0
                    )
                ), 0
            ).label("discount"),
            # Công nợ phân bổ
            func.coalesce(
                func.sum(
                    case(
                        (models.Invoice.total_amount > 0, service_debt_amount),
                        else_=0
                    )
                ), 0
            ).label("debt"),
        )
        .join(models.InvoiceItem, models.InvoiceItem.service_id == models.DentalService.id)
        .join(models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id)
        .filter(
            models.Invoice.created_at >= since
        )
        .group_by(models.DentalService.name)
        .order_by(func.sum(case((models.Invoice.total_amount > 0, service_paid_amount), else_=0)).desc())
        .all()
    )

    return [
        {
            "service": r.service,
            "count": int(r.count),
            "amount": float(r.amount),
            "discount": float(r.discount),
            "debt": float(r.debt),
        }
        for r in rows
    ]


@router.get("/upcoming-followups")
def upcoming_followups(days: int = Query(30, ge=1, le=180), db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "report:read")
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=days)
    rows = (
        db.query(models.MedicalRecord)
        .filter(
            models.MedicalRecord.next_appointment_date.isnot(None),
            models.MedicalRecord.next_appointment_date >= now,
            models.MedicalRecord.next_appointment_date <= until,
        )
        .order_by(models.MedicalRecord.next_appointment_date)
        .all()
    )
    return [
        {
            "record_id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient.full_name if r.patient else None,
            "phone": r.patient.phone if r.patient else None,
            "next_appointment_date": r.next_appointment_date,
        }
        for r in rows
    ]


@router.get("/feedbacks")
def patient_feedbacks(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "report:read")
    since = datetime.now(timezone.utc) - timedelta(days=days)

    appointments = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.start_time >= since,
            (models.Appointment.rating.isnot(None)) | (models.Appointment.feedback.isnot(None))
        )
        .order_by(models.Appointment.start_time.desc())
        .all()
    )

    results = []
    for app in appointments:
        # Lấy danh sách tên dịch vụ từ hồ sơ bệnh án liên quan (nếu có)
        services_list = []
        if app.medical_record and app.medical_record.details:
            services_list = [d.service.name for d in app.medical_record.details if d.service]
        service_names = ", ".join(services_list) if services_list else "-"

        results.append({
            "id": app.id,
            "visit_date": app.start_time,
            "patient_name": app.patient.full_name if app.patient else "-",
            "doctor_name": app.doctor.full_name if app.doctor else "-",
            "service": service_names,
            "rating": app.rating,
            "feedback": app.feedback or "-",
        })

    return results