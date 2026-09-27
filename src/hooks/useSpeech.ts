/**
 * Hook de voz do Prumo — Web Speech API nativa do navegador (grátis, offline
 * onde o SO suportar, sem enviar áudio a terceiros que o usuário não conheça).
 *
 * - Ditado: SpeechRecognition com lang pt-BR (Brasil) / pt-AO* (Angola — nem
 *   todo engine tem pt-AO; o browser faz fallback automático para pt quando
 *   disponível). Interim results aparecem em tempo real no campo.
 * - Leitura: speechSynthesis lê a resposta do copiloto em voz alta (toggle).
 *
 * Compatibilidade: Chrome/Edge/Safari 14+. Firefox não suporta SpeechRecognition
 * — o hook expõe `isSupported` para a UI esconder o microfone nesses browsers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ── Tipos mínimos da Web Speech API (não existem no lib.dom de todas as versões) ── */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type SpeechStatus = 'idle' | 'listening' | 'error' | 'unsupported';

export interface UseSpeechResult {
  /** true se o browser suporta SpeechRecognition (mostra/oculta o mic). */
  isSupported: boolean;
  status: SpeechStatus;
  isListening: boolean;
  /** Texto parcial (ainda não finalizado) do ditado atual. */
  interimText: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  /** Lê um texto em voz alta (resposta do copiloto). */
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  /** true se o browser suporta leitura em voz alta. */
  canSpeak: boolean;
}

/**
 * @param lang 'pt-BR' | 'pt-AO' — idioma do reconhecimento
 * @param onFinalText chamado quando uma frase finalizada é reconhecida
 */
export function useSpeech(lang: string, onFinalText?: (text: string) => void): UseSpeechResult {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Mantém o callback atual sem recriar a recognition quando ele muda
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  const ctor = useMemo(() => getRecognitionCtor(), []);
  const isSupported = ctor !== null;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!ctor) {
      setStatus('unsupported');
      return;
    }
    const rec = new ctor();
    rec.lang = lang;
    rec.continuous = true; // permite frases encadeadas sem soltar o botão
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setStatus('listening');
      setError(null);
      setInterimText('');
    };

    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          const finalText = alt.transcript.trim();
          if (finalText && onFinalRef.current) {
            onFinalRef.current(finalText);
          }
        } else {
          interim += alt.transcript;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (ev: Event & { error?: string }) => {
      const code = ev.error || 'unknown';
      setStatus('error');
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Permissão de microfone negada. Autorize o microfone nas configurações do navegador.');
      } else if (code === 'no-speech') {
        setError('Não captei nada. Tente falar novamente.');
      } else if (code === 'network') {
        setError('O serviço de voz do navegador precisa de internet.');
      } else if (code !== 'aborted') {
        setError('Falha no reconhecimento de voz. Tente novamente.');
      }
    };

    rec.onend = () => {
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      setInterimText('');
    };

    recognitionRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        // já parado
      }
      recognitionRef.current = null;
    };
  }, [ctor, lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || status === 'listening') return;
    setError(null);
    try {
      recognitionRef.current.start();
    } catch {
      // start() em recognition já ativo dispara InvalidStateError — ignorar
    }
  }, [status]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // já parado
    }
    setStatus('idle');
    setInterimText('');
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [canSpeak]);

  const speak = useCallback(
    (text: string) => {
      if (!canSpeak || !text) return;
      window.speechSynthesis.cancel();
      // Remove markdown simples (** **, ##, listas) para não soletrar símbolos
      const clean = text
        .replace(/\*\*/g, '')
        .replace(/^#+\s/gm, '')
        .replace(/[-•]\s/g, '')
        .slice(0, 600);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = lang;
      utter.rate = 1.02;
      utter.pitch = 1;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    [canSpeak, lang]
  );

  // Parar a leitura quando o componente desmontar
  useEffect(() => () => {
    if (canSpeak) window.speechSynthesis.cancel();
  }, [canSpeak]);

  return {
    isSupported,
    status,
    isListening: status === 'listening',
    interimText,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSpeaking,
    canSpeak,
  };
}
