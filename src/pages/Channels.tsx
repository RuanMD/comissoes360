import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Network, MousePointerClick, Activity, DollarSign } from 'lucide-react';

export function Channels() {
    const metrics = useMetrics();

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border border-border-dark shadow-2xl">
                    <Network className="w-7 h-7 sm:w-10 sm:h-10 text-primary/50" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios de Cliques e Comissões para visualizar esta análise.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Análise por Canal</h2>
                    <p className="text-text-secondary text-sm">Desempenho distribuído pelos referenciadores (Canais)</p>
                </div>
                <DateFilter />
            </header>

            {/* Overview KPIs specific to Channels context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Network className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Canais Engajados</p>
                        <p className="font-bold text-lg sm:text-xl">{metrics.channelsRanking.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <MousePointerClick className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total Cliques</p>
                        <p className="font-bold text-lg sm:text-xl">{metrics.totalClicks}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total Vendas</p>
                        <p className="font-bold text-lg sm:text-xl">{metrics.totalOrders}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Comissão Acumulada</p>
                        <p className="font-bold text-xl">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Channels Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-dark flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Ranking de Canais</h3>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Canal (Referenciador)</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Vendas</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Conversão</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Comissão Estimada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {metrics.channelsRanking.map((item, idx) => {
                                const conversion = item.clicks > 0 ? ((item.orders / item.clicks) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                                return (
                                    <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                        <td className="p-4 text-sm font-medium text-white max-w-[300px] truncate" title={item.channel}>
                                            <span className="text-primary font-mono text-xs p-1 bg-primary/10 border border-primary/20 rounded">
                                                {item.channel}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                        <td className="p-4 text-sm text-white text-right font-mono">{item.orders}</td>
                                        <td className="p-4 text-sm text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-1.5 bg-background-dark rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className={`h-full ${parseFloat(conversion) > 5 ? 'bg-green-500' : 'bg-primary'}`}
                                                        style={{ width: `${Math.min(parseFloat(conversion) * 5, 100)}%` }}>
                                                    </div>
                                                </div>
                                                <span className="font-mono">{conversion}%</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                            R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                )
                            })}

                            {metrics.channelsRanking.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-text-secondary">
                                        Nenhum dado encontrado para o período selecionado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
