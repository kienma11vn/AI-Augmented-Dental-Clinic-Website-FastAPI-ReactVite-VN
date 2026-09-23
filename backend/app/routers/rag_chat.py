# backend/app/routers/rag_chat.py
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, ChatHistory, UserRole
from app.schemas import ChatRequest, ChatResponse, ChatMessageOut
from app.rag.gemini_rag import ask_rag_chat
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat_with_bot(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_id = payload.session_id or str(uuid.uuid4())

    # 1. Chỉ lấy lịch sử thuộc về ĐÚNG user đang đăng nhập
    history = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id,
        ChatHistory.user_id == current_user.id  # <-- BỔ SUNG ĐIỀU KIỆN NÀY
    ).order_by(ChatHistory.created_at.asc()).all()

    # 2. Lưu tin nhắn người dùng kèm user_id
    user_msg_db = ChatHistory(
        user_id=current_user.id,  # <-- Gán trực tiếp current_user.id
        session_id=session_id,
        sender="user",
        message=payload.message
    )
    db.add(user_msg_db)
    db.commit()

    # 3. Gọi Gemini API sinh phản hồi
    try:
        user_role = current_user.role if current_user else UserRole.PATIENT
        bot_reply_text = await ask_rag_chat(
            user_message=payload.message,
            history_list=history,
            user_role=user_role
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI Chatbot: {str(e)}")

    # 4. Lưu phản hồi AI kèm user_id
    ai_msg_db = ChatHistory(
        user_id=current_user.id,  # <-- Gán trực tiếp current_user.id
        session_id=session_id,
        sender="model",
        message=bot_reply_text
    )
    db.add(ai_msg_db)
    db.commit()

    return ChatResponse(response=bot_reply_text, session_id=session_id)


@router.get("/history/{session_id}", response_model=List[ChatMessageOut])
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy toàn bộ lịch sử tin nhắn của một phiên hội thoại thuộc về đúng user"""
    messages = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id,
        ChatHistory.user_id == current_user.id  # <-- BỔ SUNG ĐIỀU KIỆN NÀY
    ).order_by(ChatHistory.created_at.asc()).all()
    
    return messages