// components/emr/patient-banner-v3.tsx
// Sticky patient banner with allergy alerts, quick toggles, AI Scribe beta
'use client';
import React from 'react';
import {
  Search, History, FlaskConical, Image, Bot,
  AlertCircle, Phone, Droplets
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age: string;
  gender: string;
  uhid: string;
  phone: string;
  allergies: string[];
  bloodGroup: string;
}

interface PatientBannerV3Props {
  patient: Patient;
  onSearch: () => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  showLab: boolean;
  onToggleLab: () => void;
  showImaging: boolean;
  onToggleImaging: () => void;
  showCopilot: boolean;
  onToggleCopilot: () => void;
  scribeEnabled: boolean;
  onToggleScribe: () => void;
  scribeActive: boolean;
}

export default function PatientBannerV3({
  patient,
  onSearch,
  showHistory,
  onToggleHistory,
  showLab,
  onToggleLab,
  showImaging,
  onToggleImaging,
  showCopilot,
  onToggleCopilot,
  scribeEnabled,
  onToggleScribe,
  scribeActive,
}: PatientBannerV3Props) {
  const hasAllergies = patient.allergies.length > 0;
  const hasPatient = !!patient.id;

  return (
    <div className={`sticky top-0 z-30 bg-h1-card rounded-h1 shadow-h1-card
      border transition-colors duration-h1-normal
      ${hasAllergies ? 'border-l-4 border-l-h1-red border-h1-red/20' : 'border-h1-border'}`}>
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left — Patient info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {hasPatient ? (
            <>
              {/* Name + Demographics */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-h1-section text-h1-navy truncate">{patient.name}</h1>
                  <span className="text-h1-small text-h1-text-muted flex-shrink-0">
                    {patient.age}y / {patient.gender}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-h1-small text-h1-text-secondary">
                  <span className="font-medium">{patient.uhid}</span>
                  {patient.bloodGroup && (
                    <span className="flex items-center gap-0.5">
                      <Droplets className="w-3 h-3 text-h1-red" />
                      {patient.bloodGroup}
                    </span>
                  )}
                  {patient.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="w-3 h-3" />
                      {patient.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Allergy badges */}
              {hasAllergies && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-h1-red animate-pulse" />
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.slice(0, 3).map(a => (
                      <span key={a} className="px-1.5 py-0.5 text-[9px] font-semibold
                        bg-h1-red/10 text-h1-red rounded-full border border-h1-red/20">
                        {a}
                      </span>
                    ))}
                    {patient.allergies.length > 3 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-medium
                        bg-h1-red/5 text-h1-red rounded-full">
                        +{patient.allergies.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <span className="text-h1-body text-h1-text-muted">No patient selected</span>
          )}
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* AI Scribe toggle */}
          <button
            type="button"
            onClick={onToggleScribe}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-h1-sm text-[10px] font-medium
              transition-all duration-h1-normal cursor-pointer
              ${scribeEnabled
                ? scribeActive
                  ? 'bg-purple-600 text-white shadow-md animate-pulse'
                  : 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-h1-navy/5 text-h1-text-muted hover:bg-h1-navy/10'
              }`}
            title="AI Scribe (Beta) — Ambient consultation transcription"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Scribe</span>
            <span className="text-[8px] px-1 py-0 rounded bg-purple-200 text-purple-800 ml-0.5">β</span>
          </button>

          <div className="w-px h-5 bg-h1-border mx-1" />

          {/* Sidebar toggles */}
          {hasPatient && (
            <>
              <ToggleButton
                active={showHistory}
                onClick={onToggleHistory}
                icon={<History className="w-3.5 h-3.5" />}
                label="History"
              />
              <ToggleButton
                active={showLab}
                onClick={onToggleLab}
                icon={<FlaskConical className="w-3.5 h-3.5" />}
                label="Lab"
              />
              <ToggleButton
                active={showImaging}
                onClick={onToggleImaging}
                icon={<Image className="w-3.5 h-3.5" />}
                label="Imaging"
              />
              <ToggleButton
                active={showCopilot}
                onClick={onToggleCopilot}
                icon={<Bot className="w-3.5 h-3.5" />}
                label="Copilot"
                accentClass="text-purple-700 bg-purple-50 border-purple-200"
              />
            </>
          )}

          <div className="w-px h-5 bg-h1-border mx-1" />

          {/* Change patient */}
          <button
            type="button"
            onClick={onSearch}
            className="flex items-center gap-1 px-2 py-1.5 rounded-h1-sm text-[10px] font-medium
              bg-h1-teal/10 text-h1-teal hover:bg-h1-teal/20 transition-colors duration-h1-fast cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{hasPatient ? 'Change' : 'Search'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Small toggle button for sidebar panels
function ToggleButton({
  active,
  onClick,
  icon,
  label,
  accentClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accentClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-h1-sm text-[10px] font-medium
        transition-all duration-h1-fast cursor-pointer
        ${active
          ? accentClass || 'bg-h1-teal text-white'
          : 'bg-h1-navy/5 text-h1-text-muted hover:bg-h1-navy/10'
        }`}
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
