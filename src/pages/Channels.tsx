import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { MousePointerClick, DollarSign, ArrowUpDown, Share2, TrendingUp, Filter } from 'lucide-react';
import { useState, useMemo } from 'react';

export function Channels() {
    const metrics = useMetrics();
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        const data = metrics.funnelByChannel || [];
        if (!sortConfig) return data;

        return [...data].sort((a: any, b: any) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Handle string numbers like "1.234" or "10,50%"
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
    }, [metrics.funnelByChannel, sortConfig]);

    if (metrics.isEmpty) {
        return (
            <div className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Análise por Canal
                    </h1>
                    <DateFilter />
                </div>
                <div className="bg-background-dark/40 border border-white/5 rounded-2xl p-8 sm:p-12 text-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                        <Filter className="text-primary w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Nenhum dado encontrado</h3>
                    <p className="text-text-secondary">Selecione outro período ou importe seus dados.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 pb-32">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Análise por Canal
                    </h1>
                    <p className="text-text-secondary text-sm mt-1">Desempenho distribuído pelos referenciadores (Canais)</p>
                </div>
                <DateFilter />
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl transition-all hover:border-primary/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                            <Share2 className="text-primary w-5 h-5" />
                        </div>
                        <span className="text-text-secondary text-sm font-medium">Canais Engajados</span>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">{metrics.funnelByChannel.length}</div>
                </div>

                <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl transition-all hover:border-blue-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <MousePointerClick className="text-blue-500 w-5 h-5" />
                        </div>
                        <span className="text-text-secondary text-sm font-medium">Total Cliques</span>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">{metrics.totalClicks.toLocaleString('pt-BR')}</div>
                </div>

                <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl transition-all hover:border-green-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                            <TrendingUp className="text-green-500 w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Total Vendas</p>
                            <p className="font-bold text-xl">{metrics.totalSalesCount.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl transition-all hover:border-yellow-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <DollarSign className="text-yellow-500 w-5 h-5" />
                        </div>
                        <span className="text-text-secondary text-sm font-medium">Comissão Acumulada</span>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden mb-8 shadow-2xl">
                <div className="p-6 border-b border-border-dark bg-background-dark/20">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Ranking de Canais
                    </h2>
                </div>
                <div className="overflow-x-auto min-w-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('name')}>
                                    <div className="flex items-center gap-1.5">Canal <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors pr-10" onClick={() => requestSort('clicks')}>
                                    <div className="flex items-center justify-end gap-1.5">Cliques <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('orders')}>
                                    <div className="flex items-center justify-end gap-1.5">Vendas <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('conversion')}>
                                    <div className="flex items-center justify-end gap-1.5">Conversão <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('commission')}>
                                    <div className="flex items-center justify-end gap-1.5">Comissão <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {sortedData.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-background-dark/30 transition-colors group">
                                    <td className="p-4 text-sm font-medium text-white min-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
                                            {item.channel}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-text-secondary text-right font-mono pr-10">{item.clicks.toLocaleString('pt-BR')}</td>
                                    <td className="p-4 text-sm text-text-secondary text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                                    <td className="p-4 text-sm text-right">
                                        <div className="flex items-center justify-end gap-2.5">
                                            <div className="w-12 h-1.5 bg-background-dark rounded-full overflow-hidden hidden sm:block">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${Math.min(parseFloat(item.conversion.replace(',', '.')) * 10, 100)}%` }}>
                                                </div>
                                            </div>
                                            <span className="font-mono text-white text-xs whitespace-nowrap">{item.conversion}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                        R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-primary/5 border-t-2 border-primary/30 font-bold">
                                <td className="p-4 text-sm text-white">Totais do Ranking</td>
                                <td className="p-4 text-sm text-white text-right font-mono pr-10">{metrics.totalClicks.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.totalSalesCount.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.conversionRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                                <td className="p-4 text-sm text-primary text-right font-mono">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
