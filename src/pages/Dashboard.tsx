import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Upload, BarChart3, CheckCircle2, RefreshCw
} from 'lucide-react';
import { useData } from '../context/DataContext';

export function Dashboard() {
    const { commissionData, clickData, hasStartedAnalysis, setHasStartedAnalysis, handleFileUpload, clearData } = useData();
    const metrics = useMetrics();

    if (!hasStartedAnalysis) {
        return (
            <div className="flex flex-col items-center justify-center py-4 sm:py-12 px-3 sm:px-4 w-full max-w-4xl mx-auto md:mt-10">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-3 text-center text-white">Importe seus Relatórios</h2>
                <p className="text-text-secondary mb-5 sm:mb-10 text-center max-w-lg text-sm sm:text-base md:text-lg">
                    Para uma análise completa, faça o upload do relatório de comissões e do relatório de cliques da Shopee. Você também pode enviar apenas um deles.
                </p>

                <div className="flex flex-col md:flex-row gap-4 sm:gap-6 w-full mb-6 sm:mb-10">
                    <label className={`flex-1 bg-surface-dark border-2 border-dashed ${commissionData.length > 0 ? 'border-primary' : 'border-border-dark'} rounded-2xl p-5 sm:p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors group relative`}>
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />

                        {commissionData.length > 0 ? (
                            <>
                                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-primary/20 text-primary p-1 sm:p-1.5 rounded-full">
                                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-transform">
                                    <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-white">Comissões Carregadas</h3>
                                <p className="text-xs sm:text-sm text-primary font-medium">{commissionData.length} registros</p>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-surface-highlight text-text-secondary rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-white">Relatório de Comissões</h3>
                                <p className="text-xs sm:text-sm text-text-secondary text-center">Formato .csv (Afiliados)</p>
                            </>
                        )}
                    </label>

                    <label className={`flex-1 bg-surface-dark border-2 border-dashed ${clickData.length > 0 ? 'border-[#3b82f6]' : 'border-border-dark'} rounded-2xl p-5 sm:p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#3b82f6]/50 transition-colors group relative`}>
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />

                        {clickData.length > 0 ? (
                            <>
                                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-[#3b82f6]/20 text-[#3b82f6] p-1 sm:p-1.5 rounded-full">
                                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#3b82f6]/20 text-[#3b82f6] rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-transform">
                                    <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-white">Cliques Carregados</h3>
                                <p className="text-xs sm:text-sm text-[#3b82f6] font-medium">{clickData.length} registros</p>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-surface-highlight text-text-secondary rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-white">Relatório de Cliques</h3>
                                <p className="text-xs sm:text-sm text-text-secondary text-center">Formato .csv (Cliques)</p>
                            </>
                        )}
                    </label>
                </div>

                <button
                    onClick={() => {
                        if (commissionData.length > 0 || clickData.length > 0) {
                            setHasStartedAnalysis(true);
                        }
                    }}
                    disabled={commissionData.length === 0 && clickData.length === 0}
                    className="disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-background-dark font-bold text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4 rounded-xl flex items-center gap-2 hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20 w-full sm:w-auto justify-center"
                >
                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                    Analisar Dados
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Dashboard Geral</h2>
                    <p className="text-text-secondary text-xs sm:text-sm">Visão geral de desempenho e comissões</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => { if (window.confirm('Deseja substituir os CSVs atuais? Os dados carregados serão removidos.')) { clearData(); } }}
                        className="flex-1 sm:flex-initial px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 text-neutral-400 hover:text-white hover:bg-white/10 border border-border-dark transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Trocar CSV
                    </button>
                    <div className="flex-1 sm:flex-initial">
                        <DateFilter />
                    </div>
                </div>
            </header>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                <div className="flex flex-col p-3 sm:p-4 md:p-5 rounded-2xl bg-surface-dark border border-border-dark group hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <p className="text-text-secondary text-xs sm:text-sm font-medium">Vendas Totais</p>
                    </div>
                    <p className="text-white text-lg sm:text-xl md:text-3xl font-bold tracking-tight break-words">R$ {metrics.totalOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>

                <div className="flex flex-col p-3 sm:p-4 md:p-5 rounded-2xl bg-surface-dark border border-border-dark group hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <p className="text-text-secondary text-xs sm:text-sm font-medium">Total Pedidos</p>
                    </div>
                    <p className="text-white text-lg sm:text-xl md:text-3xl font-bold tracking-tight">{metrics.totalOrders}</p>
                </div>

                <div className="flex flex-col p-3 sm:p-4 md:p-5 rounded-2xl bg-surface-dark border border-border-dark group hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <p className="text-text-secondary text-xs sm:text-sm font-medium">Ticket Médio</p>
                    </div>
                    <p className="text-white text-lg sm:text-xl md:text-3xl font-bold tracking-tight whitespace-nowrap">R$ {metrics.totalOrders > 0 ? (metrics.totalOrderValue / metrics.totalOrders).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</p>
                </div>

                <div className="flex flex-col p-3 sm:p-4 md:p-5 rounded-2xl bg-surface-dark border border-border-dark group hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <p className="text-text-secondary text-xs sm:text-sm font-medium">Taxa Conversão</p>
                    </div>
                    <p className="text-white text-lg sm:text-xl md:text-3xl font-bold tracking-tight">{metrics.conversionRate}%</p>
                </div>

                <div className="flex flex-col p-3 sm:p-4 md:p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-surface-dark border border-primary/30 relative overflow-hidden group">
                    <div className="flex items-start justify-between mb-1 sm:mb-2 z-10 w-full min-w-0">
                        <p className="text-text-secondary text-xs sm:text-sm font-medium">Comissão Líquida</p>
                    </div>
                    <p className="text-white text-lg sm:text-xl md:text-3xl font-bold tracking-tight z-10 break-words">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Funnel Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-highlight flex items-center justify-center text-text-secondary">
                        <span className="font-bold text-lg sm:text-xl">{metrics.funnelStats.pending}</span>
                    </div>
                    <div>
                        <p className="text-xs sm:text-sm text-text-secondary">Pedidos Pendentes</p>
                        <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5">Aguardando Pagamento/Envio</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                        <span className="font-bold text-lg sm:text-xl">{metrics.funnelStats.completed}</span>
                    </div>
                    <div>
                        <p className="text-xs sm:text-sm text-primary">Pedidos Concluídos</p>
                        <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5">Comissão Garantida</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">
                        <span className="font-bold text-lg sm:text-xl">{metrics.funnelStats.cancelled}</span>
                    </div>
                    <div>
                        <p className="text-xs sm:text-sm text-red-500">Pedidos Cancelados</p>
                        <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5">Taxa de Perda: {metrics.totalOrders > 0 ? ((metrics.funnelStats.cancelled / metrics.totalOrders) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}%</p>
                    </div>
                </div>
            </div>

            {/* Insights Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-5">
                    <div>
                        <p className="text-xs sm:text-sm text-text-secondary">Comissão Base vs Extra</p>
                        <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5">Origem da sua receita</p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-right">
                        <div>
                            <p className="text-[10px] sm:text-xs text-text-secondary">Shopee</p>
                            <p className="text-xs sm:text-sm font-bold text-white font-mono">R$ {metrics.commissionSource.shopee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="h-6 sm:h-8 w-px bg-border-dark"></div>
                        <div>
                            <p className="text-[10px] sm:text-xs text-primary">Vendedores</p>
                            <p className="text-xs sm:text-sm font-bold text-primary font-mono">R$ {metrics.commissionSource.seller.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-5">
                    <div>
                        <p className="text-xs sm:text-sm text-text-secondary">Novos vs Recorrentes</p>
                        <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5">Público que você atrai</p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-right">
                        <div>
                            <p className="text-[10px] sm:text-xs text-text-secondary">Recorrentes</p>
                            <p className="text-xs sm:text-sm font-bold text-white font-mono">{metrics.buyerStats.existing}</p>
                        </div>
                        <div className="h-6 sm:h-8 w-px bg-border-dark"></div>
                        <div>
                            <p className="text-[10px] sm:text-xs text-[#3b82f6]">Novos Clientes</p>
                            <p className="text-xs sm:text-sm font-bold text-[#3b82f6] font-mono">{metrics.buyerStats.new}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Main Chart: Daily Commissions */}
                <div className="flex flex-col p-4 sm:p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white">Pedidos Diários</h3>
                            <p className="text-xs sm:text-sm text-text-secondary">Evolução do período</p>
                        </div>
                    </div>
                    <div className="relative h-[220px] sm:h-[300px] w-full mt-auto flex items-end gap-1 sm:gap-2 pt-8 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics.dailyChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#393328" vertical={false} />
                                <XAxis dataKey="date" stroke="#baaf9c" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#baaf9c" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#2d261a' }}
                                    contentStyle={{ backgroundColor: '#181611', border: '1px solid #393328', borderRadius: '12px' }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#f2a20d" strokeWidth={3} dot={{ fill: '#181611', r: 4, stroke: '#f2a20d', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Top Products */}
                <div className="flex flex-col p-4 sm:p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white mb-3 sm:mb-4">Geração de Valor (Top 5)</h3>
                    <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-2">
                        {metrics.productRanking.map((item, idx) => (
                            <div key={item.name} className="flex flex-col gap-1.5 group">
                                <div className="flex justify-between items-start text-sm">
                                    <span className="text-white font-medium line-clamp-2 max-w-[70%] leading-tight group-hover:text-primary transition-colors">{item.name}</span>
                                    <span className="text-primary font-bold ml-2 whitespace-nowrap">R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-text-secondary">Vendas: {item.count} un.</span>
                                </div>
                                <div className="h-1.5 w-full bg-surface-highlight rounded-full overflow-hidden mt-1">
                                    {/* Using an arbitrary visual percentage based on index just for effect since we don't have standard max in this simple view */}
                                    <div className="h-full bg-primary/80 transition-all" style={{ width: `${100 - (idx * 15)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Categories */}
                <div className="flex flex-col p-4 sm:p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white mb-3 sm:mb-4">Principais Categorias (L1)</h3>
                    <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-2">
                        {metrics.categoriesRanking.slice(0, 5).map((item, idx) => (
                            <div key={item.category} className="flex flex-col gap-1.5 group">
                                <div className="flex justify-between items-start text-sm">
                                    <span className="text-white font-medium line-clamp-2 max-w-[70%] leading-tight group-hover:text-[#3b82f6] transition-colors">{item.category}</span>
                                    <span className="text-[#3b82f6] font-bold ml-2 whitespace-nowrap">R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-text-secondary">Vendas: {item.count} un.</span>
                                </div>
                                <div className="h-1.5 w-full bg-surface-highlight rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-[#3b82f6]/80 transition-all" style={{ width: `${100 - (idx * 15)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div >
    );
}
