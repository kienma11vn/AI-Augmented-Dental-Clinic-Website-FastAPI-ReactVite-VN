from tests.conftest import PASSWORD, login


def test_login_success_and_me(client, users):
    headers = login(client, "admin@test.vn")
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_login_wrong_password(client, users):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.vn", "password": "sai-mat-khau"},
    )
    assert response.status_code == 401


def test_login_inactive_user(client, db, users):
    users["receptionist"].is_active = False
    db.commit()
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "receptionist@test.vn", "password": PASSWORD},
    )
    assert response.status_code == 403


def test_protected_endpoint_requires_token(client):
    assert client.get("/api/v1/patients/").status_code == 401


def test_only_admin_can_register(client, auth):
    payload = {
        "email": "moi@test.vn",
        "full_name": "Người mới",
        "role": "receptionist",
        "password": "Test@1234",
    }
    assert client.post("/api/v1/auth/register", json=payload, headers=auth("receptionist")).status_code == 403
    assert client.post("/api/v1/auth/register", json=payload, headers=auth("admin")).status_code == 200


def test_rbac_patient_cannot_write_patients(client, auth):
    response = client.post(
        "/api/v1/patients/",
        json={"full_name": "Trần Thị A", "phone": "0987654321"},
        headers=auth("patient"),
    )
    assert response.status_code == 403


def test_rbac_receptionist_can_write_patients(client, auth):
    response = client.post(
        "/api/v1/patients/",
        json={"full_name": "Trần Thị A", "phone": "0987654321"},
        headers=auth("receptionist"),
    )
    assert response.status_code in (200, 201)


def test_rbac_only_admin_accountant_read_reports(client, auth):
    assert client.get("/api/v1/reports/overview", headers=auth("doctor")).status_code == 403
    assert client.get("/api/v1/reports/overview", headers=auth("accountant")).status_code == 200


def test_health_endpoint(client):
    assert client.get("/health").json() == {"status": "ok"}
