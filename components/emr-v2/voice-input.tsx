// components/emr-v2/voice-input.tsx
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  language?: string;
  className?: string;
}

// Extend Window for vendor-prefixed SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, new () => SpeechRecognitionInstance>;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

const SILENCE_TIMEOUT_MS = 10_000;

export default function VoiceInput({
  onTranscript,
  language = 'en-IN',
  className = '',
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  // Check browser support on mount
  useEffect(() => {
    if (!getSpeechRecognitionConstructor()) {
      setIsSupported(false);
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Auto-stop after silence
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      return;
    }

    setErrorMessage('');
    finalTranscriptRef.current = '';
    setInterimText('');

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();

      let interim = '';
      let finalPart = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalPart += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalPart) {
        finalTranscriptRef.current += finalPart;
        onTranscript(finalTranscriptRef.current.trim());
      }

      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" fires on manual stop -- not a real error
      if (event.error === 'aborted') return;

      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
        'no-speech': 'No speech detected. Please try again.',
        'network': 'Network error. Check your connection.',
        'audio-capture': 'No microphone found. Please connect a microphone.',
      };
      setErrorMessage(messages[event.error] || `Speech error: ${event.error}`);
      setIsListening(false);
      setInterimText('');
      clearSilenceTimer();
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      clearSilenceTimer();
      recognitionRef.current = null;

      // Emit final transcript on end if there is accumulated text
      if (finalTranscriptRef.current.trim()) {
        onTranscript(finalTranscriptRef.current.trim());
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setErrorMessage('Failed to start speech recognition.');
      setIsListening(false);
    }
  }, [language, onTranscript, resetSilenceTimer, clearSilenceTimer]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [clearSilenceTimer]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        className={`
          relative flex items-center justify-center
          w-9 h-9 rounded-lg border
          cursor-pointer
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-1
          ${isListening
            ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 focus:ring-red-400'
            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-800 focus:ring-blue-400'
          }
        `}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={isListening}
        title={isListening ? 'Stop recording' : 'Voice input'}
      >
        {/* Pulsing red dot indicator when recording */}
        {isListening && (
          <span
            className="absolute -top-1 -right-1 flex h-3 w-3"
            aria-hidden="true"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        )}

        {isListening ? (
          <MicOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Mic className="w-4 h-4" aria-hidden="true" />
        )}
      </button>

      {/* Interim results overlay */}
      {isListening && interimText && (
        <div
          className="
            absolute left-0 top-full mt-1 z-50
            max-w-xs px-3 py-2
            bg-white border border-gray-200 rounded-lg shadow-lg
            text-sm text-gray-700 leading-snug
            pointer-events-none
          "
          role="status"
          aria-live="polite"
        >
          <span className="text-gray-400 italic">{interimText}</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && !isListening && (
        <div
          className="
            absolute left-0 top-full mt-1 z-50
            max-w-xs px-3 py-2
            bg-red-50 border border-red-200 rounded-lg shadow-lg
            text-xs text-red-700 leading-snug
          "
          role="alert"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
