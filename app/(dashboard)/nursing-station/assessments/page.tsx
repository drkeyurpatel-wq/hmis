'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClinicalAssessmentsHub() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAdm, setSelectedAdm] = useState<any>(null);
  const [fallScores, setFallScores] = useState<any[]>([]);
  const [bradenScores, setBradenScores] = useState<any[]>([]);
  const [ewsScores, setEwsScores] = useState<any[]>([]);
  const [carePlans, setCarePlans] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/ipd/bed-census?centre_id=${centreId}`).then(r => r.json()).then(d => {
      // We need active admissions — let's fetch from admissions
    });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Clinical Assessments Hub</h1>
      <p className="text-sm text-gray-500">Morse Fall Scale • Braden Scale • NEWS2 • Care Plans • Discharge Checklist</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { href: '/nursing-station/fall-risk', label: 'Morse Fall Scale', desc: '6-item fall risk assessment (0-125). Auto-creates quality incident + care plan for HIGH risk.', icon: '⚠️', color: 'border-amber-300 bg-amber-50' },
          { href: '/nursing-station/braden', label: 'Braden Scale', desc: '6-subscale pressure ulcer risk (6-23). Auto-creates prevention care plan for HIGH/VERY HIGH.', icon: '🩹', color: 'border-purple-300 bg-purple-50' },
          { href: '/nursing-station/ews', label: 'NEWS2 Early Warning', desc: '7-parameter early warning score. Auto-calculated from vitals. Triggers escalation at ≥5.', icon: '🚨', color: 'border-red-300 bg-red-50' },
          { href: '/nursing-station/care-plans', label: 'Care Plans', desc: 'Individualized nursing care plans. Auto-generated from fall/pressure risk. Editable.', icon: '📋', color: 'border-blue-300 bg-blue-50' },
          { href: '/nursing-station/discharge-checklist', label: 'Discharge Checklist', desc: '19-item structured discharge readiness. Auto-triggers PX discharge survey on completion.', icon: '✅', color: 'border-green-300 bg-green-50' },
          { href: '/nursing-station/code-blue', label: 'Code Blue / Rapid Response', desc: 'Emergency activation tracking. Response time, team, outcome. Auto-creates EXTREME incident.', icon: '🔴', color: 'border-red-300 bg-red-50' },
        ].map(t => (
          <Link key={t.href} href={t.href} className={`border-2 rounded-xl p-5 hover:shadow-md transition-shadow ${t.color}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{t.icon}</span>
              <div>
                <div className="font-bold text-base">{t.label}</div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
