import { useMetrics } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { CalendarDays, Clock, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// MOCK DATA for Time Analysis logic not yet in Context parser
const MOCK_HOURLY = Array.from({ length: 24 }).map((_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    orders: Math.floor(Math.random() * 50) + 10
}));

export function TemporalAnalysis() {
    const metrics = useMetrics();

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-6 border border-border-dark shadow-2xl">
                    <CalendarDays className="w-10 h-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe um relatório de Comissões para gerar a análise temporal de vendas.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Análise Temporal</h2>
                    <p className="text-text-secondary text-sm">Distribuição de vendas por horários e dias (Visualização de Teste)</p>
                </div>
                <DateFilter />
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 group hover:border-primary/50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Horário de Pico (Aprox)</p>
                        <p className="font-bold text-xl">19:00 - 21:00</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 group hover:border-primary/50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Dia mais Forte da Semana</p>
                        <p className="font-bold text-xl">Terça-feira</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white">Vendas por Hora (Amostragem)</h3>
                    </div>
                </div>
                <div className="relative h-[400px] w-full mt-auto flex items-end gap-1 sm:gap-2 pt-8 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={MOCK_HOURLY}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#393328" vertical={false} />
                            <XAxis dataKey="hour" stroke="#baaf9c" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#baaf9c" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: '#2d261a' }}
                                contentStyle={{ backgroundColor: '#181611', border: '1px solid #393328', borderRadius: '12px' }}
                            />
                            <Bar dataKey="orders" fill="#f2a20d" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
