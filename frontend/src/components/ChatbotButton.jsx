// frontend/src/components/ChatbotButton.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ragApi from '../api/ragApi';

export default function ChatbotButton({ currentUser }) {
  const { user } = useAuth();
  // Ưu tiên lấy user từ AuthContext, nếu không có mới dùng prop currentUser
  const activeUser = user || currentUser;

  const [isOpen, setIsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const chatEndRef = useRef(null);
  
  // Lưu toàn bộ lịch sử nhận từ API
  const [allHistory, setAllHistory] = useState([]);
  // Số lượng tin nhắn đang hiển thị
  const [visibleCount, setVisibleCount] = useState(5);
  // Ref quản lý khung cuộn tin nhắn
  const chatContainerRef = useRef(null);
  // Đánh dấu có phải lần cuộn tải tin nhắn cũ hay không
  const isLoadingMoreRef = useRef(false);

  // Dùng localStorage để lưu session_id bền vững theo ID từng user
  const localStorageKey = activeUser?.id 
    ? `rag_chat_session_${activeUser.id}` 
    : 'rag_chat_session_guest';

  // Tự động cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isLoadingMoreRef.current) {
      scrollToBottom();
    }
    // Reset lại cờ sau khi render xong
    isLoadingMoreRef.current = false;
  }, [messages, isOpen]);

  // Nạp lại Session ID & Lịch sử từ localStorage khi đăng nhập / chuyển tài khoản
  useEffect(() => {
    setMessages([]);
    setAllHistory([]);
    setVisibleCount(5);
    const savedSession = localStorage.getItem(localStorageKey);

    if (savedSession) {
      setSessionId(savedSession);
      ragApi.getHistory(savedSession)
        .then((data) => {
          if (data && data.length > 0) {
            const formatted = data.map(item => ({
              sender: item.sender === 'user' ? 'user' : 'model',
              text: item.message
            }));
            
            setAllHistory(formatted);
            // Chỉ lấy 5 tin nhắn mới nhất để hiển thị ban đầu
            setMessages(formatted.slice(-5));
          } else {
            setSessionId(null);
            localStorage.removeItem(localStorageKey);
          }
        })
        .catch(() => {
          setSessionId(null);
          localStorage.removeItem(localStorageKey);
        });
    } else {
      setSessionId(null);
    }
  }, [activeUser?.id, localStorageKey]);

  const handleScroll = (e) => {
    const container = e.target;
    // Khi cuộn chạm đỉnh trên cùng (scrollTop === 0) và còn tin nhắn chưa hiển thị
    if (container.scrollTop === 0 && messages.length < allHistory.length) {
      isLoadingMoreRef.current = true;
      const oldScrollHeight = container.scrollHeight;

      const nextCount = visibleCount + 5;
      setVisibleCount(nextCount);
      // Lấy thêm 5 tin nhắn tiếp theo về phía trước
      setMessages(allHistory.slice(-nextCount));

      // Giữ nguyên vị trí cuộn tương đối để trải nghiệm người dùng không bị giật
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - oldScrollHeight;
        }
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;
	
	const userText = inputMessage;
    setInputMessage('');          
    setLoading(true);

    const newMsg = { sender: 'user', text: userText };
    setMessages((prev) => [...prev, newMsg]);
    setAllHistory((prev) => [...prev, newMsg]);
	isLoadingMoreRef.current = false; // Đảm bảo tự động cuộn xuống khi gửi tin mới

    try {
      const res = await ragApi.sendMessage(userText, sessionId);
      
      // Cập nhật session_id vào localStorage
      if (res.session_id) {
        setSessionId(res.session_id);
        localStorage.setItem(localStorageKey, res.session_id);
      }

      const aiMsg = { sender: 'model', text: res.response };
	  setMessages((prev) => [...prev, aiMsg]);
      setAllHistory((prev) => [...prev, aiMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'model',
          text: '⚠️ Rất tiếc, đã xảy ra lỗi kết nối với Trợ lý AI. Vui lòng thử lại sau!',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Nút bấm Chatbot AI đặt trên Sidebar */}
      <div className="px-4 py-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 hover:from-amber-500/20 hover:to-indigo-500/20 border border-sky-500/30 hover:border-sky-400 text-sky-300 dark:text-sky-200 transition-all duration-300 group shadow-lg cursor-pointer"
          title="Mở Trợ lý Chatbot AI"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-amber-400/50 flex-shrink-0 bg-slate-800">
              <img
                src="/chatbot_button.png"
                alt="Chatbot AI"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerText = '🤖';
                }}
              />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-amber-400 dark:text-amber-300 group-hover:text-amber-300 dark:group-hover:text-amber-200 transition-colors">
                ✨ Chatbot AI
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">Hướng dẫn sử dụng chức năng hệ thống</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 group-hover:bg-sky-500 group-hover:text-white transition-all font-bold">
            Hỏi AI 
          </span>
        </button>
      </div>

      {/* Cửa sổ Chatbot AI (Modal Pop-up) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:pr-6 p-2 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full sm:w-[780px] h-[600px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row overflow-hidden transition-colors">
            
            {/* Cột bên trái: Banner minh họa hình ảnh Chatbot */}
            <div className="hidden sm:flex sm:w-[200px] bg-slate-100 dark:bg-slate-950 p-4 flex-col items-center justify-between border-r border-slate-200 dark:border-slate-700/80 relative overflow-hidden flex-shrink-0 transition-colors">
              {/* Hiệu ứng ánh sáng nền (Glow Effect) */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>

              {/* Tiêu đề Banner */}
              <div className="text-center z-10 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Trợ Lý Thông Minh 
                </span>
                <h2 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-sky-600 to-indigo-600 dark:from-amber-300 dark:via-sky-300 dark:to-indigo-300 mt-1 tracking-wide">
                  CHATBOT AI 
                </h2>
              </div>

              {/* Khối chứa 2 hình ảnh xếp theo chiều dọc */}
				<div className="relative my-auto py-1 flex flex-col items-center justify-center gap-3 z-10 w-full">

				  <div className="relative my-auto py-2 flex items-center justify-center z-10">
					<div 
					  onClick={() => setPreviewImage('/chatbot_button.png')}
					  className="relative w-44 h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl bg-white dark:bg-slate-800/60 p-2 flex items-center justify-center group transition-colors cursor-pointer hover:border-sky-400 dark:hover:border-sky-400"
					  title="Bấm để xem ảnh phóng to"
					>
					  <img
						src="/chatbot_button.png"
						alt="Mascot Răng AI"
						className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 rounded-lg"
						onError={(e) => {
						  e.target.src = '/chatbot_button.png';
						}}
					  />
					</div>
				  </div>

				  <div className="relative my-auto py-2 flex items-center justify-center z-10">
					<div 
					  onClick={() => setPreviewImage('/chatbot_ui_example.png')}
					  className="relative w-44 h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl bg-white dark:bg-slate-800/60 p-2 flex items-center justify-center group transition-colors cursor-pointer hover:border-sky-400 dark:hover:border-sky-400"
					  title="Bấm để xem ảnh phóng to"
					>
					  <img
						src="/chatbot_ui_example.png"
						alt="Mascot Răng AI"
						className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 rounded-lg"
						onError={(e) => {
						  e.target.src = '/chatbot_ui_example.png';
						}}
					  />
					</div>
				  </div>

				</div>

              {/* Chú thích thông tin hỗ trợ */}
              <div className="text-center z-10 pb-1">
                <p className="text-xs text-sky-600 dark:text-sky-300 font-semibold">Dental Care AI</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Hỗ trợ hướng dẫn sử dụng 24/7</p>
              </div>
            </div>

            {/* Cột bên phải: Cửa sổ Chatbot chính */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 transition-colors">
              
              {/* Header Chatbot */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-amber-400/60 bg-white dark:bg-slate-700 flex-shrink-0 shadow-sm">
                    <img
                      src="/chatbot_button.png"
                      alt="Chatbot AI Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                      Trợ lý Dental Care AI 🤖
                    </h3>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                      Sẵn sàng hỗ trợ
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Nội dung tin nhắn */}
              <div
				ref={chatContainerRef}
				onScroll={handleScroll}
				className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-950/50 text-sm transition-colors"
			  >
			    {/* Hiển thị dòng gợi ý khi vẫn còn tin nhắn cũ chưa tải hết */}
				{messages.length < allHistory.length && (
				  <div className="text-center py-1 text-[11px] text-slate-400 font-medium">
					▲ Cuộn lên trên để xem tin nhắn cũ hơn ({allHistory.length - messages.length} tin nhắn còn lại)
				  </div>
				)}			  
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2.5">
                    <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-3xl shadow-sm transition-colors">
                      🦷
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-base">
                      Xin chào, {activeUser?.full_name || activeUser?.email}!
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px]">
                      Tôi có thể hướng dẫn bạn cách sử dụng các chức năng trong hệ thống...
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-sky-600 text-white rounded-br-none shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 text-slate-400 px-4 py-2.5 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow">
                      <span className="w-2 h-2 bg-sky-500 dark:bg-sky-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-sky-500 dark:bg-sky-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-sky-500 dark:bg-sky-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Ô nhập tin nhắn */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-colors"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Nhập câu hỏi cần hướng dẫn..."
                  className="flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-sky-500 transition-colors shadow-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center shadow-sm"
                >
                  Gửi
                </button>
              </form>

            </div>
          </div>
        </div>
      )}
	  
	  {/* Modal Popup Xem ảnh phóng to kích thước vừa phải */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 p-3 rounded-2xl max-w-lg max-h-[85vh] shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nút đóng Modal */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 text-white hover:bg-rose-600 flex items-center justify-center text-sm font-bold shadow-lg transition-colors z-10"
              title="Đóng"
            >
              ✕
            </button>

            {/* Hình ảnh phóng to vừa phải */}
            <img
              src={previewImage}
              alt="Xem trước hình ảnh"
              className="w-full max-h-[75vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
}