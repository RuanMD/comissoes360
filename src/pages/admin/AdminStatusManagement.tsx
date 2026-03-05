import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastContext';
import { useData } from '../../hooks/useData';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    TouchSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Palette,
    Trash2,
    Save,
    X,
    Loader2,
    Plus,
    GripVertical
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const ICON_OPTIONS = [
    'PlayCircle', 'StopCircle', 'CheckCircle2', 'AlertCircle',
    'Archive', 'Trash2', 'Pencil', 'Save', 'Star', 'Tag',
    'Flag', 'User', 'Settings', 'Package', 'Truck'
];

const COLOR_OPTIONS = [
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Verde', value: '#22c55e' },
    { name: 'Amarelo', value: '#eab308' },
    { name: 'Vermelho', value: '#ef4444' },
    { name: 'Roxo', value: '#a855f7' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Laranja', value: '#f97316' },
    { name: 'Ciano', value: '#06b6d4' },
    { name: 'Branco', value: '#ffffff' },
    { name: 'Cinza', value: '#94a3b8' },
];

function SortableStatusCard({ status, onEdit, onDelete }: { status: any, onEdit: (s: any) => void, onDelete: (id: string) => void }) {
    const originalId = status.id || status.slug;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: originalId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    const IconComponent = (LucideIcons as any)[status.icon] || LucideIcons.HelpCircle;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-surface-dark border border-border-dark rounded-2xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all select-none"
        >
            <div className="flex items-center gap-4">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 text-text-secondary hover:text-white"
                >
                    <GripVertical className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center relative overflow-hidden pointer-events-none"
                    style={{ backgroundColor: status.color + '15', color: status.color }}
                >
                    <div className="absolute inset-0 opacity-10" style={{ backgroundColor: status.color }} />
                    <IconComponent className="w-6 h-6 relative z-10" />
                </div>
                <div className="pointer-events-none">
                    <p className="font-bold text-white flex items-center gap-2">
                        {status.name}
                        {status.isSystem && <span className="bg-primary/10 text-primary text-[8px] px-1 rounded uppercase tracking-wider">Sistema</span>}
                    </p>
                    <p className="text-xs text-text-secondary">{status.isSystem ? 'Padrão Editável' : 'Personalizado'}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEdit(status); }}
                    className="p-2 text-text-secondary hover:text-primary transition-all"
                    title="Editar"
                >
                    <LucideIcons.Edit2 className="w-5 h-5" />
                </button>
                {!status.isSystem && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onDelete(status.id); }}
                        className="p-2 text-text-secondary hover:text-red-500 transition-all"
                        title="Excluir"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function AdminStatusManagement() {
    const { statuses, sidebarStatuses, fetchStatuses, reorderStatuses, reorderSidebarStatuses } = useData();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_OPTIONS[0].value);
    const [newIcon, setNewIcon] = useState(ICON_OPTIONS[0]);

    const [editingStatus, setEditingStatus] = useState<any | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editIcon, setEditIcon] = useState('');

    const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
    const dndSensors = useSensors(pointerSensor, touchSensor);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = statuses.findIndex(s => (s.id || s.slug) === active.id);
            const newIndex = statuses.findIndex(s => (s.id || s.slug) === over.id);
            const newOrderArray = arrayMove(statuses, oldIndex, newIndex);

            const newOrderValues = newOrderArray.map(s => s.id || s.slug);
            reorderStatuses(newOrderValues);
        }
    };

    const handleSidebarDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = sidebarStatuses.findIndex(s => (s.id || s.slug) === active.id);
            const newIndex = sidebarStatuses.findIndex(s => (s.id || s.slug) === over.id);
            const newOrderArray = arrayMove(sidebarStatuses, oldIndex, newIndex);

            const newOrderValues = newOrderArray.map(s => s.id || s.slug);
            reorderSidebarStatuses(newOrderValues);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) {
            showToast('O nome do status é obrigatório.', 'error');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const { error } = await supabase
                .from('track_statuses')
                .insert({
                    user_id: user.id,
                    name: newName,
                    color: newColor,
                    icon: newIcon
                });

            if (error) throw error;

            showToast('Status criado com sucesso!');
            setNewName('');
            setIsCreating(false);
            await fetchStatuses();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Erro ao criar status.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingStatus || !editName.trim()) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            let queryError;
            if (editingStatus.isSystem && editingStatus.id === editingStatus.slug) {
                // Primeira vez editando um status de sistema: precisa inserir como override no BD
                const { error } = await supabase
                    .from('track_statuses')
                    .insert({
                        user_id: user.id,
                        slug: editingStatus.slug,
                        name: editName,
                        color: editColor,
                        icon: editIcon
                    });
                queryError = error;
            } else {
                // Status já existe de fato no BD (tem UUID válido)
                const { error } = await supabase
                    .from('track_statuses')
                    .update({
                        name: editName,
                        color: editColor,
                        icon: editIcon
                    })
                    .eq('id', editingStatus.id);
                queryError = error;
            }

            if (queryError) throw queryError;

            showToast('Status atualizado!');
            setEditingStatus(null);
            await fetchStatuses();
        } catch (error: any) {
            console.error(error);
            showToast('Erro ao atualizar status.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este status?')) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('track_statuses')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Status excluído!');
            await fetchStatuses();
        } catch (error: any) {
            console.error(error);
            showToast('Erro ao excluir status.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="flex flex-col gap-6">
            {/* Header & New Button */}
            <div className="flex justify-between items-center bg-surface-dark border border-border-dark p-6 rounded-2xl">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Gestão de Status</h2>
                    <p className="text-text-secondary text-sm">Personalize os status para seus criativos.</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-opacity-90 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Status
                    </button>
                )}
            </div>

            {/* Create Form */}
            {isCreating && (
                <div className="bg-surface-dark border border-primary/30 p-6 rounded-2xl animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white">Novo Status Personalizado</h3>
                        <button onClick={() => setIsCreating(false)} className="text-text-secondary hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Nome do Status</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-xl p-3 text-white outline-none focus:border-primary transition-all"
                                placeholder="Ex: Aguardando Aprovação"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary flex items-center justify-between">
                                Cor Representativa
                                <span className="text-[10px] font-mono opacity-50 uppercase">{newColor}</span>
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Color Picker Trigger */}
                                <div className="relative group flex items-center justify-center">
                                    <input
                                        type="color"
                                        value={newColor}
                                        onChange={e => setNewColor(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        title="Escolher cor personalizada"
                                    />
                                    <div
                                        className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden ${!COLOR_OPTIONS.some(c => c.value.toLowerCase() === newColor.toLowerCase())
                                            ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                                            : 'border-primary/50 bg-background-dark group-hover:border-primary'
                                            }`}
                                        style={!COLOR_OPTIONS.some(c => c.value.toLowerCase() === newColor.toLowerCase()) ? { backgroundColor: newColor } : {}}
                                    >
                                        <Palette className={`w-4 h-4 ${!COLOR_OPTIONS.some(c => c.value.toLowerCase() === newColor.toLowerCase()) ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-primary'}`} />
                                    </div>
                                </div>

                                <div className="w-px h-6 bg-border-dark mx-1" />

                                {COLOR_OPTIONS.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setNewColor(c.value)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${newColor.toLowerCase() === c.value.toLowerCase() ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c.value }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 md:col-span-2">
                            <label className="text-sm font-medium text-text-secondary">Ícone</label>
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                                {ICON_OPTIONS.map(iconName => {
                                    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
                                    return (
                                        <button
                                            key={iconName}
                                            onClick={() => setNewIcon(iconName)}
                                            className={`p-3 rounded-xl border-2 flex items-center justify-center transition-all ${newIcon === iconName
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border-dark bg-background-dark text-text-secondary hover:border-text-secondary hover:text-white'}`}
                                        >
                                            <IconComponent className="w-5 h-5" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-6 py-3 rounded-lg text-white font-bold hover:bg-white/5 transition-all mb-0"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={loading || !newName.trim()}
                            className="bg-primary text-background-dark font-bold px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50 transition-all mb-0"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar Status
                        </button>
                    </div>
                </div>
            )}

            {/* List CRM */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-text-secondary">
                    <LucideIcons.Layout className="w-5 h-5" />
                    <h3 className="font-bold">Ordenação do CRM (Kanban)</h3>
                </div>
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={statuses.map(s => s.id || s.slug)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {statuses.map(status => (
                                <SortableStatusCard
                                    key={`crm-${status.id || status.slug}`}
                                    status={status}
                                    onEdit={(s) => {
                                        setEditingStatus(s);
                                        setEditName(s.name);
                                        setEditColor(s.color);
                                        setEditIcon(s.icon);
                                    }}
                                    onDelete={(id) => handleDelete(id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <div className="w-full h-px bg-border-dark my-4" />

            {/* List Sidebar */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-text-secondary">
                    <LucideIcons.ListOrdered className="w-5 h-5" />
                    <h3 className="font-bold">Ordenação da Lista Lateral (Sidebar)</h3>
                </div>
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSidebarDragEnd}>
                    <SortableContext items={sidebarStatuses.map(s => s.id || s.slug)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sidebarStatuses.map(status => (
                                <SortableStatusCard
                                    key={`sidebar-${status.id || status.slug}`}
                                    status={status}
                                    onEdit={(s) => {
                                        setEditingStatus(s);
                                        setEditName(s.name);
                                        setEditColor(s.color);
                                        setEditIcon(s.icon);
                                    }}
                                    onDelete={(id) => handleDelete(id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* Edit Modal / Form */}
            {editingStatus && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
                    <div className="bg-surface-dark border border-primary/30 p-6 rounded-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <LucideIcons.Edit3 className="w-5 h-5 text-primary" />
                                Editar Status
                            </h3>
                            <button onClick={() => setEditingStatus(null)} className="text-text-secondary hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-text-secondary">Nome do Status</label>
                                <input
                                    className="bg-background-dark border border-border-dark rounded-xl p-3 text-white outline-none focus:border-primary transition-all"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="Nome do status"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-text-secondary flex items-center justify-between">
                                    Cor Representativa
                                    <span className="text-[10px] font-mono opacity-50 uppercase">{editColor}</span>
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative group flex items-center justify-center">
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={e => setEditColor(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            title="Escolher cor personalizada"
                                        />
                                        <div
                                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden ${!COLOR_OPTIONS.some(c => c.value.toLowerCase() === editColor.toLowerCase())
                                                ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                                                : 'border-primary/50 bg-background-dark group-hover:border-primary'
                                                }`}
                                            style={!COLOR_OPTIONS.some(c => c.value.toLowerCase() === editColor.toLowerCase()) ? { backgroundColor: editColor } : {}}
                                        >
                                            <Palette className={`w-4 h-4 ${!COLOR_OPTIONS.some(c => c.value.toLowerCase() === editColor.toLowerCase()) ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-primary'}`} />
                                        </div>
                                    </div>
                                    <div className="w-px h-6 bg-border-dark mx-1" />
                                    {COLOR_OPTIONS.map(c => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setEditColor(c.value)}
                                            className={`w-7 h-7 rounded-full border-2 transition-all ${editColor.toLowerCase() === c.value.toLowerCase() ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            style={{ backgroundColor: c.value }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 md:col-span-2">
                                <label className="text-sm font-medium text-text-secondary">Ícone</label>
                                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                                    {ICON_OPTIONS.map(iconName => {
                                        const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
                                        return (
                                            <button
                                                key={iconName}
                                                type="button"
                                                onClick={() => setEditIcon(iconName)}
                                                className={`p-3 rounded-xl border-2 flex items-center justify-center transition-all ${editIcon === iconName
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border-dark bg-background-dark text-text-secondary hover:border-text-secondary hover:text-white'}`}
                                            >
                                                <IconComponent className="w-5 h-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setEditingStatus(null)}
                                className="px-6 py-3 rounded-lg text-white font-bold hover:bg-white/5 transition-all text-sm mb-0"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={loading || !editName.trim()}
                                className="bg-primary text-background-dark font-bold px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50 transition-all text-sm mb-0"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    );
}
