import os
import re
import logging
import httpx
from fastapi import HTTPException
from app.config import settings
from app.pii import mask_pii, unmask_pii

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Bạn là Trợ lý AI Hành chính cho Phòng khám Nha khoa.\n"
    "Nhiệm vụ của bạn là xử lý CỤ THỂ VÀ CHỈ DUY NHẤT yêu cầu được đưa ra trong câu lệnh.\n\n"
    "QUY TẮC BẮT BUỘC:\n"
    "1. TẬP TRUNG TỐI ĐA: Chỉ trả lời đúng nội dung được yêu cầu. KHÔNG tự ý tạo thêm các phần không liên quan (ví dụ: KHÔNG tự động soạn mẫu tin nhắn hay giải thích dịch vụ khi chỉ được yêu cầu tóm tắt hồ sơ).\n"
    "2. KHÔNG XÃ GIAO / CHÀO HỎI: Trả lời trực tiếp nội dung. KHÔNG mở đầu bằng 'Chào bạn...', 'Tôi là...', KHÔNG kết thúc bằng 'Tôi có thể hỗ trợ gì thêm...'.\n"
    "3. GIỚI HẠN CHUYÊN MÔN: KHÔNG chẩn đoán bệnh, KHÔNG kê đơn thuốc, KHÔNG chỉ định phương pháp điều trị. Chỉ căn cứ vào dữ liệu được cung cấp.\n"
    "4. BẢO TỒN MÃ ẨN DANH (PII):\n"
    "   - Giữ nguyên chính xác các mã dạng [LABEL_N] (ví dụ: [PATIENT_NAME_1], [PHONE_1],...).\n"
    "   - Coi các mã này là dữ liệu hợp lệ và KHÔNG yêu cầu người dùng cung cấp thông tin thực."
)

DISCLAIMER = (
    "\n\n---\n"
    "Lưu ý: Thông tin do AI tạo ra chỉ mang tính chất tham khảo hành chính, "
    "không thay thế chỉ định chuyên môn hoặc tư vấn trực tiếp từ bác sĩ."
)


def _gemini_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"


async def ask_gemini(prompt: str, mapping: dict = None) -> str:
    if mapping is None:
        prompt, mapping = mask_pii(prompt)

    body = {
        "contents": [
            {"role": "user", "parts": [{"text": SYSTEM_PROMPT + "\n\n" + prompt}]}
        ],
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
        ],
    }

    headers = {
        "x-goog-api-key": settings.gemini_api_key,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(_gemini_url(), json=body, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"Gemini API HTTP Error: {exc.response.status_code}")
        raise HTTPException(
            status_code=503 if exc.response.status_code >= 500 else exc.response.status_code,
            detail="Dịch vụ AI tạm thời không khả dụng hoặc gặp sự cố. Vui lòng thử lại sau."
        )
    except httpx.RequestError as exc:
        logger.error(f"Gemini API Request Error: {type(exc).__name__}")
        raise HTTPException(
            status_code=502,
            detail="Không thể kết nối đến dịch vụ AI. Vui lòng kiểm tra lại kết nối mạng."
        )
    except Exception as exc:
        logger.error(f"Unhandled AI Error: {type(exc).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Đã xảy ra lỗi trong quá trình xử lý yêu cầu AI."
        )

    candidates = data.get("candidates", [])
    if not candidates:
        raise HTTPException(
            status_code=502,
            detail="Dịch vụ AI không trả về kết quả hợp lệ."
        )

    text = candidates[0]["content"]["parts"][0]["text"]
    unmasked = unmask_pii(text, mapping)
    return unmasked + DISCLAIMER


async def summarize_treatment_notes(notes: str) -> str:
    masked_notes, mapping = mask_pii(notes)
    prompt = (
        f"Nội dung ghi chú điều trị từ bác sĩ:\n\"\"\"\n{masked_notes}\n\"\"\"\n\n"
        "Yêu cầu:\n"
        "- Hãy tóm tắt lại ghi chú điều trị trên một cách ngắn gọn, đi thẳng vào trọng tâm.\n"
        "- Chỉ tổng hợp đúng những thông tin thực tế có trong ghi chú (ví dụ: liều dùng thuốc, thủ thuật đã làm, dặn dò tái khám).\n"
        "- KHÔNG tự tạo hoặc hiển thị các tiêu đề/mục trống nếu ghi chú không đề cập đến."
    )
    return await ask_gemini(prompt, mapping)


async def generate_reminder_message(patient_name: str, next_appointment: str, service: str) -> str:
    masked_name, map1 = mask_pii(patient_name)
    masked_appt, map2 = mask_pii(next_appointment)
    masked_service, map3 = mask_pii(service)
    mapping = {**map1, **map2, **map3}

    prompt = (
        f"Thông tin lịch hẹn:\n"
        f"- Bệnh nhân: {masked_name}\n"
        f"- Dịch vụ: {masked_service}\n"
        f"- Thời gian tái khám: {masked_appt}\n\n"
        "Yêu cầu:\n"
        "- Soạn duy nhất 01 tin nhắn nhắc lịch (phù hợp gửi SMS/Zalo) lịch sự, thân thiện.\n"
        "- Dặn bệnh nhân liên hệ lại nếu muốn thay đổi lịch hẹn.\n"
        "- KHÔNG kèm theo lời dẫn, KHÔNG giải thích thêm."
    )
    return await ask_gemini(prompt, mapping)


async def explain_service(service_name: str, description: str) -> str:
    masked_name, map1 = mask_pii(service_name)
    masked_desc, map2 = mask_pii(description)
    mapping = {**map1, **map2}

    prompt = (
        f"Dịch vụ nha khoa: {masked_name}\n"
        f"Mô tả: {masked_desc}\n\n"
        "Yêu cầu:\n"
        "- Giải thích dịch vụ này cho bệnh nhân bằng ngôn ngữ dễ hiểu, ngắn gọn.\n"
        "- Nêu rõ dịch vụ là gì và lợi ích mang lại.\n"
        "- KHÔNG tự đưa ra lời khuyên y khoa hoặc chỉ định điều trị."
    )
    return await ask_gemini(prompt, mapping)