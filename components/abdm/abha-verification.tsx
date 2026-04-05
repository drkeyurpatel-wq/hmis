'use client';
import React, { useState, useRef } from 'react';

// ============================================================
// ABHA Verification & Linking Component
// Supports: Create new ABHA, Verify existing, Scan QR, Search by PHR
// ============================================================

interface ABHAProfile {
  abhaNumber: string;
  abhaAddress: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  email?: string;
  address?: string;
  districtName?: string;
  stateName?: string;
  pincode?: string;
  profilePhoto?: string;
  kycVerified: boolean;
  status: string;
}

interface Props {
  patientId: string;
  patientName: string;
  patientPhone?: string;
  currentAbha?: string;
  currentAbhaAddress?: string;
  onLinked: (profile: ABHAProfile) => void;
  onUnlinked?: () => void;
  onClose?: () => void;
}

type Mode = 'menu' | 'create_aadhaar' | 'create_mobile' | 'verify_existing' | 'scan_qr' | 'search_phr' | 'profile';

const API = '/api/abdm';

async function abdmCall(action: string, data: any = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'ABDM API error');
  return result;
}

export default function ABHAVerification({ patientId, patientName, patientPhone, currentAbha, currentAbhaAddress, onLinked, onUnlinked, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(currentAbha ? 'profile' : 'menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txnId, setTxnId] = useState('');
  const [profile, setProfile] = useState<ABHAProfile | null>(null);

  // Form fields
  const [aadhaar, setAadhaar] = useState('');
  const [mobile, setMobile] = useState(patientPhone || '');
  const [otp, setOtp] = useState('');
  const [abhaNumber, setAbhaNumber] = useState('');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // QR Scanner
  const [qrInput, setQrInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const reset = () => {
    setOtp(''); setTxnId(''); setOtpSent(false); setError(''); setProfile(null);
  };

  // ---- CREATE ABHA (Aadhaar) ----
  const handleAadhaarOTP = async () => {
    if (aadhaar.replace(/\s/g, '').length !== 12) { setError('Enter valid 12-digit Aadhaar'); return; }
    setLoading(true); setError('');
    try {
      const result = await abdmCall('aadhaar_generate_otp', { aadhaarNumber: aadhaar.replace(/\s/g, '') });
      setTxnId(result.txnId);
      setOtpSent(true);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleAadhaarVerify = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      await abdmCall('aadhaar_verify_otp', { txnId, otp });
      const result = await abdmCall('create_abha', { txnId, patientId });
      setProfile(result.profile);
      onLinked(result.profile);
      setMode('profile');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  // ---- CREATE ABHA (Mobile) ----
  const handleMobileOTP = async () => {
    if (mobile.length < 10) { setError('Enter valid mobile number'); return; }
    setLoading(true); setError('');
    try {
      const result = await abdmCall('mobile_generate_otp', { mobile });
      setTxnId(result.txnId);
      setOtpSent(true);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleMobileVerify = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      await abdmCall('mobile_verify_otp', { txnId, otp });
      const result = await abdmCall('create_abha', { txnId, patientId });
      setProfile(result.profile);
      onLinked(result.profile);
      setMode('profile');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  // ---- VERIFY EXISTING ABHA ----
  const handleVerifyExisting = async (method: 'aadhaar' | 'mobile') => {
    if (!abhaNumber || abhaNumber.replace(/[-\s]/g, '').length !== 14) { setError('Enter valid 14-digit ABHA number'); return; }
    setLoading(true); setError('');
    try {
      const action = method === 'aadhaar' ? 'verify_abha_aadhaar' : 'verify_abha_mobile';
      const result = await abdmCall(action, { abhaNumber });
      setTxnId(result.txnId);
      setOtpSent(true);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const result = await abdmCall('verify_abha_otp', { txnId, otp, patientId });
      setProfile(result.profile);
      onLinked(result.profile);
      setMode('profile');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  // ---- SEARCH PHR ----
  const handleSearchPHR = async () => {
    if (!abhaAddress) { setError('Enter ABHA address'); return; }
    setLoading(true); setError('');
    try {
      const result = await abdmCall('search_abha', { abhaAddress });
      if (result.exists) {
        setAbhaNumber(result.abhaNumber || '');
        setMode('verify_existing');
        setOtpSent(false);
      } else {
        setError('ABHA address not found');
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  // ---- QR SCAN ----
  const handleQRParse = async (data: string) => {
    setLoading(true); setError('');
    try {
      const result = await abdmCall('parse_qr', { qrData: data });
      if (result.success && result.data) {
        if (result.data.abhaNumber) {
          setAbhaNumber(result.data.abhaNumber);
          setMode('verify_existing');
        } else if (result.data.abhaAddress) {
          setAbhaAddress(result.data.abhaAddress);
          setMode('search_phr');
        }
      } else {
        setError('Could not read ABHA QR code');
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setError('Camera access denied. Please paste QR data manually.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // ---- UNLINK ----
  const handleUnlink = async () => {
    setLoading(true); setError('');
    try {
      await abdmCall('unlink_abha', { patientId });
      onUnlinked?.();
      setProfile(null);
      setMode('menu');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';
  const btnPrimary = 'px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40';
  const btnSecondary = 'px-4 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200';

  return (
    <div className="bg-white rounded-2xl border shadow-lg max-w-lg w-full mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-green-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              ABHA / ABDM
              {currentAbha && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Linked</span>}
            </h2>
            <p className="text-xs text-white/80">Ayushman Bharat Health Account — {patientName}</p>
          </div>
          {onClose && <button onClick={onClose} className="text-white/70 hover:text-white text-xl">×</button>}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-400 ml-2">×</button>
          </div>
        )}

        {/* ===== MENU ===== */}
        {mode === 'menu' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
              ABDM integration is pending sandbox registration. ABHA verification and linking will be available once the NHCX sandbox connection is configured (HFR ID: IN2410013685).
            </div>
            <p className="text-sm text-gray-600">Choose how to link ABHA for this patient:</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { reset(); setMode('create_aadhaar'); }} className="p-4 border-2 border-dashed rounded-xl hover:border-blue-400 hover:bg-blue-50 text-left transition-colors">
                <div className="text-sm font-bold text-gray-900">Create New ABHA</div>
                <div className="text-[10px] text-gray-500 mt-1">Via Aadhaar OTP verification</div>
              </button>
              <button onClick={() => { reset(); setMode('create_mobile'); }} className="p-4 border-2 border-dashed rounded-xl hover:border-green-400 hover:bg-green-50 text-left transition-colors">
                <div className="text-sm font-bold text-gray-900">Create via Mobile</div>
                <div className="text-[10px] text-gray-500 mt-1">Mobile number based creation</div>
              </button>
              <button onClick={() => { reset(); setMode('verify_existing'); }} className="p-4 border-2 border-dashed rounded-xl hover:border-purple-400 hover:bg-purple-50 text-left transition-colors">
                <div className="text-sm font-bold text-gray-900">Verify Existing ABHA</div>
                <div className="text-[10px] text-gray-500 mt-1">Link existing ABHA number</div>
              </button>
              <button onClick={() => { reset(); setMode('scan_qr'); }} className="p-4 border-2 border-dashed rounded-xl hover:border-orange-400 hover:bg-orange-50 text-left transition-colors">
                <div className="text-sm font-bold text-gray-900">Scan & Share</div>
                <div className="text-[10px] text-gray-500 mt-1">Scan ABHA QR from PHR app</div>
              </button>
            </div>
            <button onClick={() => { reset(); setMode('search_phr'); }} className="w-full p-3 border rounded-xl hover:bg-gray-50 text-left">
              <div className="text-sm font-medium text-gray-700">Search by ABHA Address</div>
              <div className="text-[10px] text-gray-400">Find patient by user@abdm address</div>
            </button>
          </div>
        )}

        {/* ===== CREATE ABHA — AADHAAR ===== */}
        {mode === 'create_aadhaar' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { reset(); setMode('menu'); }} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
              <h3 className="font-bold text-sm">Create ABHA — Aadhaar OTP</h3>
            </div>
            {!otpSent ? (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Aadhaar Number *</label>
                  <input type="text" value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/[^0-9\s]/g, ''))}
                    placeholder="XXXX XXXX XXXX" maxLength={14} className={inputCls} />
                  <p className="text-[10px] text-gray-400 mt-1">OTP will be sent to Aadhaar-linked mobile</p>
                </div>
                <button onClick={handleAadhaarOTP} disabled={loading} className={btnPrimary}>
                  {loading ? 'Sending OTP...' : 'Send Aadhaar OTP'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2">
                  OTP sent to Aadhaar-linked mobile. Valid for 10 minutes.
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Enter OTP *</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP" maxLength={6} className={inputCls} autoFocus />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAadhaarVerify} disabled={loading} className={btnPrimary}>
                    {loading ? 'Verifying...' : 'Verify & Create ABHA'}
                  </button>
                  <button onClick={() => { setOtpSent(false); setOtp(''); }} className={btnSecondary}>Resend</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== CREATE ABHA — MOBILE ===== */}
        {mode === 'create_mobile' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { reset(); setMode('menu'); }} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
              <h3 className="font-bold text-sm">Create ABHA — Mobile OTP</h3>
            </div>
            {!otpSent ? (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Mobile Number *</label>
                  <input type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile" maxLength={10} className={inputCls} />
                </div>
                <button onClick={handleMobileOTP} disabled={loading} className={btnPrimary}>
                  {loading ? 'Sending OTP...' : 'Send Mobile OTP'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2">
                  OTP sent to {mobile}. Valid for 10 minutes.
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Enter OTP *</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP" maxLength={6} className={inputCls} autoFocus />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleMobileVerify} disabled={loading} className={btnPrimary}>
                    {loading ? 'Verifying...' : 'Verify & Create ABHA'}
                  </button>
                  <button onClick={() => { setOtpSent(false); setOtp(''); }} className={btnSecondary}>Resend</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== VERIFY EXISTING ABHA ===== */}
        {mode === 'verify_existing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { reset(); setMode('menu'); }} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
              <h3 className="font-bold text-sm">Verify & Link Existing ABHA</h3>
            </div>
            {!otpSent ? (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">ABHA Number *</label>
                  <input type="text" value={abhaNumber} onChange={e => setAbhaNumber(e.target.value)}
                    placeholder="XX-XXXX-XXXX-XXXX" maxLength={17} className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleVerifyExisting('aadhaar')} disabled={loading} className={btnPrimary}>
                    {loading ? 'Sending...' : 'Verify via Aadhaar OTP'}
                  </button>
                  <button onClick={() => handleVerifyExisting('mobile')} disabled={loading} className={btnSecondary}>
                    Via Mobile OTP
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2">
                  OTP sent. Verify to link ABHA {abhaNumber} to this patient.
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Enter OTP *</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP" maxLength={6} className={inputCls} autoFocus />
                </div>
                <button onClick={handleVerifyOTP} disabled={loading} className={btnPrimary}>
                  {loading ? 'Verifying...' : 'Verify & Link ABHA'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ===== SCAN & SHARE ===== */}
        {mode === 'scan_qr' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { reset(); stopCamera(); setMode('menu'); }} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
              <h3 className="font-bold text-sm">Scan & Share — QR Code</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 leading-relaxed">
              ABDM integration is pending sandbox registration. ABHA scanning will be available once the NHCX sandbox connection is configured.
            </div>
            <div className="bg-gray-50 rounded-xl border-2 border-dashed p-4 text-center">
              {!cameraActive ? (
                <>
                  <button onClick={startCamera} className={btnPrimary}>Open Camera Scanner</button>
                  <p className="text-[10px] text-gray-400 mt-2">Ask patient to show ABHA QR from PHR app</p>
                </>
              ) : (
                <div>
                  <video ref={videoRef} className="w-full rounded-lg" />
                  <button onClick={stopCamera} className="mt-2 text-xs text-red-600">Stop Camera</button>
                </div>
              )}
            </div>
            <div className="text-center text-xs text-gray-400">— or paste QR data manually —</div>
            <div>
              <textarea value={qrInput} onChange={e => setQrInput(e.target.value)}
                placeholder="Paste scanned QR code data here..." rows={3} className={inputCls} />
            </div>
            <button onClick={() => handleQRParse(qrInput)} disabled={loading || !qrInput} className={btnPrimary}>
              {loading ? 'Parsing...' : 'Parse QR Code'}
            </button>
          </div>
        )}

        {/* ===== SEARCH PHR ===== */}
        {mode === 'search_phr' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { reset(); setMode('menu'); }} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
              <h3 className="font-bold text-sm">Search by ABHA Address</h3>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">ABHA Address (PHR)</label>
              <input type="text" value={abhaAddress} onChange={e => setAbhaAddress(e.target.value)}
                placeholder="username@abdm" className={inputCls} />
            </div>
            <button onClick={handleSearchPHR} disabled={loading || !abhaAddress} className={btnPrimary}>
              {loading ? 'Searching...' : 'Search & Verify'}
            </button>
          </div>
        )}

        {/* ===== PROFILE VIEW (linked) ===== */}
        {mode === 'profile' && (profile || currentAbha) && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-orange-50 to-green-50 rounded-xl border p-4">
              <div className="flex items-start gap-4">
                {profile?.profilePhoto && (
                  <img src={`data:image/png;base64,${profile.profilePhoto}`} alt="ABHA" className="w-16 h-16 rounded-full border-2 border-white shadow" /> 
                )}
                <div className="flex-1">
                  <div className="font-bold text-lg">{profile?.name || patientName}</div>
                  <div className="font-mono text-blue-700 text-sm font-bold mt-1">{profile?.abhaNumber || currentAbha}</div>
                  {(profile?.abhaAddress || currentAbhaAddress) && (
                    <div className="text-xs text-gray-500 mt-0.5">{profile?.abhaAddress || currentAbhaAddress}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${profile?.kycVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {profile?.kycVerified ? 'KYC Verified' : 'Not KYC Verified'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${profile?.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {profile?.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {profile && (
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  {profile.gender && <div><span className="text-gray-500">Gender:</span> {profile.gender}</div>}
                  {profile.dateOfBirth && <div><span className="text-gray-500">DOB:</span> {profile.dateOfBirth}</div>}
                  {profile.mobile && <div><span className="text-gray-500">Mobile:</span> {profile.mobile}</div>}
                  {profile.email && <div><span className="text-gray-500">Email:</span> {profile.email}</div>}
                  {profile.districtName && <div><span className="text-gray-500">District:</span> {profile.districtName}</div>}
                  {profile.stateName && <div><span className="text-gray-500">State:</span> {profile.stateName}</div>}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={handleUnlink} disabled={loading} className="px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 hover:bg-red-100">
                {loading ? 'Unlinking...' : 'Unlink ABHA'}
              </button>
              {onClose && <button onClick={onClose} className={btnSecondary}>Close</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
