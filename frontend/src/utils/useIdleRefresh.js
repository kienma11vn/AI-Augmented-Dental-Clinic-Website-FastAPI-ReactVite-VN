import { useEffect } from 'react';

/**
 * Custom Hook tự động thực hiện hành động khi người dùng không tương tác
 * @param {Function} onIdle - Hàm sẽ thực thi khi hết thời gian không tương tác (ví dụ: fetchData)
 * @param {number} timeoutMs - Thời gian chờ tính bằng ms (Mặc định 5 phút)
 * @param {boolean} disabled - Điều kiện tạm dừng đếm ngược (ví dụ: khi đang mở Modal)
 */
export function useIdleRefresh(onIdle, timeoutMs = 5 * 60 * 1000, disabled = false) {
  useEffect(() => {
    if (disabled) return;

    let timer;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onIdle();
      }, timeoutMs);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [onIdle, timeoutMs, disabled]);
}