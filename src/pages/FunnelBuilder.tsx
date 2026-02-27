import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import {
    Loader2, Plus, Trash2, Save, X, ChevronDown, ChevronUp,
    Target, GripVertical, Copy
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────

interface FunnelCondition {
    metric: string;
    operator: string;
    value: number;
}

interface FunnelDay {
    day: number;
    conditions: FunnelCondition[];
}

interface Funnel {
    id: string;
    user_id: string;
    name: string;
    days: FunnelDay[];
    maintenance_conditions: FunnelCondition[];
    created_at: string;
}

// ── Constants ────────────────────────────────────────────

const METRICS = [
    { key: 'ad_clicks', label: 'Cliques de Anúncio', unit: '', type: 'int' },
    { key: 'shopee_clicks', label: 'Cliques na Shopee', unit: '', type: 'int' },
    { key: 'cpc', label: 'CPC', unit: 'R$', type: 'decimal' },
    { key: 'orders', label: 'Pedidos', unit: '', type: 'int' },
    { key: 'commission_value', label: 'Comissão', unit: 'R$', type: 'decimal' },
    { key: 'investment', label: 'Investimento', unit: 'R$', type: 'decimal' },
    { key: 'profit', label: 'Lucro', unit: 'R$', type: 'decimal' },
    { key: 'roi_percentage', label: 'ROI (%)', unit: '%', type: 'decimal' },
] as const;

const OPERATORS = [
    { key: '<=', label: '≤ Igual ou menor' },
    { key: '>=', label: '≥ Igual ou maior' },
    { key: '==', label: '= Igual a' },
    { key: '>', label: '> Maior que' },
    { key: '<', label: '< Menor que' },
] as const;

/**
 * Presets de lucro — ao selecionar, auto-define operator+value (valor sempre 0).
 * O campo value é ocultado quando uma dessas opções é escolhida.
 */
const PROFIT_PRESETS = [
    { operator: '<', value: 0, label: 'Prejuízo' },
    { operator: '==', value: 0, label: 'Empate (0x0)' },
    { operator: '>', value: 0, label: 'Lucrando' },
    { operator: '<=', value: 0, label: 'Prejuízo ou Empate' },
    { operator: '>=', value: 0, label: 'Empate ou Lucrando' },
] as const;

/** Verifica se a condição é um preset de lucro */
const isProfitPreset = (cond: FunnelCondition) =>
    cond.metric === 'profit' && cond.value === 0 && PROFIT_PRESETS.some(p => p.operator === cond.operator);

const getProfitPresetLabel = (operator: string) =>
    PROFIT_PRESETS.find(p => p.operator === operator)?.label || operator;

// ── Component ────────────────────────────────────────────

export function FunnelBuilder() {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [funnels, setFunnels] = useState<Funnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null);
    const [editName, setEditName] = useState('');
    const [editDays, setEditDays] = useState<FunnelDay[]>([]);
    const [editMaintenance, setEditMaintenance] = useState<FunnelCondition[]>([]);
    const [expandedDay, setExpandedDay] = useState<number | null>(null);

    const [showNewForm, setShowNewForm] = useState(false);
    const [newFunnelName, setNewFunnelName] = useState('');

    // ── Fetch ────────────────────────────────────────────

    useEffect(() => {
        if (user) fetchFunnels();
    }, [user]);

    const fetchFunnels = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('funnels')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setFunnels(data || []);
        } catch (err) {
            console.error(err);
            showToast('Erro ao carregar funis.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── CRUD ─────────────────────────────────────────────

    const handleCreateFunnel = async () => {
        if (!newFunnelName.trim()) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('funnels')
                .insert({
                    user_id: user!.id,
                    name: newFunnelName.trim(),
                    days: [],
                    maintenance_conditions: [],
                })
                .select()
                .single();
            if (error) throw error;
            if (data) {
                setFunnels(prev => [data, ...prev]);
                setNewFunnelName('');
                setShowNewForm(false);
                handleSelectFunnel(data);
                showToast('Funil criado!');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro ao criar funil.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSelectFunnel = (funnel: Funnel) => {
        setSelectedFunnel(funnel);
        setEditName(funnel.name);
        setEditDays(JSON.parse(JSON.stringify(funnel.days || [])));
        setEditMaintenance(JSON.parse(JSON.stringify(funnel.maintenance_conditions || [])));
        setExpandedDay(null);
    };

    const handleSaveFunnel = async () => {
        if (!selectedFunnel) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('funnels')
                .update({
                    name: editName.trim(),
                    days: editDays,
                    maintenance_conditions: editMaintenance,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedFunnel.id);
            if (error) throw error;
            showToast('Funil salvo!');
            fetchFunnels();
            setSelectedFunnel({ ...selectedFunnel, name: editName, days: editDays, maintenance_conditions: editMaintenance });
        } catch (err) {
            console.error(err);
            showToast('Erro ao salvar funil.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteFunnel = async (funnelId: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este funil?')) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('funnels').delete().eq('id', funnelId);
            if (error) throw error;
            setFunnels(prev => prev.filter(f => f.id !== funnelId));
            if (selectedFunnel?.id === funnelId) {
                setSelectedFunnel(null);
                setEditDays([]);
            }
            showToast('Funil excluído!');
        } catch (err) {
            console.error(err);
            showToast('Erro ao excluir funil.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Day Management ───────────────────────────────────

    const addDay = () => {
        const nextDay = editDays.length > 0 ? Math.max(...editDays.map(d => d.day)) + 1 : 1;
        setEditDays([...editDays, { day: nextDay, conditions: [] }]);
        setExpandedDay(nextDay);
    };

    const removeDay = (dayNumber: number) => {
        setEditDays(editDays.filter(d => d.day !== dayNumber));
        if (expandedDay === dayNumber) setExpandedDay(null);
    };

    const duplicateDay = (dayNumber: number) => {
        const source = editDays.find(d => d.day === dayNumber);
        if (!source) return;
        const nextDay = Math.max(...editDays.map(d => d.day)) + 1;
        setEditDays([...editDays, { day: nextDay, conditions: JSON.parse(JSON.stringify(source.conditions)) }]);
        setExpandedDay(nextDay);
    };

    // ── Condition Management ─────────────────────────────

    const addCondition = (dayNumber: number) => {
        setEditDays(editDays.map(d => {
            if (d.day !== dayNumber) return d;
            return {
                ...d,
                conditions: [...d.conditions, { metric: 'cpc', operator: '<=', value: 0 }],
            };
        }));
    };

    const updateCondition = (dayNumber: number, condIndex: number, field: keyof FunnelCondition, val: string | number) => {
        setEditDays(editDays.map(d => {
            if (d.day !== dayNumber) return d;
            const updated = [...d.conditions];
            updated[condIndex] = { ...updated[condIndex], [field]: field === 'value' ? Number(val) : val };
            return { ...d, conditions: updated };
        }));
    };

    const removeCondition = (dayNumber: number, condIndex: number) => {
        setEditDays(editDays.map(d => {
            if (d.day !== dayNumber) return d;
            const updated = [...d.conditions];
            updated.splice(condIndex, 1);
            return { ...d, conditions: updated };
        }));
    };

    /** Atualiza múltiplos campos de uma condição em um único setState */
    const updateConditionFields = (dayNumber: number, condIndex: number, fields: Partial<FunnelCondition>) => {
        setEditDays(prev => prev.map(d => {
            if (d.day !== dayNumber) return d;
            const updated = [...d.conditions];
            updated[condIndex] = { ...updated[condIndex], ...fields };
            return { ...d, conditions: updated };
        }));
    };

    // ── Helpers ──────────────────────────────────────────

    const getMetricLabel = (key: string) => METRICS.find(m => m.key === key)?.label || key;
    const getMetricUnit = (key: string) => METRICS.find(m => m.key === key)?.unit || '';

    const formatConditionPreview = (condition: FunnelCondition) => {
        // Presets de lucro
        if (isProfitPreset(condition)) {
            return `Lucro: ${getProfitPresetLabel(condition.operator)}`;
        }
        const unit = getMetricUnit(condition.metric);
        const valueStr = unit === 'R$'
            ? `R$ ${condition.value.toFixed(2).replace('.', ',')}`
            : unit === '%'
                ? `${condition.value}%`
                : `${condition.value}`;
        return `${getMetricLabel(condition.metric)} ${condition.operator} ${valueStr}`;
    };

    // ── Render ───────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="w-6 h-6 text-primary" />
                        Funil Builder
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">Crie funis com regras diárias de métricas</p>
                </div>
                <button
                    onClick={() => setShowNewForm(true)}
                    className="bg-primary text-background-dark font-bold px-4 py-2 rounded-lg hover:bg-opacity-90 flex items-center gap-2 shadow-[0_0_15px_rgba(242,162,13,0.3)] text-sm"
                >
                    <Plus className="w-4 h-4" /> Novo Funil
                </button>
            </div>

            {/* New Funnel Form */}
            {showNewForm && (
                <div className="bg-surface-dark border border-primary/30 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-200">
                    <input
                        className="flex-1 bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-primary transition-colors"
                        placeholder="Nome do funil..."
                        value={newFunnelName}
                        onChange={(e) => setNewFunnelName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFunnel()}
                        autoFocus
                    />
                    <button
                        onClick={handleCreateFunnel}
                        disabled={saving || !newFunnelName.trim()}
                        className="bg-primary text-background-dark font-bold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Criar
                    </button>
                    <button onClick={() => { setShowNewForm(false); setNewFunnelName(''); }} className="text-text-secondary hover:text-white p-2">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Funnel List */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                    {funnels.length === 0 && !showNewForm && (
                        <div className="bg-surface-dark border border-border-dark rounded-2xl p-8 text-center">
                            <Target className="w-10 h-10 text-text-secondary mx-auto mb-3" />
                            <p className="text-text-secondary text-sm">Nenhum funil criado ainda.</p>
                            <button
                                onClick={() => setShowNewForm(true)}
                                className="mt-4 text-primary text-sm font-medium hover:underline"
                            >
                                + Criar seu primeiro funil
                            </button>
                        </div>
                    )}

                    {funnels.map(funnel => (
                        <div
                            key={funnel.id}
                            onClick={() => handleSelectFunnel(funnel)}
                            className={`bg-surface-dark border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50 ${selectedFunnel?.id === funnel.id
                                ? 'border-primary shadow-[0_0_10px_rgba(242,162,13,0.15)]'
                                : 'border-border-dark'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <h3 className="text-white font-semibold text-sm truncate">{funnel.name}</h3>
                                    <p className="text-text-secondary text-xs mt-0.5">
                                        {(funnel.days || []).length} dia(s) configurado(s)
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(funnel.id); }}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Funnel Editor */}
                <div className="lg:col-span-8">
                    {!selectedFunnel ? (
                        <div className="bg-surface-dark border border-border-dark rounded-2xl p-12 text-center">
                            <GripVertical className="w-8 h-8 text-text-secondary mx-auto mb-3" />
                            <p className="text-text-secondary text-sm">Selecione ou crie um funil para editar</p>
                        </div>
                    ) : (
                        <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                            {/* Editor Header */}
                            <div className="p-4 border-b border-border-dark flex items-center justify-between gap-3">
                                <input
                                    className="flex-1 bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-white text-sm font-semibold outline-none focus:border-primary transition-colors"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Nome do funil..."
                                />
                                <button
                                    onClick={handleSaveFunnel}
                                    disabled={saving}
                                    className="bg-primary text-background-dark font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(242,162,13,0.2)]"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar
                                </button>
                            </div>

                            {/* Days */}
                            <div className="p-4 flex flex-col gap-3">
                                {editDays.length === 0 && (
                                    <div className="text-center py-8 text-text-secondary text-sm">
                                        Nenhum dia adicionado. Clique em "Adicionar Dia" para começar.
                                    </div>
                                )}

                                {editDays
                                    .sort((a, b) => a.day - b.day)
                                    .map((funnelDay) => {
                                        const isExpanded = expandedDay === funnelDay.day;
                                        return (
                                            <div key={funnelDay.day} className="border border-border-dark rounded-xl bg-background-dark overflow-hidden">
                                                {/* Day Header */}
                                                <button
                                                    onClick={() => setExpandedDay(isExpanded ? null : funnelDay.day)}
                                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-highlight/30 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/30">
                                                            {funnelDay.day}
                                                        </span>
                                                        <div className="text-left">
                                                            <span className="text-white text-sm font-medium">Dia {funnelDay.day}</span>
                                                            <span className="text-text-secondary text-xs ml-2">
                                                                {funnelDay.conditions.length} condição(ões)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); duplicateDay(funnelDay.day); }}
                                                            title="Duplicar dia"
                                                            className="p-1 rounded text-text-secondary hover:text-blue-400 transition-colors"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeDay(funnelDay.day); }}
                                                            title="Remover dia"
                                                            className="p-1 rounded text-text-secondary hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
                                                    </div>
                                                </button>

                                                {/* Conditions Preview (collapsed) */}
                                                {!isExpanded && funnelDay.conditions.length > 0 && (
                                                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                                                        {funnelDay.conditions.map((cond, ci) => (
                                                            <span key={ci} className="text-[10px] bg-surface-highlight text-text-secondary px-2 py-0.5 rounded-full border border-border-dark">
                                                                {formatConditionPreview(cond)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Expanded: Condition Editor */}
                                                {isExpanded && (
                                                    <div className="border-t border-border-dark p-4 flex flex-col gap-3">
                                                        {funnelDay.conditions.map((cond, ci) => {
                                                            const isProfit = cond.metric === 'profit';
                                                            return (
                                                                <div key={ci} className="flex items-center gap-2 flex-wrap">
                                                                    {/* Metric */}
                                                                    <select
                                                                        value={cond.metric}
                                                                        onChange={(e) => {
                                                                            const newMetric = e.target.value;
                                                                            if (newMetric === 'profit') {
                                                                                // Atualizar metric + operator + value de uma vez
                                                                                updateConditionFields(funnelDay.day, ci, {
                                                                                    metric: 'profit',
                                                                                    operator: '>',
                                                                                    value: 0,
                                                                                });
                                                                            } else {
                                                                                updateCondition(funnelDay.day, ci, 'metric', newMetric);
                                                                            }
                                                                        }}
                                                                        className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary flex-1 min-w-[140px]"
                                                                    >
                                                                        {METRICS.map(m => (
                                                                            <option key={m.key} value={m.key}>{m.label}</option>
                                                                        ))}
                                                                    </select>

                                                                    {isProfit ? (
                                                                        /* Preset de Lucro */
                                                                        <select
                                                                            value={cond.operator}
                                                                            onChange={(e) => {
                                                                                const preset = PROFIT_PRESETS.find(p => p.operator === e.target.value);
                                                                                if (preset) {
                                                                                    updateCondition(funnelDay.day, ci, 'operator', preset.operator);
                                                                                    updateCondition(funnelDay.day, ci, 'value', preset.value);
                                                                                }
                                                                            }}
                                                                            className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary flex-1 min-w-[160px]"
                                                                        >
                                                                            {PROFIT_PRESETS.map(p => (
                                                                                <option key={p.operator} value={p.operator}>{p.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <>
                                                                            {/* Operator */}
                                                                            <select
                                                                                value={cond.operator}
                                                                                onChange={(e) => updateCondition(funnelDay.day, ci, 'operator', e.target.value)}
                                                                                className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary min-w-[120px]"
                                                                            >
                                                                                {OPERATORS.map(o => (
                                                                                    <option key={o.key} value={o.key}>{o.label}</option>
                                                                                ))}
                                                                            </select>

                                                                            {/* Value */}
                                                                            <div className="relative flex-1 min-w-[100px]">
                                                                                {getMetricUnit(cond.metric) && (
                                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xs">
                                                                                        {getMetricUnit(cond.metric)}
                                                                                    </span>
                                                                                )}
                                                                                <input
                                                                                    type="number"
                                                                                    step="any"
                                                                                    value={cond.value}
                                                                                    onChange={(e) => updateCondition(funnelDay.day, ci, 'value', e.target.value)}
                                                                                    className={`w-full bg-surface-dark border border-border-dark rounded-lg py-2 text-xs text-white outline-none focus:border-primary ${getMetricUnit(cond.metric) ? 'pl-8 pr-3' : 'px-3'
                                                                                        }`}
                                                                                />
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    {/* Remove */}
                                                                    <button
                                                                        onClick={() => removeCondition(funnelDay.day, ci)}
                                                                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}

                                                        <button
                                                            onClick={() => addCondition(funnelDay.day)}
                                                            className="text-primary text-xs font-medium hover:underline flex items-center gap-1 mt-1"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Adicionar Condição
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                {/* Add Day Button */}
                                <button
                                    onClick={addDay}
                                    className="w-full border-2 border-dashed border-border-dark rounded-xl py-3 text-sm text-text-secondary hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar Dia
                                </button>

                                {/* ── Manutenção (Constant Day) ── */}
                                <div className="bg-surface-dark border border-green-500/30 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 bg-green-500/5">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">∞</span>
                                            <div>
                                                <span className="text-sm font-bold text-green-400">Manutenção</span>
                                                <span className="text-xs text-text-secondary ml-2">
                                                    {editMaintenance.length} condição(ões) · aplica a todos os dias após Dia {editDays.length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {editMaintenance.map((cond, ci) => {
                                            const metricObj = METRICS.find(m => m.key === cond.metric);
                                            return (
                                                <div key={ci} className="flex items-center gap-2 flex-wrap">
                                                    <select
                                                        value={cond.metric}
                                                        onChange={(e) => {
                                                            const newMetric = e.target.value;
                                                            const updated = [...editMaintenance];
                                                            if (newMetric === 'profit') {
                                                                updated[ci] = { ...updated[ci], metric: 'profit', operator: '>', value: 0 };
                                                            } else {
                                                                updated[ci] = { ...updated[ci], metric: newMetric };
                                                            }
                                                            setEditMaintenance(updated);
                                                        }}
                                                        className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500 flex-1 min-w-[140px]"
                                                    >
                                                        {METRICS.map(m => (
                                                            <option key={m.key} value={m.key}>{m.label}</option>
                                                        ))}
                                                    </select>

                                                    {cond.metric === 'profit' && isProfitPreset(cond) ? (
                                                        <select
                                                            value={`${cond.operator}|${cond.value}`}
                                                            onChange={(e) => {
                                                                const [op, val] = e.target.value.split('|');
                                                                const updated = [...editMaintenance];
                                                                updated[ci] = { ...updated[ci], operator: op, value: Number(val) };
                                                                setEditMaintenance(updated);
                                                            }}
                                                            className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500 flex-1 min-w-[160px]"
                                                        >
                                                            {PROFIT_PRESETS.map(p => (
                                                                <option key={p.label} value={`${p.operator}|${p.value}`}>{p.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <>
                                                            <select
                                                                value={cond.operator}
                                                                onChange={(e) => {
                                                                    const updated = [...editMaintenance];
                                                                    updated[ci] = { ...updated[ci], operator: e.target.value };
                                                                    setEditMaintenance(updated);
                                                                }}
                                                                className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500 w-[130px]"
                                                            >
                                                                {OPERATORS.map(o => (
                                                                    <option key={o.key} value={o.key}>{o.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="flex items-center gap-1">
                                                                {metricObj?.unit && <span className="text-xs text-text-secondary">{metricObj.unit}</span>}
                                                                <input
                                                                    type="number"
                                                                    step={metricObj?.type === 'decimal' ? '0.01' : '1'}
                                                                    value={cond.value}
                                                                    onChange={(e) => {
                                                                        const updated = [...editMaintenance];
                                                                        updated[ci] = { ...updated[ci], value: Number(e.target.value) };
                                                                        setEditMaintenance(updated);
                                                                    }}
                                                                    className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500 w-[90px] text-right"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() => setEditMaintenance(editMaintenance.filter((_, i) => i !== ci))}
                                                        className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        <button
                                            onClick={() => setEditMaintenance([...editMaintenance, { metric: 'ad_clicks', operator: '<=', value: 0 }])}
                                            className="text-green-400 text-xs font-medium hover:underline flex items-center gap-1 mt-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Adicionar Condição de Manutenção
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
