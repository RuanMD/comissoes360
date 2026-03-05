import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChevronDown, Calendar, BarChart3, TrendingUp, DollarSign, MousePointerClick, ShoppingCart, Percent, Check } from 'lucide-react';
import { format, subDays, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyPerformanceChartProps {
    data: any[];
}

type MetricKey = 'investment' | 'profit' | 'commission' | 'shopeeClicks' | 'orders' | 'cpc';

interface MetricConfig {
    label: string;
    color: string;
    icon: any;
    suffix?: string;
    prefix?: string;
}

const METRICS: Record<MetricKey, MetricConfig> = {
    profit: { label: 'Lucro', color: '#22c55e', icon: TrendingUp, prefix: 'R$ ' },
    investment: { label: 'Investimento', color: '#f97316', icon: DollarSign, prefix: 'R$ ' },
    commission: { label: 'Comissões', color: '#f2a20d', icon: Percent, prefix: 'R$ ' },
    shopeeClicks: { label: 'Cliques', color: '#3b82f6', icon: MousePointerClick },
    orders: { label: 'Pedidos', color: '#a855f7', icon: ShoppingCart },
    cpc: { label: 'CPC Médio', color: '#ec4899', icon: BarChart3, prefix: 'R$ ' },
};

export function DailyPerformanceChart({ data }: DailyPerformanceChartProps) {
    const [days, setDays] = useState<15 | 30 | 60>(30);
    const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(['profit', 'investment']);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const filteredData = useMemo(() => {
        const now = new Date();
        const start = subDays(now, days);
        const end = now;

        return data.filter(item => {
            if (item.date === 'N/A') return false;
            try {
                const date = parseISO(item.date);
                return isWithinInterval(date, { start, end });
            } catch {
                return false;
            }
        }).map(item => ({
            ...item,
            formattedDate: format(parseISO(item.date), 'dd/MM', { locale: ptBR })
        }));
    }, [data, days]);

    const formatValue = (val: number, metric: MetricKey) => {
        const config = METRICS[metric];
        let formatted = val.toLocaleString('pt-BR', { minimumFractionDigits: config.prefix ? 2 : 0, maximumFractionDigits: 2 });
        return `${config.prefix || ''}${formatted}${config.suffix || ''}`;
    };

    const toggleMetric = (key: MetricKey) => {
        setActiveMetrics(prev => {
            if (prev.includes(key)) {
                if (prev.length === 1) return prev;
                return prev.filter(k => k !== key);
            }
            return [...prev, key];
        });
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const date = payload[0].payload.date;
            const fullDate = format(parseISO(date), "dd 'de' MMMM", { locale: ptBR });
            return (
                <div className="bg-surface-dark border border-border-dark p-3 rounded-xl shadow-2xl min-w-[200px]">
                    <p className="text-text-secondary text-[10px] mb-2 uppercase font-bold tracking-wider border-b border-border-dark pb-2">{fullDate}</p>
                    <div className="space-y-2">
                        {payload.map((entry: any, idx: number) => {
                            const key = entry.dataKey as MetricKey;
                            const config = METRICS[key];
                            return (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || config.color }} />
                                        <span className="text-text-secondary text-xs">{config.label}</span>
                                    </div>
                                    <span className="text-white text-xs font-bold">
                                        {formatValue(entry.value, key)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Calculate dynamic bar size based on period and number of metrics
    const barSize = useMemo(() => {
        const maxTotalWidth = filteredData.length > 30 ? 12 : 24;
        return Math.max(4, maxTotalWidth / activeMetrics.length);
    }, [filteredData.length, activeMetrics.length]);

    return (
        <div className="flex flex-col p-4 sm:p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Desempenho Diário
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary">Comparação visual lado a lado</p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Multi Metric Select */}
                    <div className="relative flex-1 sm:flex-initial">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="w-full sm:min-w-[200px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-highlight border border-border-dark text-sm font-medium text-white hover:border-primary/50 transition-all font-outfit"
                        >
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                <span className="truncate">
                                    {activeMetrics.length === 1
                                        ? METRICS[activeMetrics[0]].label
                                        : `${activeMetrics.length} Métricas`}
                                </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                                <div className="absolute top-full right-0 mt-2 w-[240px] bg-surface-dark border border-border-dark rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-1">
                                    {(Object.keys(METRICS) as MetricKey[]).map((key) => {
                                        const config = METRICS[key];
                                        const isSelected = activeMetrics.includes(key);
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleMetric(key)}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-surface-highlight ${isSelected ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: config.color }}
                                                    />
                                                    <span className={`font-medium ${isSelected ? 'text-primary' : 'text-text-secondary'}`}>
                                                        {config.label}
                                                    </span>
                                                </div>
                                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Days Filter */}
                    <div className="flex bg-surface-highlight border border-border-dark rounded-xl p-1">
                        {[15, 30, 60].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? 'bg-primary text-background-dark shadow-lg' : 'text-text-secondary hover:text-white'}`}
                            >
                                {d}D
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-[350px] sm:h-[450px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={filteredData}
                        margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                        barGap={0}
                        barCategoryGap="25%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#393328" vertical={false} opacity={0.3} />
                        <XAxis
                            dataKey="formattedDate"
                            stroke="#baaf9c"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            interval={days === 60 ? 5 : days === 30 ? 2 : 0}
                            dy={10}
                        />
                        <YAxis
                            stroke="#baaf9c"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                                if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
                                return val;
                            }}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255, 255, 255, 0.03)', radius: 8 }}
                            content={<CustomTooltip />}
                        />
                        {activeMetrics.map((key) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                fill={METRICS[key].color}
                                radius={[4, 4, 0, 0]}
                                barSize={barSize * 2} // Doubled the calculated relative size for more impact
                                fillOpacity={0.85}
                                className="hover:fill-opacity-100 transition-all duration-300"
                            >
                                {filteredData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={key === 'profit' && entry.profit < 0 ? '#ef4444' : METRICS[key].color}
                                    />
                                ))}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-8 flex flex-wrap gap-y-4 items-center border-t border-border-dark pt-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {activeMetrics.map(key => (
                        <div key={key} className="flex items-center gap-2 group cursor-default">
                            <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-125" style={{ backgroundColor: METRICS[key].color }} />
                            <span className="text-[11px] text-text-secondary font-medium tracking-wide group-hover:text-white transition-colors">{METRICS[key].label}</span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-[10px] text-text-secondary font-bold tracking-widest bg-surface-highlight/50 px-3 py-1.5 rounded-full border border-border-dark/50">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>{format(subDays(new Date(), days), 'dd MMM', { locale: ptBR })} — {format(new Date(), 'dd MMM', { locale: ptBR })}</span>
                </div>
            </div>
        </div>
    );
}
