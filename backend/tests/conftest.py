"""Cấu hình pytest dùng chung.

Test chạy trên SQLite in-memory để không cần PostgreSQL.
Riêng ràng buộc chống trùng lịch (ExcludeConstraint của PostgreSQL) chỉ được
kiểm thử khi biến môi trường TEST_DATABASE_URL trỏ tới một PostgreSQL thật.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only-32ch")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from datetime import datetime, timedelta, timezone  # noqa: E402
from decimal import Decimal  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.dialects.postgresql import ExcludeConstraint  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import models  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.security import get_password_hash  # noqa: E402

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
IS_POSTGRES = bool(TEST_DATABASE_URL and TEST_DATABASE_URL.startswith("postgresql"))

requires_postgres = pytest.mark.skipif(
    not IS_POSTGRES,
    reason="Cần TEST_DATABASE_URL trỏ tới PostgreSQL để kiểm thử ExcludeConstraint",
)


def _drop_postgres_only_constraints() -> None:
    """SQLite không hỗ trợ EXCLUDE constraint -> loại bỏ khi tạo bảng test."""
    table = models.Appointment.__table__
    for constraint in list(table.constraints):
        if isinstance(constraint, ExcludeConstraint):
            table.constraints.discard(constraint)


@pytest.fixture(scope="session")
def engine():
    if IS_POSTGRES:
        eng = create_engine(TEST_DATABASE_URL, future=True)
    else:
        _drop_postgres_only_constraints()
        eng = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture()
def db(engine):
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(engine, db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_tables(engine):
    """Xóa dữ liệu trước mỗi test để các test độc lập nhau."""
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


PASSWORD = "Test@1234"


@pytest.fixture()
def users(db):
    """Tạo 5 tài khoản tương ứng 5 vai trò."""
    created = {}
    for role in models.UserRole:
        user = models.User(
            email=f"{role.value}@test.vn",
            full_name=f"User {role.value}",
            role=role,
            hashed_password=get_password_hash(PASSWORD),
        )
        db.add(user)
        created[role.value] = user
    db.commit()
    for user in created.values():
        db.refresh(user)
    return created


def login(client, email: str, password: str = PASSWORD) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth(client, users):
    """Trả về hàm lấy header Authorization theo vai trò."""

    def _auth(role: str) -> dict:
        return login(client, f"{role}@test.vn")

    return _auth


@pytest.fixture()
def clinic(db, users):
    """Dữ liệu nền: 1 bệnh nhân, 1 bác sĩ, 2 ghế, 1 dịch vụ."""
    patient = models.Patient(
        full_name="Nguyễn Văn Bệnh",
        phone="0912345678",
        id_number="079123456789",
        user_id=users["patient"].id,
    )
    doctor = models.Doctor(
        user_id=users["doctor"].id,
        full_name="Lê Thị Bác Sĩ",
        specialty="Nha khoa tổng quát",
        license_number="LIC-001",
    )
    chair_a = models.DentalChair(name="Ghế 01")
    chair_b = models.DentalChair(name="Ghế 02")
    service = models.DentalService(
        name="Lấy cao răng",
        code="CAO01",
        description="Làm sạch vôi răng",
        unit_price=Decimal("300000"),
    )
    db.add_all([patient, doctor, chair_a, chair_b, service])
    db.commit()
    for obj in (patient, doctor, chair_a, chair_b, service):
        db.refresh(obj)
    return {
        "patient": patient,
        "doctor": doctor,
        "chair_a": chair_a,
        "chair_b": chair_b,
        "service": service,
    }


@pytest.fixture()
def slot():
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=1)
    return start, start + timedelta(minutes=30)
