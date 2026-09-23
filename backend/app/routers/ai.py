from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.ai_guardrails import (
    explain_service,
    generate_reminder_message,
    summarize_treatment_notes,
)
from app.audit import log_action
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


@router.post("/summarize-record", response_model=schemas.AIResponse)
async def summarize_record(payload: schemas.AISummaryRequest, db: Session = Depends(get_db),
                           current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "ai:use")
    record = db.query(models.MedicalRecord).filter(
        models.MedicalRecord.id == payload.medical_record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Hồ sơ điều trị không tồn tại")
    if not record.treatment_notes:
        raise HTTPException(status_code=400, detail="Hồ sơ chưa có ghi chú điều trị để tóm tắt")
    result = await summarize_treatment_notes(record.treatment_notes)
    record.ai_summary = result
    db.commit()
    log_action(db, current_user, "ai_summarize", "medical_records", record.id)
    return {"result": result}


@router.post("/reminder", response_model=schemas.AIResponse)
async def reminder(payload: schemas.AIReminderRequest, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "ai:use")
    result = await generate_reminder_message(payload.patient_name, payload.next_appointment, payload.service)
    log_action(db, current_user, "ai_reminder", "appointments", None, payload.next_appointment)
    return {"result": result}


@router.post("/generate-change-notice", response_model=schemas.AIResponse)
async def generate_change_notice(payload: schemas.AIChangeNoticeRequest, db: Session = Depends(get_db),
                                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "ai:use")
    try:
        from app.ai_guardrails import generate_change_notice_message
        result = await generate_change_notice_message(
            patient_name=payload.patient_name,
            doctor_name=payload.doctor_name,
            old_time=payload.old_time,
            new_time=payload.new_time,
            change_type=payload.change_type,
            reason=payload.reason
        )
    except (ImportError, AttributeError):
        if payload.change_type == "cancel":
            result = f"Kính gửi {payload.patient_name}, lịch hẹn khám của bạn đã bị hủy do {payload.reason or 'lý do bất khả kháng'}. Xin lỗi bạn vì sự bất tiện này."
        elif payload.change_type == "reschedule":
            result = f"Kính gửi {payload.patient_name}, lịch hẹn khám của bạn đã được dời từ {payload.old_time or ''} sang {payload.new_time or ''}. Vui lòng kiểm tra lại thông tin."
        else:
            result = f"Kính gửi {payload.patient_name}, lịch hẹn của bạn tại phòng khám đã được cập nhật thay đổi. Vui lòng liên hệ nếu cần trợ giúp."

    log_action(db, current_user, "ai_change_notice", "appointments", None, payload.patient_name)
    return {"result": result}


@router.post("/explain-service", response_model=schemas.AIResponse)
async def explain(payload: schemas.AIExplainRequest, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "ai:use")
    result = await explain_service(payload.service_name, payload.description)
    log_action(db, current_user, "ai_explain", "dental_services", None, payload.service_name)
    return {"result": result}