import React, { useState, useRef, useEffect } from 'react';
import {
  ChatMessage,
  User,
  Account,
  Transaction,
  BudgetLimit,
  Country,
  FinancialSnapshot,
} from '../types';
import {
  calculateAggregatedBalance,
  calculateTotals,
  analyzeBudgets,
  generatePredictiveAlerts,
  formatCurrency,
} from '../services/businessRules';
import {
  Sparkles,
  Send,
  Compass,
  ArrowRight,
  Bot,
  User as UserIcon,
  HelpCircle,
  Lightbulb,
  WifiOff,
  HardDrive,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react';
import { TabKey } from './Navigation';
import { useSpeech } from '../hooks/useSpeech';

interface CopilotChatViewProps {
  user: User;
  country: Country;
  accounts: Account[];
  transactions: Transaction[];
  budgetLimits: BudgetLimit[];
  messages: ChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  onNavigateTab: (tab: TabKey) => void;
  isOnline?: boolean;
}

export const CopilotChatView: React.FC<CopilotChatViewProps> = ({
  user,
  country,
  accounts,
  transactions,
  budgetLimits,
  messages,
  onSendMessage,
  onNavigateTab,
  isOnline = true,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voz (Fase 1): ditado pt-BR/pt-AO + leitura em voz alta da resposta.
  const handleFinalVoiceText = React.useCallback(
    (text: string) => {
      setInputVal((prev) => (prev ? `${prev} ${text}` : text));
    },
    []
  );
  const speech = useSpeech(country === 'BR' ? 'pt-BR' : 'pt-AO', handleFinalVoiceText);

  // LÊ em voz alta a última resposta do assistente quando ela chega
  // (somente com o modo "ler em voz alta" ativado pelo usuário).
  const lastAssistantIdRef = useRef<string | null>(null);
  const initialMessagesRef = useRef(true);
  useEffect(() => {
    if (initialMessagesRef.current && messages.length > 0) {
      initialMessagesRef.current = false;
      lastAssistantIdRef.current = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null;
      return;
    }
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.id !== lastAssistantIdRef.current) {
      lastAssistantIdRef.current = last.id;
      if (readAloud && !isLoading) speech.speak(last.content);
    }
  }, [messages, readAloud, isLoading, speech]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim() || isLoading) return;

    setInputVal('');
    setIsLoading(true);
    try {
      await onSendMessage(text);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Sugestões de perguntas contextuais
  const quickPrompts =
    country === 'BR'
      ? [
          `Como está minha reserva de emergência para ${user.profile.profession}?`,
          `Qual o impacto de um novo contrato PJ de R$ 3.500 no meu patrimônio?`,
          `Quais categorias estão consumindo mais do meu orçamento este mês?`,
          `Como acelerar minha meta de "${user.profile.primaryGoal}"?`,
        ]
      : [
          `Como está o meu plano de poupança em Kwanzas para ${user.profile.profession}?`,
          `Qual o impacto de um contrato extra de Kz 500.000 em 24 meses?`,
          `Como gerir o consumo no Kero e Sonangol dentro dos limites?`,
          `Qual o prazo realista para a meta de "${user.profile.primaryGoal}"?`,
        ];

  const handleActionClick = (action: NonNullable<ChatMessage['suggestedAction']>) => {
    if (action.actionType === 'open_scenario') {
      onNavigateTab('scenarios');
    } else if (action.actionType === 'check_goal' || action.actionType === 'view_budget') {
      onNavigateTab('budgets');
    }
  };

  return (
    <div
      id="copilot-chat-view"
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs flex flex-col h-[calc(100vh-14rem)] min-h-[550px]"
    >
      {/* Top Banner do Copiloto */}
      <div className="p-4 border-b border-[var(--line)] bg-[var(--surface-2)]/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif-display font-bold text-sm text-[var(--text)]">
                Prumo Copiloto IA
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
                Alimentado por Gemini
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-dim)]">
              Contextualizado para {user.name} ({user.profile.profession}) • {country === 'BR' ? 'Brasil' : 'Angola'}
            </p>
          </div>
        </div>

        {/* Snapshot / Online Badge */}
        {!isOnline ? (
          <div className="flex items-center gap-1.5 text-xs text-[var(--warn)] bg-[var(--warn-soft)] px-2.5 py-1 rounded-md border border-[var(--warn)]/30 font-medium">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Modo Offline • Dados Seguros Localmente</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-dim)] bg-[var(--surface)] px-2.5 py-1 rounded-md border border-[var(--line)]">
            <div className="w-2 h-2 rounded-full bg-[var(--positive)] animate-pulse" />
            <span>Retrato Financeiro Conectado</span>
          </div>
        )}
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-1 ${
                  isUser
                    ? 'bg-[var(--text)] text-[var(--surface)] font-semibold'
                    : 'bg-[var(--accent)] text-white shadow-xs'
                }`}
              >
                {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              </div>

              {/* Balão de Mensagem */}
              <div
                className={`rounded-xl p-4 text-xs sm:text-sm space-y-2.5 leading-relaxed transition-all ${
                  isUser
                    ? 'bg-[var(--accent)] text-white shadow-xs rounded-tr-none'
                    : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-line font-sans-ui">{msg.content}</div>

                {/* Ação Sugerida */}
                {msg.suggestedAction && (
                  <div className="pt-2 border-t border-[var(--line)]/50">
                    <button
                      type="button"
                      onClick={() => handleActionClick(msg.suggestedAction!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--accent)]/40 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                      <span>{msg.suggestedAction.label}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de carregamento */}
        {isLoading && (
          <div className="flex gap-3 max-w-xl">
            <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs shrink-0 mt-1">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="rounded-xl p-3.5 bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text-dim)] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
              <div
                className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
              <span>Prumo analisando seu retrato financeiro...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Botões de Ação Rápida Contextuais */}
      <div className="px-4 py-2 border-t border-[var(--line)] bg-[var(--surface-2)]/40 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] shrink-0 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-[var(--accent)]" /> Sugestões:
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-full text-xs border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Barra de Entrada de Texto */}
      <div className="p-3 sm:p-4 border-t border-[var(--line)] bg-[var(--surface)]">
        {/* Dica do ditado em andamento */}
        {speech.isListening && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-xs text-[var(--accent)] font-medium animate-pulse">
            <Mic className="w-3.5 h-3.5" />
            <span>Ouvindo{speech.interimText ? `: "${speech.interimText}"` : '... fale agora'}</span>
          </div>
        )}
        {speech.error && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-xs text-[var(--danger)] font-medium">
            <MicOff className="w-3.5 h-3.5" />
            <span>{speech.error}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {speech.isSupported && (
            <button
              id="btn-voice-input"
              type="button"
              onClick={() => (speech.isListening ? speech.stopListening() : speech.startListening())}
              disabled={isLoading}
              title={speech.isListening ? 'Parar ditado' : 'Falar com o Prumo (ditado por voz)'}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                speech.isListening
                  ? 'bg-[var(--danger)] border-[var(--danger)] text-white animate-pulse shadow-xs'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
              } disabled:opacity-40`}
            >
              {speech.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            id="copilot-input-field"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={speech.isListening ? 'Ouvindo você...' : 'Pergunte ao Prumo sobre metas, cortes de custo, reserva ou simulações...'}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-dim)]"
          />
          {speech.canSpeak && (
            <button
              id="btn-read-aloud"
              type="button"
              onClick={() => {
                if (readAloud) {
                  speech.stopSpeaking();
                  setReadAloud(false);
                } else {
                  setReadAloud(true);
                  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
                  if (lastAssistant && !isLoading) speech.speak(lastAssistant.content);
                }
              }}
              title={readAloud ? 'Desativar leitura em voz alta' : 'Ler respostas em voz alta'}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                readAloud
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-xs'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
              }`}
            >
              {readAloud ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button
            id="btn-send-copilot-msg"
            type="button"
            onClick={() => handleSend()}
            disabled={!inputVal.trim() || isLoading}
            className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-xs sm:text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
