'use client';
import React, { useState, useEffect } from 'react';

type PortalTab = 'home' | 'reports' | 'prescriptions' | 'bills' | 'appointments' | 'vitals' | 'feedback';

async function portalAPI(body: any) {
  const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

export default function PatientPortal() {
  const [session, setSession] = useState<{ token: string; patientId: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<PortalTab>('home');
  const [profile, setProfile] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Appointment form
  const [apptForm, setApptForm] = useState({ preferredDate: '', preferredTime: '', department: '', reason: '' });
  // Feedback form
  const [fbForm, setFbForm] = useState({ feedbackType: 'general', rating: 5, message: '' });
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Restore session from localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('h1_portal_session') : null;
    if (saved) { try { const s = JSON.parse(saved); setSession(s); } catch {} }
  }, []);

  // Load profile on session
  useEffect(() => {
    if (!session) return;
    portalAPI({ action: 'get_data', sessionToken: session.token, dataType: 'profile' }).then(r => {
      if (r.data) setProfile(r.data);
      else { setSession(null); localStorage.removeItem('h1_portal_session'); }
    });
  }, [session]);

  const sendOTP = async () => {
    if (phone.length < 10) { setError('Enter valid 10-digit phone number'); return; }
    setLoading(true); setError('');
    const r = await portalAPI({ action: 'send_otp', phone });
    setLoading(false);
    if (r.success) { setOtpSent(true); setPatientName(r.patientName || ''); }
    else setError(r.error || 'Failed to send OTP');
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true); setError('');
    const r = await portalAPI({ action: 'verify_otp', phone, otp });
    setLoading(false);
    if (r.success) {
      const s = { token: r.sessionToken, patientId: r.patientId };
      setSession(s);
      localStorage.setItem('h1_portal_session', JSON.stringify(s));
    } else setError(r.error || 'Invalid OTP');
  };

  const loadData = async (type: string) => {
    if (!session) return [];
    const r = await portalAPI({ action: 'get_data', sessionToken: session.token, dataType: type });
    return r.data || [];
  };

  const loadTab = async (t: PortalTab) => {
    setTab(t);
    if (t === 'reports') setReports(await loadData('lab_reports'));
    if (t === 'prescriptions') setPrescriptions(await loadData('prescriptions'));
    if (t === 'bills') setBills(await loadData('bills'));
    if (t === 'vitals') setVitals(await loadData('vitals_history'));
    if (t === 'appointments') setAppointments(await loadData('appointments'));
  };

  const logout = () => { setSession(null); setProfile(null); localStorage.removeItem('h1_portal_session'); setOtpSent(false); setPhone(''); setOtp(''); };

  const flagColor = (r: any) => r.is_critical ? 'text-red-600 font-bold' : r.is_abnormal ? 'text-yellow-600 font-bold' : '';

  // ===== LOGIN SCREEN =====
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">H1</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Health1 Patient Portal</h1>
            <p className="text-sm text-gray-500 mt-1">View your reports, prescriptions, and more</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            {!otpSent ? (<>
              <div><label className="text-sm font-medium text-gray-700">Mobile number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full mt-1 px-4 py-3 border rounded-xl text-lg tracking-widest text-center" placeholder="Enter 10-digit mobile" maxLength={10} />
              </div>
              <button onClick={sendOTP} disabled={loading || phone.length < 10}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
                {loading ? 'Sending...' : 'Get OTP'}
              </button>
            </>) : (<>
              <div className="text-center text-sm text-gray-600">
                OTP sent to <span className="font-medium">+91 {phone}</span>
                {patientName && <><br/>Welcome, <span className="font-bold text-blue-600">{patientName}</span></>}
              </div>
              <div><input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border rounded-xl text-2xl tracking-[0.5em] text-center font-mono" placeholder="------" maxLength={6} autoFocus /></div>
              <button onClick={verifyOTP} disabled={loading || otp.length !== 6}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-700">
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button onClick={() => { setOtpSent(false); setOtp(''); }} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">Change number</button>
            </>)}
            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 text-center">{error}</div>}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">Health1 Super Speciality Hospital, Ahmedabad</p>
        </div>
      </div>
    );
  }

  // ===== PORTAL HOME =====
  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center"><span className="text-white text-sm font-bold">H1</span></div>
            <div><div className="font-semibold text-sm">{profile?.first_name} {profile?.last_name}</div>
              <div className="text-[10px] text-gray-400">{profile?.uhid} | {profile?.age_years}yr/{profile?.gender?.charAt(0).toUpperCase()}</div></div>
          </div>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-600">Logout</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b sticky top-[60px] z-20 overflow-x-auto">
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {([['home','Home'],['reports','Lab Reports'],['prescriptions','Prescriptions'],['bills','Bills'],['vitals','Vitals'],['appointments','Appointments'],['feedback','Feedback']] as [PortalTab,string][]).map(([k,l]) =>
            <button key={k} onClick={() => loadTab(k)} className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>{l}</button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* ===== HOME ===== */}
        {tab === 'home' && <div className="space-y-4">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            {[['reports','Lab Reports','View your test results','bg-blue-50 text-blue-700'],
              ['prescriptions','Prescriptions','Your medications','bg-green-50 text-green-700'],
              ['bills','Bills','Payment history','bg-orange-50 text-orange-700'],
              ['appointments','Book Appointment','Schedule a visit','bg-purple-50 text-purple-700']
            ].map(([key,title,desc,color]) => (
              <button key={key} onClick={() => loadTab(key as PortalTab)} className={`${color} rounded-xl p-4 text-left hover:opacity-90 transition-opacity`}>
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>

          {/* Profile card */}
          {profile && <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Your Profile</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-400 text-xs">Name:</span> <span className="font-medium">{profile.first_name} {profile.last_name}</span></div>
              <div><span className="text-gray-400 text-xs">UHID:</span> <span className="font-mono">{profile.uhid}</span></div>
              <div><span className="text-gray-400 text-xs">Age/Gender:</span> {profile.age_years} / {profile.gender}</div>
              <div><span className="text-gray-400 text-xs">Blood Group:</span> <span className="font-bold text-red-600">{profile.blood_group || '—'}</span></div>
              <div><span className="text-gray-400 text-xs">Phone:</span> {profile.phone_primary}</div>
              <div><span className="text-gray-400 text-xs">Email:</span> {profile.email || '—'}</div>
            </div>
          </div>}
        </div>}

        {/* ===== LAB REPORTS ===== */}
        {tab === 'reports' && <div>
          <h2 className="font-semibold text-sm mb-3">Lab Reports</h2>
          {reports.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No lab reports found</div> :
          selectedReport ? (
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div><div className="font-semibold">{selectedReport.test?.test_name}</div>
                  <div className="text-xs text-gray-400">{new Date(selectedReport.reported_at || selectedReport.created_at).toLocaleDateString('en-IN')}</div></div>
                <button onClick={() => setSelectedReport(null)} className="text-xs text-blue-600">Back to list</button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 text-gray-500 text-xs">Parameter</th>
                  <th className="p-3 text-gray-500 text-xs text-center">Result</th>
                  <th className="p-3 text-gray-500 text-xs text-center">Unit</th>
                  <th className="p-3 text-gray-500 text-xs text-center">Reference</th>
                </tr></thead><tbody>{(selectedReport.results || []).map((r: any, i: number) => (
                  <tr key={i} className={`border-b ${r.is_critical ? 'bg-red-50' : r.is_abnormal ? 'bg-yellow-50' : ''}`}>
                    <td className="p-3 text-sm">{r.parameter_name}</td>
                    <td className={`p-3 text-center text-sm ${flagColor(r)}`}>{r.result_value} {r.is_critical ? '!!' : r.is_abnormal ? '*' : ''}</td>
                    <td className="p-3 text-center text-gray-500 text-xs">{r.unit}</td>
                    <td className="p-3 text-center text-gray-400 text-xs">{r.normal_range_min != null ? `${r.normal_range_min} — ${r.normal_range_max}` : '—'}</td>
                  </tr>
                ))}</tbody></table>
              </div>
              {(selectedReport.results || []).some((r: any) => r.is_critical) && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <span className="font-bold">!! Critical values detected.</span> Please consult your doctor immediately.
              </div>}
            </div>
          ) : (
            <div className="space-y-2">{reports.map((r: any) => {
              const hasCritical = (r.results || []).some((res: any) => res.is_critical);
              const hasAbnormal = (r.results || []).some((res: any) => res.is_abnormal);
              return (
                <button key={r.id} onClick={() => setSelectedReport(r)} className={`w-full bg-white rounded-xl border p-4 text-left hover:border-blue-300 ${hasCritical ? 'border-red-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div><div className="font-medium text-sm">{r.test?.test_name}</div>
                      <div className="text-xs text-gray-400">{new Date(r.reported_at || r.created_at).toLocaleDateString('en-IN')}</div></div>
                    <div className="flex items-center gap-1">
                      {hasCritical && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">CRITICAL</span>}
                      {!hasCritical && hasAbnormal && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded">Abnormal</span>}
                      {!hasCritical && !hasAbnormal && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded">Normal</span>}
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                  </div>
                </button>
              );
            })}</div>
          )}
        </div>}

        {/* ===== PRESCRIPTIONS ===== */}
        {tab === 'prescriptions' && <div>
          <h2 className="font-semibold text-sm mb-3">Prescriptions</h2>
          {prescriptions.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No prescriptions found</div> :
          <div className="space-y-3">{prescriptions.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-400">{new Date(p.encounter_date).toLocaleDateString('en-IN')}</div>
                <div className="text-xs text-gray-500">Dr. {p.doctor?.full_name}</div>
              </div>
              {p.diagnoses && <div className="text-xs text-gray-600 mb-2"><span className="font-medium">Diagnosis:</span> {(Array.isArray(p.diagnoses) ? p.diagnoses : []).map((d: any) => d.label || d).join(', ')}</div>}
              {p.prescriptions && (Array.isArray(p.prescriptions) ? p.prescriptions : []).length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-2"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
                  <th className="text-left p-2">#</th><th className="text-left p-2">Medication</th><th className="p-2">Dose</th><th className="p-2">Frequency</th><th className="p-2">Duration</th>
                </tr></thead><tbody>{(Array.isArray(p.prescriptions) ? p.prescriptions : []).map((rx: any, i: number) => (
                  <tr key={i} className="border-b"><td className="p-2">{i+1}</td><td className="p-2 font-medium">{rx.brand || rx.drug} {rx.strength || ''}</td>
                    <td className="p-2 text-center">{rx.dose}</td><td className="p-2 text-center">{rx.frequency}</td><td className="p-2 text-center">{rx.duration}</td></tr>
                ))}</tbody></table></div>
              )}
              {p.advice && (Array.isArray(p.advice) ? p.advice : []).length > 0 && <div className="text-xs text-gray-500"><span className="font-medium">Advice:</span> {(Array.isArray(p.advice) ? p.advice : []).join(', ')}</div>}
              {p.follow_up && <div className="text-xs text-blue-600 mt-1">Follow-up: {typeof p.follow_up === 'object' ? p.follow_up.date : p.follow_up}</div>}
            </div>
          ))}</div>}
        </div>}

        {/* ===== BILLS ===== */}
        {tab === 'bills' && <div>
          <h2 className="font-semibold text-sm mb-3">Bills & Payments</h2>
          {bills.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No bills found</div> :
          <div className="space-y-2">{bills.map((b: any) => (
            <div key={b.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-medium">{new Date(b.bill_date).toLocaleDateString('en-IN')}</div>
                  <div className="text-xs text-gray-400">{(b.items || []).length} item(s)</div></div>
                <div className="text-right">
                  <div className="font-bold text-sm">Rs.{parseFloat(b.net_amount || 0).toLocaleString('en-IN')}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.status === 'paid' ? 'bg-green-100 text-green-700' : parseFloat(b.balance || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                    {b.status === 'paid' ? 'Paid' : `Balance: Rs.${parseFloat(b.balance || 0).toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            </div>
          ))}</div>}
        </div>}

        {/* ===== VITALS ===== */}
        {tab === 'vitals' && <div>
          <h2 className="font-semibold text-sm mb-3">Vitals History</h2>
          {vitals.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No vitals recorded</div> :
          <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Date</th><th className="p-2">BP</th><th className="p-2">HR</th><th className="p-2">SpO2</th><th className="p-2">Temp</th><th className="p-2">Sugar</th><th className="p-2">Weight</th>
          </tr></thead><tbody>{vitals.map((v: any, i: number) => (
            <tr key={i} className="border-b"><td className="p-2 text-gray-500">{new Date(v.recorded_at).toLocaleDateString('en-IN')}</td>
              <td className="p-2 text-center">{v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}</td>
              <td className="p-2 text-center">{v.pulse || '—'}</td><td className="p-2 text-center">{v.spo2 || '—'}%</td>
              <td className="p-2 text-center">{v.temperature || '—'}</td><td className="p-2 text-center">{v.blood_sugar || '—'}</td>
              <td className="p-2 text-center">{v.weight_kg || '—'}</td></tr>
          ))}</tbody></table></div>}
        </div>}

        {/* ===== APPOINTMENTS ===== */}
        {tab === 'appointments' && <div>
          <h2 className="font-semibold text-sm mb-3">Appointments</h2>
          <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
            <h3 className="text-sm font-medium">Book New Appointment</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Preferred date *</label>
                <input type="date" value={apptForm.preferredDate} onChange={e => setApptForm(f => ({...f, preferredDate: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" min={new Date().toISOString().split('T')[0]} /></div>
              <div><label className="text-xs text-gray-500">Preferred time</label>
                <select value={apptForm.preferredTime} onChange={e => setApptForm(f => ({...f, preferredTime: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Any time</option>{['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','19:00','20:00'].map(t => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div><label className="text-xs text-gray-500">Department</label>
              <select value={apptForm.department} onChange={e => setApptForm(f => ({...f, department: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{['General Medicine','Cardiology','Neurology','Orthopedics','General Surgery','Gastroenterology','Pulmonology','Nephrology','Urology','ENT','Ophthalmology','Dermatology','Psychiatry','Gynecology','Pediatrics'].map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Reason for visit</label>
              <input type="text" value={apptForm.reason} onChange={e => setApptForm(f => ({...f, reason: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Follow-up, new complaint..." /></div>
            <button onClick={async () => { if (!apptForm.preferredDate) return; const r = await portalAPI({ action: 'book_appointment', sessionToken: session.token, ...apptForm }); if (r.success) { flash('Appointment request submitted! We will confirm shortly.'); loadTab('appointments'); } }} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">Request Appointment</button>
          </div>

          {appointments.length > 0 && <div className="space-y-2">{appointments.map((a: any) => (
            <div key={a.id} className="bg-white rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-medium">{a.preferred_date}{a.confirmed_date ? ` → ${a.confirmed_date}` : ''}</div>
                  <div className="text-xs text-gray-500">{a.department || 'General'} | {a.reason || '—'}</div></div>
                <span className={`px-2 py-0.5 rounded text-[10px] ${a.status === 'confirmed' ? 'bg-green-100 text-green-700' : a.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span>
              </div>
            </div>
          ))}</div>}
        </div>}

        {/* ===== FEEDBACK ===== */}
        {tab === 'feedback' && <div>
          <h2 className="font-semibold text-sm mb-3">Share Your Feedback</h2>
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <div><label className="text-xs text-gray-500">Category</label>
              <select value={fbForm.feedbackType} onChange={e => setFbForm(f => ({...f, feedbackType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['general','doctor','lab','pharmacy','billing','homecare','complaint','suggestion'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Rating</label>
              <div className="flex gap-2 mt-1">{[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setFbForm(f => ({...f, rating: n}))}
                  className={`w-10 h-10 rounded-lg border text-sm font-bold ${fbForm.rating >= n ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-400 border-gray-200'}`}>{n}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">Your message *</label>
              <textarea value={fbForm.message} onChange={e => setFbForm(f => ({...f, message: e.target.value}))} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Tell us about your experience..." /></div>
            <button onClick={async () => { if (!fbForm.message) return; const r = await portalAPI({ action: 'submit_feedback', sessionToken: session.token, ...fbForm }); if (r.success) { flash('Thank you for your feedback!'); setFbForm({ feedbackType: 'general', rating: 5, message: '' }); } }} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">Submit Feedback</button>
          </div>
        </div>}
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 py-6 text-center text-[10px] text-gray-400">
        Health1 Super Speciality Hospital, Ahmedabad | www.health1.co.in<br/>
        For emergencies, call: 079-XXXXXXXX
      </div>
    </div>
  );
}
