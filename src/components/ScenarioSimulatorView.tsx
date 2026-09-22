import React, { useState, useMemo } from 'react';
import { ScenarioEvent, Country, User, MonthProjection } from '../types';
import { projectScenarios, formatCurrency } from '../services/businessRules';
import {
  TrendingUp,
  Plus,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface ScenarioSimulatorViewProps {
  user: User;
  initialBalance: number;
  baseMonthlyIncome: number;
  baseMonthlyExpense: number;
  country: Country;
  events: ScenarioEvent[];
  onToggleEvent: (id: string) => void;
  onAddEvent: (event: Omit<ScenarioEvent, 'id'>) => void;
  onDeleteEvent: (id: string) => void;
}

export const ScenarioSimulatorView: React.FC<ScenarioSimulatorViewProps> = ({
  user,
  initialBalance,
  baseMonthlyIncome,
  baseMonthlyExpense,
  country,
  events,
  onToggleEvent,
  onAddEvent,
  onDeleteEvent,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(24);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Form states para novo evento
  const [eventLabel, setEventLabel] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventType, setEventType] = useState<'income' | 'expense'>('income');
  const [eventDelta, setEventDelta] = useState('');
  const [eventOneTime, setEventOneTime] = useState('');
  const [eventStartMonth, setEventStartMonth] = useState('2');
  const [eventCategory, setEventCategory] = useState('Salário / Honorários');

  // Calcular projeção de 24 meses
  const projections = useMemo(() => {
    return projectScenarios(initialBalance, baseMonthlyIncome, baseMonthlyExpense, events, 24);
  }, [initialBalance, baseMonthlyIncome, baseMonthlyExpense, events]);

  const currentMonthData = projections[selectedMonth - 1] || projections[23];
  const month24Data = projections[23];
  const netDifferenceAt24 = month24Data.scenarioBalance - month24Data.baselineBalance;

  // Render SVG Chart calculations
  const chartHeight = 240;
  const chartWidth = 720;
  const padding = { top: 25, right: 30, bottom: 35, left: 70 };

  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Min & Max across baseline and scenario balances
  const allValues = projections.flatMap((p) => [p.baselineBalance, p.scenarioBalance]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(...allValues) * 1.08;

  const getX = (index: number) => padding.left + (index / 23) * innerWidth;
  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return padding.top + innerHeight - ((val - minVal) / range) * innerHeight;
  };

  // Build SVG Path
  const baselinePath = projections
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.baselineBalance)}`)
    .join(' ');

  const scenarioPath = projections
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.scenarioBalance)}`)
    .join(' ');

  // Area between scenario and baseline
  const areaPath = `${scenarioPath} ${projections
    .slice()
    .reverse()
    .map((p, i) => `L ${getX(23 - i)} ${getY(p.baselineBalance)}`)
    .join(' ')} Z`;

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const delta = parseFloat(eventDelta) || 0;
    const oneTime = parseFloat(eventOneTime) || 0;
    const startM = parseInt(eventStartMonth, 10) || 1;

    if (!eventLabel) return;

    onAddEvent({
      label: eventLabel,
      description: eventDesc || 'Evento simulado no Prumo',
      type: eventType,
      monthlyDelta: eventType === 'income' ? Math.abs(delta) : -Math.abs(delta),
      oneTimeCost: oneTime > 0 ? oneTime : undefined,
      startMonth: Math.max(1, Math.min(24, startM)),
      enabled: true,
      category: eventCategory,
    });

    setEventLabel('');
    setEventDesc('');
    setEventDelta('');
    setEventOneTime('');
    setShowAddEventModal(false);
  };

  return (
    <div id="scenario-simulator-view" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
              Simulador de Cenários (24 Meses)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-dim)]">
            Projete o impacto patrimonial de decisões profissionais e eventos de vida com toggles em tempo real.
          </p>
        </div>

        <button
          id="btn-add-scenario-event"
          type="button"
          onClick={() => setShowAddEventModal(!showAddEventModal)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--accent)] text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Evento</span>
        </button>
      </div>

      {/* Modal / Card para Novo Evento */}
      {showAddEventModal && (
        <form
          onSubmit={handleCreateEvent}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h3 className="font-semibold text-sm text-[var(--text)]">Novo Evento de Cenário</h3>
            <span className="text-xs text-[var(--text-dim)]">Simulação de 1 a 24 meses</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[var(--text-dim)]">Nome do Evento</label>
              <input
                type="text"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                placeholder="Ex: Novo Contrato PJ, Pós-graduação"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                required
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-dim)]">Tipo</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
              >
                <option value="income">Receita Extra Mensal (+)</option>
                <option value="expense">Despesa Extra Mensal (-)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-dim)]">
                Impacto Mensal ({country === 'BR' ? 'R$' : 'Kz'})
              </label>
              <input
                type="number"
                value={eventDelta}
                onChange={(e) => setEventDelta(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-dim)]">Custo Pontual / Aquisição (Opcional)</label>
              <input
                type="number"
                value={eventOneTime}
                onChange={(e) => setEventOneTime(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-dim)]">Mês de Início (1 a 24)</label>
              <input
                type="number"
                min="1"
                max="24"
                value={eventStartMonth}
                onChange={(e) => setEventStartMonth(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-dim)]">Categoria</label>
              <input
                type="text"
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                placeholder="Ex: Trabalho, Moradia, Educação"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setShowAddEventModal(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] text-[var(--text-dim)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white font-semibold"
            >
              Adicionar ao Cenário
            </button>
          </div>
        </form>
      )}

      {/* 4 Cards de Resumo da Projeção de 24 Meses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Inicial */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-xs text-[var(--text-dim)]">Saldo Atual de Partida</div>
          <div className="font-serif-display text-xl font-bold text-[var(--text)] mt-1">
            {formatCurrency(initialBalance, country)}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">Patrimônio inicial consolidado</div>
        </div>

        {/* Saldo Base no Mês 24 */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-xs text-[var(--text-dim)]">Projeção Base (24 Meses)</div>
          <div className="font-serif-display text-xl font-bold text-[var(--text)] mt-1">
            {formatCurrency(month24Data.baselineBalance, country)}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">Sem novos eventos ativos</div>
        </div>

        {/* Saldo com Cenário no Mês 24 */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs ring-1 ring-[var(--accent)]/30">
          <div className="text-xs text-[var(--accent)] font-semibold">Projeção com Cenário (24M)</div>
          <div className="font-serif-display text-xl font-bold text-[var(--accent)] mt-1">
            {formatCurrency(month24Data.scenarioBalance, country)}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">Com eventos selecionados</div>
        </div>

        {/* Diferença Líquida Acumulada */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-xs text-[var(--text-dim)]">Ganho Líquido do Cenário</div>
          <div
            className={`font-serif-display text-xl font-bold mt-1 ${
              netDifferenceAt24 >= 0 ? 'text-[var(--positive)]' : 'text-[var(--danger)]'
            }`}
          >
            {netDifferenceAt24 >= 0 ? '+' : ''}
            {formatCurrency(netDifferenceAt24, country)}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            {netDifferenceAt24 >= 0 ? 'Aceleração de patrimônio' : 'Consumo planejado'}
          </div>
        </div>
      </div>

      {/* Gráfico Interativo de 24 Meses (Fraunces Typography & Copper Aesthetic) */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif-display text-lg font-bold text-[var(--text)]">
              Curva de Evolução Patrimonial (24 Meses)
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              Passe o cursor sobre o gráfico para inspecionar cada mês e seus eventos ativos.
            </p>
          </div>

          {/* Legenda do Gráfico */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-[var(--text-dim)]" />
              <span className="text-[var(--text-dim)]">Cenário Base</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-1 bg-[var(--accent)] rounded-full" />
              <span className="font-semibold text-[var(--accent)]">Cenário Projetado</span>
            </div>
          </div>
        </div>

        {/* SVG Canvas do Gráfico */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto select-none"
            style={{ minWidth: '600px' }}
          >
            {/* Background Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const yPos = padding.top + innerHeight * (1 - ratio);
              const val = minVal + (maxVal - minVal) * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={chartWidth - padding.right}
                    y2={yPos}
                    stroke="var(--line)"
                    strokeDasharray="3,3"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={yPos + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--text-dim)"
                    className="font-sans-ui"
                  >
                    {formatCurrency(Math.round(val), country).split(',')[0]}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            <path d={areaPath} fill="var(--accent)" fillOpacity="0.08" />

            {/* Baseline Line */}
            <path
              d={baselinePath}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="2"
              strokeDasharray="4,4"
            />

            {/* Scenario Line */}
            <path d={scenarioPath} fill="none" stroke="var(--accent)" strokeWidth="3" />

            {/* Markers & Interactive points */}
            {projections.map((p, i) => {
              const x = getX(i);
              const yScenario = getY(p.scenarioBalance);
              const isSelected = selectedMonth === p.monthIndex;

              return (
                <g
                  key={p.monthIndex}
                  className="cursor-pointer"
                  onClick={() => setSelectedMonth(p.monthIndex)}
                >
                  {/* Vertical bar highlight on hover/selection */}
                  {isSelected && (
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + innerHeight}
                      stroke="var(--accent)"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                  )}

                  <circle
                    cx={x}
                    cy={yScenario}
                    r={isSelected ? 6 : 3}
                    fill={isSelected ? 'var(--accent)' : 'var(--surface)'}
                    stroke="var(--accent)"
                    strokeWidth="2"
                    className="transition-all hover:scale-150"
                  />

                  {/* Month X Labels every 3 months */}
                  {(i === 0 || (i + 1) % 3 === 0 || i === 23) && (
                    <text
                      x={x}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--text-dim)"
                      className="font-sans-ui"
                    >
                      M{i + 1}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Caixa de Inspeção do Mês Selecionado */}
        <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-semibold text-xs text-[var(--accent)] uppercase tracking-wider">
                Inspeção: {currentMonthData.monthLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-1 text-xs">
              <div>
                <span className="text-[var(--text-dim)]">Saldo com Cenário: </span>
                <strong className="text-[var(--accent)]">
                  {formatCurrency(currentMonthData.scenarioBalance, country)}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-dim)]">Saldo sem Cenário: </span>
                <span className="text-[var(--text)]">
                  {formatCurrency(currentMonthData.baselineBalance, country)}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-dim)]">Variação no Mês: </span>
                <strong
                  className={
                    currentMonthData.deltaNet >= 0
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--danger)]'
                  }
                >
                  {currentMonthData.deltaNet >= 0 ? '+' : ''}
                  {formatCurrency(currentMonthData.deltaNet, country)}
                </strong>
              </div>
            </div>
          </div>

          <div className="text-xs">
            <span className="text-[var(--text-dim)] font-medium">Eventos ativos neste mês:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {currentMonthData.activeEvents.length > 0 ? (
                currentMonthData.activeEvents.map((e) => (
                  <span
                    key={e}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
                  >
                    {e}
                  </span>
                ))
              ) : (
                <span className="text-[var(--text-dim)] text-[11px] italic">
                  Nenhum evento especial agendado para este mês.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Eventos Ligáveis (Toggles ON/OFF) */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif-display text-lg font-bold text-[var(--text)]">
              Eventos e Hipóteses do Cenário
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              Ligue ou desligue qualquer hipótese para ver a repercussão instantânea na curva de 24 meses.
            </p>
          </div>
          <span className="text-xs text-[var(--text-dim)]">
            {events.filter((e) => e.enabled).length} de {events.length} ativos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {events.map((evt) => {
            const isIncome = evt.type === 'income';

            return (
              <div
                key={evt.id}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  evt.enabled
                    ? 'border-[var(--accent)]/40 bg-[var(--surface-2)]/60 shadow-xs'
                    : 'border-[var(--line)] bg-[var(--surface)] opacity-70'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isIncome
                          ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                          : 'bg-[var(--danger-soft)] text-[var(--danger)]'
                      }`}
                    >
                      {isIncome ? 'Receita Extra' : 'Despesa / Custo'}
                    </span>
                    <span className="text-[11px] text-[var(--text-dim)]">
                      Inicia no Mês {evt.startMonth}
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-[var(--text)]">{evt.label}</h4>
                  <p className="text-xs text-[var(--text-dim)] leading-relaxed">{evt.description}</p>

                  <div className="flex items-center gap-3 text-xs pt-1">
                    {evt.monthlyDelta !== 0 && (
                      <span className="font-medium text-[var(--text)]">
                        {evt.monthlyDelta > 0 ? '+' : ''}
                        {formatCurrency(evt.monthlyDelta, country)} / mês
                      </span>
                    )}
                    {evt.oneTimeCost && evt.oneTimeCost > 0 && (
                      <span className="font-medium text-[var(--warn)]">
                        Custo único: {formatCurrency(evt.oneTimeCost, country)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleEvent(evt.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      evt.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
                    }`}
                    role="switch"
                    aria-checked={evt.enabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        evt.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteEvent(evt.id)}
                    className="text-[11px] text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                    title="Remover evento"
                  >
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
