// lib/abdm/abdm-client.ts
// ABDM (Ayushman Bharat Digital Mission) Gateway Client
// Covers: ABHA creation, verification, linking, PHR address, Scan & Share
// Spec: https://sandbox.abdm.gov.in/docs/

const ABDM_SANDBOX = 'https://abhasbx.abdm.gov.in/abha/api/v3';
const ABDM_PRODUCTION = 'https://abha.abdm.gov.in/abha/api/v3';
const ABDM_GATEWAY_SANDBOX = 'https://dev.abdm.gov.in/gateway';
const ABDM_GATEWAY_PRODUCTION = 'https://live.ndhm.gov.in/gateway';

export interface ABDMConfig {
  clientId: string;
  clientSecret: string;
  isProduction: boolean;
  hipId: string;          // HIP ID (facility HFR ID)
  hipName: string;
  callbackUrl: string;    // webhook for async responses
}

export interface ABHAProfile {
  abhaNumber: string;       // 14-digit: XX-XXXX-XXXX-XXXX
  abhaAddress: string;      // user@abdm PHR address
  name: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  email?: string;
  address?: string;
  districtName?: string;
  stateName?: string;
  pincode?: string;
  profilePhoto?: string;    // base64
  kycVerified: boolean;
  status: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED';
}

// ============================================================
// AUTH — Get ABDM Gateway Session Token
// ============================================================

let _cachedToken: { token: string; expiresAt: number } | null = null;

export async function getABDMToken(config: ABDMConfig): Promise<string | null> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) return _cachedToken.token;

  const gatewayUrl = config.isProduction ? ABDM_GATEWAY_PRODUCTION : ABDM_GATEWAY_SANDBOX;
  try {
    const res = await fetch(`${gatewayUrl}/v0.5/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: config.clientId, clientSecret: config.clientSecret }),
    });
    if (!res.ok) {
      console.error('[ABDM] Auth failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    _cachedToken = { token: data.accessToken, expiresAt: Date.now() + (data.expiresIn - 60) * 1000 };
    return data.accessToken;
  } catch (error) {
    console.error('[ABDM] Auth error:', error);
    return null;
  }
}

function getBaseUrl(config: ABDMConfig) {
  return config.isProduction ? ABDM_PRODUCTION : ABDM_SANDBOX;
}

async function abdmFetch(config: ABDMConfig, path: string, body: any, token?: string) {
  const accessToken = token || await getABDMToken(config);
  if (!accessToken) throw new Error('ABDM authentication failed');

  const res = await fetch(`${getBaseUrl(config)}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'REQUEST-ID': crypto.randomUUID(),
      'TIMESTAMP': new Date().toISOString(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.details?.[0]?.message || `ABDM API error: ${res.status}`);
  }
  return data;
}

// ============================================================
// ABHA CREATION — Aadhaar Flow
// ============================================================

/** Step 1: Generate Aadhaar OTP for ABHA creation */
export async function generateAadhaarOTP(config: ABDMConfig, aadhaarNumber: string): Promise<{ txnId: string; message: string }> {
  const data = await abdmFetch(config, '/enrollment/request/otp', {
    scope: ['abha-enrol', 'dl-flow'],
    loginHint: 'aadhaar',
    loginId: aadhaarNumber,
    otpSystem: 'aadhaar',
  });
  return { txnId: data.txnId, message: data.message || 'OTP sent to Aadhaar-linked mobile' };
}

/** Step 2: Verify Aadhaar OTP */
export async function verifyAadhaarOTP(config: ABDMConfig, txnId: string, otp: string): Promise<{ txnId: string; authResult: string; accounts?: any[] }> {
  const data = await abdmFetch(config, '/enrollment/enrol/byAadhaar', {
    authData: {
      authMethods: ['otp'],
      otp: { txnId, otpValue: otp },
    },
  });
  return { txnId: data.txnId, authResult: data.authResult || 'success', accounts: data.accounts };
}

/** Step 3: Create ABHA after Aadhaar verification */
export async function createABHA(config: ABDMConfig, txnId: string): Promise<ABHAProfile> {
  const data = await abdmFetch(config, '/enrollment/create/abha-number', { txnId });
  return mapABHAProfile(data);
}

// ============================================================
// ABHA CREATION — Mobile Flow
// ============================================================

/** Generate mobile OTP for ABHA creation */
export async function generateMobileOTP(config: ABDMConfig, mobile: string): Promise<{ txnId: string; message: string }> {
  const data = await abdmFetch(config, '/enrollment/request/otp', {
    scope: ['abha-enrol', 'mobile-verify'],
    loginHint: 'mobile',
    loginId: mobile,
    otpSystem: 'abdm',
  });
  return { txnId: data.txnId, message: data.message || 'OTP sent to mobile' };
}

/** Verify mobile OTP */
export async function verifyMobileOTP(config: ABDMConfig, txnId: string, otp: string): Promise<{ txnId: string; authResult: string }> {
  const data = await abdmFetch(config, '/enrollment/auth/byAbdm', {
    authData: {
      authMethods: ['otp'],
      otp: { txnId, otpValue: otp },
    },
  });
  return { txnId: data.txnId, authResult: data.authResult || 'success' };
}

// ============================================================
// ABHA VERIFICATION — Existing ABHA
// ============================================================

/** Verify existing ABHA number with Aadhaar OTP */
export async function verifyABHAByAadhaar(config: ABDMConfig, abhaNumber: string): Promise<{ txnId: string; message: string }> {
  const data = await abdmFetch(config, '/profile/login/request/otp', {
    scope: ['abha-login', 'aadhaar-verify'],
    loginHint: 'abha-number',
    loginId: abhaNumber.replace(/-/g, ''),
    otpSystem: 'aadhaar',
  });
  return { txnId: data.txnId, message: data.message || 'OTP sent' };
}

/** Verify existing ABHA number with mobile OTP */
export async function verifyABHAByMobile(config: ABDMConfig, abhaNumber: string): Promise<{ txnId: string; message: string }> {
  const data = await abdmFetch(config, '/profile/login/request/otp', {
    scope: ['abha-login', 'mobile-verify'],
    loginHint: 'abha-number',
    loginId: abhaNumber.replace(/-/g, ''),
    otpSystem: 'abdm',
  });
  return { txnId: data.txnId, message: data.message || 'OTP sent' };
}

/** Complete ABHA verification and get profile */
export async function verifyABHAOTP(config: ABDMConfig, txnId: string, otp: string): Promise<ABHAProfile> {
  const data = await abdmFetch(config, '/profile/login/verify', {
    authData: {
      authMethods: ['otp'],
      otp: { txnId, otpValue: otp },
    },
  });
  // Fetch full profile with the token returned
  if (data.token) {
    const profile = await abdmFetch(config, '/profile/account', {}, data.token);
    return mapABHAProfile(profile);
  }
  return mapABHAProfile(data);
}

// ============================================================
// ABHA SEARCH — By ABHA Address / PHR
// ============================================================

/** Search ABHA by PHR address */
export async function searchByABHAAddress(config: ABDMConfig, abhaAddress: string): Promise<{ exists: boolean; abhaNumber?: string; name?: string; status?: string }> {
  try {
    const data = await abdmFetch(config, '/profile/search/byHealthId', {
      healthId: abhaAddress,
    });
    return {
      exists: true,
      abhaNumber: data.abhaNumber,
      name: data.name || `${data.firstName} ${data.lastName}`,
      status: data.status,
    };
  } catch {
    return { exists: false };
  }
}

// ============================================================
// SCAN & SHARE — QR Code
// ============================================================

/** Generate QR code data for Scan & Share at reception */
export function generateScanShareQRData(hipId: string, hipName: string, counterId: string): string {
  // ABDM Scan & Share format: hip/<hipId>/counter/<counterId>
  return JSON.stringify({
    hipId,
    hipName,
    counterId,
    purpose: 'LINK',
    requester: { type: 'HIP', id: hipId },
  });
}

/** Process scanned ABHA QR code from patient's PHR app */
export function parseABHAQRCode(qrData: string): { abhaNumber?: string; abhaAddress?: string; name?: string; gender?: string; dob?: string; mobile?: string; address?: string } | null {
  try {
    const data = JSON.parse(qrData);
    return {
      abhaNumber: data.hidn || data.abhaNumber || data.hid,
      abhaAddress: data.phr || data.abhaAddress || data.healthId,
      name: data.name,
      gender: data.gender,
      dob: data.dob,
      mobile: data.mobile,
      address: data.address,
    };
  } catch {
    // Try parsing as plain ABHA number
    const cleaned = qrData.replace(/[^0-9-]/g, '');
    if (/^\d{2}-\d{4}-\d{4}-\d{4}$/.test(cleaned)) {
      return { abhaNumber: cleaned };
    }
    if (/^\d{14}$/.test(cleaned)) {
      return { abhaNumber: `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}-${cleaned.slice(10)}` };
    }
    return null;
  }
}

// ============================================================
// PHR ADDRESS MANAGEMENT
// ============================================================

/** Create/link PHR address to ABHA */
export async function createPHRAddress(config: ABDMConfig, txnId: string, phrAddress: string): Promise<{ success: boolean; phrAddress: string }> {
  const data = await abdmFetch(config, '/enrollment/create/phr-address', {
    txnId,
    phrAddress,
    preferred: true,
  });
  return { success: true, phrAddress: data.phrAddress || phrAddress };
}

/** Check if PHR address is available */
export async function checkPHRAddressAvailability(config: ABDMConfig, phrAddress: string): Promise<boolean> {
  try {
    const data = await abdmFetch(config, '/enrollment/phr-address/suggestion', {
      txnId: 'check',
    });
    return !data.exists;
  } catch {
    return false;
  }
}

/** Get suggested PHR addresses */
export async function suggestPHRAddresses(config: ABDMConfig, txnId: string): Promise<string[]> {
  const data = await abdmFetch(config, '/enrollment/phr-address/suggestion', { txnId });
  return data.abhaAddressList || [];
}

// ============================================================
// LINK PATIENT — Save ABHA to HMIS patient record
// ============================================================

export async function linkABHAToPatient(
  supabase: any, patientId: string, profile: ABHAProfile
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('hmis_patients').update({
    abha_number: profile.abhaNumber,
    abha_address: profile.abhaAddress,
    abha_status: profile.status,
    abha_linked_at: new Date().toISOString(),
    abha_kyc_verified: profile.kycVerified,
    abha_profile: {
      name: profile.name,
      gender: profile.gender,
      dob: profile.dateOfBirth,
      mobile: profile.mobile,
      photo: profile.profilePhoto,
    },
  }).eq('id', patientId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Unlink ABHA from patient */
export async function unlinkABHA(
  supabase: any, patientId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('hmis_patients').update({
    abha_number: null,
    abha_address: null,
    abha_status: null,
    abha_linked_at: null,
    abha_kyc_verified: false,
    abha_profile: null,
  }).eq('id', patientId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================
// HELPERS
// ============================================================

function mapABHAProfile(data: any): ABHAProfile {
  const abhaNum = data.ABHANumber || data.abhaNumber || data.healthIdNumber || '';
  const formatted = abhaNum.includes('-') ? abhaNum :
    abhaNum.length === 14 ? `${abhaNum.slice(0, 2)}-${abhaNum.slice(2, 6)}-${abhaNum.slice(6, 10)}-${abhaNum.slice(10)}` : abhaNum;

  return {
    abhaNumber: formatted,
    abhaAddress: data.preferredAbhaAddress || data.abhaAddress || data.healthId || data.phrAddress || '',
    name: data.name || `${data.firstName || ''} ${data.middleName || ''} ${data.lastName || ''}`.trim(),
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    middleName: data.middleName,
    gender: data.gender || '',
    dateOfBirth: data.dateOfBirth || data.dayOfBirth ? `${data.yearOfBirth || ''}-${(data.monthOfBirth || '').toString().padStart(2, '0')}-${(data.dayOfBirth || '').toString().padStart(2, '0')}` : '',
    mobile: data.mobile || '',
    email: data.email,
    address: data.address,
    districtName: data.districtName,
    stateName: data.stateName,
    pincode: data.pincode,
    profilePhoto: data.profilePhoto,
    kycVerified: data.kycVerified ?? data.verificationType === 'AADHAAR',
    status: data.status || 'ACTIVE',
  };
}

/** Format ABHA number for display: XX-XXXX-XXXX-XXXX */
export function formatABHANumber(num: string): string {
  const digits = num.replace(/[^0-9]/g, '');
  if (digits.length !== 14) return num;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

/** Validate ABHA number format */
export function isValidABHANumber(num: string): boolean {
  return /^\d{2}-\d{4}-\d{4}-\d{4}$/.test(num) || /^\d{14}$/.test(num.replace(/-/g, ''));
}

/** Validate ABHA address format */
export function isValidABHAAddress(addr: string): boolean {
  return /^[a-zA-Z0-9._]+@abdm$/.test(addr) || /^[a-zA-Z0-9._]+@sbx$/.test(addr);
}
