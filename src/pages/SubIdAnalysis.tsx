import { useState, useEffect, useCallback } from 'react';
import { useMetrics, parseShopeeDate } from '../hooks/useMetrics';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { supabase } from '../lib/supabase';
import { DateFilter } from '../components/ui/DateFilter';
import {
    Hash, DollarSign, MousePointerClick, Activity, Package, Eye, EyeOff,
    ChevronDown, ChevronUp, ShoppingBag, Radio, FileText, Clapperboard,
    Loader2, CheckCircle2, RefreshCw, Plus, Save, X, Link as LinkIcon
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
    const { commissionData, clickData, reportType } = useData();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [hideNames, setHideNames] = useState(false);
    const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'products' | 'channels' | 'orders'>('products');

    // Tracks state
    const [allTracks, setAllTracks] = useState<TrackInfo[]>([]);
    const [matchedTracks, setMatchedTracks] = useState<MatchedTrack[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncDone, setSyncDone] = useState(false);
    const [syncingSubId, setSyncingSubId] = useState<string | null>(null);
    const [syncedSubIds, setSyncedSubIds] = useState<Set<string>>(new Set());

    // Inline create track form
    const [creatingForSubId, setCreatingForSubId] = useState<string | null>(null);
    const [createName, setCreateName] = useState('');
    const [createLink, setCreateLink] = useState('');
    const [savingCreate, setSavingCreate] = useState(false);

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
            setSyncDone(false);
            setSyncedSubIds(new Set());
        } catch (err) {
            console.error('Erro ao buscar tracks:', err);
        }
    }, [user, reportType, clickData, commissionData, buildDateAgg]);

    useEffect(() => {
        detectMatchingTracks();
    }, [detectMatchingTracks]);

    // Sync ALL matched tracks
    const handleSyncAll = async () => {
        if (matchedTracks.length === 0) return;
        setSyncing(true);
        try {
            for (const mt of matchedTracks) {
                await syncSingleTrack(mt.track.id, mt.dateAggregation);
            }
            const totalDates = matchedTracks.reduce((s, mt) => s + Object.keys(mt.dateAggregation).length, 0);
            showToast(`Sincronizado! ${matchedTracks.length} track(s), ${totalDates} registro(s) atualizados.`);
            setSyncDone(true);
            setSyncedSubIds(new Set(matchedTracks.map(mt => mt.csvSubId)));
        } catch (err) {
            console.error('Erro na sincronização:', err);
            showToast('Erro ao sincronizar dados.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    // Sync a SINGLE track by its ID and date aggregation
    const syncSingleTrack = async (trackId: string, dateAgg: Record<string, { shopee_clicks: number; orders: number; commission_value: number }>) => {
        const dates = Object.keys(dateAgg);

        const { data: existing, error: fetchErr } = await supabase
            .from('creative_track_entries')
            .select('*')
            .eq('track_id', trackId)
            .in('date', dates);

        if (fetchErr) throw fetchErr;

        const existingMap = new Map<string, any>();
        (existing || []).forEach(e => existingMap.set(e.date, e));

        const payloads = dates.map(date => {
            const csvData = dateAgg[date];
            const existingEntry = existingMap.get(date);
            return {
                track_id: trackId,
                date,
                shopee_clicks: csvData.shopee_clicks,
                orders: csvData.orders,
                commission_value: Math.round(csvData.commission_value * 100) / 100,
                ad_clicks: existingEntry?.ad_clicks ?? 0,
                cpc: existingEntry?.cpc ?? 0,
                investment: existingEntry?.investment ?? 0,
            };
        });

        const { error: upsertErr } = await supabase
            .from('creative_track_entries')
            .upsert(payloads, { onConflict: 'track_id,date' });

        if (upsertErr) throw upsertErr;
    };

    // Sync individual sub_id
    const handleSyncIndividual = async (csvSubId: string) => {
        const mt = matchedTracks.find(m => m.csvSubId === csvSubId);
        if (!mt) return;
        setSyncingSubId(csvSubId);
        try {
            await syncSingleTrack(mt.track.id, mt.dateAggregation);
            const days = Object.keys(mt.dateAggregation).length;
            showToast(`${mt.track.name}: ${days} registro(s) sincronizados!`);
            setSyncedSubIds(prev => new Set([...prev, csvSubId]));
        } catch (err) {
            console.error(err);
            showToast('Erro ao sincronizar.', 'error');
        } finally {
            setSyncingSubId(null);
        }
    };

    // Open inline create form
    const openCreateForm = (subId: string) => {
        // Suggest a name based on the sub_id (first part before '-')
        const nameParts = subId.split('-');
        const suggestedName = nameParts[0] || subId;
        setCreatingForSubId(subId);
        setCreateName(suggestedName);
        setCreateLink('');
    };

    // Create track and optionally sync
    const handleCreateTrack = async (syncAfter: boolean) => {
        if (!creatingForSubId || !user || !createName.trim()) {
            showToast('Nome é obrigatório.', 'error');
            return;
        }

        setSavingCreate(true);
        try {
            const { data, error } = await supabase
                .from('creative_tracks')
                .insert({
                    user_id: user.id,
                    name: createName.trim(),
                    affiliate_link: createLink.trim(),
                    sub_id: creatingForSubId,
                })
                .select()
                .single();

            if (error) throw error;

            const newTrack: TrackInfo = { id: data.id, name: data.name, sub_id: data.sub_id };
            setAllTracks(prev => [...prev, newTrack]);

            if (syncAfter) {
                const dateAgg = buildDateAgg(creatingForSubId);
                if (Object.keys(dateAgg).length > 0) {
                    await syncSingleTrack(data.id, dateAgg);
                    const newMatch: MatchedTrack = { track: newTrack, csvSubId: creatingForSubId, dateAggregation: dateAgg };
                    setMatchedTracks(prev => [...prev, newMatch]);
                    setSyncedSubIds(prev => new Set([...prev, creatingForSubId!]));
                    const days = Object.keys(dateAgg).length;
                    showToast(`Track "${createName.trim()}" criado e ${days} registro(s) sincronizados!`);
                } else {
                    showToast(`Track "${createName.trim()}" criado! (sem dados de data no CSV)`);
                }
            } else {
                showToast(`Track "${createName.trim()}" criado!`);
            }

            setCreatingForSubId(null);
            setCreateName('');
            setCreateLink('');
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

    const getMatchForSubId = (csvSubId: string): MatchedTrack | undefined => {
        return matchedTracks.find(m => m.csvSubId === csvSubId);
    };

    const toggleExpand = (subId: string) => {
        if (expandedSubId === subId) {
            setExpandedSubId(null);
        } else {
            setExpandedSubId(subId);
            setDetailTab('products');
        }
    };

    if (metrics.isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-surface-dark rounded-2xl flex items-center justify-center mb-6 border border-border-dark shadow-2xl">
                    <Hash className="w-10 h-10 text-primary/50" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sem Dados Disponíveis</h2>
                <p className="text-text-secondary max-w-sm">Importe os relatórios de Cliques e Comissões para visualizar esta análise.</p>
            </div>
        );
    }

    const showTrackColumn = commissionData.length > 0 || clickData.length > 0;

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-dark pb-6">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Análise por Sub_ID</h2>
                    <p className="text-text-secondary text-sm">Cruzamento de Cliques e Comissões</p>
                </div>
                <DateFilter />
            </header>

            {/* Sync Banner (all tracks) */}
            {showTrackColumn && matchedTracks.length > 0 && (
                <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${syncDone ? 'bg-green-500/5 border-green-500/30' : 'bg-primary/5 border-primary/30'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${syncDone ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                            {syncDone ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Clapperboard className="w-5 h-5 text-primary" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">
                                {syncDone ? 'Criativo Track sincronizado!' : `${matchedTracks.length} track(s) compatível(is) encontrado(s)`}
                            </p>
                            <p className="text-xs text-text-secondary">
                                {syncDone
                                    ? `Dados dos CSVs foram enviados para ${matchedTracks.map(m => m.track.name).join(', ')}`
                                    : `${matchedTracks.map(m => `${m.track.name} (${m.track.sub_id})`).join(', ')} — ${matchedTracks.reduce((s, m) => s + Object.keys(m.dateAggregation).length, 0)} dia(s) detectados`
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={syncDone ? () => { setSyncDone(false); handleSyncAll(); } : handleSyncAll}
                        disabled={syncing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors disabled:opacity-50 ${syncDone
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                            : 'bg-primary text-background-dark shadow-[0_0_15px_rgba(242,162,13,0.3)] hover:bg-opacity-90'
                            }`}
                    >
                        {syncing
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</>
                            : syncDone
                                ? <><RefreshCw className="w-4 h-4" /> Sincronizar Todos</>
                                : <><Clapperboard className="w-4 h-4" /> Sincronizar Todos</>
                        }
                    </button>
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
                            onClick={() => handleCreateTrack(false)}
                            disabled={savingCreate || !createName.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white bg-surface-dark border border-border-dark hover:border-white/20 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" /> Criar (preencher depois)
                        </button>
                        <button
                            onClick={() => handleCreateTrack(true)}
                            disabled={savingCreate || !createName.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-primary text-background-dark shadow-[0_0_15px_rgba(242,162,13,0.3)] hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                        >
                            {savingCreate ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Criar e Sincronizar
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
                                const matchInfo = showTrackColumn ? getMatchForSubId(item.subId) : undefined;
                                const isSynced = syncedSubIds.has(item.subId);
                                const isSyncingThis = syncingSubId === item.subId;
                                const isNoSubId = item.subId === 'Sem Sub_id';

                                return (
                                    <>
                                        <tr
                                            key={idx}
                                            onClick={() => toggleExpand(item.subId)}
                                            className={`hover:bg-background-dark/30 transition-colors cursor-pointer ${isExpanded ? 'bg-background-dark/20' : ''}`}
                                        >
                                            <td className="p-4 text-sm font-medium text-white max-w-[200px] truncate" title={hideNames ? `Sub ID #${idx + 1}` : item.subId}>
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
                                                    ) : existingTrack && matchInfo ? (
                                                        // Has track + has CSV data -> Sync button
                                                        isSynced ? (
                                                            <button
                                                                onClick={() => { setSyncedSubIds(prev => { const n = new Set(prev); n.delete(item.subId); return n; }); handleSyncIndividual(item.subId); }}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors mx-auto"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                Sincronizado
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSyncIndividual(item.subId)}
                                                                disabled={isSyncingThis}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50 mx-auto"
                                                            >
                                                                {isSyncingThis
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <RefreshCw className="w-3.5 h-3.5" />
                                                                }
                                                                Sync
                                                            </button>
                                                        )
                                                    ) : existingTrack ? (
                                                        // Has track but no CSV data for it
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
                                                    <div className="bg-background-dark/60 border-t border-b border-primary/20 px-6 py-5">
                                                        {/* Detail Tabs */}
                                                        <div className="flex gap-2 mb-4">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('products'); }}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === 'products' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <ShoppingBag className="w-3.5 h-3.5" />
                                                                Produtos ({details.products.length})
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('channels'); }}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === 'channels' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <Radio className="w-3.5 h-3.5" />
                                                                Canais ({details.channelBreakdown.length})
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('orders'); }}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === 'orders' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                                Pedidos ({details.orders.length})
                                                            </button>
                                                        </div>

                                                        {/* Products Tab */}
                                                        {detailTab === 'products' && (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <table className="w-full text-left">
                                                                    <thead>
                                                                        <tr className="bg-surface-dark/50">
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Produto</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right">Pedidos</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark">
                                                                        {details.products.map((p, i) => (
                                                                            <tr key={i} className="hover:bg-surface-dark/30">
                                                                                <td className="px-4 py-2.5 text-sm text-white max-w-[300px] truncate" title={p.name}>{p.name}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{p.count}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-primary font-bold text-right font-mono">
                                                                                    R$ {p.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {details.products.length === 0 && (
                                                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-text-secondary text-sm">Nenhum produto encontrado.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {/* Channels Tab */}
                                                        {detailTab === 'channels' && (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <table className="w-full text-left border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-surface-dark/50">
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary whitespace-nowrap">Canal</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">Cliques</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">% Cliques</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">Vendas</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right whitespace-nowrap">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark">
                                                                        {details.channelBreakdown.map((ch, i) => {
                                                                            const totalChannelClicks = details.channelBreakdown.reduce((s, c) => s + c.clicks, 0);
                                                                            const pct = totalChannelClicks > 0 ? ((ch.clicks / totalChannelClicks) * 100).toFixed(1) : '0.0';
                                                                            return (
                                                                                <tr key={i} className="hover:bg-surface-dark/30">
                                                                                    <td className="px-4 py-2.5 text-sm text-white">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                                                                            <span className="truncate max-w-[150px]" title={ch.channel}>{ch.channel}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{ch.clicks}</td>
                                                                                    <td className="px-4 py-2.5 text-sm text-right">
                                                                                        <div className="flex items-center justify-end gap-2">
                                                                                            <span className="font-mono text-text-secondary">{pct}%</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{ch.orders}</td>
                                                                                    <td className="px-4 py-2.5 text-sm text-primary font-bold text-right font-mono">
                                                                                        R$ {ch.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        {details.channelBreakdown.length === 0 && (
                                                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary text-sm">Nenhum canal encontrado.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {/* Orders Tab */}
                                                        {detailTab === 'orders' && (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <table className="w-full text-left">
                                                                    <thead>
                                                                        <tr className="bg-surface-dark/50">
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">ID Pedido</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Produto</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Status</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary">Data</th>
                                                                            <th className="px-4 py-2.5 text-xs font-medium text-text-secondary text-right">Comissão</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-dark">
                                                                        {details.orders.slice(0, 20).map((order, i) => (
                                                                            <tr key={i} className="hover:bg-surface-dark/30">
                                                                                <td className="px-4 py-2.5 text-xs text-text-secondary font-mono">{order.orderId}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-white max-w-[200px] truncate" title={order.product}>{order.product}</td>
                                                                                <td className="px-4 py-2.5">
                                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.status.toLowerCase() === 'concluído' ? 'bg-green-500/10 text-green-400' :
                                                                                        order.status.toLowerCase() === 'cancelado' ? 'bg-red-500/10 text-red-400' :
                                                                                            'bg-yellow-500/10 text-yellow-400'
                                                                                        }`}>
                                                                                        {order.status}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-xs text-text-secondary">{order.date}</td>
                                                                                <td className="px-4 py-2.5 text-sm text-primary font-bold text-right font-mono">
                                                                                    R$ {order.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {details.orders.length > 20 && (
                                                                            <tr><td colSpan={5} className="px-4 py-3 text-center text-text-secondary text-xs">Mostrando 20 de {details.orders.length} pedidos</td></tr>
                                                                        )}
                                                                        {details.orders.length === 0 && (
                                                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary text-sm">Nenhum pedido encontrado.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
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
