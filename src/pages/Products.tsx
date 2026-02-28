import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Package, Hash, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { OrderFiltersPanel } from '../components/ui/OrderFiltersPanel';

export function Products() {
    const metrics = useMetrics();
    const filterState = useOrderFilters(metrics.allOrders);

    if (metrics.isEmpty || metrics.allOrders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-6 border border-border-dark shadow-2xl">
                    <Package className="w-10 h-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe um relatório de Comissões para extrair as métricas de produto.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Ranking de Produtos</h2>
                    <p className="text-text-secondary text-sm">Visualização de performance no nível do item</p>
                </div>
                <DateFilter />
            </header>

            {/* Overview KPIs specific to Products context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Produtos Diferentes Vendidos</p>
                        <p className="font-bold text-xl">{filterState.filteredMetrics.uniqueProductsCount}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total de Unidades/Pedidos</p>
                        <p className="font-bold text-xl">{filterState.filteredMetrics.totalUnits}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Comissão Acumulada</p>
                        <p className="font-bold text-xl">R$ {filterState.filteredMetrics.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-dark flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white">Todos os Produtos</h3>
                    </div>
                    {/* Filtros e Busca */}
                    <OrderFiltersPanel {...filterState} />
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 font-medium text-text-secondary whitespace-nowrap">Data</th>
                                <th className="p-4 font-medium text-text-secondary">Produto</th>
                                <th className="p-4 font-medium text-text-secondary text-right whitespace-nowrap">Qtd</th>
                                <th className="p-4 font-medium text-text-secondary text-center whitespace-nowrap">Canal</th>
                                <th className="p-4 font-medium text-text-secondary text-center whitespace-nowrap">Sub ID</th>
                                <th className="p-4 font-medium text-text-secondary text-center whitespace-nowrap">Status</th>
                                <th className="p-4 font-medium text-text-secondary text-center whitespace-nowrap">Tipo</th>
                                <th className="p-4 font-medium text-text-secondary text-right whitespace-nowrap">Comissão</th>
                                <th className="p-4 font-medium text-text-secondary text-right whitespace-nowrap">Pedido ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {filterState.filteredOrders.map((order, idx) => (
                                <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                    <td className="p-4 text-text-secondary whitespace-nowrap">
                                        {order.date !== '—' ? format(new Date(order.date), 'dd/MM HH:mm') : '—'}
                                    </td>
                                    <td className="p-4 text-white min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {order.imageUrl && (
                                                <img src={order.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                            )}
                                            <span className="truncate max-w-[280px]" title={order.productName}>{order.productName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-white text-right font-mono">{order.qty}</td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 border border-white/10 text-text-secondary">
                                            {order.channel}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center font-mono text-xs text-text-secondary">
                                        {order.subId || '—'}
                                    </td>
                                    <td className="p-4 text-center whitespace-nowrap">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${['PAID', 'VALIDATED', 'COMPLETED', 'Concluído'].includes(order.status)
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : ['CANCELLED', 'INVALID', 'FAILED', 'UNPAID', 'Cancelado'].includes(order.status)
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                            {order.status || 'PENDING'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center whitespace-nowrap">
                                        <span className={`text-[10px] ${['DIRECT', 'direct', 'Direta'].includes(order.type)
                                            ? 'text-green-400' : 'text-amber-400'
                                            }`}>
                                            {['DIRECT', 'direct', 'Direta'].includes(order.type) ? 'Direta' : order.type || '—'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-primary font-bold text-right font-mono">
                                        {order.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td className="p-4 text-text-secondary text-right font-mono text-xs">
                                        {order.id.length > 8 ? order.id.slice(-8) : order.id}
                                    </td>
                                </tr>
                            ))}

                            {filterState.filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-text-secondary">
                                        Nenhum pedido encontrado para o período selecionado.
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
