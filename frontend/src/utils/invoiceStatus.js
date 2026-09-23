import { InvoiceStatus } from '../constants/enums';

/**
 * Trả về thông tin hiển thị (nhãn tiếng Việt & class Tailwind) cho trạng thái hóa đơn.
 * @param {string} status Trạng thái của hóa đơn ('paid', 'unpaid', 'partial', ...)
 * @returns {{ label: string, badgeClass: string }}
 */
export const getInvoiceStatusInfo = (status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  switch (normalizedStatus) {
    case InvoiceStatus.PAID:
    case 'da_thanh_toan':
      return {
        label: 'Đã thanh toán',
        badgeClass:
          'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      };

    case InvoiceStatus.PARTIAL:
    case 'thanh_toan_mot_phan':
      return {
        label: 'Thanh toán một phần',
        badgeClass:
          'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      };

    case InvoiceStatus.UNPAID:
    case 'chua_thanh_toan':
    default:
      return {
        label: 'Chưa thanh toán',
        badgeClass:
          'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
      };
  }
};

/**
 * Hàm lấy tên nhãn tiếng Việt của trạng thái hóa đơn
 * @param {string} status 
 * @returns {string}
 */
export const formatInvoiceStatus = (status) => {
  return getInvoiceStatusInfo(status).label;
};