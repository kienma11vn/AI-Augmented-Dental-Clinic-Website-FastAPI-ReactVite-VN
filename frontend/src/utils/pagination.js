/**
 * Hàm tính toán danh sách số trang và dấu ba chấm ('...') để hiển thị thanh phân trang gọn gàng.
 * 
 * @param {number} currentPage - Trang hiện tại
 * @param {number} totalPages - Tổng số trang
 * @param {number} siblingCount - Số trang lân cận hiển thị ở mỗi bên trang hiện tại (mặc định = 1)
 * @returns {Array<number|string>} Mảng các số trang và ký tự '...'
 */
export const getPaginationRange = (currentPage, totalPages, siblingCount = 1) => {
  // Tổng số nút hiển thị tối đa = Trang đầu (1) + Trang cuối (1) + Current (1) + Siblings (2*siblingCount) + Dots (2)
  const totalPageNumbers = siblingCount * 2 + 5;

  // Trường hợp 1: Tổng số trang ít hơn hoặc bằng ngưỡng hiển thị -> Hiển thị toàn bộ
  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  // Trường hợp 2: Chỉ hiển thị dấu '...' ở bên phải
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, '...', lastPageIndex];
  }

  // Trường hợp 3: Chỉ hiển thị dấu '...' ở bên trái
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
    return [firstPageIndex, '...', ...rightRange];
  }

  // Trường hợp 4: Hiển thị dấu '...' ở cả 2 bên (trái và phải)
  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = [];
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      middleRange.push(i);
    }
    return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
};