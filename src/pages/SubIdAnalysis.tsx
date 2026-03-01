import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { useMetrics, parseShopeeDate } from '../hooks/useMetrics';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { supabase } from '../lib/supabase';
import { syncService } from '../lib/syncService';
import { DateFilter } from '../components/ui/DateFilter';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { OrderFiltersPanel } from '../components/ui/OrderFiltersPanel';
import {
    Hash, DollarSign, MousePointerClick, Activity, Package, Eye, EyeOff,
    ChevronDown, ChevronUp, ShoppingBag, Radio, Clapperboard,
    Loader2, CheckCircle2, Plus, Save, X, Link as LinkIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface TrackInfo {
    id: string;
    name: string;
    sub_id: string;
}

interface MatchedTrack {
    track: TrackInfo;
    csvSubId: string;
    dateAggregation: Record<string, { shopee_clicks: number; orders: number; commission_value: number }>;
}

export function SubIdAnalysis() {
    const metrics = useMetrics();
    const { commissionData, clickData, reportType, isAutoSyncing } = useData();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [hideNames, setHideNames] = useState(false);
    const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'products' | 'channels' | 'orders'>('products');

    // Tracks state
    const [allTracks, setAllTracks] = useState<TrackInfo[]>([]);
    const [matchedTracks, setMatchedTracks] = useState<MatchedTrack[]>([]);

    // Inline create track form
    const [creatingForSubId, setCreatingForSubId] = useState<string | null>(null);
    const [createName, setCreateName] = useState('');
    const [createLink, setCreateLink] = useState('');
    const [savingCreate, setSavingCreate] = useState(false);

    // Filter Logic for Expanded SubID
    const expandedSubIdOrders = useMemo(() => {
        if (!expandedSubId) return [];
        return metrics.allOrders.filter(o =>
            (expandedSubId === 'Sem Sub_id' && (!o.subId || o.subId === 'Sem Sub_id')) ||
            (expandedSubId !== 'Sem Sub_id' && o.subId === expandedSubId)
        );
    }, [metrics.allOrders, expandedSubId]);

    const filterState = useOrderFilters(expandedSubIdOrders);

    // Build date aggregation for a specific CSV sub_id
    const buildDateAgg = useCallback((csvSubId: string) => {
        const dateAgg: Record<string, { shopee_clicks: number; orders: number; commission_value: number }> = {};

        clickData.forEach(click => {
            const raw = click['Sub_id'] || '';
            const canonical = raw.split('-').filter(Boolean).join('-');
            if (canonical !== csvSubId) return;

            const dateObj = parseShopeeDate(click['Tempo dos Cliques']);
            if (!dateObj) return;
            const dateKey = format(dateObj, 'yyyy-MM-dd');

            if (!dateAgg[dateKey]) dateAgg[dateKey] = { shopee_clicks: 0, orders: 0, commission_value: 0 };
            dateAgg[dateKey].shopee_clicks += 1;
        });

        commissionData.forEach(item => {
            const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
            const canonical = parts.join('-');

            if (canonical && canonical !== csvSubId) {
                if (!(csvSubId.includes(canonical) || canonical.includes(csvSubId))) return;
            } else if (!canonical) {
                return;
            }

            const dateObj = parseShopeeDate(item['Horário do pedido']);
            if (!dateObj) return;
            const dateKey = format(dateObj, 'yyyy-MM-dd');

            const netComm = parseFloat(item['Comissão líquida do afiliado(R$)']?.toString().replace(',', '.') || '0');

            if (!dateAgg[dateKey]) dateAgg[dateKey] = { shopee_clicks: 0, orders: 0, commission_value: 0 };
            dateAgg[dateKey].orders += 1;
            dateAgg[dateKey].commission_value += netComm;
        });

        return dateAgg;
    }, [clickData, commissionData]);

    // Detect matching tracks when both CSVs are loaded
    const detectMatchingTracks = useCallback(async () => {
        if (!user || (commissionData.length === 0 && clickData.length === 0)) {
            setMatchedTracks([]);
            setAllTracks([]);
            return;
        }

        try {
            const { data: tracks, error } = await supabase
                .from('creative_tracks')
                .select('id, name, sub_id')
                .eq('user_id', user.id);

            if (error) throw error;
            setAllTracks(tracks || []);

            if (!tracks || tracks.length === 0) {
                setMatchedTracks([]);
                return;
            }

            // Build canonical sub_ids from CSV
            const csvSubIds = new Set<string>();
            clickData.forEach(click => {
                const raw = click['Sub_id'] || '';
                const canonical = raw.split('-').filter(Boolean).join('-');
                if (canonical) csvSubIds.add(canonical);
            });
            commissionData.forEach(item => {
                const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                const canonical = parts.join('-');
                if (canonical) csvSubIds.add(canonical);
            });

            // Match tracks
            const matched: MatchedTrack[] = [];
            for (const track of tracks) {
                if (!track.sub_id) continue;
                let matchingCsvSubId: string | null = null;
                for (const csvSub of csvSubIds) {
                    if (csvSub === track.sub_id || csvSub.includes(track.sub_id) || track.sub_id.includes(csvSub)) {
                        matchingCsvSubId = csvSub;
                        break;
                    }
                }
                if (!matchingCsvSubId) continue;

                const dateAgg = buildDateAgg(matchingCsvSubId);
                if (Object.keys(dateAgg).length > 0) {
                    matched.push({ track, csvSubId: matchingCsvSubId, dateAggregation: dateAgg });
                }
            }

            setMatchedTracks(matched);
        } catch (err) {
            console.error('Erro ao buscar tracks:', err);
        }
    }, [user, reportType, clickData, commissionData, buildDateAgg]);

    useEffect(() => {
        detectMatchingTracks();
    }, [detectMatchingTracks]);

    // Open inline create form
    const openCreateForm = (subId: string) => {
        // Suggest a name based on the sub_id (first part before '-')
        const nameParts = subId.split('-');
        const suggestedName = nameParts[0] || subId;
        setCreatingForSubId(subId);
        setCreateName(suggestedName);
        setCreateLink('');
    };

    // Create track
    const handleCreateTrack = async () => {
        if (!creatingForSubId || !user || !createName.trim()) {
            showToast('Nome é obrigatório.', 'error');
            return;
        }

        setSavingCreate(true);
        try {
            const newTrackId = Math.random().toString(36).substr(2, 9);
            const fullPayload = {
                user_id: user.id,
                name: createName.trim(),
                affiliate_link: createLink.trim(),
                sub_id: creatingForSubId,
                id: newTrackId,
                created_at: new Date().toISOString()
            };

            // Optimistic
            const newTrack: TrackInfo = { id: newTrackId, name: createName.trim(), sub_id: creatingForSubId };
            setAllTracks(prev => [...prev, newTrack]);

            showToast(`Track "${createName.trim()}" criado localmente!`);

            setCreatingForSubId(null);
            setCreateName('');
            setCreateLink('');

            // Queue sync
            await syncService.addToQueue({
                type: 'CREATE_TRACK',
                payload: fullPayload
            });

        } catch (err) {
            console.error(err);
            showToast('Erro ao criar track.', 'error');
        } finally {
            setSavingCreate(false);
        }
    };

    // Helpers
    const getTrackForSubId = (csvSubId: string): TrackInfo | undefined => {
        return allTracks.find(t =>
            t.sub_id && (t.sub_id === csvSubId || csvSubId.includes(t.sub_id) || t.sub_id.includes(csvSubId))
        );
    };



    const toggleExpand = (subId: string) => {
        if (expandedSubId === subId) {
            setExpandedSubId(null);
        } else {
            setExpandedSubId(subId);
            setDetailTab('products');
            filterState.clearFilters(); // Reset filters when opening a new SubID
        }
    };

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border border-border-dark shadow-2xl">
                    <Hash className="w-7 h-7 sm:w-10 sm:h-10 text-primary/50" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios de Cliques e Comissões para visualizar esta análise.</p>
            </div>
        );
    }

    const showTrackColumn = commissionData.length > 0 || clickData.length > 0;

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-border-dark pb-4 sm:pb-6">
                <div className="flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Análise por Sub_ID</h2>
                    <p className="text-text-secondary text-sm">Cruzamento de Cliques e Comissões</p>
                </div>
                <DateFilter />
            </header>

            {/* Sync Banner (all tracks) */}
            {showTrackColumn && matchedTracks.length > 0 && (
                <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isAutoSyncing ? 'bg-primary/5 border-primary/30' : 'bg-green-500/5 border-green-500/30'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAutoSyncing ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                            {isAutoSyncing ? <Clapperboard className="w-5 h-5 text-primary" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">
                                {isAutoSyncing ? `${matchedTracks.length} track(s) detectado(s)` : 'Criativo Track sincronizado!'}
                            </p>
                            <p className="text-xs text-text-secondary">
                                {isAutoSyncing
                                    ? `Mesclando banco de dados com CSV para ${matchedTracks.map(m => m.track.name).join(', ')} `
                                    : `${matchedTracks.map(m => `${m.track.name} (${m.track.sub_id})`).join(', ')} — ${matchedTracks.reduce((s, m) => s + Object.keys(m.dateAggregation).length, 0)} dia(s) sincronizados`
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-green-500/10 text-green-400 border border-green-500/30">
                        {isAutoSyncing
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando BD...</>
                            : <><CheckCircle2 className="w-4 h-4" /> Banco Atualizado Automático</>
                        }
                    </div>
                </div>
            )}

            {/* Inline Create Track Form */}
            {creatingForSubId && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clapperboard className="w-5 h-5 text-primary" />
                            <h3 className="text-sm font-bold text-white">
                                Criar Track para <span className="text-primary font-mono">{creatingForSubId}</span>
                            </h3>
                        </div>
                        <button
                            onClick={() => setCreatingForSubId(null)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Nome do Track *</label>
                            <input
                                className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm"
                                value={createName}
                                onChange={e => setCreateName(e.target.value)}
                                placeholder="Ex: MOP"
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-text-secondary">Link de Afiliado (opcional)</label>
                            <div className="relative">
                                <LinkIcon className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    className="bg-background-dark border border-border-dark rounded-lg p-3 pl-9 text-white outline-none focus:border-primary transition-colors text-sm w-full"
                                    value={createLink}
                                    onChange={e => setCreateLink(e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                        <button
                            onClick={() => { setCreatingForSubId(null); setCreateName(''); setCreateLink(''); }}
                            disabled={savingCreate}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white bg-surface-dark border border-border-dark hover:border-white/20 transition-colors disabled:opacity-50"
                        >
                            <X className="w-4 h-4" /> Cancelar
                        </button>
                        <button
                            onClick={handleCreateTrack}
                            disabled={savingCreate || !createName.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-primary text-background-dark shadow-[0_0_15px_rgba(242,162,13,0.3)] hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                        >
                            {savingCreate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Criar Track
                        </button>
                    </div>
                </div>
            )}

            {/* Overview KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Sub IDs Únicos</p>
                        <p className="font-bold text-xl">{metrics.subIdRanking.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <MousePointerClick className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total Cliques</p>
                        <p className="font-bold text-xl">{metrics.totalClicks}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#a855f7]/10 flex items-center justify-center text-[#a855f7]">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Vendas Totais</p>
                        <p className="font-bold text-xl">{metrics.totalOrders}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Conversão Média</p>
                        <p className="font-bold text-xl">{metrics.conversionRate}%</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Comissão Média/Venda</p>
                        <p className="font-bold text-xl">R$ {metrics.totalOrders > 0 ? (metrics.totalNetCommission / metrics.totalOrders).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</p>
                    </div>
                </div>
            </div>

            {/* Sub ID Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-dark flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Ranking de Performance</h3>
                    <button
                        onClick={() => setHideNames(prev => !prev)}
                        title={hideNames ? 'Mostrar Sub IDs' : 'Ocultar Sub IDs'}
                        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${hideNames
                            ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                            : 'bg-surface-highlight text-text-secondary border-border-dark hover:text-white'
                            }`}
                    >
                        {hideNames ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {hideNames ? 'Sub IDs ocultos' : 'Ocultar Sub IDs'}
                    </button>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Sub ID</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">Canais Relacionados</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Cliques</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Vendas</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Conversão</th>
                                <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-right">Comissão</th>
                                {showTrackColumn && (
                                    <th className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap text-center">Track</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {metrics.subIdRanking.map((item, idx) => {
                                const isExpanded = expandedSubId === item.subId;
                                const details = metrics.subIdDetails[item.subId];
                                const colCount = showTrackColumn ? 7 : 6;

                                // Track matching
                                const existingTrack = showTrackColumn ? getTrackForSubId(item.subId) : undefined;
                                const isNoSubId = item.subId === 'Sem Sub_id';

                                return (
                                    <Fragment key={item.subId || idx}>
                                        <tr
                                            onClick={() => toggleExpand(item.subId)}
                                            className={`hover:bg-background-dark/30 transition-colors cursor-pointer ${isExpanded ? 'bg-background-dark/20' : ''}`}
                                        >
                                            <td className="p-4 text-sm font-medium text-white max-w-[200px] truncate" title={hideNames ? `Sub ID #${idx + 1} ` : item.subId}>
                                                <div className="flex items-center gap-2">
                                                    {isExpanded
                                                        ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
                                                        : <ChevronDown className="w-4 h-4 text-text-secondary/50 flex-shrink-0" />
                                                    }
                                                    {hideNames ? (
                                                        <span className="px-2 py-1 bg-surface-highlight text-text-secondary border border-border-dark rounded font-mono text-xs">
                                                            Sub ID #{idx + 1}
                                                        </span>
                                                    ) : item.subId === 'Sem Sub_id' ? (
                                                        <span className="text-text-secondary italic">{item.subId}</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded font-mono text-xs">
                                                            {item.subId}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-text-secondary max-w-[200px] truncate" title={item.channels}>
                                                {item.channels}
                                            </td>
                                            <td className="p-4 text-sm text-white text-right font-mono">{item.clicks}</td>
                                            <td className="p-4 text-sm text-white text-right font-mono">{item.orders}</td>
                                            <td className="p-4 text-sm text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 bg-background-dark rounded-full overflow-hidden hidden sm:block">
                                                        <div
                                                            className={`h-full ${parseFloat(item.conversion) > 5 ? 'bg-green-500' : 'bg-primary'}`}
                                                            style={{ width: `${Math.min(parseFloat(item.conversion) * 5, 100)}%` }}>
                                                        </div>
                                                    </div>
                                                    <span className="font-mono">{item.conversion}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                                R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            {showTrackColumn && (
                                                <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                    {isNoSubId ? (
                                                        <span className="text-xs text-neutral-600">—</span>
                                                    ) : existingTrack ? (
                                                        <span className="text-xs text-neutral-500 italic" title={`Track "${existingTrack.name}" vinculado`}>
                                                            {existingTrack.name}
                                                        </span>
                                                    ) : (
                                                        // No track -> Create button
                                                        <button
                                                            onClick={() => openCreateForm(item.subId)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary border border-border-dark hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors mx-auto"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            Criar Track
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>

                                        {/* Expanded Detail Row */}
                                        {isExpanded && details && (
                                            <tr key={`${idx}-detail`}>
                                                <td colSpan={colCount} className="p-0">
                                                    <div className="bg-background-dark/60 border-t border-b border-primary/20 px-6 py-6 flex flex-col gap-6">
                                                        {/* Detail Tabs */}
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('products'); }}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${detailTab === 'products'
                                                                    ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                                                                    : 'text-text-secondary hover:text-white bg-surface-dark/60 border border-border-dark'
                                                                    }`}
                                                            >
                                                                <ShoppingBag className="w-4 h-4" />
                                                                Pedidos Detalhados
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('channels'); }}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${detailTab === 'channels'
                                                                    ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                                                                    : 'text-text-secondary hover:text-white bg-surface-dark/60 border border-border-dark'
                                                                    }`}
                                                            >
                                                                <Radio className="w-4 h-4" />
                                                                Canais ({details.channelBreakdown.length})
                                                            </button>
                                                        </div>

                                                        {/* Details Content */}
                                                        {detailTab === 'products' ? (
                                                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                    <div className="bg-surface-dark/40 border border-border-dark/60 p-4 rounded-xl backdrop-blur-sm">
                                                                        <p className="text-text-secondary text-[10px] uppercase tracking-wider mb-2 font-bold opacity-70">Vendas (Filtrado)</p>
                                                                        <p className="text-2xl font-bold text-white font-mono leading-none">{filterState.filteredMetrics.totalUnits}</p>
                                                                    </div>
                                                                    <div className="bg-surface-dark/40 border border-border-dark/60 p-4 rounded-xl backdrop-blur-sm">
                                                                        <p className="text-text-secondary text-[10px] uppercase tracking-wider mb-2 font-bold opacity-70">Comissão (Filtrada)</p>
                                                                        <div className="flex items-baseline gap-1">
                                                                            <span className="text-xs text-primary font-bold">R$</span>
                                                                            <p className="text-2xl font-bold text-primary font-mono leading-none">
                                                                                {filterState.filteredMetrics.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-surface-dark/40 border border-border-dark/60 p-4 rounded-xl backdrop-blur-sm">
                                                                        <p className="text-text-secondary text-[10px] uppercase tracking-wider mb-2 font-bold opacity-70">Produtos Únicos</p>
                                                                        <p className="text-2xl font-bold text-white font-mono leading-none">{filterState.filteredMetrics.uniqueProductsCount}</p>
                                                                    </div>
                                                                </div>

                                                                <OrderFiltersPanel {...filterState} />

                                                                <div className="rounded-xl overflow-hidden border border-border-dark shadow-2xl">
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left text-sm min-w-[1000px]">
                                                                            <thead>
                                                                                <tr className="bg-surface-dark/80 backdrop-blur-md">
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider whitespace-nowrap">Data</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider">Produto</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-right whitespace-nowrap">Qtd</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-center whitespace-nowrap">Canal</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-center whitespace-nowrap">Sub ID</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-center whitespace-nowrap">Atribuição</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-right whitespace-nowrap">Comissão</th>
                                                                                    <th className="px-5 py-3.5 font-bold text-text-secondary text-[11px] uppercase tracking-wider text-right whitespace-nowrap">Pedido</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-border-dark/50">
                                                                                {filterState.filteredOrders.slice(0, 50).map((order, i) => {
                                                                                    const isCompleted = ['PAID', 'VALIDATED', 'COMPLETED', 'Concluído'].some(s => order.status?.toUpperCase().includes(s.toUpperCase()));
                                                                                    const isCancelled = ['CANCELLED', 'INVALID', 'FAILED', 'UNPAID', 'Cancelado'].some(s => order.status?.toUpperCase().includes(s.toUpperCase()));

                                                                                    return (
                                                                                        <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                                                                                            <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap text-xs font-mono">
                                                                                                {order.date !== '—' ? format(new Date(order.date), 'dd/MM HH:mm') : '—'}
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-white min-w-0">
                                                                                                <div className="flex items-center gap-3 min-w-0">
                                                                                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-dark/40 flex-shrink-0 border border-white/5 group-hover:border-primary/30 transition-colors">
                                                                                                        {order.imageUrl ? (
                                                                                                            <img src={order.imageUrl} alt="" className="w-full h-full object-cover" />
                                                                                                        ) : (
                                                                                                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                                                                                <ShoppingBag className="w-4 h-4 text-text-secondary opacity-30" />
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <span className="truncate max-w-[280px] text-xs font-medium group-hover:text-primary transition-colors" title={order.productName}>
                                                                                                        {order.productName}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-white text-right font-bold font-mono text-xs">{order.qty}</td>
                                                                                            <td className="px-5 py-3.5 text-center">
                                                                                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight bg-white/5 border border-white/10 text-text-secondary group-hover:border-white/20 transition-colors">
                                                                                                    {order.channel}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-center">
                                                                                                <span className="font-mono text-[10px] text-text-secondary bg-surface-dark/40 px-1.5 py-0.5 rounded border border-white/5 group-hover:text-white transition-colors">
                                                                                                    {order.subId || '—'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isCompleted
                                                                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                                                    : isCancelled
                                                                                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                                                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                                                                                    }`}>
                                                                                                    <span className={`w-1 h-1 rounded-full ${isCompleted ? 'bg-emerald-400' : isCancelled ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
                                                                                                    {isCompleted ? 'Concluído' : isCancelled ? 'Cancelado' : 'Pendente'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${order.type === 'Direta' ? 'text-emerald-400' : 'text-amber-400 opacity-80'}`}>
                                                                                                    {order.type || 'Indireta'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-primary font-black text-right font-mono">
                                                                                                {order.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                            </td>
                                                                                            <td className="px-5 py-3.5 text-text-secondary text-right font-mono text-[10px] opacity-60 hover:opacity-100 transition-opacity">
                                                                                                {order.id.length > 8 ? order.id.slice(-8) : order.id}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                                {filterState.filteredOrders.length === 0 && (
                                                                                    <tr>
                                                                                        <td colSpan={9} className="px-4 py-8 text-center text-text-secondary">
                                                                                            Nenhum pedido encontrado com estes filtros.
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead>
                                                                            <tr className="bg-surface-dark/50">
                                                                                <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap">Canal</th>
                                                                                <th className="px-4 py-3 text-xs font-bold text-text-secondary text-right uppercase tracking-wider whitespace-nowrap">Cliques</th>
                                                                                <th className="px-4 py-3 text-xs font-bold text-text-secondary text-right uppercase tracking-wider whitespace-nowrap">% Cliques</th>
                                                                                <th className="px-4 py-3 text-xs font-bold text-text-secondary text-right uppercase tracking-wider whitespace-nowrap">Vendas</th>
                                                                                <th className="px-4 py-3 text-xs font-bold text-text-secondary text-right uppercase tracking-wider whitespace-nowrap">Comissão</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-border-dark/50">
                                                                            {details.channelBreakdown.map((ch, i) => {
                                                                                const totalChannelClicks = details.channelBreakdown.reduce((s, c) => s + c.clicks, 0);
                                                                                const pct = totalChannelClicks > 0 ? ((ch.clicks / totalChannelClicks) * 100).toFixed(1) : '0.0';
                                                                                return (
                                                                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                                                        <td className="px-4 py-3 text-sm text-white">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                                                                                <span className="truncate max-w-[150px] font-medium" title={ch.channel}>{ch.channel}</span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-sm text-white text-right font-mono">{ch.clicks}</td>
                                                                                        <td className="px-4 py-3 text-sm text-right">
                                                                                            <span className="font-mono text-text-secondary text-xs">{pct}%</span>
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-sm text-white text-right font-mono">{ch.orders}</td>
                                                                                        <td className="px-4 py-3 text-sm text-primary font-bold text-right font-mono">
                                                                                            R$ {ch.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                            {details.channelBreakdown.length === 0 && (
                                                                                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary text-sm">Nenhum canal encontrado.</td></tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}

                            {metrics.subIdRanking.length === 0 && (
                                <tr>
                                    <td colSpan={showTrackColumn ? 7 : 6} className="p-8 text-center text-text-secondary">
                                        Nenhum dado encontrado para o período selecionado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {metrics.subIdRanking.length > 0 && (
                            <tfoot>
                                <tr className="bg-primary/5 border-t-2 border-primary/30">
                                    <td className="p-4 text-sm font-bold text-white" colSpan={2}>Total</td>
                                    <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                        {metrics.subIdRanking.reduce((sum, item) => sum + item.clicks, 0)}
                                    </td>
                                    <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                        {metrics.subIdRanking.reduce((sum, item) => sum + item.orders, 0)}
                                    </td>
                                    <td className="p-4 text-sm text-white text-right font-mono font-bold">
                                        {metrics.conversionRate}%
                                    </td>
                                    <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                        R$ {metrics.subIdRanking.reduce((sum, item) => sum + item.commission, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    {showTrackColumn && <td className="p-4"></td>}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
