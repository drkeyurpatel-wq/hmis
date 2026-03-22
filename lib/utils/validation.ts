// lib/utils/validation.ts
// Reusable form validators for HMIS

export type ValidationError = { field: string; message: string };
export type ValidationResult = { valid: boolean; errors: ValidationError[] };

// ---- PRIMITIVES ----
export const isRequired = (val: any, field: string, label?: string): ValidationError | null =>
  (!val || (typeof val === 'string' && !val.trim())) ? { field, message: `${label || field} is required` } : null;

export const isPhone = (val: string, field: string): ValidationError | null => {
  if (!val) return null; // optional unless paired with isRequired
  const clean = val.replace(/[\s\-\+]/g, '');
  return clean.length < 10 || clean.length > 13 ? { field, message: 'Phone must be 10-13 digits' } : null;
};

export const isEmail = (val: string, field: string): ValidationError | null => {
  if (!val) return null;
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? { field, message: 'Invalid email format' } : null;
};

export const isAadhaar = (val: string, field: string): ValidationError | null => {
  if (!val) return null;
  return !/^\d{12}$/.test(val.replace(/\s/g, '')) ? { field, message: 'Aadhaar must be 12 digits' } : null;
};

export const isPincode = (val: string, field: string): ValidationError | null => {
  if (!val) return null;
  return !/^\d{6}$/.test(val) ? { field, message: 'Pincode must be 6 digits' } : null;
};

export const minLength = (val: string, min: number, field: string, label?: string): ValidationError | null =>
  val && val.length < min ? { field, message: `${label || field} must be at least ${min} characters` } : null;

export const maxLength = (val: string, max: number, field: string, label?: string): ValidationError | null =>
  val && val.length > max ? { field, message: `${label || field} must be less than ${max} characters` } : null;

export const isPositiveNumber = (val: any, field: string, label?: string): ValidationError | null => {
  if (!val && val !== 0) return null;
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? { field, message: `${label || field} must be a positive number` } : null;
};

// ---- COMPOSITE VALIDATORS ----
export function validatePatientRegistration(form: any): ValidationResult {
  const errors: ValidationError[] = [
    isRequired(form.first_name, 'first_name', 'First name'),
    isRequired(form.last_name, 'last_name', 'Last name'),
    isRequired(form.gender, 'gender', 'Gender'),
    isRequired(form.phone_primary, 'phone_primary', 'Phone number'),
    isPhone(form.phone_primary, 'phone_primary'),
    isEmail(form.email, 'email'),
    isPincode(form.pincode, 'pincode'),
    minLength(form.first_name, 2, 'first_name', 'First name'),
  ].filter(Boolean) as ValidationError[];
  return { valid: errors.length === 0, errors };
}

export function validateOPDVisit(form: { patientId: string; doctorId: string; complaint?: string }): ValidationResult {
  const errors: ValidationError[] = [
    isRequired(form.patientId, 'patientId', 'Patient'),
    isRequired(form.doctorId, 'doctorId', 'Doctor'),
  ].filter(Boolean) as ValidationError[];
  return { valid: errors.length === 0, errors };
}

export function validateIPDAdmission(form: any): ValidationResult {
  const errors: ValidationError[] = [
    isRequired(form.patientId, 'patientId', 'Patient'),
    isRequired(form.doctorId, 'doctorId', 'Doctor'),
    isRequired(form.department, 'department', 'Department'),
    isRequired(form.admissionType, 'admissionType', 'Admission type'),
  ].filter(Boolean) as ValidationError[];
  return { valid: errors.length === 0, errors };
}

export function validateStaffCreation(form: any): ValidationResult {
  const errors: ValidationError[] = [
    isRequired(form.fullName, 'fullName', 'Full name'),
    isRequired(form.email, 'email', 'Email'),
    isRequired(form.password, 'password', 'Password'),
    isRequired(form.staffType, 'staffType', 'Staff type'),
    isRequired(form.employeeCode, 'employeeCode', 'Employee code'),
    isEmail(form.email, 'email'),
    minLength(form.password, 6, 'password', 'Password'),
    isPhone(form.phone, 'phone'),
  ].filter(Boolean) as ValidationError[];
  return { valid: errors.length === 0, errors };
}

export function validateBilling(form: any): ValidationResult {
  const errors: ValidationError[] = [
    isRequired(form.patientId, 'patientId', 'Patient'),
    isPositiveNumber(form.amount, 'amount', 'Amount'),
  ].filter(Boolean) as ValidationError[];
  return { valid: errors.length === 0, errors };
}

// ---- ERROR DISPLAY HELPER ----
export function getFieldError(errors: ValidationError[], field: string): string | undefined {
  return errors.find(e => e.field === field)?.message;
}
