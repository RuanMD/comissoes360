import { useState } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Hash, DollarSign, MousePointerClick, Activity, Package, Eye, EyeOff, ChevronDown, ChevronUp, ShoppingBag, Radio, FileText } from 'lucide-react';

export function SubIdAnalysis() {
    const metrics = useMetrics();
    const [hideNames, setHideNames] = useState(false);
    const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'products' | 'channels' | 'orders'>('products');

    const toggleExpand = (subId: string) => {
        if (expandedSubId === subId) {
            setExpandedSubId(null);
        } else {
            setExpandedSubId(subId);
            setDetailTab('products');
        }
    };

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-6 border border-border-dark shadow-2xl">
                    <Hash className="w-10 h-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios de Cliques e Comissões para visualizar esta análise.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Análise por Sub_ID</h2>
                    <p className="text-text-secondary text-sm">Cruzamento de Cliques e Comissões</p>
                </div>
                <DateFilter />
            </header>

            {/* Overview KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Sub IDs Únicos</p>
                        <p className="font-bold text-xl">{metrics.subIdRanking.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <MousePointerClick className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total Cliques</p>
                        <p className="font-bold text-xl">{metrics.totalClicks}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#a855f7]/10 flex items-center justify-center text-[#a855f7]">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Vendas Totais</p>
                        <p className="font-bold text-xl">{metrics.totalOrders}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Conversão Média</p>
                        <p className="font-bold text-xl">{metrics.conversionRate}%</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Comissão Média/Venda</p>
                        <p className="font-bold text-xl">R$ {metrics.totalOrders > 0 ? (metrics.totalNetCommission / metrics.totalOrders).toFixed(2) : '0.00'}</p>
                    </div>
                </div>
            </div>

            {/* Sub ID Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-dark flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Ranking de Performance</h3>
                    <button
                        onClick={() => setHideNames(prev => !prev)}
                        title={hideNames ? 'Mostrar Sub IDs' : 'Ocultar Sub IDs'}
                        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${hideNames
                                ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                                : 'bg-surface-highlight text-text-secondary border-border-dark hover:text-white'
                            }`}
                    >
                        {hideNames ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {hideNames ? 'Sub IDs ocultos' : 'Ocultar Sub IDs'}
                    </button>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Sub ID</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Canais Relacionados</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Vendas</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Conversão</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Comissão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {metrics.subIdRanking.map((item, idx) => {
                                const isExpanded = expandedSubId === item.subId;
                                const details = metrics.subIdDetails[item.subId];

                                return (
                                    <>
                                        <tr
                                            key={idx}
                                            onClick={() => toggleExpand(item.subId)}
                                            className={`hover:bg-background-dark/30 transition-colors cursor-pointer ${isExpanded ? 'bg-background-dark/20' : ''}`}
                                        >
                                            <td className="p-4 text-sm font-medium text-white max-w-[200px] truncate" title={hideNames ? `Sub ID #${idx + 1}` : item.subId}>
                                                <div className="flex items-center gap-2">
                                                    {isExpanded
                                                        ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
                                                        : <ChevronDown className="w-4 h-4 text-text-secondary/50 flex-shrink-0" />
                                                    }
                                                    {hideNames ? (
                                                        <span className="px-2 py-1 bg-surface-highlight text-text-secondary border border-border-dark rounded font-mono text-xs">
                                                            Sub ID #{idx + 1}
                                                        </span>
                                                    ) : item.subId === 'Sem Sub_id' ? (
                                                        <span className="text-text-secondary italic">{item.subId}</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded font-mono text-xs">
                                                            {item.subId}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-text-secondary max-w-[200px] truncate" title={item.channels}>
                                                {item.channels}
                                            </td>
                                            <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                            <td className="p-4 text-sm text-white text-right font-mono">{item.orders}</td>
                                            <td className="p-4 text-sm text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 bg-background-dark rounded-full overflow-hidden hidden sm:block">
                                                        <div
                                                            className={`h-full ${parseFloat(item.conversion) > 5 ? 'bg-green-500' : 'bg-primary'}`}
                                                            style={{ width: `${Math.min(parseFloat(item.conversion) * 5, 100)}%` }}>
                                                        </div>
                                                    </div>
                                                    <span className="font-mono">{item.conversion}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                                R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        {/* Expanded Detail Row */}
                                        {isExpanded && details && (
                                            <tr key={`${idx}-detail`}>
                                                <td colSpan={6} className="p-0">
                                                    <div className="bg-background-dark/60 border-t border-b border-primary/20 px-6 py-5">
                                                        {/* Detail Tabs */}
                                                        <div className="flex gap-2 mb-4">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('products'); }}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === 'products' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <ShoppingBag className="w-3.5 h-3.5" />
                                                                Produtos ({details.products.length})
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('channels'); }}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === 'channels' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <Radio className="w-3.5 h-3.5" />
                                                                Canais ({details.channelBreakdown.length})
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('orders'); }}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === 'orders' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                                Pedidos ({details.orders.length})
                                                            </button>
                                                        </div>

                                                        {/* Products Tab */}
                                                        {detailTab === 'products' && (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <table className="w-full text-left">
                                                                    <thead>
                                                                        <tr className="bg-surface-dark/50">
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Produto</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right">Pedidos</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark">
                                                                        {details.products.map((p, i) => (
                                                                            <tr key={i} className="hover:bg-surface-dark/30">
                                                                                <td className="px-4 py-2.5 text-sm text-white max-w-[300px] truncate" title={p.name}>{p.name}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{p.count}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-primary font-bold text-right font-mono">
                                                                                    R$ {p.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {details.products.length === 0 && (
                                                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-text-secondary text-sm">Nenhum produto encontrado.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {/* Channels Tab */}
                                                        {detailTab === 'channels' && (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <table className="w-full text-left border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-surface-dark/50">
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary whitespace-nowrap">Canal</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">Cliques</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">% Cliques</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">Vendas</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark">
                                                                        {details.channelBreakdown.map((ch, i) => {
                                                                            const totalChannelClicks = details.channelBreakdown.reduce((s, c) => s + c.clicks, 0);
                                                                            const pct = totalChannelClicks > 0 ? ((ch.clicks / totalChannelClicks) * 100).toFixed(1) : '0.0';
                                                                            return (
                                                                                <tr key={i} className="hover:bg-surface-dark/30">
                                                                                    <td className="px-4 py-2.5 text-sm text-white">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                                                                            <span className="truncate max-w-[150px]" title={ch.channel}>{ch.channel}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{ch.clicks}</td>
                                                                                    <td className="px-4 py-2.5 text-sm text-right">
                                                                                        <div className="flex items-center justify-end gap-2">
                                                                                            <span className="font-mono text-text-secondary">{pct}%</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{ch.orders}</td>
                                                                                    <td className="px-4 py-2.5 text-sm text-primary font-bold text-right font-mono">
                                                                                        R$ {ch.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        {details.channelBreakdown.length === 0 && (
                                                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary text-sm">Nenhum canal encontrado.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {/* Orders Tab */}
                                                        {detailTab === 'orders' && (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <table className="w-full text-left">
                                                                    <thead>
                                                                        <tr className="bg-surface-dark/50">
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">ID Pedido</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Produto</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Status</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Data</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark">
                                                                        {details.orders.slice(0, 20).map((order, i) => (
                                                                            <tr key={i} className="hover:bg-surface-dark/30">
                                                                                <td className="px-4 py-2.5 text-xs text-text-secondary font-mono">{order.orderId}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-white max-w-[200px] truncate" title={order.product}>{order.product}</td>
                                                                                <td className="px-4 py-2.5">
                                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.status.toLowerCase() === 'concluído' ? 'bg-green-500/10 text-green-400' :
                                                                                            order.status.toLowerCase() === 'cancelado' ? 'bg-red-500/10 text-red-400' :
                                                                                                'bg-yellow-500/10 text-yellow-400'
                                                                                        }`}>
                                                                                        {order.status}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-xs text-text-secondary">{order.date}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-primary font-bold text-right font-mono">
                                                                                    R$ {order.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {details.orders.length > 20 && (
                                                                            <tr><td colSpan={5} className="px-4 py-3 text-center text-text-secondary text-xs">Mostrando 20 de {details.orders.length} pedidos</td></tr>
                                                                        )}
                                                                        {details.orders.length === 0 && (
                                                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary text-sm">Nenhum pedido encontrado.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}

                            {metrics.subIdRanking.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-secondary">
                                        Nenhum dado encontrado para o período selecionado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {metrics.subIdRanking.length > 0 && (
                            <tfoot>
                                <tr className="bg-primary/5 border-t-2 border-primary/30">
                                    <td className="p-4 text-sm font-bold text-white" colSpan={2}>Total</td>
                                    <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                        {metrics.subIdRanking.reduce((sum, item) => sum + item.clicks, 0)}
                                    </td>
                                    <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                        {metrics.subIdRanking.reduce((sum, item) => sum + item.orders, 0)}
                                    </td>
                                    <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                        {metrics.conversionRate}%
                                    </td>
                                    <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                        R$ {metrics.subIdRanking.reduce((sum, item) => sum + item.commission, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
