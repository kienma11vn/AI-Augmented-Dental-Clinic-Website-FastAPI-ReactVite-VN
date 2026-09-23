from datetime import timedelta


def _appointment(client, headers, clinic, slot, shift=timedelta()):
    start, end = slot
    response = client.post(
        "/api/v1/appointments/",
        json={
            "patient_id": clinic["patient"].id,
            "doctor_id": clinic["doctor"].id,
            "chair_id": clinic["chair_a"].id,
            "start_time": (start + shift).isoformat(),
            "end_time": (end + shift).isoformat(),
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _record(client, auth, clinic, slot, shift=timedelta()):
    appointment = _appointment(client, auth("receptionist"), clinic, slot, shift)
    response = client.post(
        "/api/v1/records/",
        json={
            "patient_id": clinic["patient"].id,
            "appointment_id": appointment["id"],
            "doctor_id": clinic["doctor"].id,
            "diagnosis_summary": "Nhiều vôi răng ở mặt trong",
            "treatment_notes": "Đã lấy cao răng toàn hàm, hẹn tái khám 6 tháng",
            "details": [
                {"service_id": clinic["service"].id, "quantity": 2, "unit_price": "300000"}
            ],
        },
        headers=auth("doctor"),
    )
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_doctor_creates_record_with_details(client, auth, clinic, slot):
    record = _record(client, auth, clinic, slot)
    assert len(record["details"]) == 1
    assert record["details"][0]["quantity"] == 2


def test_receptionist_cannot_create_record(client, auth, clinic, slot):
    appointment = _appointment(client, auth("receptionist"), clinic, slot)
    response = client.post(
        "/api/v1/records/",
        json={
            "patient_id": clinic["patient"].id,
            "appointment_id": appointment["id"],
            "doctor_id": clinic["doctor"].id,
        },
        headers=auth("receptionist"),
    )
    assert response.status_code == 403


def test_invoice_from_record_totals_correctly(client, auth, clinic, slot):
    record = _record(client, auth, clinic, slot)
    response = client.post(f"/api/v1/invoices/from-record/{record['id']}", headers=auth("accountant"))
    assert response.status_code == 201, response.text
    invoice = response.json()
    assert float(invoice["total_amount"]) == 600000
    assert invoice["status"] == "unpaid"


def test_partial_then_full_payment(client, auth, clinic, slot):
    record = _record(client, auth, clinic, slot)
    invoice = client.post(f"/api/v1/invoices/from-record/{record['id']}", headers=auth("accountant")).json()

    partial = client.put(
        f"/api/v1/invoices/{invoice['id']}",
        json={"paid_amount": "200000"},
        headers=auth("accountant"),
    ).json()
    assert partial["status"] == "partial"

    paid = client.put(
        f"/api/v1/invoices/{invoice['id']}",
        json={"paid_amount": "600000"},
        headers=auth("accountant"),
    ).json()
    assert paid["status"] == "paid"


def test_overpayment_rejected(client, auth, clinic, slot):
    record = _record(client, auth, clinic, slot)
    invoice = client.post(f"/api/v1/invoices/from-record/{record['id']}", headers=auth("accountant")).json()
    response = client.put(
        f"/api/v1/invoices/{invoice['id']}",
        json={"paid_amount": "999999999"},
        headers=auth("accountant"),
    )
    assert response.status_code == 400


def test_invoice_requires_items(client, auth, clinic):
    response = client.post(
        "/api/v1/invoices/",
        json={"patient_id": clinic["patient"].id, "items": []},
        headers=auth("accountant"),
    )
    assert response.status_code in (400, 422)


def test_doctor_cannot_write_invoice(client, auth, clinic):
    response = client.post(
        "/api/v1/invoices/",
        json={
            "patient_id": clinic["patient"].id,
            "items": [{"service_id": clinic["service"].id, "quantity": 1, "unit_price": "300000"}],
        },
        headers=auth("doctor"),
    )
    assert response.status_code == 403


def test_patient_sees_only_own_invoices(client, auth, clinic, slot):
    record = _record(client, auth, clinic, slot)
    client.post(f"/api/v1/invoices/from-record/{record['id']}", headers=auth("accountant"))
    response = client.get("/api/v1/invoices/", headers=auth("patient"))
    assert response.status_code == 200
    assert all(item["patient_id"] == clinic["patient"].id for item in response.json())


def test_audit_log_written_for_invoice(client, auth, db, clinic, slot):
    from app import models

    record = _record(client, auth, clinic, slot)
    client.post(f"/api/v1/invoices/from-record/{record['id']}", headers=auth("accountant"))
    logs = db.query(models.AuditLog).filter(models.AuditLog.entity == "invoices").all()
    assert logs
