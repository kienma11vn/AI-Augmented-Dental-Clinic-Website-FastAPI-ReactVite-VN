from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, EmailStr, AliasChoices, computed_field, field_validator, field_serializer
from app.models import UserRole, AppointmentStatus, InvoiceStatus, NotificationType


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class PatientBase(BaseModel):
    full_name: str
    phone: str
    id_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None


class PatientCreate(PatientBase):
    user_id: Optional[int] = None


class PatientUpdate(PatientBase):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class PatientOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    full_name: str
    phone: Optional[str] = None
    id_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


class DoctorBase(BaseModel):
    full_name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None


class DoctorCreate(DoctorBase):
    user_id: int


class DoctorUpdate(DoctorBase):
    full_name: Optional[str] = None


class DoctorOut(DoctorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int


class DoctorScheduleBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time


class DoctorScheduleOut(DoctorScheduleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    doctor_id: int


class DoctorWithSchedules(DoctorOut):
    schedules: List[DoctorScheduleOut] = []


class DentalChairBase(BaseModel):
    name: str
    room: Optional[str] = None
    is_active: bool = True


class DentalChairOut(DentalChairBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class DentalServiceBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    unit_price: Decimal = Field(..., validation_alias=AliasChoices('price', 'unit_price'))
    is_active: bool = True


class DentalServiceCreate(DentalServiceBase):
    pass


class DentalServiceUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, validation_alias=AliasChoices('price', 'unit_price'))
    is_active: Optional[bool] = None


class DentalServiceOut(DentalServiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    
    @computed_field
    @property
    def price(self) -> Decimal:
        return self.unit_price


class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int
    chair_id: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    note: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5, description="Đánh giá từ 1 đến 5 sao")
    feedback: Optional[str] = Field(None, description="Ý kiến phản hồi")


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    chair_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    note: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    feedback: Optional[str] = None
    
    @field_validator("status", mode="before")
    @classmethod
    def lowercase_status(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class AppointmentOut(AppointmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    patient: Optional[PatientOut] = None
    doctor: Optional[DoctorOut] = None
    chair: Optional[DentalChairOut] = None
    
    @field_serializer('status')
    def serialize_status(self, status: AppointmentStatus, _info):
        if self.note and "[CHECKIN]" in self.note and status == AppointmentStatus.CONFIRMED:
            return "checkin"
        return status.value if hasattr(status, "value") else str(status)


class AppointmentFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Số sao đánh giá (1-5)")
    feedback: Optional[str] = Field(None, description="Nội dung phản hồi")


class NotificationBase(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    title: str
    message: str
    type: Optional[str] = NotificationType.REMINDER.value
    is_read: bool = False


class NotificationCreate(NotificationBase):
    pass


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None


class NotificationOut(NotificationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    patient: Optional[PatientOut] = None
    appointment: Optional[AppointmentOut] = None


class MedicalRecordDetailBase(BaseModel):
    service_id: int
    quantity: int = 1
    unit_price: Decimal
    note: Optional[str] = None


class MedicalRecordDetailCreate(MedicalRecordDetailBase):
    pass


class MedicalRecordDetailOut(MedicalRecordDetailBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    service: Optional[DentalServiceOut] = None


class MedicalRecordBase(BaseModel):
    patient_id: int
    appointment_id: int
    doctor_id: int
    diagnosis_summary: Optional[str] = None
    treatment_notes: Optional[str] = None
    ai_summary: Optional[str] = None
    next_appointment_date: Optional[datetime] = None


class MedicalRecordCreate(BaseModel):
    patient_id: int
    appointment_id: int
    doctor_id: int
    diagnosis_summary: Optional[str] = None
    treatment_notes: Optional[str] = None
    next_appointment_date: Optional[datetime] = None
    details: List[MedicalRecordDetailCreate] = []


class MedicalRecordUpdate(BaseModel):
    diagnosis_summary: Optional[str] = None
    treatment_notes: Optional[str] = None
    next_appointment_date: Optional[datetime] = None


class MedicalRecordOut(MedicalRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    patient: Optional[PatientOut] = None
    doctor: Optional[DoctorOut] = None
    appointment: Optional[AppointmentOut] = None
    details: List[MedicalRecordDetailOut] = []


class InvoiceBase(BaseModel):
    patient_id: int
    medical_record_id: Optional[int] = None
    total_amount: Decimal
    discount_amount: Decimal = Decimal("0")
    discount_rate: Decimal = Decimal("0")
    final_amount: Decimal
    discount_code: Optional[str] = None
    discount_reason: Optional[str] = None
    payment_method: Optional[str] = None
    paid_amount: Decimal = Decimal("0")
    status: InvoiceStatus = InvoiceStatus.UNPAID


class InvoiceItemBase(BaseModel):
    service_id: int
    quantity: int = 1
    unit_price: Decimal


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemOut(InvoiceItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    service: Optional[DentalServiceOut] = None


class InvoiceCreate(BaseModel):
    patient_id: int
    medical_record_id: Optional[int] = None
    discount_amount: Optional[Decimal] = Decimal("0")
    discount_rate: Optional[Decimal] = Decimal("0")
    discount_code: Optional[str] = None
    discount_reason: Optional[str] = None
    payment_method: Optional[str] = None
    items: List[InvoiceItemCreate]


class InvoiceFromRecordCreate(BaseModel):
    discount_amount: Optional[Decimal] = Decimal("0")
    discount_rate: Optional[Decimal] = Decimal("0")
    discount_code: Optional[str] = None
    discount_reason: Optional[str] = None
    payment_method: Optional[str] = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: Optional[int]
    action: str
    entity: str
    entity_id: Optional[int]
    details: Optional[str]
    created_at: datetime
    user: Optional[UserOut] = None


class AISummaryRequest(BaseModel):
    medical_record_id: int


class AIReminderRequest(BaseModel):
    patient_name: str
    next_appointment: str
    service: Optional[str] = "Khám răng"


class AIChangeNoticeRequest(BaseModel):
    patient_name: str
    doctor_name: Optional[str] = None
    old_time: Optional[str] = None
    new_time: Optional[str] = None
    change_type: str = Field(..., description="reschedule, cancel, doctor_change, general")
    reason: Optional[str] = None


class AIExplainRequest(BaseModel):
    service_name: str
    description: Optional[str] = ""


class AIResponse(BaseModel):
    result: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class DiscountProgramBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    discount_rate: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    is_active: bool = True


class DiscountProgramCreate(DiscountProgramBase):
    pass


class DiscountProgramUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    discount_rate: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    is_active: Optional[bool] = None


class DiscountProgramOut(DiscountProgramBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class InvoicePaymentBase(BaseModel):
    amount: Decimal
    payment_method: Optional[str] = "Tiền mặt"
    note: Optional[str] = None


class InvoicePaymentCreate(InvoicePaymentBase):
    pass


class InvoicePaymentOut(InvoicePaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: int
    created_at: datetime  


class InvoiceUpdate(BaseModel):
    paid_amount: Optional[Decimal] = None
    add_payment_amount: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    discount_rate: Optional[Decimal] = None
    discount_code: Optional[str] = None
    discount_reason: Optional[str] = None
    payment_method: Optional[str] = None
    payment_note: Optional[str] = None
    status: Optional[InvoiceStatus] = None


class InvoiceOut(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    patient: Optional[PatientOut] = None
    items: List[InvoiceItemOut] = []
    payments: List[InvoicePaymentOut] = []


class PatientRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    phone: Optional[str] = None
    id_number: str
    
    
class ChatRequest(BaseModel):
    message: str = Field(..., description="Nội dung tin nhắn gửi tới AI")
    session_id: Optional[str] = Field(None, description="Mã phiên hội thoại (UUID)")


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    session_id: str
    sender: str
    message: str
    created_at: datetime


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ AI Chatbot")
    session_id: str = Field(..., description="Mã phiên hội thoại")    
    
    
class ChatHistorySessionOut(BaseModel):
    session_id: str
    last_message: str
    updated_at: datetime    