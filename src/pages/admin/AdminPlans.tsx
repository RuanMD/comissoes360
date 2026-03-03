import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastContext';
import { Loader2, Plus, Trash2, Save, Copy, GripVertical } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { ALL_FEATURE_KEYS, FEATURE_LABELS, FeatureKey } from '../../hooks/useFeatureAccess';

interface PlanFeature {
    id: string;
    text: string;
}

interface Plan {
    id: string;
    name: string;
    description: string;
    price: number;
    period: string;
    checkout_url: string;
    features: string[]; // No banco ainda salvamos como string[]
    _features?: PlanFeature[]; // Localmente usamos objetos com ID para reorder estável
    is_popular: boolean;
    is_active: boolean;
    feature_keys: string[];
}

interface ReorderItemProps {
    planId: string;
    feature: PlanFeature;
    onUpdate: (planId: string, featureId: string, newText: string) => void;
    onRemove: (planId: string, featureId: string) => void;
}

const ReorderItem = ({ planId, feature, onUpdate, onRemove }: ReorderItemProps) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={feature}
            dragListener={false}
            dragControls={controls}
            className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg text-sm text-neutral-300 border border-border-dark group"
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                    onPointerDown={(e) => controls.start(e)}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-white/5 rounded transition-colors touch-none"
                >
                    <GripVertical className="w-5 h-5 text-neutral-500 flex-shrink-0" />
                </div>
                <input
                    type="text"
                    value={feature.text}
                    onChange={(e) => onUpdate(planId, feature.id, e.target.value)}
                    className="bg-transparent border-none outline-none text-white w-full focus:ring-0"
                    placeholder="Descrição do item..."
                />
            </div>
            <button
                onClick={() => onRemove(planId, feature.id)}
                className="text-red-400 hover:text-red-500 p-1 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </Reorder.Item>
    );
};


export function AdminPlans() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [newFeature, setNewFeature] = useState<{ [planId: string]: string }>({});
    const { showToast } = useToast();

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .order('created_at', { ascending: true });
            if (error) throw error;
            if (data) {
                const plansWithIds = data.map((p: Plan) => ({
                    ...p,
                    _features: (p.features || []).map(f => ({ id: Math.random().toString(36).substring(7), text: f }))
                }));
                setPlans(plansWithIds);
            }
        } catch (error) {
            console.error('Erro ao puxar planos', error);
            showToast('Erro ao carregar planos.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlan = async (plan: Plan) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('plans')
                .update({
                    name: plan.name,
                    description: plan.description,
                    price: plan.price,
                    period: plan.period,
                    checkout_url: plan.checkout_url,
                    features: plan._features ? plan._features.map(f => f.text) : plan.features,
                    is_popular: plan.is_popular,
                    is_active: plan.is_active,
                    feature_keys: plan.feature_keys || [],
                })
                .eq('id', plan.id);
            if (error) throw error;
            showToast('Plano salvo com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar o plano.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCreatePlan = async () => {
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('plans')
                .insert({
                    name: 'Novo Plano',
                    description: 'Nova descrição',
                    price: 0,
                    period: 'mês',
                    checkout_url: '',
                    features: [],
                    is_popular: false,
                    is_active: true,
                    feature_keys: [],
                })
                .select()
                .single();
            if (error) throw error;
            if (data) {
                const newPlan = {
                    ...data,
                    _features: []
                };
                setPlans(prev => [...prev, newPlan]);
                showToast('Novo plano adicionado!');
            }
        } catch (error) {
            console.error(error);
            showToast('Erro ao criar plano.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicatePlan = async (plan: Plan) => {
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('plans')
                .insert({
                    name: `${plan.name} (Cópia)`,
                    description: plan.description,
                    price: plan.price,
                    period: plan.period,
                    checkout_url: plan.checkout_url,
                    features: plan.features,
                    is_popular: false,
                    is_active: plan.is_active,
                    feature_keys: plan.feature_keys || [],
                })
                .select()
                .single();
            if (error) throw error;
            if (data) {
                const newPlan = {
                    ...data,
                    _features: (data.features || []).map((f: string) => ({ id: Math.random().toString(36).substring(7), text: f }))
                };
                setPlans(prev => [...prev, newPlan]);
                showToast('Plano duplicado com sucesso!');
            }
        } catch (error) {
            console.error(error);
            showToast('Erro ao duplicar plano.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePlan = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o plano "${name}"? Esta ação não pode ser desfeita.`)) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('plans').delete().eq('id', id);
            if (error) throw error;
            setPlans(prev => prev.filter(p => p.id !== id));
            showToast('Plano excluído com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir plano.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddFeature = (planId: string) => {
        const featText = newFeature[planId];
        if (!featText || featText.trim() === '') return;

        setPlans(plans.map(p => {
            if (p.id === planId) {
                const newFeat: PlanFeature = { id: Math.random().toString(36).substring(7), text: featText };
                const updated_features = [...(p._features || []), newFeat];
                return { ...p, _features: updated_features };
            }
            return p;
        }));
        setNewFeature({ ...newFeature, [planId]: '' });
    };

    const handleReorderFeatures = (planId: string, newFeatures: PlanFeature[]) => {
        setPlans(plans.map(p =>
            p.id === planId ? { ...p, _features: newFeatures } : p
        ));
    };

    const handleUpdateFeatureText = (planId: string, featureId: string, newText: string) => {
        setPlans(plans.map(p => {
            if (p.id === planId) {
                const updated_features = (p._features || []).map(f =>
                    f.id === featureId ? { ...f, text: newText } : f
                );
                return { ...p, _features: updated_features };
            }
            return p;
        }));
    };

    const handleRemoveFeature = (planId: string, featureId: string) => {
        setPlans(plans.map(p => {
            if (p.id === planId) {
                const updated_features = (p._features || []).filter(f => f.id !== featureId);
                return { ...p, _features: updated_features };
            }
            return p;
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Planos de Assinatura</h2>
                <button
                    onClick={handleCreatePlan}
                    disabled={saving}
                    className="bg-surface-highlight hover:text-[#f2a20d] border border-[#f2a20d]/30 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    <Plus className="w-5 h-5" />
                    Novo Plano
                </button>
            </div>

            {plans.length === 0 && (
                <div className="text-center py-10 bg-surface-dark rounded-2xl border border-border-dark text-neutral-400">
                    Nenhum plano cadastrado. Clique em "Novo Plano" para começar.
                </div>
            )}

            {plans.map((plan, index) => (
                <div key={plan.id} className="bg-surface-dark border border-border-dark rounded-2xl p-6 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-dark pb-4">
                        <h3 className="text-lg font-bold text-primary">Edição de Plano</h3>
                        <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={plan.is_popular}
                                    onChange={(e) => {
                                        const newPlans = [...plans];
                                        newPlans[index].is_popular = e.target.checked;
                                        setPlans(newPlans);
                                    }}
                                />
                                Destaque "Mais Popular"
                            </label>
                            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={plan.is_active}
                                    onChange={(e) => {
                                        const newPlans = [...plans];
                                        newPlans[index].is_active = e.target.checked;
                                        setPlans(newPlans);
                                    }}
                                />
                                Ativo
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Nome</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                                value={plan.name}
                                onChange={(e) => {
                                    const newPlans = [...plans];
                                    newPlans[index].name = e.target.value;
                                    setPlans(newPlans);
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Preço (R$)</label>
                            <input
                                type="number"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                                value={plan.price}
                                onChange={(e) => {
                                    const newPlans = [...plans];
                                    newPlans[index].price = Number(e.target.value);
                                    setPlans(newPlans);
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Período (ex: / mês)</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                                value={plan.period || ''}
                                onChange={(e) => {
                                    const newPlans = [...plans];
                                    newPlans[index].period = e.target.value;
                                    setPlans(newPlans);
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Descrição</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                                value={plan.description || ''}
                                onChange={(e) => {
                                    const newPlans = [...plans];
                                    newPlans[index].description = e.target.value;
                                    setPlans(newPlans);
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-4">
                            <label className="text-sm font-medium text-text-secondary">URL de Checkout (Para onde enviar o lead)</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors border-primary/30"
                                value={plan.checkout_url || ''}
                                onChange={(e) => {
                                    const newPlans = [...plans];
                                    newPlans[index].checkout_url = e.target.value;
                                    setPlans(newPlans);
                                }}
                            />
                        </div>
                    </div>

                    {/* Features */}
                    <div className="border border-border-dark rounded-xl p-4 bg-background-dark">
                        <h4 className="text-sm font-bold text-white mb-4">Itens inclusos neste plano</h4>
                        <Reorder.Group
                            axis="y"
                            values={plan._features || []}
                            onReorder={(newFeatures) => handleReorderFeatures(plan.id, newFeatures)}
                            className="flex flex-col gap-2 mb-4"
                        >
                            {(plan._features || []).map((feature) => (
                                <ReorderItem
                                    key={feature.id}
                                    planId={plan.id}
                                    feature={feature}
                                    onUpdate={handleUpdateFeatureText}
                                    onRemove={handleRemoveFeature}
                                />
                            ))}
                            {(plan._features || []).length === 0 && <p className="text-xs text-text-secondary">Nenhum item adicionado.</p>}
                        </Reorder.Group>

                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-surface-dark border border-border-dark rounded-lg p-2 text-sm text-white outline-none focus:border-primary"
                                placeholder="Ex: Suporte prioritário..."
                                value={newFeature[plan.id] || ''}
                                onChange={(e) => setNewFeature({ ...newFeature, [plan.id]: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddFeature(plan.id);
                                }}
                            />
                            <button
                                onClick={() => handleAddFeature(plan.id)}
                                className="bg-surface-highlight text-white px-4 py-2 rounded-lg hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Adicionar
                            </button>
                        </div>
                    </div>

                    {/* Feature Keys (Recursos) */}
                    <div className="border border-border-dark rounded-xl p-4 bg-background-dark">
                        <h4 className="text-sm font-bold text-white mb-4">Recursos liberados neste plano</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {ALL_FEATURE_KEYS.map((key) => (
                                <label key={key} className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer hover:text-white transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={(plan.feature_keys || []).includes(key)}
                                        onChange={(e) => {
                                            const newPlans = [...plans];
                                            const currentKeys = newPlans[index].feature_keys || [];
                                            if (e.target.checked) {
                                                newPlans[index].feature_keys = [...currentKeys, key];
                                            } else {
                                                newPlans[index].feature_keys = currentKeys.filter((k: string) => k !== key);
                                            }
                                            setPlans(newPlans);
                                        }}
                                        className="accent-primary"
                                    />
                                    {FEATURE_LABELS[key as FeatureKey]}
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => {
                                    const newPlans = [...plans];
                                    newPlans[index].feature_keys = [...ALL_FEATURE_KEYS];
                                    setPlans(newPlans);
                                }}
                                className="text-xs text-primary hover:underline"
                            >
                                Selecionar Todos
                            </button>
                            <button
                                onClick={() => {
                                    const newPlans = [...plans];
                                    newPlans[index].feature_keys = [];
                                    setPlans(newPlans);
                                }}
                                className="text-xs text-red-400 hover:underline"
                            >
                                Limpar
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleDuplicatePlan(plan)}
                                disabled={saving}
                                className="text-neutral-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                title="Duplicar este plano"
                            >
                                <Copy className="w-4 h-4" /> Duplicar
                            </button>
                            <button
                                onClick={() => handleDeletePlan(plan.id, plan.name)}
                                disabled={saving}
                                className="text-red-400 hover:text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" /> Excluir Plano
                            </button>
                        </div>
                        <button
                            onClick={() => handleSavePlan(plan)}
                            disabled={saving}
                            className="bg-primary text-background-dark font-bold px-6 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 shadow-[0_0_15px_rgba(242,162,13,0.3)] flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Plano
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
