import { useState, useMemo } from 'react';
import {
    DndContext,
    closestCorners,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    useDroppable,
    DragOverlay,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as LucideIcons from 'lucide-react';
import { GripVertical } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Track = any;

interface StatusObj {
    slug: string;
    name: string;
    color: string;
    icon: string;
    [key: string]: any;
}

interface KanbanBoardProps {
    tracks: Track[];
    statuses: StatusObj[];
    trackEntryCounts: Record<string, number>;
    onSelectTrack: (track: Track) => void;
    onUpdateStatus: (track: Track, newStatus: string) => void;
    selectedTrackId: string | null;
}

// ─── Droppable Column ───
function KanbanColumn({ statusSlug, statusObj, children, count }: {
    statusSlug: string;
    statusObj: StatusObj;
    children: React.ReactNode;
    count: number;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${statusSlug}` });
    const IconComp = (LucideIcons as any)[statusObj.icon] || LucideIcons.HelpCircle;

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col bg-background-dark/40 rounded-2xl border transition-all min-w-[260px] max-w-[320px] flex-shrink-0 ${isOver
                ? 'border-primary/60 shadow-[0_0_25px_rgba(242,162,13,0.15)]'
                : 'border-border-dark'
                }`}
        >
            {/* Column Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-dark/50">
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: statusObj.color + '20', color: statusObj.color }}
                >
                    <IconComp className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white truncate">{statusObj.name}</span>
                <span
                    className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: statusObj.color + '15', color: statusObj.color }}
                >
                    {count}
                </span>
            </div>

            {/* Cards Area */}
            <div className="flex flex-col gap-2 p-3 flex-1 min-h-[120px] overflow-y-auto custom-scrollbar max-h-[calc(100vh-280px)]">
                {children}
                {count === 0 && (
                    <div className="flex items-center justify-center h-20 text-text-secondary text-xs italic opacity-50">
                        Nenhum criativo
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sortable Card ───
function KanbanCard({ track, isSelected, entryCount, onClick }: {
    track: Track;
    isSelected: boolean;
    entryCount: number;
    onClick: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: track.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-surface-dark border rounded-xl p-3 cursor-pointer transition-all group select-none ${isSelected
                ? 'border-primary/50 shadow-[0_0_12px_rgba(242,162,13,0.15)]'
                : 'border-border-dark hover:border-primary/30'
                }`}
        >
            <div className="flex items-start gap-2">
                <div
                    {...attributes}
                    {...listeners}
                    className="mt-0.5 cursor-grab active:cursor-grabbing text-text-secondary hover:text-white shrink-0"
                >
                    <GripVertical className="w-4 h-4 opacity-30 group-hover:opacity-80 transition-opacity" />
                </div>
                <div className="flex-1 min-w-0" onClick={onClick}>
                    <p className="text-sm font-semibold text-white truncate" title={track.name}>
                        {track.name}
                    </p>
                    {track.sub_id && (
                        <p className="text-[10px] text-primary/70 font-mono truncate mt-0.5" title={track.sub_id}>
                            {track.sub_id}
                        </p>
                    )}
                    {entryCount > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <LucideIcons.BarChart3 className="w-3 h-3 text-text-secondary" />
                            <span className="text-[10px] text-text-secondary font-semibold">{entryCount} registros</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Overlay Card (ghost while dragging) ───
function KanbanCardOverlay({ track }: { track: Track }) {
    return (
        <div className="bg-surface-dark border border-primary/40 rounded-xl p-3 shadow-2xl shadow-primary/10 w-[280px] rotate-2 scale-105">
            <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{track.name}</p>
                    {track.sub_id && (
                        <p className="text-[10px] text-primary/70 font-mono truncate mt-0.5">{track.sub_id}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Kanban Board ───
export function KanbanBoard({ tracks, statuses, trackEntryCounts, onSelectTrack, onUpdateStatus, selectedTrackId }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
    const sensors = useSensors(pointerSensor, touchSensor);

    // Group tracks by status
    const tracksByStatus = useMemo(() => {
        const grouped: Record<string, Track[]> = {};
        for (const s of statuses) {
            grouped[s.slug] = [];
        }
        for (const track of tracks) {
            const statusSlug = track.status || 'rascunho';
            if (!grouped[statusSlug]) {
                grouped[statusSlug] = [];
            }
            grouped[statusSlug].push(track);
        }
        return grouped;
    }, [tracks, statuses]);

    const activeTrack = useMemo(() => {
        if (!activeId) return null;
        return tracks.find(t => t.id === activeId) || null;
    }, [activeId, tracks]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const trackId = active.id as string;
        const track = tracks.find(t => t.id === trackId);
        if (!track) return;

        // Determine the target status column
        let targetStatus: string | null = null;

        const overId = over.id as string;
        if (overId.startsWith('column-')) {
            targetStatus = overId.replace('column-', '');
        } else {
            // Dropped on another card - find what column that card belongs to
            const overTrack = tracks.find(t => t.id === overId);
            if (overTrack) {
                targetStatus = overTrack.status;
            }
        }

        if (targetStatus && targetStatus !== track.status) {
            onUpdateStatus(track, targetStatus);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {statuses.map(statusObj => {
                    const columnTracks = tracksByStatus[statusObj.slug] || [];
                    return (
                        <KanbanColumn
                            key={statusObj.slug}
                            statusSlug={statusObj.slug}
                            statusObj={statusObj}
                            count={columnTracks.length}
                        >
                            <SortableContext
                                items={columnTracks.map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {columnTracks.map(track => (
                                    <KanbanCard
                                        key={track.id}
                                        track={track}
                                        isSelected={selectedTrackId === track.id}
                                        entryCount={trackEntryCounts[track.id] || 0}
                                        onClick={() => onSelectTrack(track)}
                                    />
                                ))}
                            </SortableContext>
                        </KanbanColumn>
                    );
                })}
            </div>

            <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {activeTrack ? <KanbanCardOverlay track={activeTrack} /> : null}
            </DragOverlay>
        </DndContext>
    );
}
