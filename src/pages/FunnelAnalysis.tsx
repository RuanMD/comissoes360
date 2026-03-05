import { useState, useEffect } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import {
    Filter, MousePointerClick, DollarSign, TrendingDown, Clock,
    ArrowUpDown, ShoppingCart, CheckCircle2, XCircle, BarChart3, TrendingUp,
    PiggyBank, Percent, Target
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableKpiCard } from '../components/dashboard/SortableKpiCard';
import { DailyPerformanceChart } from '../components/dashboard/DailyPerformanceChart';

export function FunnelAnalysis() {
    const metrics = useMetrics();
    const [activeTab, setActiveTab] = useState<'subid' | 'channel' | 'category' | 'hour'>('subid');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedData = <T extends Record<string, any>>(data: T[]) => {
        if (!sortConfig) return data;
        const sortedData = [...data].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Specific parsing for formatted conversion percentages (e.g. "5,56%")
            if (typeof valA === 'string' && valA.includes('%')) {
                valA = parseFloat(valA.replace(',', '.').replace('%', ''));
                valB = parseFloat((valB as string).replace(',', '.').replace('%', ''));
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sortedData;
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const DEFAULT_GLOBAL_KPI_ORDER = [
        'profit', 'orders', 'completed', 'pending', 'cancelled', 'avgOrders',
        'commission', 'investment', 'profitPct', 'shopeeClicks', 'adClicks', 'cpc'
    ];

    const [globalKpiOrder, setGlobalKpiOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('shopee_analisar_global_kpi_order');
        return saved ? JSON.parse(saved) : DEFAULT_GLOBAL_KPI_ORDER;
    });

    useEffect(() => {
        localStorage.setItem('shopee_analisar_global_kpi_order', JSON.stringify(globalKpiOrder));
    }, [globalKpiOrder]);

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setGlobalKpiOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border border-border-dark shadow-2xl">
                    <Filter className="w-7 h-7 sm:w-10 sm:h-10 text-primary/50" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios de Cliques e Comissões para visualizar o funil completo.</p>
            </div>
        );
    }
    const formatPct = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const kpiDefinitions: Record<string, any> = {
        profit: { label: 'Lucro Total', value: `R$ ${formatBRL(metrics.totalProfit)}`, icon: DollarSign, color: metrics.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
        orders: { label: 'Pedidos Totais', value: metrics.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
        completed: { label: 'Pedidos Concluídos', value: `${metrics.funnelStats.completed} (R$ ${formatBRL(metrics.funnelStats.completedValue)})`, icon: CheckCircle2, color: 'text-green-400' },
        pending: { label: 'Pedidos Pendentes', value: `${metrics.funnelStats.pending} (R$ ${formatBRL(metrics.funnelStats.pendingValue)})`, icon: Clock, color: 'text-yellow-400' },
        cancelled: { label: 'Pedidos Cancelados', value: `${metrics.funnelStats.cancelled} (R$ ${formatBRL(metrics.funnelStats.cancelledValue)})`, icon: XCircle, color: 'text-red-400' },
        avgOrders: { label: 'Média Pedidos/Dia', value: metrics.avgOrdersPerDay.toFixed(1), icon: BarChart3, color: 'text-purple-400' },
        commission: { label: 'Total Comissões', value: `R$ ${formatBRL(metrics.totalNetCommission)}`, icon: TrendingUp, color: 'text-primary' },
        investment: { label: 'Total Investimento', value: `R$ ${formatBRL(metrics.totalInvestment)}`, icon: PiggyBank, color: 'text-orange-400' },
        profitPct: { label: 'Lucro Médio', value: `${formatPct(metrics.profitPct)}%`, icon: Percent, color: metrics.profitPct >= 0 ? 'text-green-400' : 'text-red-400' },
        shopeeClicks: { label: 'Cliques Shopee', value: metrics.totalClicks.toLocaleString('pt-BR'), icon: MousePointerClick, color: 'text-cyan-400' },
        adClicks: { label: 'Cliques Anúncio', value: metrics.totalAdClicks.toLocaleString('pt-BR'), icon: Target, color: 'text-pink-400' },
        cpc: { label: 'CPC Médio', value: `R$ ${formatBRL(metrics.cpc)}`, icon: MousePointerClick, color: 'text-amber-400' }
    };

    const funnelSteps = [
        { label: 'Cliques Anúncio', value: metrics.totalAdClicks || 0, color: '#6366f1' },
        { label: 'Cliques Shopee', value: metrics.totalClicks || 0, color: '#3b82f6' },
        { label: 'Pedidos Gerados', value: metrics.totalOrders || 0, color: '#f2a20d' },
    ];
    const maxFunnelValue = Math.max(...funnelSteps.map(s => s.value), 1);

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Funil Completo</h2>
                    <p className="text-text-secondary text-sm">Visualização do fluxo de tráfego e vendas</p>
                </div>
                <DateFilter />
            </header>

            {/* Funnel Visual */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-4 sm:p-6">
                <h3 className="text-sm sm:text-base font-bold text-white mb-4 sm:mb-5">Visualização do Funil</h3>
                <div className="flex flex-col gap-4">
                    {funnelSteps.map((step, idx) => {
                        const widthPct = Math.max((step.value / maxFunnelValue) * 100, 4);
                        const dropOff = idx > 0 && funnelSteps[idx - 1].value > 0
                            ? (((funnelSteps[idx - 1].value - step.value) / funnelSteps[idx - 1].value) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                            : null;
                        return (
                            <div key={step.label}>
                                {dropOff && (
                                    <div className="flex items-center gap-2 mb-1.5 ml-2">
                                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                        <span className="text-xs text-red-400">-{dropOff}% drop-off</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    <div className="w-40 text-sm text-text-secondary shrink-0">{step.label}</div>
                                    <div className="flex-1 h-10 bg-surface-highlight rounded-lg overflow-hidden relative">
                                        <div
                                            className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                                            style={{ width: `${widthPct}%`, backgroundColor: step.color }}
                                        >
                                            <span className="text-sm font-bold text-white drop-shadow">{step.value}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-center gap-4 mt-2 pt-3 border-t border-border-dark">
                        <div className="w-40 text-sm text-primary font-medium shrink-0">Comissão Acumulada</div>
                        <div className="flex flex-col">
                            <div className="text-2xl font-bold text-primary">
                                R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            {metrics.totalInvestment > 0 && (
                                <div className="text-xs text-text-secondary">
                                    ROAS: <span className={metrics.roas >= 1 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                        {metrics.roas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}x
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Performance Chart */}
            <DailyPerformanceChart data={(metrics as any).dailyPerformance || []} />

            {/* Sortable KPI Cards */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={globalKpiOrder} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {globalKpiOrder.map((id) => {
                            const kpi = kpiDefinitions[id];
                            if (!kpi) return null;
                            return <SortableKpiCard key={id} id={id} kpi={kpi} compact />;
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('subid')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'subid' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'}`}
                >
                    Funil por Sub_ID
                </button>
                <button
                    onClick={() => setActiveTab('channel')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'channel' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'}`}
                >
                    Funil por Canal
                </button>
                <button
                    onClick={() => setActiveTab('category')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'category' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'}`}
                >
                    Funil por Categoria
                </button>
                <button
                    onClick={() => setActiveTab('hour')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'hour' ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'}`}
                >
                    <Clock className="w-4 h-4" />
                    Funil por Horário
                </button>
            </div>

            {/* Funnel by Sub_ID */}
            {activeTab === 'subid' && (
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-border-dark">
                        <h3 className="text-lg font-bold text-white">Funil por Sub_ID</h3>
                        <p className="text-text-secondary text-sm">Performance completa de cada campanha</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background-dark/50 border-b border-border-dark">
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap cursor-pointer hover:text-white" onClick={() => requestSort('subId')}>
                                        <div className="flex items-center gap-1">Sub_ID <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('adClicks')}>
                                        <div className="flex items-center justify-end gap-1">Cliques Ads <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('clicks')}>
                                        <div className="flex items-center justify-end gap-1">Cliques Shopee <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('orders')}>
                                        <div className="flex items-center justify-end gap-1">Pedidos <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('conversion')}>
                                        <div className="flex items-center justify-end gap-1">Conversão <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('investment')}>
                                        <div className="flex items-center justify-end gap-1">Investimento <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('commission')}>
                                        <div className="flex items-center justify-end gap-1">Comissão <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('roas')}>
                                        <div className="flex items-center justify-end gap-1">ROAS <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {getSortedData(metrics.funnelBySubId).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                        <td className="p-4 text-sm text-white">
                                            {item.subId === 'Sem Sub_id' ? (
                                                <span className="text-text-secondary italic">{item.subId}</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded font-mono text-xs">
                                                    {item.subId}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{(item as any).adClicks || 0}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.orders}</td>
                                        <td className="p-4 text-sm text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-12 h-1.5 bg-background-dark rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className={`h-full ${parseFloat(item.conversion) > 5 ? 'bg-green-500' : 'bg-primary'}`}
                                                        style={{ width: `${Math.min(parseFloat(item.conversion) * 5, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono">{item.conversion}%</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono">
                                            R$ {(item as any).investment?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className={`p-4 text-sm text-right font-mono font-bold ${((item as any).investment > 0 ? item.commission / (item as any).investment : 0) >= 1 ? 'text-green-500' : 'text-red-400'}`}>
                                            {((item as any).investment > 0 ? item.commission / (item as any).investment : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x
                                        </td>
                                    </tr>
                                ))}
                                {metrics.funnelBySubId.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-text-secondary">Nenhum dado encontrado.</td></tr>
                                )}
                            </tbody>
                            {metrics.funnelBySubId.length > 0 && (() => {
                                const tAdClicks = metrics.funnelBySubId.reduce((s, i) => s + ((i as any).adClicks || 0), 0);
                                const tClicks = metrics.funnelBySubId.reduce((s, i) => s + i.clicks, 0);
                                const tOrders = metrics.funnelBySubId.reduce((s, i) => s + i.orders, 0);
                                const tInvest = metrics.funnelBySubId.reduce((s, i) => s + ((i as any).investment || 0), 0);
                                const tComm = metrics.funnelBySubId.reduce((s, i) => s + i.commission, 0);
                                const tConv = tClicks > 0 ? (tOrders / tClicks) * 100 : 0;
                                const tRoas = tInvest > 0 ? tComm / tInvest : 0;

                                return (
                                    <tfoot>
                                        <tr className="bg-primary/5 border-t-2 border-primary/30">
                                            <td className="p-4 text-sm font-bold text-white">Total</td>
                                            <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                                {tAdClicks}
                                            </td>
                                            <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                                {tClicks}
                                            </td>
                                            <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                                {tOrders}
                                            </td>
                                            <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                                {tConv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                                            </td>
                                            <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                                R$ {tInvest.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                                R$ {tComm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={`p-4 text-sm text-right font-mono font-bold ${tRoas >= 1 ? 'text-green-500' : 'text-red-400'}`}>
                                                {tRoas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x
                                            </td>
                                        </tr>
                                    </tfoot>
                                );
                            })()}
                        </table>
                    </div>
                </div>
            )}

            {/* Funnel by Channel — Enriched with Ads/Investment/ROAS */}
            {activeTab === 'channel' && (
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-border-dark">
                        <h3 className="text-lg font-bold text-white">Funil por Canal</h3>
                        <p className="text-text-secondary text-sm">Performance por fonte de tráfego com dados de investimento</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background-dark/50 border-b border-border-dark">
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap cursor-pointer hover:text-white" onClick={() => requestSort('channel')}>
                                        <div className="flex items-center gap-1">Canal <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('adClicks')}>
                                        <div className="flex items-center justify-end gap-1">Cliques Ads <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('clicks')}>
                                        <div className="flex items-center justify-end gap-1">Cliques Shopee <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('orders')}>
                                        <div className="flex items-center justify-end gap-1">Pedidos <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('conversion')}>
                                        <div className="flex items-center justify-end gap-1">Conversão <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('investment')}>
                                        <div className="flex items-center justify-end gap-1">Investimento <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('commission')}>
                                        <div className="flex items-center justify-end gap-1">Comissão <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('roas')}>
                                        <div className="flex items-center justify-end gap-1">ROAS <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {getSortedData(metrics.funnelByChannel).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                        <td className="p-4 text-sm text-white">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#3b82f6] flex-shrink-0" />
                                                {item.channel}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{(item as any).adClicks || 0}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.orders}</td>
                                        <td className="p-4 text-sm text-right font-mono">{item.conversion}%</td>
                                        <td className="p-4 text-sm text-red-400 text-right font-mono">
                                            R$ {((item as any).investment || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className={`p-4 text-sm text-right font-mono font-bold ${((item as any).roas || 0) >= 1 ? 'text-green-500' : ((item as any).investment > 0 ? 'text-red-400' : 'text-text-secondary')}`}>
                                            {((item as any).investment > 0 ? ((item as any).roas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x' : '—')}
                                        </td>
                                    </tr>
                                ))}
                                {metrics.funnelByChannel.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-text-secondary">Nenhum dado encontrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Funnel by Category */}
            {activeTab === 'category' && (
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-border-dark">
                        <h3 className="text-lg font-bold text-white">Funil por Categoria</h3>
                        <p className="text-text-secondary text-sm">Performance por categoria de produto</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background-dark/50 border-b border-border-dark">
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Categoria</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques Ads</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques Shopee</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Pedidos</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Conversão</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Receita</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Comissão</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Investimento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {(metrics as any).funnelByCategory.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                        <td className="p-4 text-sm text-white">{item.category}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.adClicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono font-bold">{item.orders}</td>
                                        <td className="p-4 text-sm text-right font-mono text-blue-400">{item.conversion}%</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">
                                            R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-red-400 text-right font-mono">
                                            R$ {item.investment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {(metrics as any).funnelByCategory.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-text-secondary">Nenhum dado encontrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Funnel by Hour */}
            {activeTab === 'hour' && (
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-border-dark">
                        <h3 className="text-lg font-bold text-white">Funil por Horário</h3>
                        <p className="text-text-secondary text-sm">Performance por hora do dia — descubra quando seu tráfego mais converte</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background-dark/50 border-b border-border-dark">
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap cursor-pointer hover:text-white" onClick={() => requestSort('hour')}>
                                        <div className="flex items-center gap-1">Horário <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('adClicks')}>
                                        <div className="flex items-center justify-end gap-1">Cliques Ads <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('clicks')}>
                                        <div className="flex items-center justify-end gap-1">Cliques Shopee <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('orders')}>
                                        <div className="flex items-center justify-end gap-1">Pedidos <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('conversion')}>
                                        <div className="flex items-center justify-end gap-1">Conversão <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('investment')}>
                                        <div className="flex items-center justify-end gap-1">Investimento <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right cursor-pointer hover:text-white" onClick={() => requestSort('commission')}>
                                        <div className="flex items-center justify-end gap-1">Comissão <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {getSortedData(metrics.funnelByHour).map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                        <td className="p-4 text-sm text-white">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-[#22c55e] flex-shrink-0" />
                                                <span className="font-mono font-bold">{item.hour}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.adClicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono font-bold">{item.orders}</td>
                                        <td className="p-4 text-sm text-right font-mono text-blue-400">{item.conversion}%</td>
                                        <td className="p-4 text-sm text-red-400 text-right font-mono">
                                            R$ {item.investment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {(!(metrics as any).funnelByHour || (metrics as any).funnelByHour.length === 0) && (
                                    <tr><td colSpan={7} className="p-8 text-center text-text-secondary">Nenhum dado encontrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}
