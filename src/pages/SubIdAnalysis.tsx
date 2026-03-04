import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { useMetrics, parseShopeeDate } from '../hooks/useMetrics';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { supabase } from '../lib/supabase';
import { syncService } from '../lib/syncService';

import { DateFilter } from '../components/ui/DateFilter';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { OrderFiltersPanel } from '../components/ui/OrderFiltersPanel';
import {
    Hash, DollarSign, MousePointerClick, Activity, Eye, EyeOff,
    ChevronDown, ChevronUp, ShoppingBag, Radio, Clapperboard,
    CheckCircle2, Plus, ArrowUpDown, TrendingUp, X, Save, Loader2
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
    const { commissionData, clickData, isAutoSyncing } = useData();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [hideNames, setHideNames] = useState(false);
    const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'products' | 'channels' | 'orders'>('products');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Tracks state
    const [allTracks, setAllTracks] = useState<TrackInfo[]>([]);
    const [matchedTracks, setMatchedTracks] = useState<MatchedTrack[]>([]);

    // Inline create track form
    const [creatingForSubId, setCreatingForSubId] = useState<string | null>(null);
    const [createName, setCreateName] = useState('');
    const [createLink, setCreateLink] = useState('');
    const [savingCreate, setSavingCreate] = useState(false);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        const data = metrics.funnelBySubId || [];
        if (!sortConfig) return data;

        return [...data].sort((a: any, b: any) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            const parseVal = (v: any) => {
                if (typeof v === 'string') {
                    const clean = v.replace(/[R$\s.%]/g, '').replace(',', '.');
                    const num = parseFloat(clean);
                    return isNaN(num) ? v.toLowerCase() : num;
                }
                return v;
            };

            const finalA = parseVal(valA);
            const finalB = parseVal(valB);

            if (finalA < finalB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (finalA > finalB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [metrics.funnelBySubId, sortConfig]);

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
            let canonical = parts.join('-');
            if (!canonical || !canonical.replace(/-/g, '').trim()) canonical = 'Sem Sub_id';

            if (canonical !== csvSubId && canonical !== 'Sem Sub_id') {
                if (!(csvSubId.includes(canonical) || canonical.includes(csvSubId))) return;
            } else if (canonical === 'Sem Sub_id' && csvSubId !== 'Sem Sub_id') {
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

            const matched: MatchedTrack[] = [];
            for (const track of tracks) {
                if (!track.sub_id) continue;

                const matchingSubId = Object.keys(metrics.subIdDetails).find(csvSub =>
                    csvSub === track.sub_id || csvSub.includes(track.sub_id) || track.sub_id.includes(csvSub)
                );

                if (!matchingSubId) continue;

                const dateAgg = buildDateAgg(matchingSubId);
                if (Object.keys(dateAgg).length > 0) {
                    matched.push({ track, csvSubId: matchingSubId, dateAggregation: dateAgg });
                }
            }

            setMatchedTracks(matched);
        } catch (err) {
            console.error('Erro ao buscar tracks:', err);
        }
    }, [user, metrics.subIdDetails, buildDateAgg, commissionData.length, clickData.length]);

    useEffect(() => {
        detectMatchingTracks();
    }, [detectMatchingTracks]);

    const openCreateForm = (subId: string) => {
        const nameParts = subId.split('-');
        const suggestedName = nameParts[0] || subId;
        setCreatingForSubId(subId);
        setCreateName(suggestedName);
        setCreateLink('');
    };

    const handleCreateTrack = async () => {
        if (!creatingForSubId || !user || !createName.trim()) {
            showToast('Nome é obrigatório.', 'error');
            return;
        }

        setSavingCreate(true);
        try {
            const newTrackId = crypto.randomUUID();
            const fullPayload = {
                user_id: user.id,
                name: createName.trim(),
                affiliate_link: createLink.trim(),
                sub_id: creatingForSubId,
                id: newTrackId,
                created_at: new Date().toISOString()
            };

            const newTrack: TrackInfo = { id: newTrackId, name: createName.trim(), sub_id: creatingForSubId };
            setAllTracks(prev => [...prev, newTrack]);

            showToast(`Track "${createName.trim()}" criado localmente!`);

            setCreatingForSubId(null);
            setCreateName('');
            setCreateLink('');

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
            filterState.clearFilters();
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
                    <p className="text-text-secondary text-sm">Desempenho sincronizado e distribuído por Sub_ID</p>
                </div>
                <DateFilter />
            </header>

            {/* Sync Banner */}
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
                </div>
            )}

            {/* Overview KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-primary/30">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Sub IDs Únicos</p>
                        <p className="font-bold text-xl">{metrics.funnelBySubId.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-blue-500/30">
                    <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                        <MousePointerClick className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total Cliques</p>
                        <p className="font-bold text-xl">{metrics.totalClicks.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-green-500/30">
                    <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total Vendas</p>
                        <p className="font-bold text-xl">{metrics.totalOrders.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-purple-500/30">
                    <div className="w-10 h-10 rounded-lg bg-[#a855f7]/10 flex items-center justify-center text-[#a855f7]">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Conversão Média</p>
                        <p className="font-bold text-xl">{metrics.conversionRate}%</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-dark border border-border-dark rounded-xl p-4 transition-all hover:border-yellow-500/30">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Comissão Acumulada</p>
                        <p className="font-bold text-xl">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Sub ID Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 border-b border-border-dark flex justify-between items-center bg-background-dark/20">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Ranking de Performance por Sub_ID
                    </h3>
                    <button
                        onClick={() => setHideNames(prev => !prev)}
                        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${hideNames
                            ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                            : 'bg-surface-highlight text-text-secondary border-border-dark hover:text-white'
                            }`}
                    >
                        {hideNames ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {hideNames ? 'Sub IDs Ocultos' : 'Ocultar Sub IDs'}
                    </button>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('subId')}>
                                    <div className="flex items-center gap-1.5">Sub ID <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>

                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('clicks')}>
                                    <div className="flex items-center justify-end gap-1.5">Cliques <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('orders')}>
                                    <div className="flex items-center justify-end gap-1.5">Vendas <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('conversion')}>
                                    <div className="flex items-center justify-end gap-1.5">Conversão <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('commission')}>
                                    <div className="flex items-center justify-end gap-1.5">Comissão <ArrowUpDown className="w-3.5 h-3.5" /></div>
                                </th>
                                {showTrackColumn && (
                                    <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Track</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {sortedData.map((item: any, idx: number) => {
                                const isExpanded = expandedSubId === item.subId;
                                const details = metrics.subIdDetails[item.subId];
                                const existingTrack = showTrackColumn ? getTrackForSubId(item.subId) : undefined;
                                const isNoSubId = item.subId === 'Sem Sub_id';

                                return (
                                    <Fragment key={item.subId || idx}>
                                        <tr
                                            onClick={() => toggleExpand(item.subId)}
                                            className={`hover:bg-background-dark/30 transition-all cursor-pointer group ${isExpanded ? 'bg-background-dark/20' : ''}`}
                                        >
                                            <td className="p-4 text-sm font-medium text-white max-w-[200px] truncate">
                                                <div className="flex items-center gap-2">
                                                    {isExpanded
                                                        ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
                                                        : <ChevronDown className="w-4 h-4 text-text-secondary/50 flex-shrink-0 group-hover:text-primary transition-colors" />
                                                    }
                                                    {hideNames ? (
                                                        <span className="px-2 py-1 bg-surface-highlight text-text-secondary border border-border-dark rounded font-mono text-xs">
                                                            Sub ID #{idx + 1}
                                                        </span>
                                                    ) : item.subId === 'Sem Sub_id' ? (
                                                        <span className="text-text-secondary italic">{item.subId}</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded font-mono text-xs group-hover:border-primary/40 transition-colors">
                                                            {item.subId}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4 text-sm text-text-secondary text-right font-mono">{item.clicks.toLocaleString('pt-BR')}</td>
                                            <td className="p-4 text-sm text-text-secondary text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                                            <td className="p-4 text-sm text-right">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <div className="w-12 h-1.5 bg-background-dark rounded-full overflow-hidden hidden sm:block">
                                                        <div
                                                            className={`h-full ${parseFloat(item.conversion) > 5 ? 'bg-green-500' : 'bg-primary'}`}
                                                            style={{ width: `${Math.min(parseFloat(item.conversion.replace(',', '.')) * 10, 100)}%` }}>
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-white text-xs">{item.conversion}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-primary font-bold text-right font-mono">
                                                R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            {showTrackColumn && (
                                                <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                    {isNoSubId ? (
                                                        <span className="text-xs text-neutral-600">—</span>
                                                    ) : existingTrack ? (
                                                        <div className="flex items-center justify-center gap-1.5 text-xs text-green-400 font-medium bg-green-500/5 px-2 py-1 rounded-full border border-green-500/20">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {existingTrack.name}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => openCreateForm(item.subId)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary border border-primary/20 hover:bg-primary/10 transition-all mx-auto"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            Track
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>

                                        {/* Expanded Detail Row */}
                                        {isExpanded && details && (
                                            <tr key={`${idx}-detail`}>
                                                <td colSpan={showTrackColumn ? 7 : 6} className="p-0">
                                                    <div className="bg-background-dark/60 border-t border-b border-primary/20 px-6 py-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        {/* Detail Tabs */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('products'); }}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${detailTab === 'products'
                                                                    ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20 scale-[1.02]'
                                                                    : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <ShoppingBag className="w-4 h-4" />
                                                                Pedidos Detalhados
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDetailTab('channels'); }}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${detailTab === 'channels'
                                                                    ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20 scale-[1.02]'
                                                                    : 'text-text-secondary hover:text-white bg-surface-dark border border-border-dark'
                                                                    }`}
                                                            >
                                                                <Radio className="w-4 h-4" />
                                                                Canais ({details.channelBreakdown.length})
                                                            </button>
                                                        </div>

                                                        {/* Quick Create Track Form */}
                                                        {creatingForSubId === item.subId && (
                                                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2 text-primary">
                                                                        <Plus className="w-4 h-4" />
                                                                        <span className="text-xs font-bold uppercase tracking-wider">Novo Criativo Track</span>
                                                                    </div>
                                                                    <button onClick={() => setCreatingForSubId(null)} className="text-text-secondary hover:text-white">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Nome do Criativo</label>
                                                                        <input
                                                                            type="text"
                                                                            value={createName}
                                                                            onChange={e => setCreateName(e.target.value)}
                                                                            className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none transition-colors"
                                                                            placeholder="Ex: Kit Umidificador"
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Link de Afiliado (Opcional)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={createLink}
                                                                            onChange={e => setCreateLink(e.target.value)}
                                                                            className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none transition-colors"
                                                                            placeholder="https://shope.ee/..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-end gap-2 text-slate-900 font-bold">
                                                                    <button
                                                                        onClick={handleCreateTrack}
                                                                        disabled={savingCreate || !createName.trim()}
                                                                        className="bg-primary px-4 py-2 rounded-lg text-xs flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all font-bold"
                                                                    >
                                                                        {savingCreate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                                        Salvar e Vincular
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Details Content */}
                                                        {detailTab === 'products' ? (
                                                            <div className="flex flex-col gap-6">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                    <div className="bg-surface-dark border border-border-dark/60 p-4 rounded-xl">
                                                                        <p className="text-text-secondary text-[10px] uppercase tracking-wider mb-1 font-bold">Vendas Filtradas</p>
                                                                        <p className="text-2xl font-bold text-white font-mono">{filterState.filteredMetrics.totalUnits}</p>
                                                                    </div>
                                                                    <div className="bg-surface-dark border border-border-dark/60 p-4 rounded-xl">
                                                                        <p className="text-text-secondary text-[10px] uppercase tracking-wider mb-1 font-bold">Comissão Filtrada</p>
                                                                        <p className="text-2xl font-bold text-primary font-mono">
                                                                            R$ {filterState.filteredMetrics.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-surface-dark border border-border-dark/60 p-4 rounded-xl">
                                                                        <p className="text-text-secondary text-[10px] uppercase tracking-wider mb-1 font-bold">Produtos Distintos</p>
                                                                        <p className="text-2xl font-bold text-white font-mono">{filterState.filteredMetrics.uniqueProductsCount}</p>
                                                                    </div>
                                                                </div>

                                                                <OrderFiltersPanel {...filterState} />

                                                                <div className="rounded-xl overflow-hidden border border-border-dark shadow-xl">
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left text-sm min-w-[900px]">
                                                                            <thead>
                                                                                <tr className="bg-surface-dark/80 font-bold text-[10px] text-text-secondary uppercase">
                                                                                    <th className="px-5 py-3">Data</th>
                                                                                    <th className="px-5 py-3">Produto</th>
                                                                                    <th className="px-5 py-3 text-right">Qtd</th>
                                                                                    <th className="px-5 py-3 text-center">Status</th>
                                                                                    <th className="px-5 py-3 text-right">Comissão</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-border-dark/50">
                                                                                {filterState.filteredOrders.slice(0, 50).map((order, i) => {
                                                                                    const isCompleted = ['Concluído', 'VALIDATED'].some(s => order.status?.includes(s));
                                                                                    return (
                                                                                        <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                                                                                            <td className="px-5 py-3 text-text-secondary text-xs font-mono">
                                                                                                {order.date !== '—' ? format(new Date(order.date), 'dd/MM HH:mm') : '—'}
                                                                                            </td>
                                                                                            <td className="px-5 py-3">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                                                                                                        {order.imageUrl && <img src={order.imageUrl} className="w-full h-full object-cover" />}
                                                                                                    </div>
                                                                                                    <span className="truncate max-w-[250px] text-xs font-medium text-white">{order.productName}</span>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-5 py-3 text-white text-right font-mono text-xs">{order.qty}</td>
                                                                                            <td className="px-5 py-3 text-center">
                                                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isCompleted ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                                                                    {order.status}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-5 py-3 text-primary font-bold text-right font-mono">
                                                                                                R$ {order.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-xl overflow-hidden border border-border-dark">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead>
                                                                            <tr className="bg-surface-dark font-bold text-[10px] text-text-secondary uppercase">
                                                                                <th className="px-4 py-3">Canal</th>
                                                                                <th className="px-4 py-3 text-right">Cliques</th>
                                                                                <th className="px-4 py-3 text-right">Vendas</th>
                                                                                <th className="px-4 py-3 text-right">Comissão</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-border-dark/50">
                                                                            {details.channelBreakdown.map((ch, i) => (
                                                                                <tr key={i} className="hover:bg-white/[0.02]">
                                                                                    <td className="px-4 py-3 text-sm text-white font-medium">{ch.channel}</td>
                                                                                    <td className="px-4 py-3 text-sm text-text-secondary text-right font-mono">{ch.clicks}</td>
                                                                                    <td className="px-4 py-3 text-sm text-text-secondary text-right font-mono">{ch.orders}</td>
                                                                                    <td className="px-4 py-3 text-sm text-primary font-bold text-right font-mono">
                                                                                        R$ {ch.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
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
                        </tbody>
                        <tfoot>
                            <tr className="bg-primary/5 border-t-2 border-primary/30">
                                <td className="p-4 text-sm font-bold text-white" colSpan={2}>Totais do Ranking</td>
                                <td className="p-4 text-sm text-white text-right font-mono font-bold">{metrics.totalClicks.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono font-bold">{metrics.totalOrders.toLocaleString('pt-BR')}</td>
                                <td className="p-4 text-sm text-white text-right font-mono font-bold">{metrics.conversionRate}%</td>
                                <td className="p-4 text-sm text-primary font-bold text-right font-mono">R$ {metrics.totalNetCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                {showTrackColumn && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
