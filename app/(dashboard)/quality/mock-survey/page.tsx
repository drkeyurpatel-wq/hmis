'use client';
import { useState } from 'react';

export default function MockSurveyPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [surveyType, setSurveyType] = useState('initial');
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  const runSurvey = async () => {
    setLoading(true);
    const res = await fetch(`/api/quality/mock-survey?centre_id=${centreId}&type=${surveyType}`);
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mock NABH Survey Simulator</h1>
        <p className="text-sm text-gray-500">Simulates a NABH assessor visit with random sampling per assessment rules</p>
      </div>

      <div className="flex items-center gap-4">
        <select value={surveyType} onChange={e => setSurveyType(e.target.value)} className="border rounded-lg px-4 py-2">
          <option value="initial">Initial Assessment (Core + Commitment)</option>
          <option value="surveillance">Surveillance (+ Achievement)</option>
          <option value="re-accreditation">Re-Accreditation (+ Excellence)</option>
        </select>
        <button onClick={runSurvey} disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Simulating...' : 'Run Mock Survey'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className={`rounded-xl p-6 text-center ${result.would_pass ? 'bg-green-50 border-2 border-green-400' : 'bg-red-50 border-2 border-red-400'}`}>
            <div className="text-5xl font-bold">{result.compliance_pct}%</div>
            <div className="text-lg font-semibold mt-2">{result.would_pass ? '✅ WOULD PASS' : '❌ WOULD NOT PASS'}</div>
            <div className="text-sm text-gray-600 mt-1">Target: {result.target_pct}% | Sampled: {result.sampled_count} of {result.total_applicable} OEs</div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{result.total_gaps}</div>
              <div className="text-sm text-gray-500">Total Gaps</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{result.critical_gaps}</div>
              <div className="text-sm text-gray-500">Core Gaps (Critical)</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{result.core_sampled}</div>
              <div className="text-sm text-gray-500">Core OEs Checked (100%)</div>
            </div>
          </div>

          {result.gap_elements?.length > 0 && (
            <div className="border rounded-lg">
              <div className="bg-red-50 dark:bg-red-950 px-4 py-2 font-semibold text-sm text-red-800">Gap Elements (score &lt; 3)</div>
              <div className="divide-y">
                {result.gap_elements.map((g: any, i: number) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                    <div><code className="text-xs font-mono bg-gray-100 px-1 rounded">{g.code}</code> <span className="text-xs text-gray-400 ml-1">{g.level}</span></div>
                    <span className={`text-xs font-bold ${g.score === 0 ? 'text-gray-400' : g.score < 3 ? 'text-red-600' : 'text-green-600'}`}>Score: {g.score}/5</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
