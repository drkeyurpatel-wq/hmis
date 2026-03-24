'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientName, setPatientName] = useState('');

  const sendOTP = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) { setError('Enter a valid 10-digit phone number'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', phone: clean }),
      });
      const data = await res.json();
      if (res.ok) {
        setPatientName(data.patientName || '');
        setStep('otp');
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', phone: phone.replace(/\D/g, ''), otp }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('portal_token', data.token);
        localStorage.setItem('portal_patient_id', data.patientId);
        localStorage.setItem('portal_patient_name', data.patientName || '');
        router.push('/portal');
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-4">
            <img src="/images/health1-logo.svg" alt="Health1" className="h-12 w-auto" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Patient Portal</h1>
          <p className="text-sm text-gray-500 mt-1">View reports, appointments & bills</p>
        </div>

        <div className="bg-white rounded-2xl border p-6 space-y-4">
          {step === 'phone' ? (
            <>
              <div>
                <label className="text-xs text-gray-500 font-medium">Mobile Number</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400 bg-gray-50 px-3 py-2.5 rounded-lg border">+91</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={10}
                    className="flex-1 px-4 py-2.5 border rounded-lg text-base" placeholder="9876543210" autoFocus />
                </div>
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              <button onClick={sendOTP} disabled={loading}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              {patientName && <div className="text-center text-sm text-gray-600">Welcome, <b>{patientName}</b></div>}
              <div>
                <label className="text-xs text-gray-500 font-medium">Enter OTP sent to +91{phone.replace(/\D/g, '').slice(-10)}</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6}
                  className="w-full mt-1 px-4 py-3 border rounded-lg text-center text-2xl tracking-[0.5em] font-mono" placeholder="------" autoFocus />
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              <button onClick={verifyOTP} disabled={loading}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                className="w-full py-2 text-xs text-gray-500 hover:text-teal-600">Change number</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
