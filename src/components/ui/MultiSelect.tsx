import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface MultiSelectProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
}

export function MultiSelect({
    label,
    options,
    selected,
    onChange,
    placeholder = "Todos"
}: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        const isSelected = selected.includes(option);
        if (isSelected) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    return (
        <div className="flex flex-col gap-1.5 min-w-0" ref={containerRef}>
            <label className="text-xs font-semibold text-text-secondary">{label}</label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between gap-2 bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-primary/50 text-left min-h-[38px] ${isOpen ? 'ring-2 ring-primary/20 border-primary/50' : ''
                        }`}
                >
                    <div className="flex-1 truncate">
                        {selected.length === 0 ? (
                            <span className="text-text-secondary">{placeholder}</span>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {selected.length === 1 ? (
                                    <span className="text-white">{selected[0]}</span>
                                ) : (
                                    <span className="text-white font-bold">{selected.length} selecionados</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {selected.length > 0 && (
                            <div
                                onClick={clearSelection}
                                className="p-0.5 rounded-md hover:bg-white/10 text-text-secondary hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </div>
                        )}
                        <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute z-50 mt-2 w-full min-w-[180px] bg-surface-dark/95 backdrop-blur-xl border border-border-dark rounded-xl shadow-2xl p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
                            {options.length === 0 ? (
                                <div className="px-3 py-4 text-center text-xs text-text-secondary italic">
                                    Nenhuma opção disponível
                                </div>
                            ) : (
                                <>
                                    {options.map((option) => {
                                        const isSelected = selected.includes(option);
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => toggleOption(option)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all duration-200 group relative ${isSelected
                                                        ? 'bg-primary/10 text-primary font-bold'
                                                        : 'text-text-secondary hover:bg-white/5 hover:text-white'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${isSelected
                                                        ? 'bg-primary border-primary'
                                                        : 'border-border-dark group-hover:border-primary/50'
                                                    }`}>
                                                    {isSelected && <Check className="w-3 h-3 text-background-dark stroke-[3px]" />}
                                                </div>
                                                <span className="truncate">{option}</span>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
