import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Package, Hash, DollarSign } from 'lucide-react';

export function Products() {
    const metrics = useMetrics();

    if (metrics.isEmpty || metrics.allProducts.length === 0) {
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
                        <p className="font-bold text-xl">{metrics.allProducts.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total de Unidades/Pedidos</p>
                        <p className="font-bold text-xl">{metrics.totalOrders}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Comissão Acumulada</p>
                        <p className="font-bold text-xl">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-dark flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Todos os Produtos</h3>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-sm font-medium text-text-secondary">Nome do Produto</th>
                                <th className="p-4 text-sm font-medium text-text-secondary text-right whitespace-nowrap">Volume (Pedidos)</th>
                                <th className="p-4 text-sm font-medium text-text-secondary text-right whitespace-nowrap">Comissão (R$)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {metrics.allProducts.map((item, idx) => (
                                <tr key={idx} className="hover:bg-background-dark/30 transition-colors">
                                    <td className="p-4 text-sm font-medium text-white max-w-[300px] truncate" title={item.name}>
                                        {item.name}
                                    </td>
                                    <td className="p-4 text-sm text-white text-right font-mono">{item.count}</td>
                                    <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                        R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}

                            {metrics.allProducts.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-text-secondary">
                                        Nenhum produto encontrado para o período selecionado.
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
