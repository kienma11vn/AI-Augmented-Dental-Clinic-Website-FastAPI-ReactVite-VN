// frontend/src/pages/admin/SqlChatbot.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { sqlChatbotApi } from '../../api/sqlChatbotApi';

export default function SqlChatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [messages, setMessages] = useState([
    {
      sender: 'model',
      text: `Xin chào Quản trị viên - ${user?.full_name || user?.email || ''}! Tôi là Trợ lý AI SQL Chatbot của hệ thống phòng khám. Bạn có thể hỏi bất kỳ thông tin gì về dữ liệu CSDL dưới dạng ngôn ngữ tự nhiên.`,
      sql: null,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userText = inputMessage;
    setInputMessage('');
    setLoading(true);

    const newMsg = { sender: 'user', text: userText, sql: null };
    setMessages((prev) => [...prev, newMsg]);

    try {
      const res = await sqlChatbotApi.querySql(userText); // Gọi API truy vấn AI SQL
      const aiMsg = {
        sender: 'model',
        text: res.response,
        sql: res.generated_sql, // Hiển thị câu lệnh SQL do AI sinh ra
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg = error?.response?.data?.detail || error?.detail || '⚠️ Rất tiếc, đã xảy ra lỗi khi thực thi truy vấn hoặc bạn không có quyền Quản trị viên (Admin).';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'model',
          text: errorMsg,
          sql: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Nút bấm AI SQL Chatbot đặt trên Sidebar */}
      <div className="px-4 py-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 hover:from-emerald-500/20 hover:to-indigo-500/20 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 dark:text-emerald-200 transition-all duration-300 group shadow-lg cursor-pointer"
          title="Mở Trợ lý AI SQL Chatbot"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-amber-400/50 flex-shrink-0 bg-slate-800">
              <img
                src="/ai_sql.png"
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
              <p className="text-xs font-bold text-emerald-400 dark:text-emerald-300 group-hover:text-emerald-300 transition-colors">
                ⚡Chatbot SQL
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">Truy vấn các dữ liệu trong CSDL bằng AI</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition-all font-bold">
            Bắt đầu
          </span>
        </button>
      </div>

      {/* Cửa sổ Modal Popup Chatbot AI SQL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:pr-6 p-2 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full sm:w-[820px] h-[620px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row overflow-hidden transition-colors">
            
            {/* Cột bên trái: Banner minh họa hình ảnh */}
            <div className="hidden sm:flex sm:w-[200px] bg-slate-100 dark:bg-slate-950 p-4 flex-col items-center justify-between border-r border-slate-200 dark:border-slate-700/80 relative overflow-hidden flex-shrink-0 transition-colors">
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="text-center z-10 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Database Secure
                </span>
                <h2 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-sky-600 to-indigo-600 dark:from-emerald-300 dark:via-sky-300 dark:to-indigo-300 mt-1 tracking-wide">
                  AI SQL CHATBOT
                </h2>
              </div>

			{/* Khối chứa 2 hình ảnh xếp theo chiều dọc */}
              <div className="relative my-auto py-1 flex flex-col items-center justify-center gap-3 z-10 w-full">
                <div className="relative my-auto py-2 flex items-center justify-center z-10">
                  <div 
                    onClick={() => setPreviewImage('/ai_sql.png')}
                    className="relative w-40 h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-md bg-white dark:bg-slate-800/60 p-2 flex items-center justify-center group transition-colors cursor-pointer hover:border-sky-400"
                    title="Bấm để xem ảnh phóng to"
                  >
                    <img
                      src="/ai_sql.png"
                      alt="Mascot AI"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 rounded-lg"
                      onError={(e) => { e.target.src = '/ai_sql.png'; }}
                    />
                  </div>
                </div>

                <div className="relative my-auto py-2 flex items-center justify-center z-10">
                  <div 
                    onClick={() => setPreviewImage('/ai_sql_rule.png')}
                    className="relative w-40 h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-md bg-white dark:bg-slate-800/60 p-2 flex items-center justify-center group transition-colors cursor-pointer hover:border-sky-400"
                    title="Bấm để xem ảnh phóng to"
                  >
                    <img
                      src="/ai_sql_rule.png"
                      alt="Mascot AI"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 rounded-lg"
                      onError={(e) => { e.target.src = '/ai_sql_rule.png'; }}
                    />
                  </div>
                </div>
              </div>					  

              <div className="text-center z-10 pb-1">
                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">Read Replica DB</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Bảo mật dữ liệu an toàn</p>
              </div>
            </div>

            {/* Cột bên phải: Giao diện Chat chính */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 transition-colors">
              
              {/* Header Chatbot */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-amber-400/60 bg-white dark:bg-slate-700 flex-shrink-0 shadow-sm">
                    <img
                      src="/ai_sql.png"
                      alt="Chatbot AI Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                      Trợ lý AI SQL Chatbot 🤖
                    </h3>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Sẵn sàng truy vấn dữ liệu
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

              {/* Danh sách tin nhắn */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-950/50 text-sm transition-colors">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-sky-600 text-white rounded-br-none shadow-md'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      
                      {/* Hiển thị câu lệnh SQL do AI sinh ra */}
                      {msg.sql && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span>⚡</span> Câu lệnh SQL đã thực thi trên Read Replica DB:
                          </p>
                          <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-xl text-xs font-mono overflow-x-auto shadow-inner">
                            {msg.sql}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 text-slate-400 px-4 py-2.5 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-xs ml-2 text-slate-500 font-medium">Đang chuyển đổi yêu cầu sang SQL và truy vấn CSDL...</span>
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
                  placeholder="Nhập câu hỏi dữ liệu (Ví dụ: Liệt kê danh sách bác sĩ...)"
                  className="flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                >
                  Gửi 🚀
                </button>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Xem ảnh phóng to */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 p-3 rounded-2xl max-w-lg max-h-[85vh] shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 text-white hover:bg-rose-600 flex items-center justify-center text-sm font-bold shadow-lg transition-colors z-10"
            >
              ✕
            </button>
            <img src={previewImage} alt="Preview" className="w-full max-h-[75vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </>
  );
}