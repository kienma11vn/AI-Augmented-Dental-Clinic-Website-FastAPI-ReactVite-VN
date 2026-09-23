from datetime import timedelta

from tests.conftest import requires_postgres


def _payload(clinic, slot, chair_key="chair_a", shift=timedelta()):
    start, end = slot
    return {
        "patient_id": clinic["patient"].id,
        "doctor_id": clinic["doctor"].id,
        "chair_id": clinic[chair_key].id,
        "start_time": (start + shift).isoformat(),
        "end_time": (end + shift).isoformat(),
    }


def test_create_appointment(client, auth, clinic, slot):
    response = client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=auth("receptionist"))
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "scheduled"


def test_end_time_must_be_after_start_time(client, auth, clinic, slot):
    payload = _payload(clinic, slot)
    payload["end_time"] = payload["start_time"]
    response = client.post("/api/v1/appointments/", json=payload, headers=auth("receptionist"))
    assert response.status_code == 400


def test_patient_cannot_create_appointment(client, auth, clinic, slot):
    response = client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=auth("patient"))
    assert response.status_code == 403


def test_doctor_sees_only_own_appointments(client, auth, clinic, slot):
    client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=auth("receptionist"))
    response = client.get("/api/v1/appointments/", headers=auth("doctor"))
    assert response.status_code == 200
    assert all(item["doctor_id"] == clinic["doctor"].id for item in response.json())


def test_cancel_appointment_sets_status(client, auth, clinic, slot):
    created = client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=auth("receptionist")).json()
    assert client.delete(f"/api/v1/appointments/{created['id']}", headers=auth("receptionist")).status_code == 204
    fetched = client.get(f"/api/v1/appointments/{created['id']}", headers=auth("receptionist")).json()
    assert fetched["status"] == "cancelled"


def test_non_overlapping_slots_allowed(client, auth, clinic, slot):
    headers = auth("receptionist")
    assert client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=headers).status_code == 201
    later = _payload(clinic, slot, shift=timedelta(hours=2))
    assert client.post("/api/v1/appointments/", json=later, headers=headers).status_code == 201


@requires_postgres
def test_doctor_double_booking_rejected(client, auth, clinic, slot):
    headers = auth("receptionist")
    assert client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=headers).status_code == 201
    # Cùng bác sĩ, khác ghế, trùng khoảng thời gian -> 409
    overlap = _payload(clinic, slot, chair_key="chair_b", shift=timedelta(minutes=10))
    assert client.post("/api/v1/appointments/", json=overlap, headers=headers).status_code == 409


@requires_postgres
def test_chair_double_booking_rejected(client, auth, db, clinic, slot):
    from app import models

    other_doctor_user = models.User(
        email="bacsi2@test.vn",
        full_name="Bác sĩ 2",
        role=models.UserRole.DOCTOR,
        hashed_password="x",
    )
    db.add(other_doctor_user)
    db.commit()
    other_doctor = models.Doctor(user_id=other_doctor_user.id, full_name="Bác sĩ 2", license_number="LIC-002")
    db.add(other_doctor)
    db.commit()

    headers = auth("receptionist")
    assert client.post("/api/v1/appointments/", json=_payload(clinic, slot), headers=headers).status_code == 201
    overlap = _payload(clinic, slot, shift=timedelta(minutes=10))
    overlap["doctor_id"] = other_doctor.id
    assert client.post("/api/v1/appointments/", json=overlap, headers=headers).status_code == 409
