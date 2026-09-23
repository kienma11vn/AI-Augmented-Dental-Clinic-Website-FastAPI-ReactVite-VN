import { AppointmentStatus } from './enums';

export const APPOINTMENT_STATUS_VI = {
  [AppointmentStatus.SCHEDULED]: 'CHỜ XÁC NHẬN',
  [AppointmentStatus.CONFIRMED]: 'ĐÃ XÁC NHẬN',
  [AppointmentStatus.CHECKIN]: 'ĐÃ CHECK-IN',
  [AppointmentStatus.COMPLETED]: 'ĐÃ HOÀN THÀNH',
  [AppointmentStatus.CANCELLED]: 'ĐÃ HỦY',
};

export const formatAppointmentStatus = (status) => {
  return APPOINTMENT_STATUS_VI[status] || status;
};