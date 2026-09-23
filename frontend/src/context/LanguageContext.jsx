import { createContext, useContext } from 'react';
import { APPOINTMENT_STATUS_VI, formatAppointmentStatus } from '../constants/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  return (
    <LanguageContext.Provider value={{ appointmentStatusMap: APPOINTMENT_STATUS_VI, formatAppointmentStatus }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);