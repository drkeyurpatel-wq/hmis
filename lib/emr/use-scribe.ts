// lib/emr/use-scribe.ts
// AI Scribe (Beta): Continuous consultation recording → Claude API → structured SOAP
// Uses Web Speech API for STT, then sends transcript to Claude Sonnet for structuring
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { VoiceLang } from './use-voice';

export interface ScribeResponse {
  complaints: string;
  examination: { system: string; findings: string }[];
  diagnoses: { name: string; icd10?: string; type?: 'primary' | 'secondary' | 'differential' }[];
  prescriptions: { drug: string; dose: string; frequency: string; duration: string; route?: string; instructions?: string }[];
  advice: string;
  followUp?: string;
}

export interface UseScribeReturn {
  /** Whether scribe is actively recording */
  isRecording: boolean;
  /** Whether scribe is processing (API call in progress) */
  isProcessing: boolean;
  /** Raw transcript accumulated during recording */
  rawTranscript: string;
  /** Structured result after API processing */
  result: ScribeResponse | null;
  /** Error message */
  error: string | null;
  /** Start continuous recording */
  startRecording: () => void;
  /** Stop recording and trigger API processing */
  stopAndProcess: () => void;
  /** Cancel recording without processing */
  cancel: () => void;
  /** Clear results */
  clearResult: () => void;
  /** Current language */
  language: VoiceLang;
  /** Set language */
  setLanguage: (lang: VoiceLang) => void;
}

const SCRIBE_SYSTEM_PROMPT = `You are a medical AI scribe. You will receive a raw transcript of a doctor-patient consultation (may be in English, Hindi, Gujarati, or a mix). 

Parse the conversation and extract structured clinical information. Return ONLY a valid JSON object with this exact structure:

{
  "complaints": "Chief complaint as a concise clinical statement",
  "examination": [
    {"system": "General", "findings": "findings text"},
    {"system": "CVS", "findings": "findings text"}
  ],
  "diagnoses": [
    {"name": "Diagnosis name", "icd10": "ICD-10 code if known", "type": "primary"}
  ],
  "prescriptions": [
    {"drug": "Drug name", "dose": "Dose with unit", "frequency": "OD/BD/TDS etc", "duration": "duration", "route": "Oral/IV etc", "instructions": "before food etc"}
  ],
  "advice": "Patient instructions and advice",
  "followUp": "Follow-up date or period if mentioned"
}

Rules:
- Extract ONLY information explicitly mentioned in the conversation
- If a section has no information, use empty string or empty array
- For prescriptions, use standard abbreviations (OD, BD, TDS, QID, SOS)
- Translate Hindi/Gujarati medical terms to English clinical terms
- For diagnosis, try to include ICD-10 codes when clearly identifiable
- Do NOT hallucinate or infer information not present in the transcript
- Return ONLY the JSON object, no markdown, no explanation, no backticks`;

export function useScribe(): UseScribeReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawTranscript, setRawTranscript] = useState('');
  const [result, setResult] = useState<ScribeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<VoiceLang>('en-IN');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const isStoppingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    // Reset state
    setError(null);
    setResult(null);
    setRawTranscript('');
    transcriptRef.current = '';
    isStoppingRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      transcriptRef.current = fullTranscript;
      setRawTranscript(fullTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
        setIsRecording(false);
        return;
      }
    };

    recognition.onend = () => {
      // Auto-restart if not intentionally stopped (Chrome's ~60s limit)
      if (!isStoppingRef.current && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError('Failed to start recording');
    }
  }, [language]);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
      setError('No speech detected. Try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SCRIBE_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Here is the consultation transcript:\n\n${transcript}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const textContent = data.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      if (!textContent) {
        throw new Error('Empty response from AI');
      }

      // Parse JSON — strip any accidental markdown fences
      const cleaned = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed: ScribeResponse = JSON.parse(cleaned);

      // Validate structure
      if (typeof parsed.complaints !== 'string') parsed.complaints = '';
      if (!Array.isArray(parsed.examination)) parsed.examination = [];
      if (!Array.isArray(parsed.diagnoses)) parsed.diagnoses = [];
      if (!Array.isArray(parsed.prescriptions)) parsed.prescriptions = [];
      if (typeof parsed.advice !== 'string') parsed.advice = '';

      setResult(parsed);
    } catch (err: any) {
      console.error('Scribe API error:', err);
      setError(err.message || 'Failed to process consultation');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const stopAndProcess = useCallback(() => {
    isStoppingRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);

    // Process the accumulated transcript
    processTranscript(transcriptRef.current);
  }, [processTranscript]);

  const cancel = useCallback(() => {
    isStoppingRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setRawTranscript('');
    transcriptRef.current = '';
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setRawTranscript('');
    transcriptRef.current = '';
  }, []);

  return {
    isRecording,
    isProcessing,
    rawTranscript,
    result,
    error,
    startRecording,
    stopAndProcess,
    cancel,
    clearResult,
    language,
    setLanguage,
  };
}
