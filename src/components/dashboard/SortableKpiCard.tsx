import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LucideIcon } from 'lucide-react';

interface KpiData {
    label: string;
    value: string;
    icon: LucideIcon;
    color: string;
    profit?: number;
    pct?: number;
}

interface SortableKpiCardProps {
    id: string;
    kpi: KpiData;
    compact?: boolean;
}

export function SortableKpiCard({ id, kpi, compact }: SortableKpiCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    const Icon = kpi.icon;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`
                group relative flex flex-col rounded-xl bg-surface-dark border transition-all cursor-grab active:cursor-grabbing
                ${isDragging ? 'opacity-50 border-primary shadow-2xl scale-105 z-50' : 'border-border-dark hover:border-primary/50'}
                ${compact ? 'p-3 gap-1.5' : 'p-4 gap-2'}
            `}
        >
            <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
                <Icon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${kpi.color}`} />
                <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-text-secondary uppercase tracking-wider font-medium line-clamp-1`}>
                    {kpi.label}
                </span>

                {/* Arrastador de Blocos */}
                <div className="ml-auto opacity-0 group-hover:opacity-100 lg:hidden group-hover:block transition-opacity md:opacity-100">
                    <div className="flex gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-text-secondary/30" />
                        <div className="w-1 h-1 rounded-full bg-text-secondary/30" />
                        <div className="w-1 h-1 rounded-full bg-text-secondary/30" />
                    </div>
                </div>
            </div>

            <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`${compact ? 'text-lg' : 'text-2xl'} font-bold tracking-tight ${kpi.color} break-words`}>
                    {kpi.value}
                </span>

                {/* Porcentagem ou Indicador Adicional (se houver) */}
                {kpi.pct !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${kpi.pct >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {kpi.pct >= 0 ? '+' : ''}{(kpi.pct)}%
                    </span>
                )}
            </div>
        </div>
    );
}
