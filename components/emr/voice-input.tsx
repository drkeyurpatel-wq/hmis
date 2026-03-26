// components/emr/voice-input.tsx
// Reusable voice dictation button with language picker + live transcript overlay
// Attaches to any free-text field — appends transcribed text
'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Languages, X } from 'lucide-react';
import { useVoice, VOICE_LABELS, type VoiceLang } from '@/lib/emr/use-voice';

interface VoiceInputProps {
  /** Current text value of the target field */
  value: string;
  /** Setter for the target field — voice transcript appends to this */
  onChange: (text: string) => void;
  /** Placeholder shown in transcript overlay when not listening */
  placeholder?: string;
  /** CSS class for the mic button container */
  className?: string;
  /** Disable the voice button */
  disabled?: boolean;
}

export default function VoiceInput({
  value,
  onChange,
  placeholder = 'Tap mic and speak...',
  className = '',
  disabled = false,
}: VoiceInputProps) {
  const [showLangPicker, setShowLangPicker] = useState(false);
  const langPickerRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    isSupported,
    language,
    setLanguage,
    interim,
    finalText,
    start,
    stop,
    clear,
    error,
  } = useVoice({
    onFinal: (text) => {
      // Append final transcript to existing value
      const separator = value && !value.endsWith(' ') && !value.endsWith('\n') ? ' ' : '';
      onChange(value + separator + text);
    },
  });

  // When final text updates, clear the voice state so next segment starts fresh
  const prevFinalRef = useRef(finalText);
  useEffect(() => {
    if (finalText !== prevFinalRef.current && finalText) {
      // Final was already appended via onFinal callback — just clear voice state
      prevFinalRef.current = finalText;
    }
  }, [finalText]);

  // Close lang picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    }
    if (showLangPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLangPicker]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stop();
      clear();
    } else {
      clear();
      start();
    }
  }, [isListening, start, stop, clear]);

  const handleLangSelect = useCallback((lang: VoiceLang) => {
    setLanguage(lang);
    setShowLangPicker(false);
    // If currently listening, restart with new language
    if (isListening) {
      stop();
      clear();
      // Small delay to let browser release mic
      setTimeout(() => start(), 100);
    }
  }, [setLanguage, isListening, stop, clear, start]);

  if (!isSupported) {
    return null; // Graceful fallback — no mic button shown
  }

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`}>
      {/* Language selector */}
      <div className="relative" ref={langPickerRef}>
        <button
          type="button"
          onClick={() => setShowLangPicker(!showLangPicker)}
          disabled={disabled}
          className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-medium rounded-h1-sm
            bg-h1-navy/5 text-h1-navy hover:bg-h1-navy/10 transition-colors duration-h1-fast
            disabled:opacity-40 disabled:cursor-not-allowed"
          title="Change voice language"
        >
          <Languages className="w-3 h-3" />
          <span>{VOICE_LABELS[language]}</span>
        </button>

        {showLangPicker && (
          <div className="absolute bottom-full mb-1 left-0 z-50 bg-h1-card rounded-h1-sm
            shadow-h1-dropdown border border-h1-border py-1 min-w-[100px] animate-h1-fade-in">
            {(Object.entries(VOICE_LABELS) as [VoiceLang, string][]).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLangSelect(code)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-h1-teal/10 transition-colors
                  ${language === code ? 'text-h1-teal font-semibold bg-h1-teal/5' : 'text-h1-text'}`}
              >
                <span className="font-medium">{label}</span>
                <span className="text-h1-text-muted ml-2">
                  {code === 'en-IN' ? 'English' : code === 'hi-IN' ? 'Hindi' : 'Gujarati'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mic button */}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={disabled}
        className={`p-1.5 rounded-full transition-all duration-h1-normal cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed
          ${isListening
            ? 'bg-h1-red text-white shadow-md animate-pulse'
            : 'bg-h1-navy/5 text-h1-navy hover:bg-h1-navy/10'
          }`}
        title={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* Live transcript overlay */}
      {isListening && (
        <div className="absolute bottom-full mb-2 left-0 right-0 min-w-[250px] z-40
          bg-h1-card rounded-h1 shadow-h1-dropdown border border-h1-red/30 p-2 animate-h1-fade-in">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-h1-red rounded-full animate-pulse" />
              <span className="text-[10px] font-medium text-h1-red">
                Listening ({VOICE_LABELS[language]})
              </span>
            </div>
            <button
              type="button"
              onClick={() => { stop(); clear(); }}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-h1-text-muted" />
            </button>
          </div>
          <div className="text-xs text-h1-text min-h-[20px]">
            {interim ? (
              <span className="text-h1-text-secondary italic">{interim}</span>
            ) : (
              <span className="text-h1-text-muted">{placeholder}</span>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && !isListening && (
        <div className="absolute bottom-full mb-2 left-0 z-40
          bg-h1-red/10 border border-h1-red/20 rounded-h1-sm px-2 py-1 text-[10px] text-h1-red
          max-w-[250px] animate-h1-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
