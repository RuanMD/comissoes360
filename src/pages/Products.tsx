import { useState, useMemo, Fragment } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import {
    Package, DollarSign,
    ArrowUpDown, TrendingUp, MousePointerClick, ShoppingBag,
    ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { format } from 'date-fns';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { OrderFiltersPanel } from '../components/ui/OrderFiltersPanel';

export function Products() {
    const metrics = useMetrics();
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredRanking = useMemo(() => {
        let data = metrics.funnelByProduct || [];
        if (searchQuery) {
            const lowQuery = searchQuery.toLowerCase();
            data = data.filter(p => p.name.toLowerCase().includes(lowQuery));
        }
        return data;
    }, [metrics.funnelByProduct, searchQuery]);

    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredRanking;

        return [...filteredRanking].sort((a: any, b: any) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            const parseVal = (v: any) => {
                if (typeof v === 'string') {
                    const clean = v.replace(/[R$\s.%]/g, '').replace(',', '.');
                    const num = parseFloat(clean);
                    return isNaN(num) ? v.toLowerCase() : num;
                }
                return v;
            };

            const finalA = parseVal(valA);
            const finalB = parseVal(valB);

            if (finalA < finalB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (finalA > finalB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRanking, sortConfig]);

    // Detail orders for expanded product
    const expandedProductOrders = useMemo(() => {
        if (!expandedProduct) return [];
        return metrics.allOrders.filter(o => o.productName === expandedProduct);
    }, [metrics.allOrders, expandedProduct]);

    const filterState = useOrderFilters(expandedProductOrders);

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border border-border-dark shadow-2xl">
                    <Package className="w-7 h-7 sm:w-10 sm:h-10 text-primary/50" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios para visualizar o ranking de produtos.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Ranking de Performance por Produto</h2>
                    <p className="text-text-secondary text-sm">Visão consolidada de cliques, investimentos e conversão por item</p>
                </div>
                <DateFilter />
            </header>

            {/* Quick Status KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-primary/30">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Itens Únicos</p>
                        <p className="font-bold text-xl">{metrics.funnelByProduct.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-blue-500/30">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <MousePointerClick className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Cliques em Produto</p>
                        <p className="font-bold text-xl">{metrics.totalClicks.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-green-500/30">
                    <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                        <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Unidades Vendidas</p>
                        <p className="font-bold text-xl">{metrics.totalSalesCount.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-yellow-500/30">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Ganho Líquido</p>
                        <p className="font-bold text-xl">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Ranking Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 border-b border-border-dark flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background-dark/20">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Top Performance por Produto
                    </h3>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface-highlight border border-border-dark rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('name')}>
                                    <div className="flex items-center gap-1.5">Produto <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors pr-10" onClick={() => requestSort('clicks')}>
                                    <div className="flex items-center justify-end gap-1.5">Cliques <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('orders')}>
                                    <div className="flex items-center justify-end gap-1.5">Vendas <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('conversion')}>
                                    <div className="flex items-center justify-end gap-1.5">Conv. <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('investment')}>
                                    <div className="flex items-center justify-end gap-1.5">Invest. <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('commission')}>
                                    <div className="flex items-center justify-end gap-1.5">Comissão <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('roas')}>
                                    <div className="flex items-center justify-end gap-1.5">ROAS <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {sortedData.map((item, idx) => {
                                const isExpanded = expandedProduct === item.name;
                                return (
                                    <Fragment key={idx}>
                                        <tr
                                            onClick={() => setExpandedProduct(isExpanded ? null : item.name)}
                                            className={`hover: bg - background - dark / 30 transition - all cursor - pointer group ${isExpanded ? 'bg-background-dark/20' : ''} `}
                                        >
                                            <td className="p-4 text-sm font-medium text-white max-w-[300px] truncate">
                                                <div className="flex items-center gap-3">
                                                    {isExpanded
                                                        ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
                                                        : <ChevronDown className="w-4 h-4 text-text-secondary/50 flex-shrink-0 group-hover:text-primary transition-colors" />
                                                    }
                                                    <span className="truncate" title={item.name}>{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-text-secondary text-right font-mono pr-10">{item.clicks.toLocaleString('pt-BR')}</td>
                                            <td className="p-4 text-sm text-text-secondary text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                                            <td className="p-4 text-sm text-right font-mono text-white">{item.conversion}%</td>
                                            <td className="p-4 text-sm text-text-secondary text-right font-mono">
                                                R$ {item.investment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                                R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 text-sm text-right">
                                                <span className={`px - 2 py - 0.5 rounded - lg font - mono text - xs ${parseFloat(item.roas.replace(',', '.')) >= 2 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-surface-highlight text-text-secondary border border-border-dark'} `}>
                                                    {item.roas}
                                                </span>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="p-0">
                                                    <div className="bg-background-dark/60 border-t border-b border-primary/20 px-6 py-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="flex justify-between items-center">
                                                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                                <ShoppingBag className="w-4 h-4 text-primary" />
                                                                Histórico de Vendas: {item.name}
                                                            </h4>
                                                        </div>

                                                        <OrderFiltersPanel {...filterState} />

                                                        <div className="rounded-xl overflow-hidden border border-border-dark shadow-xl bg-surface-dark">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-left text-sm min-w-[800px]">
                                                                    <thead>
                                                                        <tr className="bg-background-dark font-bold text-[10px] text-text-secondary uppercase">
                                                                            <th className="px-5 py-3">Data</th>
                                                                            <th className="px-5 py-3 text-center">Status</th>
                                                                            <th className="px-5 py-3 text-right">Qtd</th>
                                                                            <th className="px-5 py-3 text-center">Canal</th>
                                                                            <th className="px-5 py-3 text-center">Sub ID</th>
                                                                            <th className="px-5 py-3 text-right">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark/50">
                                                                        {filterState.filteredOrders.map((order, i) => (
                                                                            <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                                                                                <td className="px-5 py-3 text-text-secondary text-xs font-mono">
                                                                                    {order.date !== '—' ? format(new Date(order.date), 'dd/MM HH:mm') : '—'}
                                                                                </td>
                                                                                <td className="px-5 py-3 text-center">
                                                                                    <span className={`px - 1.5 py - 0.5 rounded - full text - [9px] font - bold ${['Concluído', 'VALIDATED'].some(s => order.status?.includes(s)) ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'} `}>
                                                                                        {order.status}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-5 py-3 text-white text-right font-mono text-xs">{order.qty}</td>
                                                                                <td className="px-5 py-3 text-center">
                                                                                    <span className="text-[10px] text-text-secondary bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                                                        {order.channel}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-5 py-3 text-center font-mono text-[10px] text-text-secondary">
                                                                                    {order.subId || '—'}
                                                                                </td>
                                                                                <td className="px-5 py-3 text-primary font-bold text-right font-mono">
                                                                                    R$ {order.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-primary/5 border-t-2 border-primary/30 font-bold">
                                <td className="p-4 text-sm text-white">Totais do Ranking</td>
                                <td className="p-4 text-sm text-white text-right font-mono pr-10">{metrics.totalClicks.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.totalSalesCount.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.conversionRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                                <td className="p-4 text-sm text-white text-right font-mono">R$ {metrics.totalInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-4 text-sm text-primary text-right font-mono">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.roas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
