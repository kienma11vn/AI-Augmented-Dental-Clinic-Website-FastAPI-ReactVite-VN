from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.database import get_db
from app.dependencies import get_current_user
from app.rbac import require_role

router = APIRouter()


def _resolve_status(final_amount: Decimal, paid: Decimal) -> models.InvoiceStatus:
    if paid <= 0:
        return models.InvoiceStatus.UNPAID
    if paid >= final_amount:
        return models.InvoiceStatus.PAID
    return models.InvoiceStatus.PARTIAL


def _calculate_discount(total: Decimal, discount_amount: Optional[Decimal], discount_rate: Optional[Decimal]) -> tuple[Decimal, Decimal, Decimal]:
    disc_rate = discount_rate or Decimal("0")
    disc_amount = discount_amount or Decimal("0")

    if disc_rate > 0 and disc_amount == 0:
        disc_amount = (total * disc_rate / Decimal("100")).quantize(Decimal("0.01"))

    if disc_amount > total:
        raise HTTPException(status_code=400, detail="Số tiền chiết khấu không thể lớn hơn tổng tiền hóa đơn")

    final_amount = max(Decimal("0"), total - disc_amount)
    return disc_amount, disc_rate, final_amount


@router.get("/", response_model=list[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "invoice:read")
    query = db.query(models.Invoice)
    if current_user.role == "patient":
        patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
        query = query.filter(models.Invoice.patient_id == (patient.id if patient else -1))
    return query.order_by(models.Invoice.created_at.desc()).all()


@router.post("/", response_model=schemas.InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "invoice:write")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Hóa đơn phải có ít nhất một dịch vụ")
    
    total = sum((Decimal(i.unit_price) * i.quantity for i in payload.items), Decimal("0"))
    disc_amount, disc_rate, final = _calculate_discount(total, payload.discount_amount, payload.discount_rate)

    invoice = models.Invoice(
        patient_id=payload.patient_id,
        medical_record_id=payload.medical_record_id,
        total_amount=total,
        discount_amount=disc_amount,
        discount_rate=disc_rate,
        final_amount=final,
        discount_code=payload.discount_code,
        discount_reason=payload.discount_reason,
        payment_method=payload.payment_method,
        paid_amount=Decimal("0"),
        status=models.InvoiceStatus.UNPAID,
        items=[models.InvoiceItem(**i.model_dump()) for i in payload.items],
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    log_action(db, current_user, "create", "invoices", invoice.id, f"total={total}, final={final}")
    return invoice


@router.post("/from-record/{record_id}", response_model=schemas.InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice_from_record(record_id: int, payload: Optional[schemas.InvoiceFromRecordCreate] = None,
                               db: Session = Depends(get_db),
                               current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "invoice:write")
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Hồ sơ điều trị không tồn tại")

    details = record.details or []
    total = sum((Decimal(d.unit_price) * (d.quantity or 1) for d in details), Decimal("0"))
    
    disc_amount, disc_rate = Decimal("0"), Decimal("0")
    disc_code, disc_reason, pay_method = None, None, None
    if payload:
        disc_amount, disc_rate, final = _calculate_discount(total, payload.discount_amount, payload.discount_rate)
        disc_code, disc_reason, pay_method = payload.discount_code, payload.discount_reason, payload.payment_method
    else:
        final = total

    invoice = models.Invoice(
        patient_id=record.patient_id,
        medical_record_id=record.id,
        total_amount=total,
        discount_amount=disc_amount,
        discount_rate=disc_rate,
        final_amount=final,
        discount_code=disc_code,
        discount_reason=disc_reason,
        payment_method=pay_method,
        paid_amount=Decimal("0"),
        status=models.InvoiceStatus.UNPAID,
        items=[
            models.InvoiceItem(service_id=d.service_id, quantity=d.quantity or 1, unit_price=d.unit_price)
            for d in details
        ],
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    log_action(db, current_user, "create_from_record", "invoices", invoice.id, f"record={record_id}, final={final}")
    return invoice


@router.get("/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    require_role(current_user, "invoice:read")
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Hóa đơn không tồn tại")
    if current_user.role == "patient":
        patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
        if not patient or invoice.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem hóa đơn này")
    return invoice


@router.put("/{invoice_id}", response_model=schemas.InvoiceOut)
def update_invoice(
    invoice_id: int,
    invoice_in: schemas.InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_role(current_user, "invoice:write")
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn.")

    if invoice_in.discount_code is not None:
        invoice.discount_code = invoice_in.discount_code
    if invoice_in.discount_rate is not None:
        invoice.discount_rate = invoice_in.discount_rate
    if invoice_in.discount_amount is not None:
        invoice.discount_amount = invoice_in.discount_amount
    if invoice_in.discount_reason is not None:
        invoice.discount_reason = invoice_in.discount_reason

    invoice.final_amount = max(Decimal("0"), invoice.total_amount - invoice.discount_amount)

    add_amount = invoice_in.add_payment_amount or Decimal("0")
    if add_amount > 0:
        new_payment = models.InvoicePayment(
            invoice_id=invoice.id,
            amount=add_amount,
            payment_method=invoice_in.payment_method or "Tiền mặt",
            note=invoice_in.payment_note or "Thanh toán từng phần/toàn bộ",
        )
        db.add(new_payment)
        invoice.paid_amount = (invoice.paid_amount or Decimal("0")) + add_amount

    elif invoice_in.paid_amount is not None and invoice_in.paid_amount != invoice.paid_amount:
        diff = invoice_in.paid_amount - (invoice.paid_amount or Decimal("0"))
        if diff > 0:
            new_payment = models.InvoicePayment(
                invoice_id=invoice.id,
                amount=diff,
                payment_method=invoice_in.payment_method or "Tiền mặt",
                note="Thanh toán bổ sung",
            )
            db.add(new_payment)
        invoice.paid_amount = invoice_in.paid_amount

    if invoice.paid_amount >= invoice.final_amount:
        invoice.status = models.InvoiceStatus.PAID
    elif invoice.paid_amount > 0:
        invoice.status = models.InvoiceStatus.PARTIAL
    else:
        invoice.status = models.InvoiceStatus.UNPAID

    db.commit()
    db.refresh(invoice)
    return invoice