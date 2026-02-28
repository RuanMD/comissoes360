import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
    hasStartedAnalysis: boolean;
    setHasStartedAnalysis: (val: boolean) => void;
    isAutoSyncing: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [commissionData, setCommissionData] = useState<any[]>([]);
    const [clickData, setClickData] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [reportType, setReportType] = useState<ReportType>('unknown');
    const [dateFilter, setDateFilter] = useState<DateFilterStr>('all');
    const [customRange, setCustomRange] = useState<CustomDateRange>({ start: '', end: '' });
    const [hasStartedAnalysis, setHasStartedAnalysis] = useState<boolean>(false);
    const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);

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
            setIsAutoSyncing(true);
            try {
                // 1. Fetch user's creative_tracks
                const { data: tracks, error: tracksErr } = await supabase
                    .from('creative_tracks')
                    .select('id, sub_id')
                    .eq('user_id', user.id);

                if (tracksErr) throw tracksErr;
                if (!tracks || tracks.length === 0) return;

                // 2. Identify canonical sub_ids from currently parsed CSV and build aggregation
                const matchedAgg: Record<string, Record<string, { shopee_clicks?: number, orders?: number, commission_value?: number }>> = {};
                const channelUpdates: Record<string, string> = {};

                const getMatch = (raw: string) => {
                    const canonical = (raw || '').split('-').filter(Boolean).join('-');
                    if (!canonical) return null;
                    const track = tracks.find(t => t.sub_id && (canonical === t.sub_id || canonical.includes(t.sub_id) || t.sub_id.includes(canonical)));
                    return track ? track.id : null;
                };

                clickData.forEach(click => {
                    const trackId = getMatch(click['Sub_id']);
                    if (!trackId) return;

                    const dateObj = parseShopeeDate(click['Tempo dos Cliques']);
                    if (!dateObj) return;
                    const dateKey = format(dateObj, 'yyyy-MM-dd');

                    if (!matchedAgg[trackId]) matchedAgg[trackId] = {};
                    if (!matchedAgg[trackId][dateKey]) matchedAgg[trackId][dateKey] = {};

                    matchedAgg[trackId][dateKey].shopee_clicks = (matchedAgg[trackId][dateKey].shopee_clicks || 0) + 1;

                    // Capture channel from CSV
                    if (click['Referenciador'] && click['Referenciador'] !== 'Desconhecido') {
                        channelUpdates[trackId] = click['Referenciador'];
                    }
                });

                commissionData.forEach(item => {
                    const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                    const canonical = parts.join('-');
                    const trackId = getMatch(canonical);
                    if (!trackId) return;

                    const dateObj = parseShopeeDate(item['Horário do pedido']);
                    if (!dateObj) return;
                    const dateKey = format(dateObj, 'yyyy-MM-dd');

                    const netComm = parseFloat(item['Comissão líquida do afiliado(R$)']?.toString().replace(',', '.') || '0');

                    if (!matchedAgg[trackId]) matchedAgg[trackId] = {};
                    if (!matchedAgg[trackId][dateKey]) matchedAgg[trackId][dateKey] = {};

                    matchedAgg[trackId][dateKey].orders = (matchedAgg[trackId][dateKey].orders || 0) + 1;
                    matchedAgg[trackId][dateKey].commission_value = (matchedAgg[trackId][dateKey].commission_value || 0) + netComm;
                });

                // 3. For each track, sync the dates doing an intelligent merge with existing data
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
                            // Merging logic: if this CSV parse *provided* a click value, use it. Otherwise, fallback to DB.
                            shopee_clicks: csvValues.shopee_clicks !== undefined ? csvValues.shopee_clicks : (dbValues?.shopee_clicks ?? 0),
                            // Merging logic: same for orders and commissions.
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

                // 4. Update track channels if discovered
                const channelUpdateKeys = Object.keys(channelUpdates);
                if (channelUpdateKeys.length > 0) {
                    for (const trackId of channelUpdateKeys) {
                        await supabase
                            .from('creative_tracks')
                            .update({ channel: channelUpdates[trackId] })
                            .eq('id', trackId);
                    }
                }

                console.log("CSV Auto-sync completed.");
            } catch (err) {
                console.error("Auto-sync error:", err);
            } finally {
                setIsAutoSyncing(false);
            }
        };

        syncCsvWithDb();

    }, [clickData, commissionData, fileName, user]); // Only trigger when a new file processes, clickData or commissionData changes 

    return (
        <DataContext.Provider value={{
            commissionData, clickData, fileName, handleFileUpload, reportType, clearData,
            dateFilter, setDateFilter, customRange, setCustomRange, hasStartedAnalysis, setHasStartedAnalysis, isAutoSyncing
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
