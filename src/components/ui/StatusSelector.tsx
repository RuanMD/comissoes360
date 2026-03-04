import { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';

interface StatusObj {
    id?: string;
    slug: string;
    name: string;
    color: string;
    icon: string;
    isSystem?: boolean;
}

interface StatusSelectorProps {
    currentStatusSlug: string;
    statuses: StatusObj[];
    onSelect: (newStatusSlug: string) => void;
    disabled?: boolean;
}

export function StatusSelector({ currentStatusSlug, statuses, onSelect, disabled = false }: StatusSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fallback if status not found
    const currentStatus = statuses.find(s => s.slug === currentStatusSlug) || {
        slug: currentStatusSlug,
        name: currentStatusSlug.charAt(0).toUpperCase() + currentStatusSlug.slice(1),
        color: '#94a3b8',
        icon: 'HelpCircle'
    };

    const CurrentIcon = (LucideIcons as any)[currentStatus.icon] || LucideIcons.HelpCircle;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-[0.98]'}`}
                style={{
                    backgroundColor: currentStatus.color,
                    color: '#ffffff',
                    boxShadow: isOpen ? `0 0 0 2px ${currentStatus.color}60` : `0 4px 12px -2px ${currentStatus.color}40`
                }}
            >
                <div className="flex items-center gap-1.5">
                    <CurrentIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{currentStatus.name}</span>
                </div>
                <LucideIcons.ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 top-full mt-1.5 left-0 w-full min-w-[180px] bg-surface-dark border border-border-dark rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                        {statuses.map(status => {
                            const Icon = (LucideIcons as any)[status.icon] || LucideIcons.HelpCircle;
                            const isSelected = status.slug === currentStatusSlug;
                            return (
                                <button
                                    key={status.slug}
                                    type="button"
                                    onClick={() => {
                                        onSelect(status.slug);
                                        setIsOpen(false);
                                    }}
                                    className={`flex items-center gap-2 w-full px-2.5 py-2 text-left rounded-lg transition-colors
                                        ${isSelected ? 'bg-primary/10' : 'hover:bg-white/5'}`}
                                >
                                    <div
                                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${status.color}20`, color: status.color }}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm ${isSelected ? 'font-bold text-primary' : 'font-medium text-text-secondary'}`}>
                                        {status.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
