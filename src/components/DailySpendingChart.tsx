import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Area,
} from 'recharts';
import { Transaction, Country } from '../types';
import { formatCurrency } from '../services/businessRules';
import { TrendingDown, Calendar, AlertCircle, ArrowUpRight, Zap } from 'lucide-react';

interface DailySpendingChartProps {
  transactions: Transaction[];
  country: Country;
}

interface DailySpendingPoint {
  date: string;
  fullDate: string;
  dayLabel: string;
  amount: number;
  count: number;
  topCategory?: string;
}

export const DailySpendingChart: React.FC<DailySpendingChartProps> = ({
  transactions,
  country,
}) => {
  const [activeMetric, setActiveMetric] = useState<'daily' | 'cumulative'>('daily');

  // Calcular os últimos 30 dias contínuos a partir da data de referência
  const { chartData, total30Days, dailyAverage, peakDay, activeDaysCount } = useMemo(() => {
    const expenseTxs = transactions.filter((t) => t.type === 'expense');

    // Determinar data âncora: se houver transações futuras ou passadas, alinhar à mais recente
    const txTimestamps = expenseTxs
      .map((t) => new Date(t.occurredAt).getTime())
      .filter((ts) => !isNaN(ts));

    const anchorDate =
      txTimestamps.length > 0
        ? new Date(Math.max(Date.now(), Math.max(...txTimestamps)))
        : new Date();

    // Mapear gastos por string 'YYYY-MM-DD'
    const dailyMap: Record<
      string,
      { amount: number; count: number; categories: Record<string, number> }
    > = {};

    expenseTxs.forEach((tx) => {
      const dateKey = tx.occurredAt.slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { amount: 0, count: 0, categories: {} };
      }
      dailyMap[dateKey].amount += tx.amount;
      dailyMap[dateKey].count += 1;
      dailyMap[dateKey].categories[tx.category] =
        (dailyMap[dateKey].categories[tx.category] || 0) + tx.amount;
    });

    // Gerar 30 dias contínuos em ordem cronológica
    const points: DailySpendingPoint[] = [];
    let runningTotal = 0;

    for (let i = 29; i >= 0; i--) {
      const d = new Date(anchorDate);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);

      const dayData = dailyMap[dateKey] || { amount: 0, count: 0, categories: {} };
      runningTotal += dayData.amount;

      // Categoria predominante do dia
      let topCategory: string | undefined = undefined;
      let maxCatAmount = 0;
      Object.entries(dayData.categories).forEach(([cat, val]) => {
        if (val > maxCatAmount) {
          maxCatAmount = val;
          topCategory = cat;
        }
      });

      const dayNum = d.getDate().toString().padStart(2, '0');
      const monthNames = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
      ];
      const monthShort = monthNames[d.getMonth()];

      points.push({
        date: `${dayNum} ${monthShort}`,
        fullDate: dateKey,
        dayLabel: `${dayNum}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
        amount: Math.round(dayData.amount * 100) / 100,
        count: dayData.count,
        topCategory,
      });
    }

    const total = points.reduce((acc, p) => acc + p.amount, 0);
    const avg = total / 30;

    let peak: DailySpendingPoint = points[0];
    let activeDays = 0;

    points.forEach((p) => {
      if (p.amount > peak.amount) {
        peak = p;
      }
      if (p.amount > 0) {
        activeDays += 1;
      }
    });

    return {
      chartData: points,
      total30Days: total,
      dailyAverage: avg,
      peakDay: peak,
      activeDaysCount: activeDays,
    };
  }, [transactions]);

  // Se o usuário alternar para acumulado
  const displayData = useMemo(() => {
    if (activeMetric === 'daily') return chartData;
    let acc = 0;
    return chartData.map((pt) => {
      acc += pt.amount;
      return {
        ...pt,
        amount: Math.round(acc * 100) / 100,
      };
    });
  }, [chartData, activeMetric]);

  return (
    <div
      id="daily-spending-chart-card"
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors"
    >
      {/* Top Header do Gráfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Últimos 30 Dias
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--line)]">
              {activeDaysCount} dias com movimentações
            </span>
          </div>
          <h3 className="font-serif-display text-lg sm:text-xl font-bold text-[var(--text)] mt-1">
            Tendência de Gastos Diários
          </h3>
          <p className="text-xs text-[var(--text-dim)]">
            Acompanhe o ritmo diário de saídas para calibrar seus hábitos e metas financeiras
          </p>
        </div>

        {/* Toggle de Visualização: Diário vs Acumulado */}
        <div className="flex items-center self-start sm:self-auto bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--line)]">
          <button
            id="btn-metric-daily"
            type="button"
            onClick={() => setActiveMetric('daily')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeMetric === 'daily'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Diário
          </button>
          <button
            id="btn-metric-cumulative"
            type="button"
            onClick={() => setActiveMetric('cumulative')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeMetric === 'cumulative'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Acumulado
          </button>
        </div>
      </div>

      {/* Grid de Métricas Resumidas dos 30 Dias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
          <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between">
            <span>Total Gasto (30D)</span>
            <TrendingDown className="w-3.5 h-3.5 text-[var(--danger)]" />
          </div>
          <div className="font-serif-display text-base sm:text-lg font-bold text-[var(--text)] mt-0.5">
            {formatCurrency(total30Days, country)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
          <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between">
            <span>Média Diária</span>
            <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="font-serif-display text-base sm:text-lg font-bold text-[var(--accent)] mt-0.5">
            {formatCurrency(dailyAverage, country)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
          <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between">
            <span>Pico em 1 Dia</span>
            <AlertCircle className="w-3.5 h-3.5 text-[var(--warn)]" />
          </div>
          <div className="font-serif-display text-base sm:text-lg font-bold text-[var(--text)] mt-0.5">
            {formatCurrency(peakDay.amount, country)}
          </div>
          <div className="text-[10px] text-[var(--text-dim)] mt-0.5 truncate">
            {peakDay.date} {peakDay.topCategory ? `• ${peakDay.topCategory}` : ''}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
          <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between">
            <span>Dias Sem Gastos</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[var(--positive)]" />
          </div>
          <div className="font-serif-display text-base sm:text-lg font-bold text-[var(--positive)] mt-0.5">
            {30 - activeDaysCount} dias
          </div>
          <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
            {Math.round(((30 - activeDaysCount) / 30) * 100)}% do período livre
          </div>
        </div>
      </div>

      {/* Recharts Line Chart Container */}
      <div id="daily-spending-recharts" className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#B5642B" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#B5642B" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="var(--line)"
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.6}
            />

            <XAxis
              dataKey="dayLabel"
              stroke="var(--text-dim)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              interval={4}
              dy={6}
            />

            <YAxis
              stroke="var(--text-dim)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) => {
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                return `${val}`;
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as DailySpendingPoint;
                return (
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-md text-xs space-y-1">
                    <div className="font-semibold text-[var(--text)] flex items-center justify-between gap-4">
                      <span>{data.date}</span>
                      <span className="text-[var(--text-dim)] font-normal text-[10px]">
                        {data.fullDate}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[var(--accent)] font-serif-display">
                      {formatCurrency(data.amount, country)}
                    </div>
                    {activeMetric === 'daily' && (
                      <div className="text-[11px] text-[var(--text-dim)] pt-1 border-t border-[var(--line)] flex items-center justify-between gap-3">
                        <span>Lançamentos: {data.count}</span>
                        {data.topCategory && (
                          <span className="text-[var(--accent)] font-medium">
                            {data.topCategory}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Linha de Referência da Média Diária (apenas no modo diário) */}
            {activeMetric === 'daily' && dailyAverage > 0 && (
              <ReferenceLine
                y={dailyAverage}
                stroke="#E0975A"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Média: ${formatCurrency(dailyAverage, country)}`,
                  fill: 'var(--text-dim)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="amount"
              stroke="#B5642B"
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                // Exibir ponto com destaque nos dias com gasto real
                if (payload.amount <= 0 && activeMetric === 'daily') return null;
                const isPeak = payload.fullDate === peakDay.fullDate && activeMetric === 'daily';
                return (
                  <circle
                    key={`dot-${payload.fullDate}`}
                    cx={cx}
                    cy={cy}
                    r={isPeak ? 5 : 3}
                    fill={isPeak ? '#B5642B' : '#E0975A'}
                    stroke="var(--surface)"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: '#B5642B',
                stroke: 'var(--surface)',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
