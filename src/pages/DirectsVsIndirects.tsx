import { useState, useMemo } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Zap, ShieldCheck, ArrowUpDown, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export function DirectsVsIndirects() {
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
        const data = metrics.funnelByDirectVsIndirect || [];
        if (!sortConfig) return data;

        return [...data].sort((a: any, b: any) => {
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
    }, [metrics.funnelByDirectVsIndirect, sortConfig]);

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border border-border-dark shadow-2xl">
                    <ShieldCheck className="w-7 h-7 sm:w-10 sm:h-10 text-primary/50" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe um relatório de Comissões para visualizar esta análise.</p>
            </div>
        );
    }

    const COLORS = ['#f2a20d', '#3b82f6'];
    const chartData = metrics.directsVsIndirects;

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Diretas vs Indiretas</h2>
                    <p className="text-text-secondary text-sm">Distribuição de vendas diretas x carrinho cruzado (cross-selling)</p>
                </div>
                <DateFilter />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visual Chart */}
                <div className="flex flex-col p-4 sm:p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0 min-h-[300px] sm:min-h-[400px]">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-2">Comportamento do Comprador</h3>
                    <p className="text-xs sm:text-sm text-text-secondary mb-4 sm:mb-6">Muitas compras de afiliados provêm de itens que o usuário não clicou originalmente, sendo atribuídas pela janela de 7 dias de cookies.</p>

                    <div className="flex-1 flex items-center justify-center w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#181611', border: '1px solid #393328', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="bg-gradient-to-br from-primary/20 to-surface-dark border border-primary/30 rounded-2xl p-6 relative overflow-hidden group">
                        <Zap className="text-primary w-8 h-8 mb-4 border border-primary/20 rounded-lg p-1" />
                        <h4 className="text-xl font-bold text-white mb-2">Impacto do Cross-Sell</h4>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Historicamente, mais de 60% das vendas de afiliados na Shopee originam-se de produtos nos quais o cliente não clicou diretamente na sua campanha. Identificar corretamente os nichos de Cross-Selling ajudará na seleção de futuros canais de divulgação.
                        </p>
                    </div>
                    {chartData.map((item, idx) => (
                        <div key={idx} className="bg-surface-dark border border-border-dark rounded-2xl p-6 group hover:border-border-hover transition-colors shadow-xl">
                            <h4 className="text-lg font-medium text-white mb-2">{item.name}</h4>
                            <p className="text-3xl font-bold font-mono" style={{ color: COLORS[idx % COLORS.length] }}>
                                {item.value.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-text-secondary mt-1 overflow-hidden text-ellipsis">
                                {item.name === 'Diretas' ? 'Pedidos do link promovido' : 'Pedidos via carrinho cruzado'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Breakdown Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 border-b border-border-dark bg-background-dark/20 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-white">Ranking por Tipo de Venda</h3>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('type')}>
                                    <div className="flex items-center gap-1.5">Tipo <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('clicks')}>
                                    <div className="flex items-center justify-end gap-1.5">Cliques <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('orders')}>
                                    <div className="flex items-center justify-end gap-1.5">Vendas <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('conversion')}>
                                    <div className="flex items-center justify-end gap-1.5">Conv. <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('revenue')}>
                                    <div className="flex items-center justify-end gap-1.5">Venda Total <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('commission')}>
                                    <div className="flex items-center justify-end gap-1.5">Comissão <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {sortedData.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                    <td className="p-4 text-sm font-medium text-white">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.type === 'Direta' ? '#f2a20d' : '#3b82f6' }}></div>
                                            {item.type}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-text-secondary text-right font-mono">{item.clicks.toLocaleString('pt-BR')}</td>
                                    <td className="p-4 text-sm text-text-secondary text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                                    <td className="p-4 text-sm text-white text-right font-mono">{item.conversion}%</td>
                                    <td className="p-4 text-sm text-text-secondary text-right font-mono">R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-4 text-sm text-primary font-bold text-right font-mono">R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-primary/5 border-t-2 border-primary/30 font-bold">
                                <td className="p-4 text-sm text-white">Totais</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.totalClicks.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.totalOrders.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono">{metrics.conversionRate}%</td>
                                <td className="p-4 text-sm text-white text-right font-mono">R$ {metrics.totalOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-4 text-sm text-primary text-right font-mono">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
