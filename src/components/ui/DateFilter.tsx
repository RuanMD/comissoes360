import { useData } from '../../context/DataContext';

export function DateFilter() {
    const { dateFilter, setDateFilter, customRange, setCustomRange } = useData();

    return (
        <div className="flex flex-wrap items-center gap-2">
            {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 bg-surface-dark border border-border-dark rounded-lg p-1 px-3">
                    <input
                        type="date"
                        value={customRange.start}
                        onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                        className="bg-transparent text-sm text-white outline-none cursor-pointer"
                    />
                    <span className="text-text-secondary text-sm">até</span>
                    <input
                        type="date"
                        value={customRange.end}
                        onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                        className="bg-transparent text-sm text-white outline-none cursor-pointer"
                    />
                </div>
            )}
            <div className="flex items-center gap-2 bg-surface-dark border border-border-dark rounded-lg p-1">
                <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="bg-transparent border-0 text-white text-sm focus:ring-0 cursor-pointer py-1.5 pl-3 pr-8 font-medium outline-none">
                    <option value="today">Hoje</option>
                    <option value="yesterday">Ontem</option>
                    <option value="anteontem">Anteontem</option>
                    <option value="7days">Últimos 7 dias</option>
                    <option value="30days">Últimos 30 dias</option>
                    <option value="all">Tudo</option>
                    <option value="custom">Personalizado</option>
                </select>
            </div>
        </div>
    );
}
