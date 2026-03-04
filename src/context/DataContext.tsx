import { createContext, useState, useEffect, ReactNode, useMemo } from 'react';
import Papa from 'papaparse';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { parseShopeeDate } from '../hooks/useMetrics';
import { format } from 'date-fns';

export type ReportType = 'clicks' | 'commission' | 'orders' | 'unknown' | 'multiple';
export type DateFilterStr = 'today' | 'yesterday' | 'anteontem' | '7days' | '30days' | 'all' | 'custom';
export interface CustomDateRange { start: string; end: string }

export interface DataContextType {
    commissionData: any[];
    clickData: any[];
    fileName: string;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    reportType: ReportType;
    clearData: () => void;
    dateFilter: DateFilterStr;
    setDateFilter: (filter: DateFilterStr) => void;
    customRange: CustomDateRange;
    setCustomRange: (range: CustomDateRange) => void;
    statuses: any[];
    fetchStatuses: () => Promise<void>;
    reorderStatuses: (newOrder: string[]) => Promise<void>;
    hasStartedAnalysis: boolean;
    setHasStartedAnalysis: (val: boolean) => void;
    isAutoSyncing: boolean;
}

export const DEFAULT_SYSTEM_STATUSES = [
    { slug: 'ativo', name: 'Ativo', color: '#3b82f6', icon: 'PlayCircle' },
    { slug: 'off', name: 'Desativado/Off', color: '#94a3b8', icon: 'StopCircle' },
    { slug: 'validado', name: 'Validado', color: '#22c55e', icon: 'CheckCircle2' },
    { slug: 'rascunho', name: 'Rascunho', color: '#eab308', icon: 'Pencil' },
];

export const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [commissionData, setCommissionData] = useState<any[]>([]);
    const [clickData, setClickData] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [reportType, setReportType] = useState<ReportType>('unknown');
    const [dateFilter, setDateFilter] = useState<DateFilterStr>('all');
    const [customRange, setCustomRange] = useState<CustomDateRange>({ start: '', end: '' });
    const [statuses, setStatuses] = useState<any[]>([]);
    const [hasStartedAnalysis, setHasStartedAnalysis] = useState<boolean>(false);
    const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);

    const fetchStatuses = async () => {
        if (!user) return;
        const [statusRes, prefsRes] = await Promise.all([
            supabase.from('track_statuses').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
            supabase.from('users').select('user_preferences').eq('id', user.id).single()
        ]);

        let dbData: any[] = [];
        if (!statusRes.error && statusRes.data) {
            dbData = statusRes.data;
        }

        const prefs = (prefsRes.data?.user_preferences as any) || {};
        const statusOrder = prefs.status_order || [];

        // Merge system defaults with database records
        const allStatuses = DEFAULT_SYSTEM_STATUSES.map(def => {
            const dbMatch = dbData.find(s => s.slug === def.slug);
            return dbMatch ? { ...dbMatch, isSystem: true, id: dbMatch.id || def.slug } : { ...def, isSystem: true, id: def.slug };
        });

        const customOnes = dbData.filter(s => !s.slug).map(s => ({ ...s, isSystem: false }));
        const combined = [...allStatuses, ...customOnes].map(s => ({ ...s, id: s.id || s.slug }));

        if (statusOrder.length > 0) {
            combined.sort((a, b) => {
                const idxA = statusOrder.indexOf(a.id);
                const idxB = statusOrder.indexOf(b.id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        }

        setStatuses(combined);
    };

    const reorderStatuses = async (newOrder: string[]) => {
        if (!user) return;
        setStatuses(prev => {
            const sorted = [...prev].sort((a, b) => {
                const idxA = newOrder.indexOf(a.id);
                const idxB = newOrder.indexOf(b.id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
            return sorted;
        });

        const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
        const current = (data?.user_preferences as Record<string, unknown>) ?? {};
        await supabase
            .from('users')
            .update({ user_preferences: { ...current, status_order: newOrder } })
            .eq('id', user.id);
    };

    useEffect(() => {
        if (user) fetchStatuses();
    }, [user]);

    // Normaliza sub_id removendo separadores (vírgula, espaço, hífen) para matching robusto
    const normalizeSubId = (s: string) => s.replace(/[-,\s]+/g, '').toLowerCase();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const firstRow = results.data[0] as any;
                    if (firstRow['ID dos Cliques']) {
                        setClickData(results.data);
                        setReportType(prev => prev === 'commission' ? 'multiple' : 'clicks');
                    } else if (firstRow['ID do pedido'] && firstRow['Comissão líquida do afiliado(R$)']) {
                        setCommissionData(results.data);
                        setReportType(prev => prev === 'clicks' ? 'multiple' : 'commission');
                    } else if (firstRow['Order ID'] || firstRow['Total Commission']) {
                        setReportType('orders');
                        // Optional fallback support for other structures
                    } else {
                        setReportType('unknown');
                    }
                },
            });
        }
    };

    const clearData = () => {
        setCommissionData([]);
        setClickData([]);
        setFileName('');
        setReportType('unknown');
        setHasStartedAnalysis(false);
    };

    // Auto-Sync Effect triggered when CSV data changes
    useEffect(() => {
        if (!user || (!clickData.length && !commissionData.length)) return;

        const syncCsvWithDb = async () => {
            const parseCurrency = (val: any) => {
                if (!val) return 0;
                const clean = val.toString().replace(/[^0-9,.-]/g, '').replace(',', '.');
                const parsed = parseFloat(clean);
                return isNaN(parsed) ? 0 : parsed;
            };

            setIsAutoSyncing(true);
            try {
                // 1. Fetch user's creative_tracks
                const { data: tracks, error: tracksErr } = await supabase
                    .from('creative_tracks')
                    .select('id, sub_id, channel')
                    .eq('user_id', user.id);

                if (tracksErr) throw tracksErr;
                const currentTracks = tracks || [];

                // 2. Identify unique sub_ids and channels from CSV that need a track
                const neededSubIds = new Set<string>();
                const subIdToChannelMap = new Map<string, string>();

                clickData.forEach(click => {
                    const raw = click['Sub_id'] || '';
                    const canonical = (raw.split('-').filter(Boolean).join('-') || '').trim() === '' ? 'Sem Sub_id' : raw.split('-').filter(Boolean).join('-');
                    neededSubIds.add(canonical);
                    if (click['Referenciador'] && click['Referenciador'] !== 'Desconhecido') {
                        subIdToChannelMap.set(canonical, click['Referenciador']);
                    }
                });

                commissionData.forEach(item => {
                    const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                    const canonical = (parts.join('-') || '').trim() === '' || !parts.join('-').replace(/-/g, '').trim() ? 'Sem Sub_id' : parts.join('-');
                    neededSubIds.add(canonical);
                    if (item['Canal'] && item['Canal'] !== 'Desconhecido') {
                        subIdToChannelMap.set(canonical, item['Canal']);
                    }
                });

                // 3. Auto-create tracks for missing Sub_IDs
                const updatedTracks = [...currentTracks];
                const newTracksToCreate: any[] = [];

                for (const subId of neededSubIds) {
                    const normSubId = normalizeSubId(subId);
                    const exists = currentTracks.find(t =>
                        t.sub_id && normalizeSubId(t.sub_id) === normSubId
                    );

                    if (!exists) {
                        const channel = subIdToChannelMap.get(subId) || 'Orgânico';
                        newTracksToCreate.push({
                            user_id: user.id,
                            sub_id: subId,
                            name: subId === 'Sem Sub_id' ? `Orgânico - ${channel} ` : subId,
                            channel: channel,
                            status: 'ativo'
                        });
                    }
                }

                if (newTracksToCreate.length > 0) {
                    const { data: created, error: createErr } = await supabase
                        .from('creative_tracks')
                        .insert(newTracksToCreate)
                        .select();

                    if (!createErr && created) {
                        updatedTracks.push(...created);
                    }
                }

                // 4. Identify canonical track IDs for aggregation
                const matchedAgg: Record<string, Record<string, { shopee_clicks?: number, orders?: number, commission_value?: number }>> = {};
                const channelUpdates: Record<string, string> = {};

                const getMatch = (raw: string) => {
                    let canonical = (raw || '').split('-').filter(Boolean).join('-') || 'Sem Sub_id';
                    if (canonical.trim() === '' || !canonical.replace(/-/g, '').trim()) canonical = 'Sem Sub_id';
                    const normCanonical = normalizeSubId(canonical);
                    const track = updatedTracks.find(t =>
                        t.sub_id && normalizeSubId(t.sub_id) === normCanonical
                    );
                    return track ? track.id : null;
                };

                // Filter out entries that didn't match any track (should be rare now)
                clickData.forEach(click => {
                    const trackId = getMatch(click['Sub_id']);
                    if (!trackId) return;

                    const dateObj = parseShopeeDate(click['Tempo dos Cliques']);
                    if (!dateObj) return;
                    const dateKey = format(dateObj, 'yyyy-MM-dd');

                    if (!matchedAgg[trackId]) matchedAgg[trackId] = {};
                    if (!matchedAgg[trackId][dateKey]) matchedAgg[trackId][dateKey] = {};

                    matchedAgg[trackId][dateKey].shopee_clicks = (matchedAgg[trackId][dateKey].shopee_clicks || 0) + 1;

                    if (click['Referenciador'] && click['Referenciador'] !== 'Desconhecido') {
                        channelUpdates[trackId] = click['Referenciador'];
                    }
                });

                commissionData.forEach(item => {
                    const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                    let canonical = parts.join('-') || 'Sem Sub_id';
                    if (canonical.trim() === '' || !canonical.replace(/-/g, '').trim()) canonical = 'Sem Sub_id';
                    const trackId = getMatch(canonical);
                    if (!trackId) return;

                    const dateObj = parseShopeeDate(item['Horário do pedido']);
                    if (!dateObj) return;
                    const dateKey = format(dateObj, 'yyyy-MM-dd');


                    const netComm = parseCurrency(item['Comissão líquida do afiliado(R$)']);

                    if (!matchedAgg[trackId]) matchedAgg[trackId] = {};
                    if (!matchedAgg[trackId][dateKey]) matchedAgg[trackId][dateKey] = {};

                    matchedAgg[trackId][dateKey].orders = (matchedAgg[trackId][dateKey].orders || 0) + 1;
                    matchedAgg[trackId][dateKey].commission_value = (matchedAgg[trackId][dateKey].commission_value || 0) + netComm;
                });

                // 5. Build individual commission rows for shopee_conversions (Detailed Orders)
                const conversionRows: any[] = [];
                commissionData.forEach(item => {
                    const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                    let canonical = parts.join('-') || 'Sem Sub_id';
                    if (canonical.trim() === '' || !canonical.replace(/-/g, '').trim()) canonical = 'Sem Sub_id';
                    const trackId = getMatch(canonical);

                    const dateObj = parseShopeeDate(item['Horário do pedido']);
                    if (!dateObj) return;

                    conversionRows.push({
                        track_id: trackId,
                        user_id: user?.id || null,
                        conversion_id: item['ID do pedido']?.toString() || `${trackId || 'unmatched'} -${dateObj.getTime()} `,
                        click_time: parseShopeeDate(item['Tempo dos Cliques'])?.toISOString() || null,
                        purchase_time: dateObj.toISOString(),
                        order_id: item['ID do pedido']?.toString() || null,
                        order_status: item['Status do pedido'] || null,
                        item_id: parseInt(item['ID do item']?.toString() || '0') || null,
                        item_name: item['Nome do Produto'] || null,
                        item_price: parseCurrency(item['Preço unitário do item(R$)']),
                        qty: parseInt(item['Quantidade']?.toString() || '1'),
                        actual_amount: parseCurrency(item['Preço unitário do item(R$)']),
                        total_commission: parseCurrency(item['Comissão total do afiliado(R$)']),
                        seller_commission: parseCurrency(item['Comissão do vendedor(R$)']),
                        shopee_commission: parseCurrency(item['Comissões extras da Shopee(R$)']),
                        net_commission: parseCurrency(item['Comissão líquida do afiliado(R$)']),
                        item_total_commission: parseCurrency(item['Comissão total do afiliado(R$)']),
                        synced_at: new Date().toISOString()
                    });
                });

                if (conversionRows.length > 0) {
                    // Batch upsert all rows (matched + unmatched) using user_id-based constraint
                    const chunkSize = 100;
                    for (let i = 0; i < conversionRows.length; i += chunkSize) {
                        const chunk = conversionRows.slice(i, i + chunkSize);
                        await supabase
                            .from('shopee_conversions')
                            .upsert(chunk, { onConflict: 'user_id,conversion_id,item_id' });
                    }
                }

                // 6. For each track, sync the dates doing an intelligent merge with existing data (Daily Aggregates)
                for (const trackId of Object.keys(matchedAgg)) {
                    const datesObj = matchedAgg[trackId];
                    const dates = Object.keys(datesObj);
                    if (dates.length === 0) continue;

                    const { data: existing } = await supabase
                        .from('creative_track_entries')
                        .select('*')
                        .eq('track_id', trackId)
                        .in('date', dates);

                    const existingMap = new Map<string, any>();
                    (existing || []).forEach(e => existingMap.set(e.date, e));

                    const payloads = dates.map(date => {
                        const csvValues = datesObj[date];
                        const dbValues = existingMap.get(date);

                        return {
                            track_id: trackId,
                            date,
                            shopee_clicks: csvValues.shopee_clicks !== undefined ? csvValues.shopee_clicks : (dbValues?.shopee_clicks ?? 0),
                            orders: csvValues.orders !== undefined ? csvValues.orders : (dbValues?.orders ?? 0),
                            commission_value: csvValues.commission_value !== undefined
                                ? Math.round(csvValues.commission_value * 100) / 100
                                : (dbValues?.commission_value ?? 0),
                            ad_clicks: dbValues?.ad_clicks ?? 0,
                            cpc: dbValues?.cpc ?? 0,
                            investment: dbValues?.investment ?? 0
                        };
                    });

                    await supabase
                        .from('creative_track_entries')
                        .upsert(payloads, { onConflict: 'track_id,date' });
                }

                // 7. Update track channels if discovered and changed
                const channelUpdateEntries = Object.entries(channelUpdates);
                if (channelUpdateEntries.length > 0) {
                    for (const [trackId, channel] of channelUpdateEntries) {
                        const track = updatedTracks.find(t => t.id === trackId);
                        if (track && track.channel !== channel) {
                            await supabase
                                .from('creative_tracks')
                                .update({ channel })
                                .eq('id', trackId);
                        }
                    }
                }

                console.log("CSV Auto-sync completed with track auto-creation.");
            } catch (err) {
                console.error("Auto-sync error:", err);
            } finally {
                setIsAutoSyncing(false);
            }
        };

        syncCsvWithDb();

    }, [clickData, commissionData, fileName, user]);
    // Only trigger when a new file processes, clickData or commissionData changes 

    const contextValue = useMemo(() => ({
        commissionData, clickData, fileName, handleFileUpload, reportType, clearData,
        dateFilter, setDateFilter, customRange, setCustomRange, statuses, fetchStatuses,
        reorderStatuses, hasStartedAnalysis, setHasStartedAnalysis, isAutoSyncing
    }), [
        commissionData, clickData, fileName, reportType,
        dateFilter, customRange, statuses, hasStartedAnalysis, isAutoSyncing
    ]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
        </DataContext.Provider>
    );
}

