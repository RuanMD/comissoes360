import { useState, useRef, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Calendar, ChevronDown, Check } from 'lucide-react';

export function DateFilter() {
    const { dateFilter, setDateFilter, customRange, setCustomRange } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const options = [
        { value: 'today', label: 'Hoje' },
        { value: 'yesterday', label: 'Ontem' },
        { value: 'anteontem', label: 'Anteontem' },
        { value: '7days', label: 'Últimos 7 dias' },
        { value: '30days', label: 'Últimos 30 dias' },
        { value: 'all', label: 'Tudo' },
        { value: 'custom', label: 'Personalizado' },
    ];

    const currentLabel = options.find(opt => opt.value === dateFilter)?.label || 'Selecionar data';

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
            {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 bg-surface-dark/50 backdrop-blur-md border border-white/10 rounded-xl p-1.5 px-3 shadow-lg">
                    <input
                        type="date"
                        value={customRange.start}
                        onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                        className="bg-transparent text-xs sm:text-sm text-white outline-none cursor-pointer [color-scheme:dark]"
                    />
                    <span className="text-text-secondary text-xs font-medium">até</span>
                    <input
                        type="date"
                        value={customRange.end}
                        onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                        className="bg-transparent text-xs sm:text-sm text-white outline-none cursor-pointer [color-scheme:dark]"
                    />
                </div>
            )}

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 bg-surface-dark/80 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:bg-surface-highlight/50 active:scale-95 ${isOpen ? 'ring-2 ring-primary/50 border-primary/50' : ''}`}
                >
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-white whitespace-nowrap">{currentLabel}</span>
                    <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-surface-dark/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="py-1">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setDateFilter(option.value as any);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${dateFilter === option.value ? 'text-primary font-bold bg-primary/10' : 'text-text-secondary font-medium'}`}
                                >
                                    {option.label}
                                    {dateFilter === option.value && <Check className="w-4 h-4 text-primary" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
