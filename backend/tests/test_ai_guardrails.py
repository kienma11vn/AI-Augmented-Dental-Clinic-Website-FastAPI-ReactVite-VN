import pytest

from app import ai_guardrails
from app.ai_guardrails import DISCLAIMER, SYSTEM_PROMPT


class _FakeResponse:
    def __init__(self, text: str):
        self._text = text

    def raise_for_status(self):
        return None

    def json(self):
        return {"candidates": [{"content": {"parts": [{"text": self._text}]}}]}


class _FakeClient:
    """Ghi lại prompt gửi lên Gemini để kiểm tra PII đã bị ẩn."""

    sent_bodies: list[dict] = []
    reply = "Đã tóm tắt điều trị cho [PATIENT_NAME_1], liên hệ [PHONE_1]."

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None):
        _FakeClient.sent_bodies.append(json)
        return _FakeResponse(_FakeClient.reply)


@pytest.fixture(autouse=True)
def fake_gemini(monkeypatch):
    _FakeClient.sent_bodies = []
    monkeypatch.setattr(ai_guardrails.httpx, "AsyncClient", _FakeClient)
    return _FakeClient


@pytest.mark.asyncio
async def test_prompt_is_masked_and_reply_unmasked(fake_gemini):
    result = await ai_guardrails.ask_gemini(
        "Bệnh nhân Nguyễn Văn An, SĐT 0912345678, đã lấy cao răng."
    )
    sent_text = fake_gemini.sent_bodies[0]["contents"][0]["parts"][0]["text"]
    assert "Nguyễn Văn An" not in sent_text
    assert "0912345678" not in sent_text
    assert SYSTEM_PROMPT in sent_text
    # Kết quả trả về cho người dùng đã được unmask
    assert "Nguyễn Văn An" in result
    assert "0912345678" in result


@pytest.mark.asyncio
async def test_disclaimer_always_appended():
    result = await ai_guardrails.explain_service("Lấy cao răng", "Làm sạch vôi răng")
    assert result.endswith(DISCLAIMER)
    assert "không thay thế chỉ định chuyên môn của bác sĩ" in result


@pytest.mark.asyncio
async def test_system_prompt_forbids_diagnosis():
    assert "KHÔNG được chẩn đoán" in SYSTEM_PROMPT
    assert "KHÔNG kê đơn" in SYSTEM_PROMPT
    result = await ai_guardrails.generate_reminder_message("Trần Thị Bình", "2026-09-10 09:00", "Lấy cao răng")
    assert DISCLAIMER in result


@pytest.mark.asyncio
async def test_gemini_empty_candidates_raises(monkeypatch):
    class _EmptyClient(_FakeClient):
        async def post(self, url, json=None):
            class _Empty(_FakeResponse):
                def json(self):
                    return {"candidates": []}

            return _Empty("")

    monkeypatch.setattr(ai_guardrails.httpx, "AsyncClient", _EmptyClient)
    with pytest.raises(RuntimeError):
        await ai_guardrails.ask_gemini("Xin chào")


def test_ai_endpoint_requires_permission(client, auth):
    response = client.post(
        "/api/v1/ai/explain-service",
        json={"service_name": "Lấy cao răng", "description": "Làm sạch vôi răng"},
        headers=auth("patient"),
    )
    assert response.status_code == 403
