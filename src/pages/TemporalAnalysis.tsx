import { useMemo } from 'react';
import { useMetrics, parseShopeeDate } from '../hooks/useMetrics';
import { DateFilter } from '../components/ui/DateFilter';
import { CalendarDays, Clock, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function TemporalAnalysis() {
    const metrics = useMetrics();

    const hourlyData = useMemo(() => {
        const data = Array.from({ length: 24 }).map((_, i) => ({
            hour: `${i.toString().padStart(2, '0')}:00`,
            orders: 0
        }));

        metrics.allOrders.forEach(order => {
            const dateObj = parseShopeeDate(order.date);
            if (dateObj) {
                const hour = dateObj.getHours();
                data[hour].orders += 1;
            }
        });

        return data;
    }, [metrics.allOrders]);

    const peakHourInfo = useMemo(() => {
        let maxOrders = -1;
        let peakHour = 0;

        // Sliding window of 2 hours for peak
        for (let i = 0; i < 24; i++) {
            const currentPair = hourlyData[i].orders + hourlyData[(i + 1) % 24].orders;
            if (currentPair > maxOrders) {
                maxOrders = currentPair;
                peakHour = i;
            }
        }

        if (maxOrders <= 0) return '—';
        return `${peakHour.toString().padStart(2, '0')}:00 - ${((peakHour + 2) % 24).toString().padStart(2, '0')}:00`;
    }, [hourlyData]);

    const strongestDayInfo = useMemo(() => {
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const dayCounts = Array(7).fill(0);

        metrics.allOrders.forEach(order => {
            const dateObj = parseShopeeDate(order.date);
            if (dateObj) {
                const day = dateObj.getDay();
                dayCounts[day] += 1;
            }
        });

        let maxVal = -1;
        let bestDay = -1;
        dayCounts.forEach((count, i) => {
            if (count > maxVal) {
                maxVal = count;
                bestDay = i;
            }
        });

        if (maxVal <= 0) return '—';
        return days[bestDay];
    }, [metrics.allOrders]);

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border border-border-dark shadow-2xl">
                    <CalendarDays className="w-7 h-7 sm:w-10 sm:h-10 text-primary/50" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe um relatório de Comissões para gerar a análise temporal de vendas.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Análise Temporal</h2>
                    <p className="text-text-secondary text-sm">Distribuição de vendas por horários e dias (Visualização de Teste)</p>
                </div>
                <DateFilter />
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4 group hover:border-primary/50 transition-colors">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Horário de Pico (Aprox)</p>
                        <p className="font-bold text-lg sm:text-xl">{peakHourInfo}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 bg-surface-dark border border-border-dark rounded-xl p-3 sm:p-4 group hover:border-primary/50 transition-colors">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Dia mais Forte da Semana</p>
                        <p className="font-bold text-lg sm:text-xl">{strongestDayInfo}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col p-4 sm:p-6 rounded-2xl bg-surface-dark border border-border-dark min-w-0">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white">Vendas por Hora (Amostragem)</h3>
                    </div>
                </div>
                <div className="relative h-[280px] sm:h-[400px] w-full mt-auto flex items-end gap-1 sm:gap-2 pt-8 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData}>
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
