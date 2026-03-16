// lib/validation.ts
// Form validation helpers

export interface ValidationError {
  field: string;
  message: string;
}

export function validateRequired(value: any, field: string, label?: string): ValidationError | null {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return { field, message: `${label || field} is required` };
  }
  return null;
}

export function validatePhone(phone: string, field: string = 'phone'): ValidationError | null {
  if (!phone) return null; // optional
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  if (!/^\d{10,12}$/.test(cleaned)) {
    return { field, message: 'Invalid phone number (10-12 digits)' };
  }
  return null;
}

export function validateEmail(email: string, field: string = 'email'): ValidationError | null {
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { field, message: 'Invalid email address' };
  }
  return null;
}

export function validatePincode(pincode: string, field: string = 'pincode'): ValidationError | null {
  if (!pincode) return null;
  if (!/^\d{6}$/.test(pincode)) {
    return { field, message: 'Pincode must be 6 digits' };
  }
  return null;
}

export function validateAmount(amount: string | number, field: string, label?: string): ValidationError | null {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num < 0) {
    return { field, message: `${label || field} must be a valid positive number` };
  }
  return null;
}

export function validateDate(date: string, field: string, label?: string): ValidationError | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return { field, message: `${label || field} is not a valid date` };
  }
  return null;
}

export function validatePatientForm(form: {
  first_name: string; last_name: string; phone_primary: string;
  gender: string; email?: string; pincode?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  const r = (v: any, f: string, l: string) => { const e = validateRequired(v, f, l); if (e) errors.push(e); };
  r(form.first_name, 'first_name', 'First name');
  r(form.last_name, 'last_name', 'Last name');
  r(form.phone_primary, 'phone_primary', 'Phone number');
  r(form.gender, 'gender', 'Gender');
  const phone = validatePhone(form.phone_primary, 'phone_primary');
  if (phone) errors.push(phone);
  if (form.email) { const email = validateEmail(form.email, 'email'); if (email) errors.push(email); }
  if (form.pincode) { const pin = validatePincode(form.pincode, 'pincode'); if (pin) errors.push(pin); }
  return errors;
}

export function validateAdmissionForm(form: {
  patientId: string; admittingDoctorId: string; primaryDoctorId: string;
  departmentId: string; admissionType: string; payorType: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  const r = (v: any, f: string, l: string) => { const e = validateRequired(v, f, l); if (e) errors.push(e); };
  r(form.patientId, 'patientId', 'Patient');
  r(form.admittingDoctorId, 'admittingDoctorId', 'Admitting doctor');
  r(form.primaryDoctorId, 'primaryDoctorId', 'Primary doctor');
  r(form.departmentId, 'departmentId', 'Department');
  return errors;
}

export function validatePaymentForm(form: {
  amount: string; mode: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  const r = (v: any, f: string, l: string) => { const e = validateRequired(v, f, l); if (e) errors.push(e); };
  r(form.amount, 'amount', 'Payment amount');
  r(form.mode, 'mode', 'Payment mode');
  const amt = validateAmount(form.amount, 'amount', 'Amount');
  if (amt) errors.push(amt);
  if (parseFloat(form.amount) <= 0) errors.push({ field: 'amount', message: 'Amount must be greater than 0' });
  return errors;
}

// Helper: get first error for a field
export function getFieldError(errors: ValidationError[], field: string): string | undefined {
  return errors.find(e => e.field === field)?.message;
}

// Inline error message getter
export function fieldErrorMsg(errors: ValidationError[], field: string): string | undefined {
  return errors.find(e => e.field === field)?.message;
}
