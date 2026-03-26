// lib/emr/use-voice.ts
// Web Speech API hook with multi-language support (EN/HI/GU)
// Handles interim + final transcripts, auto-stop on silence, error recovery
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceLang = 'en-IN' | 'hi-IN' | 'gu-IN';

export interface UseVoiceOptions {
  /** Initial language (default: en-IN) */
  lang?: VoiceLang;
  /** Auto-stop after silence (ms). Default 2000. 0 = manual stop only */
  silenceTimeout?: number;
  /** Called with each interim transcript update */
  onInterim?: (text: string) => void;
  /** Called when a final transcript segment is committed */
  onFinal?: (text: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export interface UseVoiceReturn {
  isListening: boolean;
  isSupported: boolean;
  language: VoiceLang;
  setLanguage: (lang: VoiceLang) => void;
  /** Live interim transcript (updates during speech) */
  interim: string;
  /** Accumulated final transcript (committed segments) */
  finalText: string;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Clear all transcripts */
  clear: () => void;
  error: string | null;
}

// Medical abbreviation expansion map
const MED_ABBREVIATIONS: Record<string, string> = {
  'bp': 'BP', 'hr': 'HR', 'rr': 'RR', 'spo2': 'SpO2', 'spo 2': 'SpO2',
  'bmi': 'BMI', 'ecg': 'ECG', 'ekg': 'EKG', 'ct': 'CT', 'mri': 'MRI',
  'usg': 'USG', 'opd': 'OPD', 'ipd': 'IPD', 'icu': 'ICU', 'er': 'ER',
  'cbc': 'CBC', 'lft': 'LFT', 'kft': 'KFT', 'rft': 'RFT', 'tft': 'TFT',
  'hba1c': 'HbA1c', 'hb a1c': 'HbA1c', 'hb': 'Hb', 'wbc': 'WBC', 'rbc': 'RBC',
  'esr': 'ESR', 'crp': 'CRP', 'bnp': 'BNP', 'pt': 'PT', 'inr': 'INR',
  'od': 'OD', 'bd': 'BD', 'tds': 'TDS', 'qid': 'QID', 'hs': 'HS',
  'sos': 'SOS', 'stat': 'STAT', 'prn': 'PRN',
  'iv': 'IV', 'im': 'IM', 'sc': 'SC', 'po': 'PO',
  'cvs': 'CVS', 'rs': 'RS', 'cns': 'CNS', 'gi': 'GI', 'gu': 'GU',
  'sob': 'SOB', 'nsr': 'NSR', 'copd': 'COPD', 'dm': 'DM', 'htn': 'HTN',
  'cad': 'CAD', 'ckd': 'CKD', 'dvt': 'DVT', 'pe': 'PE', 'mi': 'MI',
  'af': 'AF', 'chf': 'CHF', 'acs': 'ACS', 'tia': 'TIA', 'cva': 'CVA',
  'icd': 'ICD', 'uhid': 'UHID', 'nabh': 'NABH', 'abdm': 'ABDM', 'abha': 'ABHA',
};

// Number patterns spoken in Indian English/Hindi
const NUMBER_PATTERNS: [RegExp, string][] = [
  [/\bone twenty over eighty\b/gi, '120/80'],
  [/\bone thirty over ninety\b/gi, '130/90'],
  [/\bone forty over ninety\b/gi, '140/90'],
  [/\bone sixty over hundred\b/gi, '160/100'],
  [/\bninety eight point six\b/gi, '98.6'],
  [/\bninety nine\b/gi, '99'],
  [/\bhundred percent\b/gi, '100%'],
  [/\bninety eight percent\b/gi, '98%'],
  [/\bninety nine percent\b/gi, '99%'],
];

/** Post-process raw STT transcript */
function postProcess(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);

  // Capitalize after sentence-ending punctuation
  text = text.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => punct + letter.toUpperCase());

  // Medical abbreviation expansion (whole-word boundaries)
  for (const [spoken, expanded] of Object.entries(MED_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${spoken}\\b`, 'gi');
    text = text.replace(regex, expanded);
  }

  // Number patterns
  for (const [pattern, replacement] of NUMBER_PATTERNS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

/** Check if Web Speech API is available */
function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export const VOICE_LABELS: Record<VoiceLang, string> = {
  'en-IN': 'EN',
  'hi-IN': 'हि',
  'gu-IN': 'ગુ',
};

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const {
    lang = 'en-IN',
    silenceTimeout = 2000,
    onInterim,
    onFinal,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState<VoiceLang>(lang);
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => isSpeechSupported());

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isStoppingRef.current = true;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceTimeout > 0) {
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current && !isStoppingRef.current) {
          recognitionRef.current.stop();
        }
      }, silenceTimeout);
    }
  }, [silenceTimeout]);

  const start = useCallback(() => {
    if (!isSupported) {
      const msg = 'Speech recognition not supported in this browser. Use Chrome or Edge.';
      setError(msg);
      onError?.(msg);
      return;
    }

    // Clean up previous instance
    if (recognitionRef.current) {
      isStoppingRef.current = true;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setError(null);
    setInterim('');
    isStoppingRef.current = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        const processed = postProcess(finalTranscript);
        setFinalText(prev => {
          const updated = prev ? prev + ' ' + processed : processed;
          onFinal?.(updated);
          return updated;
        });
        setInterim('');
      }

      if (interimTranscript) {
        setInterim(interimTranscript);
        onInterim?.(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are expected during normal usage
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      const msg = event.error === 'not-allowed'
        ? 'Microphone permission denied. Please allow microphone access.'
        : `Speech recognition error: ${event.error}`;
      setError(msg);
      onError?.(msg);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Auto-restart if not intentionally stopped (handles Chrome's ~60s limit)
      if (!isStoppingRef.current && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // Already stopped or other error — ignore
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      setError('Failed to start speech recognition');
      onError?.('Failed to start speech recognition');
    }
  }, [isSupported, language, resetSilenceTimer, onInterim, onFinal, onError]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterim('');
  }, []);

  const clear = useCallback(() => {
    setFinalText('');
    setInterim('');
    setError(null);
  }, []);

  return {
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
  };
}

// Type augmentation for webkit prefix
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
