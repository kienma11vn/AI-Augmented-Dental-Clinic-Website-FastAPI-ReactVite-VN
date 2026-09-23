# backend/app/rag/gemini_rag.py
import logging
from typing import Union
from google import genai
from google.genai import types

from app.config import settings
from app.models import UserRole
from app.middleware.rag_rules import get_allowed_files_for_role

logger = logging.getLogger(__name__)

# Khởi tạo Client bằng SDK mới google-genai
client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = (
    "Bạn là Trợ lý AI Hướng dẫn Hệ thống Nha khoa Dental Care AI.\n"
    "Nhiệm vụ của bạn là giải đáp, hướng dẫn người dùng thực hiện các thao tác, quy trình "
    "trên hệ thống dựa chính xác vào Bộ tài liệu tri thức (RAG) được cung cấp.\n\n"
    "QUY TẮC PHẢN HỒI:\n"
    "1. Trả lời chính xác, đi thẳng vào vấn đề, sử dụng danh sách dạng gạch đầu dòng hoặc bảng khi cần.\n"
    "2. Nếu câu hỏi không nằm trong tài liệu, hãy lịch sự thông báo không có thông tin và hướng dẫn liên hệ Hotline/Support.\n"
    "3. Khi người dùng đặt các câu hỏi liên quan đến quyền hạn, chức năng của các vai trò khác mà không có trong Bộ tài liệu tri thức (RAG) được cung cấp thì sẽ từ chối trả lời để phòng tránh lộ thông tin bảo mật.\n"
    "4. Giữ thái độ thân thiện, lịch sự và chuyên nghiệp."
)


def get_combined_knowledge_text_for_role(role: Union[UserRole, str]) -> str:
    """Đọc và gộp các file .txt được phép dựa trên vai trò của người dùng."""
    import os, glob
    knowledge_dir = os.path.join(os.path.dirname(__file__), "knowledge")
    allowed_files = get_allowed_files_for_role(role)

    combined_content = []
    if allowed_files == "*":
        txt_files = glob.glob(os.path.join(knowledge_dir, "*.txt"))
    else:
        txt_files = [
            os.path.join(knowledge_dir, fname)
            for fname in allowed_files
            if os.path.exists(os.path.join(knowledge_dir, fname))
        ]

    for filepath in txt_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                combined_content.append(
                    f"--- DOCUMENT: {os.path.basename(filepath)} ---\n" + f.read()
                )
        except Exception as e:
            logger.error(f"Lỗi khi đọc file {filepath}: {e}")

    return "\n\n".join(combined_content)


async def ask_rag_chat(user_message: str, history_list: list = None, user_role: Union[UserRole, str] = UserRole.PATIENT) -> str:
    """Gửi yêu cầu trao đổi tới Gemini Model kèm ngữ cảnh tài liệu dạng Text."""
    
    # 1. Lấy nội dung tri thức trực tiếp dưới dạng Text
    knowledge_text = get_combined_knowledge_text_for_role(user_role)

    formatted_history = []
    if history_list:
        for item in history_list:
            formatted_history.append(
                types.Content(
                    role=item.sender,  # "user" hoặc "model"
                    parts=[types.Part.from_text(text=item.message)]
                )
            )

    # 2. Đưa tài liệu tri thức trực tiếp vào Prompt khởi tạo
    init_user_prompt = "Bộ tài liệu tri thức hướng dẫn hệ thống dành cho vai trò của bạn:\n\n"
    if knowledge_text.strip():
        init_user_prompt += knowledge_text
    else:
        init_user_prompt += "(Không có tài liệu tri thức riêng cho vai trò này)"

    full_history = [
        types.Content(
            role="user", 
            parts=[types.Part.from_text(text=init_user_prompt)]
        ),
        types.Content(
            role="model", 
            parts=[types.Part.from_text(text="Tôi đã đọc và ghi nhớ toàn bộ tài liệu hướng dẫn trên. Tôi sẵn sàng hỗ trợ bạn!")]
        )
    ] + formatted_history

    # 3. Sử dụng client.aio (Async) để tạo phiên Chat với SDK mới
    chat = client.aio.chats.create(
        model=settings.gemini_model,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION
        ),
        history=full_history
    )

    response = await chat.send_message(user_message)
    return response.text