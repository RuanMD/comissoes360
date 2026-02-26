import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import {
    Loader2, Plus, Trash2, ArrowLeft, Pencil, Save, X,
    DollarSign, ShoppingCart, TrendingUp, MousePointerClick,
    BarChart3, Target, PiggyBank, Percent
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface Track {
    id: string;
    user_id: string;
    name: string;
    affiliate_link: string;
    sub_id: string;
    created_at: string;
}

interface TrackEntry {
    id: string;
    track_id: string;
    date: string;
    ad_clicks: number;
    shopee_clicks: number;
    cpc: number;
    orders: number;
    commission_value: number;
    investment: number;
}

// Form state for new entry
interface EntryForm {
    date: string;
    ad_clicks: string;
    shopee_clicks: string;
    cpc: string;
    orders: string;
    commission_value: string;
    investment: string;
}

const emptyEntryForm: EntryForm = {
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    ad_clicks: '',
    shopee_clicks: '',
    cpc: '',
    orders: '',
    commission_value: '',
    investment: '',
};

export function CreativeTrack() {
    const { user } = useAuth();
    const { showToast } = useToast();

    // State
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Track detail state
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [entries, setEntries] = useState<TrackEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);

    // New track form
    const [showNewForm, setShowNewForm] = useState(false);
    const [newTrackName, setNewTrackName] = useState('');
    const [newTrackLink, setNewTrackLink] = useState('');
    const [newTrackSubId, setNewTrackSubId] = useState('');

    // Edit track
    const [editingTrack, setEditingTrack] = useState(false);
    const [editName, setEditName] = useState('');
    const [editLink, setEditLink] = useState('');
    const [editSubId, setEditSubId] = useState('');

    // New entry form
    const [entryForm, setEntryForm] = useState<EntryForm>({ ...emptyEntryForm });

    // ========== FETCH TRACKS ==========
    useEffect(() => {
        if (user) fetchTracks();
    }, [user]);

    const fetchTracks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('creative_tracks')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setTracks(data || []);
        } catch (error) {
            console.error('Erro ao carregar tracks:', error);
            showToast('Erro ao carregar tracks.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ========== CREATE TRACK ==========
    const handleCreateTrack = async () => {
        if (!newTrackName.trim()) {
            showToast('Nome é obrigatório.', 'error');
            return;
        }
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('creative_tracks')
                .insert({
                    user_id: user!.id,
                    name: newTrackName.trim(),
                    affiliate_link: newTrackLink.trim(),
                    sub_id: newTrackSubId.trim(),
                })
                .select()
                .single();
            if (error) throw error;
            setTracks(prev => [...prev, data]);
            setNewTrackName('');
            setNewTrackLink('');
            setNewTrackSubId('');
            setShowNewForm(false);
            showToast('Track criado com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao criar track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== DELETE TRACK ==========
    const handleDeleteTrack = async (track: Track) => {
        if (!window.confirm(`Excluir "${track.name}" e todos os seus registros? Esta ação não pode ser desfeita.`)) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('creative_tracks').delete().eq('id', track.id);
            if (error) throw error;
            setTracks(prev => prev.filter(t => t.id !== track.id));
            if (selectedTrack?.id === track.id) {
                setSelectedTrack(null);
                setEntries([]);
            }
            showToast('Track excluído!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== UPDATE TRACK ==========
    const handleUpdateTrack = async () => {
        if (!selectedTrack || !editName.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('creative_tracks')
                .update({
                    name: editName.trim(),
                    affiliate_link: editLink.trim(),
                    sub_id: editSubId.trim(),
                })
                .eq('id', selectedTrack.id);
            if (error) throw error;
            const updated = { ...selectedTrack, name: editName.trim(), affiliate_link: editLink.trim(), sub_id: editSubId.trim() };
            setSelectedTrack(updated);
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setEditingTrack(false);
            showToast('Track atualizado!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== SELECT TRACK (load entries) ==========
    const handleSelectTrack = async (track: Track) => {
        setSelectedTrack(track);
        setEditingTrack(false);
        setEntryForm({ ...emptyEntryForm });
        setLoadingEntries(true);
        try {
            const { data, error } = await supabase
                .from('creative_track_entries')
                .select('*')
                .eq('track_id', track.id)
                .order('date', { ascending: false });
            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar registros.', 'error');
        } finally {
            setLoadingEntries(false);
        }
    };

    // ========== ADD/UPSERT ENTRY ==========
    const handleAddEntry = async () => {
        if (!selectedTrack || !entryForm.date) {
            showToast('Data é obrigatória.', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                track_id: selectedTrack.id,
                date: entryForm.date,
                ad_clicks: parseInt(entryForm.ad_clicks) || 0,
                shopee_clicks: parseInt(entryForm.shopee_clicks) || 0,
                cpc: parseFloat(entryForm.cpc) || 0,
                orders: parseInt(entryForm.orders) || 0,
                commission_value: parseFloat(entryForm.commission_value) || 0,
                investment: parseFloat(entryForm.investment) || 0,
            };
            const { data, error } = await supabase
                .from('creative_track_entries')
                .upsert(payload, { onConflict: 'track_id,date' })
                .select()
                .single();
            if (error) throw error;
            // Update or insert in local state
            setEntries(prev => {
                const exists = prev.find(e => e.date === data.date);
                if (exists) {
                    return prev.map(e => e.date === data.date ? data : e);
                }
                return [data, ...prev].sort((a, b) => b.date.localeCompare(a.date));
            });
            setEntryForm({ ...emptyEntryForm });
            showToast('Registro salvo!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar registro.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== DELETE ENTRY ==========
    const handleDeleteEntry = async (entry: TrackEntry) => {
        if (!window.confirm('Excluir este registro?')) return;
        try {
            const { error } = await supabase.from('creative_track_entries').delete().eq('id', entry.id);
            if (error) throw error;
            setEntries(prev => prev.filter(e => e.id !== entry.id));
            showToast('Registro excluído!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir registro.', 'error');
        }
    };

    // ========== COMPUTED KPIs ==========
    const kpis = useMemo(() => {
        if (entries.length === 0) return null;
        const totalCommission = entries.reduce((s, e) => s + Number(e.commission_value), 0);
        const totalInvestment = entries.reduce((s, e) => s + Number(e.investment), 0);
        const totalOrders = entries.reduce((s, e) => s + Number(e.orders), 0);
        const totalShopeeClicks = entries.reduce((s, e) => s + Number(e.shopee_clicks), 0);
        const totalAdClicks = entries.reduce((s, e) => s + Number(e.ad_clicks), 0);
        const totalProfit = totalCommission - totalInvestment;
        const avgOrdersPerDay = entries.length > 0 ? totalOrders / entries.length : 0;
        const profitPct = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

        return {
            totalProfit,
            totalOrders,
            avgOrdersPerDay,
            totalCommission,
            totalInvestment,
            profitPct,
            totalShopeeClicks,
            totalAdClicks,
        };
    }, [entries]);

    // Computed values for entry form (real-time)
    const entryProfit = (parseFloat(entryForm.commission_value) || 0) - (parseFloat(entryForm.investment) || 0);
    const entryProfitPct = (parseFloat(entryForm.investment) || 0) > 0
        ? (entryProfit / (parseFloat(entryForm.investment) || 1)) * 100
        : 0;

    // ========== RENDER ==========

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // ===== DETAIL VIEW =====
    if (selectedTrack) {
        return (
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setSelectedTrack(null); setEntries([]); setEditingTrack(false); }}
                            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        {editingTrack ? (
                            <input
                                className="bg-background-dark border border-primary rounded-lg p-2 text-white text-xl font-bold outline-none"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                autoFocus
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-white">{selectedTrack.name}</h1>
                        )}
                        {selectedTrack.sub_id && !editingTrack && (
                            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                                {selectedTrack.sub_id}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {editingTrack ? (
                            <>
                                <button
                                    onClick={() => setEditingTrack(false)}
                                    className="px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleUpdateTrack}
                                    disabled={saving}
                                    className="bg-primary text-background-dark font-bold px-4 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    <Save className="w-4 h-4" /> Salvar
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        setEditingTrack(true);
                                        setEditName(selectedTrack.name);
                                        setEditLink(selectedTrack.affiliate_link);
                                        setEditSubId(selectedTrack.sub_id);
                                    }}
                                    className="px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm flex items-center gap-1"
                                >
                                    <Pencil className="w-4 h-4" /> Editar
                                </button>
                                <button
                                    onClick={() => handleDeleteTrack(selectedTrack)}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" /> Excluir
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Edit Fields */}
                {editingTrack && (
                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Link de Afiliado</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={editLink}
                                onChange={e => setEditLink(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Sub_ID</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={editSubId}
                                onChange={e => setEditSubId(e.target.value)}
                                placeholder="Ex: MOP"
                            />
                        </div>
                    </div>
                )}

                {/* KPIs Dashboard */}
                {loadingEntries ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : kpis ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Lucro Total', value: `R$ ${kpis.totalProfit.toFixed(2)}`, icon: DollarSign, color: kpis.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                            { label: 'Pedidos Totais', value: kpis.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
                            { label: 'Média Pedidos/Dia', value: kpis.avgOrdersPerDay.toFixed(1), icon: BarChart3, color: 'text-purple-400' },
                            { label: 'Total Comissões', value: `R$ ${kpis.totalCommission.toFixed(2)}`, icon: TrendingUp, color: 'text-primary' },
                            { label: 'Total Investimento', value: `R$ ${kpis.totalInvestment.toFixed(2)}`, icon: PiggyBank, color: 'text-orange-400' },
                            { label: '% Lucro Médio', value: `${kpis.profitPct.toFixed(1)}%`, icon: Percent, color: kpis.profitPct >= 0 ? 'text-green-400' : 'text-red-400' },
                            { label: 'Cliques Shopee', value: kpis.totalShopeeClicks.toString(), icon: MousePointerClick, color: 'text-cyan-400' },
                            { label: 'Cliques Anúncio', value: kpis.totalAdClicks.toString(), icon: Target, color: 'text-pink-400' },
                        ].map((kpi, i) => (
                            <div key={i} className="bg-surface-dark border border-border-dark rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                                    <span className="text-xs text-text-secondary">{kpi.label}</span>
                                </div>
                                <span className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 bg-surface-dark rounded-2xl border border-border-dark text-neutral-400 text-sm">
                        Nenhum registro ainda. Adicione o primeiro abaixo.
                    </div>
                )}

                {/* New Entry Form */}
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-4 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-white">Novo Registro Diário</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Data</label>
                            <input
                                type="date"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.date}
                                onChange={e => setEntryForm({ ...entryForm, date: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Cliques Anúncio</label>
                            <input
                                type="number"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.ad_clicks}
                                onChange={e => setEntryForm({ ...entryForm, ad_clicks: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Cliques Shopee</label>
                            <input
                                type="number"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.shopee_clicks}
                                onChange={e => setEntryForm({ ...entryForm, shopee_clicks: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">CPC (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.cpc}
                                onChange={e => setEntryForm({ ...entryForm, cpc: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Qtd Pedidos</label>
                            <input
                                type="number"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.orders}
                                onChange={e => setEntryForm({ ...entryForm, orders: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Valor Comissão (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.commission_value}
                                onChange={e => setEntryForm({ ...entryForm, commission_value: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Investimento (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={entryForm.investment}
                                onChange={e => setEntryForm({ ...entryForm, investment: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Lucro / %</label>
                            <div className="flex items-center gap-2 h-[46px]">
                                <span className={`text-sm font-bold ${entryProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    R$ {entryProfit.toFixed(2)}
                                </span>
                                <span className={`text-xs ${entryProfitPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ({entryProfitPct.toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleAddEntry}
                        disabled={saving}
                        className="bg-primary text-background-dark font-bold px-6 py-3 rounded-xl hover:bg-opacity-90 disabled:opacity-50 shadow-[0_0_15px_rgba(242,162,13,0.3)] flex items-center justify-center gap-2 text-sm w-full sm:w-auto sm:self-end"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Salvar Registro
                    </button>
                </div>

                {/* Entries Table */}
                {entries.length > 0 && (
                    <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-border-dark">
                            <h3 className="text-sm font-bold text-white">Histórico ({entries.length} registros)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border-dark text-text-secondary text-xs">
                                        <th className="text-left p-3">Data</th>
                                        <th className="text-right p-3">Cliq. Anúncio</th>
                                        <th className="text-right p-3">Cliq. Shopee</th>
                                        <th className="text-right p-3">CPC</th>
                                        <th className="text-right p-3">Pedidos</th>
                                        <th className="text-right p-3">Comissão</th>
                                        <th className="text-right p-3">Investimento</th>
                                        <th className="text-right p-3">Lucro</th>
                                        <th className="text-right p-3">%</th>
                                        <th className="text-center p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map(entry => {
                                        const profit = Number(entry.commission_value) - Number(entry.investment);
                                        const pct = Number(entry.investment) > 0 ? (profit / Number(entry.investment)) * 100 : 0;
                                        return (
                                            <tr key={entry.id} className="border-b border-border-dark/50 hover:bg-white/5 transition-colors">
                                                <td className="p-3 text-white whitespace-nowrap">
                                                    {format(new Date(entry.date + 'T12:00:00'), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="p-3 text-right text-neutral-300">{entry.ad_clicks}</td>
                                                <td className="p-3 text-right text-neutral-300">{entry.shopee_clicks}</td>
                                                <td className="p-3 text-right text-neutral-300">R$ {Number(entry.cpc).toFixed(2)}</td>
                                                <td className="p-3 text-right text-blue-400 font-semibold">{entry.orders}</td>
                                                <td className="p-3 text-right text-primary font-semibold">R$ {Number(entry.commission_value).toFixed(2)}</td>
                                                <td className="p-3 text-right text-orange-400">R$ {Number(entry.investment).toFixed(2)}</td>
                                                <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    R$ {profit.toFixed(2)}
                                                </td>
                                                <td className={`p-3 text-right text-xs ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {pct.toFixed(1)}%
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleDeleteEntry(entry)}
                                                        className="text-red-400/50 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ===== LIST VIEW =====
    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Criativo Track</h1>
                    <p className="text-text-secondary text-sm mt-1">Acompanhe o desempenho de cada criativo de anúncio</p>
                </div>
                <button
                    onClick={() => setShowNewForm(true)}
                    className="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl hover:bg-opacity-90 shadow-[0_0_15px_rgba(242,162,13,0.3)] flex items-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" /> Novo Track
                </button>
            </div>

            {/* New Track Form */}
            {showNewForm && (
                <div className="bg-surface-dark border border-primary/30 rounded-2xl p-4 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-white">Criar Novo Track</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Nome *</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={newTrackName}
                                onChange={e => setNewTrackName(e.target.value)}
                                placeholder="Ex: MOP"
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Link de Afiliado</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={newTrackLink}
                                onChange={e => setNewTrackLink(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Sub_ID</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={newTrackSubId}
                                onChange={e => setNewTrackSubId(e.target.value)}
                                placeholder="Ex: MOP"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <button
                            onClick={() => { setShowNewForm(false); setNewTrackName(''); setNewTrackLink(''); setNewTrackSubId(''); }}
                            className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreateTrack}
                            disabled={saving || !newTrackName.trim()}
                            className="bg-primary text-background-dark font-bold px-6 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Criar Track
                        </button>
                    </div>
                </div>
            )}

            {/* Tracks Grid */}
            {tracks.length === 0 && !showNewForm ? (
                <div className="text-center py-16 bg-surface-dark rounded-2xl border border-border-dark">
                    <Target className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <p className="text-neutral-400 text-sm">Nenhum track criado ainda.</p>
                    <p className="text-neutral-500 text-xs mt-1">Clique em "Novo Track" para começar a rastrear seus criativos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tracks.map(track => (
                        <div
                            key={track.id}
                            onClick={() => handleSelectTrack(track)}
                            className="bg-surface-dark border border-border-dark rounded-2xl p-5 cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-white font-bold text-lg group-hover:text-primary transition-colors">
                                        {track.name}
                                    </h3>
                                    {track.sub_id && (
                                        <span className="text-xs text-primary/70 font-mono">{track.sub_id}</span>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track); }}
                                    className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-text-secondary text-xs">
                                Criado em {format(new Date(track.created_at), 'dd/MM/yyyy')}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
