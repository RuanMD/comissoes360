import { Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AdvancedFilters, FilterOperator } from '../../hooks/useOrderFilters';
import { MultiSelect } from './MultiSelect';

interface OrderFiltersPanelProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    filters: AdvancedFilters;
    handleFilterChange: (key: keyof AdvancedFilters, value: any) => void;
    showAdvanced: boolean;
    setShowAdvanced: (show: boolean) => void;
    clearFilters: () => void;
    uniqueChannels: string[];
}

export function OrderFiltersPanel({
    searchQuery,
    setSearchQuery,
    filters,
    handleFilterChange,
    showAdvanced,
    setShowAdvanced,
    clearFilters,
    uniqueChannels
}: OrderFiltersPanelProps) {
    const activeFiltersCount = Object.entries(filters).filter(([key, val]) => {
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === 'string') return val !== '';
        if (key === 'quantity' || key === 'commission') return (val as any).value !== null;
        return false;
    }).length;

    return (
        <div className="flex flex-col gap-3 mb-4 w-full">
            {/* Top Bar: Search + Toggle Advanced */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-dark border border-border-dark p-3 rounded-xl w-full">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                        type="text"
                        placeholder="Busque por produto, sub id, canal ou id..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${showAdvanced || activeFiltersCount > 0 ? 'bg-primary/10 text-primary border-primary/30' : 'bg-background-dark text-text-secondary border-border-dark hover:text-white'}`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros Avançados
                        {activeFiltersCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-primary text-background-dark text-[10px] flex items-center justify-center font-bold">
                                {activeFiltersCount}
                            </span>
                        )}
                        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {(activeFiltersCount > 0 || searchQuery) && (
                        <button
                            onClick={clearFilters}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                            title="Limpar todos os filtros"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvanced && (
                <div className="bg-surface-dark border border-border-dark rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-in slide-in-from-top-2">

                    {/* Canal Filter */}
                    <MultiSelect
                        label="Canal"
                        options={uniqueChannels}
                        selected={filters.channel}
                        onChange={(vals) => handleFilterChange('channel', vals)}
                        placeholder="Todos os Canais"
                    />

                    {/* Status Filter */}
                    <MultiSelect
                        label="Status"
                        options={["Concluído", "Pendente", "Cancelado"]}
                        selected={filters.status}
                        onChange={(vals) => handleFilterChange('status', vals)}
                        placeholder="Todos os Status"
                    />

                    {/* Type Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Atribuição (Tipo)</label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                        >
                            <option value="">Todas</option>
                            <option value="Direta">Direta</option>
                            <option value="Indireta">Indireta</option>
                        </select>
                    </div>

                    {/* Quantidade Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Quantidade</label>
                        <div className="flex w-full gap-1">
                            <select
                                value={filters.quantity.operator}
                                onChange={(e) => handleFilterChange('quantity', { ...filters.quantity, operator: e.target.value as FilterOperator })}
                                className="bg-background-dark border border-border-dark rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary/50 border-r-0 rounded-r-none w-16"
                            >
                                <option value="eq">=</option>
                                <option value="gt">&gt;</option>
                                <option value="lt">&lt;</option>
                            </select>
                            <input
                                type="number"
                                placeholder="0"
                                value={filters.quantity.value === null ? '' : filters.quantity.value}
                                onChange={(e) => handleFilterChange('quantity', { ...filters.quantity, value: e.target.value ? Number(e.target.value) : null })}
                                className="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 rounded-l-none"
                            />
                        </div>
                    </div>

                    {/* Comissão Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Comissão (R$)</label>
                        <div className="flex w-full gap-1">
                            <select
                                value={filters.commission.operator}
                                onChange={(e) => handleFilterChange('commission', { ...filters.commission, operator: e.target.value as FilterOperator })}
                                className="bg-background-dark border border-border-dark rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary/50 border-r-0 rounded-r-none w-16"
                            >
                                <option value="eq">=</option>
                                <option value="gt">&gt;</option>
                                <option value="lt">&lt;</option>
                            </select>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={filters.commission.value === null ? '' : filters.commission.value}
                                onChange={(e) => handleFilterChange('commission', { ...filters.commission, value: e.target.value ? Number(e.target.value) : null })}
                                className="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 rounded-l-none"
                            />
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
