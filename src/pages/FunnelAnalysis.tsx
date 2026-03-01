import { useState } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Filter, MousePointerClick, ShoppingBag, DollarSign, TrendingDown } from 'lucide-react';

export function FunnelAnalysis() {
    const metrics = useMetrics();
    const [activeTab, setActiveTab] = useState<'subid' | 'channel'>('subid');

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-6 border border-border-dark shadow-2xl">
                    <Filter className="w-10 h-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios de Cliques e Comissões para visualizar o funil completo.</p>
            </div>
        );
    }


    const funnelSteps = [
        { label: 'Cliques Totais', value: metrics.totalClicks, color: '#3b82f6' },
        { label: 'Pedidos Gerados', value: metrics.totalOrders, color: '#f2a20d' },
    ];
    const maxFunnelValue = Math.max(...funnelSteps.map(s => s.value), 1);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Funil Completo</h2>
                    <p className="text-text-secondary text-sm">Visualização do fluxo de tráfego e vendas</p>
                </div>
                <DateFilter />
            </header>

            {/* Funnel Visual */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-5">Visualização do Funil</h3>
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
                    {/* Commission total as final step */}
                    <div className="flex items-center gap-4 mt-2 pt-3 border-t border-border-dark">
                        <div className="w-40 text-sm text-primary font-medium shrink-0">Comissão Acumulada</div>
                        <div className="text-2xl font-bold text-primary">
                            R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col p-5 rounded-2xl bg-surface-dark border border-border-dark">
                    <div className="flex items-center gap-2 mb-2">
                        <MousePointerClick className="w-4 h-4 text-[#3b82f6]" />
                        <p className="text-text-secondary text-sm font-medium">Cliques</p>
                    </div>
                    <p className="text-white text-3xl font-bold tracking-tight">{metrics.totalClicks}</p>
                </div>

                <div className="flex flex-col p-5 rounded-2xl bg-surface-dark border border-border-dark">
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                        <p className="text-text-secondary text-sm font-medium">Pedidos</p>
                    </div>
                    <p className="text-white text-3xl font-bold tracking-tight">{metrics.totalOrders}</p>
                </div>

                <div className="flex flex-col p-5 rounded-2xl bg-surface-dark border border-border-dark">
                    <div className="flex items-center gap-2 mb-2">
                        <Filter className="w-4 h-4 text-[#22c55e]" />
                        <p className="text-text-secondary text-sm font-medium">Conversão</p>
                    </div>
                    <p className="text-white text-3xl font-bold tracking-tight">{metrics.conversionRate}%</p>
                </div>

                <div className="flex flex-col p-5 rounded-2xl bg-surface-dark border border-border-dark">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-[#22c55e]" />
                        <p className="text-text-secondary text-sm font-medium">EPC</p>
                    </div>
                    <p className="text-white text-3xl font-bold tracking-tight">R$ {metrics.epc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-text-secondary text-xs mt-1">Ganho por clique</p>
                </div>
            </div>

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
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Sub_ID</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Pedidos</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Conversão</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Receita</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Comissão</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">EPC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {metrics.funnelBySubId.map((item, idx) => (
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
                                            R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-[#22c55e] text-right font-mono">
                                            R$ {item.epc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {metrics.funnelBySubId.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-text-secondary">Nenhum dado encontrado.</td></tr>
                                )}
                            </tbody>
                            {metrics.funnelBySubId.length > 0 && (
                                <tfoot>
                                    <tr className="bg-primary/5 border-t-2 border-primary/30">
                                        <td className="p-4 text-sm font-bold text-white">Total</td>
                                        <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                            {metrics.funnelBySubId.reduce((s, i) => s + i.clicks, 0)}
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                            {metrics.funnelBySubId.reduce((s, i) => s + i.orders, 0)}
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono font-bold">{metrics.conversionRate}%</td>
                                        <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                            R$ {metrics.totalOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-[#22c55e] font-bold text-right font-mono">
                                            R$ {metrics.epc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* Funnel by Channel */}
            {activeTab === 'channel' && (
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-border-dark">
                        <h3 className="text-lg font-bold text-white">Funil por Canal</h3>
                        <p className="text-text-secondary text-sm">Performance por fonte de tráfego</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background-dark/50 border-b border-border-dark">
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Canal</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Pedidos</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Conversão</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Receita</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Comissão</th>
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">EPC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {metrics.funnelByChannel.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                        <td className="p-4 text-sm text-white">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#3b82f6] flex-shrink-0" />
                                                {item.channel}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.orders}</td>
                                        <td className="p-4 text-sm text-right font-mono">{item.conversion}%</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">
                                            R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-[#22c55e] text-right font-mono">
                                            R$ {item.epc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {metrics.funnelByChannel.length === 0 && (
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
