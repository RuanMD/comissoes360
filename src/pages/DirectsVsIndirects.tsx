import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { Zap, ShieldCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export function DirectsVsIndirects() {
    const metrics = useMetrics();

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-6 border border-border-dark shadow-2xl">
                    <ShieldCheck className="w-10 h-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe um relatório de Comissões para visualizar esta análise.</p>
            </div>
        );
    }

    const COLORS = ['#f2a20d', '#3b82f6'];

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Diretas vs Indiretas</h2>
                    <p className="text-text-secondary text-sm">Distribuição de vendas diretas x carrinho cruzado (cross-selling)</p>
                </div>
                <DateFilter />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visual Mock Chart */}
                <div className="flex flex-col p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0 min-h-[400px]">
                    <h3 className="text-lg font-bold text-white mb-2">Comportamento do Comprador</h3>
                    <p className="text-sm text-text-secondary mb-6">Muitas compras de afiliados provêm de itens que o usuário não clicou originalmente, sendo atribuídas pela janela de 7 dias de cookies.</p>

                    <div className="flex-1 flex items-center justify-center w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.directsVsIndirects}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {metrics.directsVsIndirects.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#181611', border: '1px solid #393328', borderRadius: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="bg-gradient-to-br from-primary/20 to-surface-dark border border-primary/30 rounded-2xl p-6 relative overflow-hidden group">
                        <Zap className="text-primary w-8 h-8 mb-4" />
                        <h4 className="text-xl font-bold text-white mb-2">Impacto do Cross-Sell</h4>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Historicamente, mais de 60% das vendas de afiliados na Shopee originam-se de produtos nos quais o cliente não clicou diretamente na sua campanha. Identificar corretamente os nichos de Cross-Selling ajudará na seleção de futuros canais de divulgação.
                        </p>
                    </div>
                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 group hover:border-border-hover transition-colors">
                        <h4 className="text-lg font-medium text-white mb-2">Vendas Diretas</h4>
                        <p className="text-3xl font-bold font-mono text-primary">{metrics.directsVsIndirects[0].value}</p>
                        <p className="text-sm text-text-secondary mt-1 overflow-hidden text-ellipsis">Pedidos do link promovido</p>
                    </div>
                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 group hover:border-border-hover transition-colors">
                        <h4 className="text-lg font-medium text-white mb-2">Vendas Indiretas</h4>
                        <p className="text-3xl font-bold font-mono text-[#3b82f6]">{metrics.directsVsIndirects[1].value}</p>
                        <p className="text-sm text-text-secondary mt-1 overflow-hidden text-ellipsis">Pedidos via carrinho cruzado</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
