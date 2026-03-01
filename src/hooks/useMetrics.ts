import { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';

export function parseShopeeDate(dateStr: string) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        return null;
    } catch {
        return null;
    }
}

export function useMetrics() {
    const { commissionData, clickData, dateFilter, customRange } = useData();
    const [dbConversions, setDbConversions] = useState<any[]>([]);
    const [dbTracks, setDbTracks] = useState<any[]>([]);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        async function fetchDbData() {
            try {
                // Try to fetch from Supabase
                const { data: convData, error: convError } = await supabase
                    .from('shopee_conversions')
                    .select('*');

                const { data: trackData, error: trackError } = await supabase
                    .from('creative_tracks')
                    .select('*, creative_track_entries(*)');

                if (!convError && convData) {
                    setDbConversions(convData);
                    // Update cache
                    await db.orders.clear();
                    await db.orders.bulkAdd(convData.map(c => ({
                        order_id: c.order_id,
                        purchase_time: c.purchase_time,
                        actual_amount: c.actual_amount,
                        commission: c.item_total_commission,
                        status: c.order_status,
                        data: c,
                        updated_at: new Date().toISOString()
                    })));
                } else if (convError) {
                    console.warn('Supabase conversions error, falling back to cache:', convError);
                    const localOrders = await db.orders.toArray();
                    setDbConversions(localOrders.map(lo => lo.data));
                }

                if (!trackError && trackData) {
                    setDbTracks(trackData);
                    // Update cache
                    await db.tracks.clear();
                    await db.tracks.bulkAdd(trackData);
                    setLastSync(new Date());
                } else if (trackError) {
                    console.warn('Supabase tracks error, falling back to cache:', trackError);
                    const localTracks = await db.tracks.toArray();
                    setDbTracks(localTracks);
                }

            } catch (err) {
                console.warn('Network error, using offline cache:', err);
                const localOrders = await db.orders.toArray();
                const localTracks = await db.tracks.toArray();
                setDbConversions(localOrders.map(lo => lo.data));
                setDbTracks(localTracks);
            }
        }
        fetchDbData();
    }, []);

    // 1. Filter Clicks by Date
    const filteredClicks = useMemo(() => {
        if (!clickData.length) return [];
        if (dateFilter === 'all') return clickData;

        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case 'anteontem':
                start = startOfDay(subDays(now, 2));
                end = endOfDay(subDays(now, 2));
                break;
            case '7days':
                start = startOfDay(subDays(now, 7));
                break;
            case '30days':
                start = startOfDay(subDays(now, 30));
                break;
            case 'custom':
                if (customRange?.start) start = startOfDay(new Date(customRange.start));
                if (customRange?.end) end = endOfDay(new Date(customRange.end));
                break;
            default:
                return clickData;
        }

        return clickData.filter(item => {
            const dateStr = item['Tempo dos Cliques'];
            const dateObj = parseShopeeDate(dateStr);
            if (!dateObj) return true;
            return isWithinInterval(dateObj, { start, end });
        });
    }, [clickData, dateFilter, customRange]);

    // 2. Unify and Filter Commissions (CSV + DB)
    const unifiedCommission = useMemo(() => {
        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);

        if (dateFilter !== 'all') {
            switch (dateFilter) {
                case 'today': start = startOfDay(now); break;
                case 'yesterday': start = startOfDay(subDays(now, 1)); end = endOfDay(subDays(now, 1)); break;
                case 'anteontem': start = startOfDay(subDays(now, 2)); end = endOfDay(subDays(now, 2)); break;
                case '7days': start = startOfDay(subDays(now, 7)); break;
                case '30days': start = startOfDay(subDays(now, 30)); break;
                case 'custom':
                    if (customRange?.start) start = startOfDay(new Date(customRange.start));
                    if (customRange?.end) end = endOfDay(new Date(customRange.end));
                    break;
            }
        }

        const filteredCsv = commissionData.filter(item => {
            if (dateFilter === 'all') return true;
            const dateObj = parseShopeeDate(item['Horário do pedido']);
            if (!dateObj) return true;
            return isWithinInterval(dateObj, { start, end });
        });

        const filteredDb = dbConversions.filter(item => {
            if (dateFilter === 'all') return true;
            if (!item.purchase_time) return true;
            const dateObj = new Date(item.purchase_time);
            return isWithinInterval(dateObj, { start, end });
        }).map(item => ({
            'ID do pedido': item.order_id,
            'Comissão líquida do afiliado(R$)': item.item_total_commission?.toString() || '0',
            'Valor de Compra(R$)': item.actual_amount?.toString() || '0',
            'Tipo de atribuição': item.attribution_type === 'ORDERED_IN_SAME_SHOP' ? 'Mesma Loja' : 'Diferente',
            'Status do Pedido': item.order_status === 'COMPLETED' ? 'Concluído' : item.order_status === 'CANCELLED' ? 'Cancelado' : 'Pendente',
            'Status do Comprador': item.buyer_type === 'NEW' ? 'Novo' : 'Existente',
            'Comissão Shopee(R$)': item.item_shopee_commission?.toString() || '0',
            'Comissão do vendedor(R$)': item.item_seller_commission?.toString() || '0',
            'Nome do Item': item.item_name,
            'Categoria Global L1': item.global_category_lv1,
            'Sub_id1': item.utm_content || (dbTracks.find(t => t.id === item.track_id)?.sub_id) || '',
            'Tempo dos Cliques': item.click_time ? format(new Date(item.click_time), 'yyyy-MM-dd HH:mm:ss') : '',
            'Horário do pedido': item.purchase_time ? format(new Date(item.purchase_time), 'yyyy-MM-dd HH:mm:ss') : '',
            'Canal': item.referrer || 'Desconhecido',
            _isFromDb: true,
            _trackId: item.track_id,
            _itemId: item.item_id,
            _qty: item.qty,
            _image: item.image_url,
            _attribution: item.attribution_type
        }));

        const unifiedMap = new Map<string, any>();
        filteredDb.forEach(item => { if (item['ID do pedido']) unifiedMap.set(item['ID do pedido'], item); });
        filteredCsv.forEach(item => { if (item['ID do pedido']) unifiedMap.set(item['ID do pedido'], item); });

        return Array.from(unifiedMap.values());
    }, [commissionData, dbConversions, dateFilter, customRange]);

    // 3. Correlate Data and Calculate Metrics
    const metrics = useMemo(() => {
        let totalNetCommission = 0;
        let totalOrderValue = 0;
        let totalOrders = unifiedCommission.length;
        let totalClicks = filteredClicks.length;

        const dailyOrders: Record<string, number> = {};
        const productCounts: Record<string, { count: number, commission: number }> = {};
        const categoryStats: Record<string, { count: number, commission: number }> = {};
        const timeToBuyMinutes: number[] = [];

        let directsCount = 0;
        let indirectsCount = 0;
        let cancelledCount = 0;
        let pendingCount = 0;
        let completedCount = 0;
        let newBuyersCount = 0;
        let existingBuyersCount = 0;
        let shopeeCommissionTotal = 0;
        let sellerCommissionTotal = 0;

        const allOrders: Array<{
            id: string,
            date: string,
            productName: string,
            imageUrl?: string | null,
            qty: number,
            channel: string,
            subId: string,
            status: string,
            type: string,
            commission: number
        }> = [];

        const subIdStats: Record<string, { clicks: number, orders: number, commission: number, channels: Set<string> }> = {};
        const subIdDetails: Record<string, {
            products: Record<string, { count: number, commission: number }>,
            channelBreakdown: Record<string, { clicks: number, orders: number, commission: number }>,
            orders: Array<{ orderId: string, product: string, commission: number, status: string, date: string }>
        }> = {};
        const channelStats: Record<string, { clicks: number, orders: number, commission: number }> = {};

        const clickSubIds = new Set<string>();
        const csvClickDatesBySubId: Record<string, Set<string>> = {};
        const subIdToChannel = new Map<string, string>();

        // Map channels from DB Conversions first
        unifiedCommission.forEach(item => {
            if (item._isFromDb && item['Canal'] && item['Canal'] !== 'Desconhecido') {
                const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                const canonical = parts.join('-') || 'Sem Sub_id';
                if (canonical !== 'Sem Sub_id') {
                    // Fuzzy match to the actual track sub_id
                    const matchedTrack = dbTracks.find(t =>
                        t.sub_id && (t.sub_id === canonical || canonical.includes(t.sub_id) || t.sub_id.includes(canonical))
                    );

                    if (matchedTrack) {
                        subIdToChannel.set(matchedTrack.sub_id, item['Canal']);
                    } else {
                        subIdToChannel.set(canonical, item['Canal']);
                    }
                }
            }
        });

        filteredClicks.forEach(click => {
            const rawSubId = click['Sub_id'] || '';
            const canonical = rawSubId.split('-').filter(Boolean).join('-') || 'Sem Sub_id';
            clickSubIds.add(canonical);
            const ref = click['Referenciador'] || 'Desconhecido';
            if (ref && ref !== 'Desconhecido') {
                subIdToChannel.set(canonical, ref);
            }

            const clickTime = (click['Tempo dos Cliques'] || '').trim();
            const dateObj = parseShopeeDate(clickTime);
            if (dateObj) {
                const dateKey = dateObj.toISOString().split('T')[0];
                if (!csvClickDatesBySubId[canonical]) csvClickDatesBySubId[canonical] = new Set();
                csvClickDatesBySubId[canonical].add(dateKey);
            }

            if (!subIdStats[canonical]) subIdStats[canonical] = { clicks: 0, orders: 0, commission: 0, channels: new Set() };
            subIdStats[canonical].clicks += 1;
            if (ref) subIdStats[canonical].channels.add(ref);

            if (!subIdDetails[canonical]) subIdDetails[canonical] = { products: {}, channelBreakdown: {}, orders: [] };
            if (!subIdDetails[canonical].channelBreakdown[ref]) subIdDetails[canonical].channelBreakdown[ref] = { clicks: 0, orders: 0, commission: 0 };
            subIdDetails[canonical].channelBreakdown[ref].clicks += 1;

            if (!channelStats[ref]) channelStats[ref] = { clicks: 0, orders: 0, commission: 0 };
            channelStats[ref].clicks += 1;
        });

        // Determine boundaries manually for dbTracks to reuse same filter as filteredClicks
        const now = new Date();
        let startBound: Date = new Date(0);
        let endBound: Date = endOfDay(now);
        if (dateFilter !== 'all') {
            switch (dateFilter) {
                case 'today': startBound = startOfDay(now); break;
                case 'yesterday': startBound = startOfDay(subDays(now, 1)); endBound = endOfDay(subDays(now, 1)); break;
                case 'anteontem': startBound = startOfDay(subDays(now, 2)); endBound = endOfDay(subDays(now, 2)); break;
                case '7days': startBound = startOfDay(subDays(now, 7)); break;
                case '30days': startBound = startOfDay(subDays(now, 30)); break;
                case 'custom':
                    if (customRange?.start) startBound = startOfDay(new Date(customRange.start));
                    if (customRange?.end) endBound = endOfDay(new Date(customRange.end));
                    break;
            }
        }

        dbTracks.forEach(track => {
            const subId = track.sub_id || 'Sem Sub_id';
            const entries = track.creative_track_entries || [];

            entries.forEach((entry: any) => {
                const entryDateKey = entry.date;
                // Merge if CSV has no clicks for this subId on this date
                if (!csvClickDatesBySubId[subId] || !csvClickDatesBySubId[subId].has(entryDateKey)) {
                    // entry.date is 'YYYY-MM-DD'. Parse carefully to avoid timezone shift
                    const [y, m, d] = entryDateKey.split('-');
                    const entryDateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);

                    let inDateRange = true;
                    if (dateFilter !== 'all') {
                        inDateRange = isWithinInterval(entryDateObj, { start: startBound, end: endBound });
                    }

                    if (inDateRange && entry.shopee_clicks > 0) {
                        const channel = track.channel || subIdToChannel.get(subId) || 'Desconhecido';

                        clickSubIds.add(subId);
                        totalClicks += entry.shopee_clicks;

                        if (!subIdStats[subId]) subIdStats[subId] = { clicks: 0, orders: 0, commission: 0, channels: new Set() };
                        subIdStats[subId].clicks += entry.shopee_clicks;
                        subIdStats[subId].channels.add(channel);

                        if (!subIdDetails[subId]) subIdDetails[subId] = { products: {}, channelBreakdown: {}, orders: [] };
                        if (!subIdDetails[subId].channelBreakdown[channel]) subIdDetails[subId].channelBreakdown[channel] = { clicks: 0, orders: 0, commission: 0 };
                        subIdDetails[subId].channelBreakdown[channel].clicks += entry.shopee_clicks;

                        if (!channelStats[channel]) channelStats[channel] = { clicks: 0, orders: 0, commission: 0 };
                        channelStats[channel].clicks += entry.shopee_clicks;
                    }
                }
            });
        });

        const parseCurrency = (val: any) => {
            if (!val) return 0;
            const clean = val.toString().replace(/[^0-9,.-]/g, '').replace(',', '.');
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 0 : parsed;
        };

        unifiedCommission.forEach((item: any) => {
            const netComm = parseCurrency(item['Comissão líquida do afiliado(R$)']);
            const orderVal = parseCurrency(item['Valor de Compra(R$)']);
            totalNetCommission += netComm;
            totalOrderValue += orderVal;

            const attribution = item['Tipo de atribuição'] || '';
            if (attribution.toLowerCase().includes('mesma loja')) directsCount++;
            else if (attribution.toLowerCase().includes('diferente')) indirectsCount++;

            const status = item['Status do Pedido'] || '';
            if (status.toLowerCase() === 'cancelado') cancelledCount++;
            else if (status.toLowerCase() === 'pendente') pendingCount++;
            else if (status.toLowerCase() === 'concluído') completedCount++;

            const buyerType = item['Status do Comprador'] || '';
            if (buyerType.toLowerCase() === 'novo') newBuyersCount++;
            else if (buyerType.toLowerCase() === 'existente') existingBuyersCount++;

            const shopeeComm = parseCurrency(item['Comissão Shopee(R$)']);
            const sellerComm = parseCurrency(item['Comissão do vendedor(R$)']);
            shopeeCommissionTotal += shopeeComm;
            sellerCommissionTotal += sellerComm;

            const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
            let canonical = parts.join('-') || 'Sem Sub_id';

            // Prioritize track_id link from database if available
            if (item._isFromDb && item._trackId) {
                const track = dbTracks.find(t => t.id === item._trackId);
                if (track) canonical = track.sub_id || 'Sem Sub_id';
            } else if (canonical !== 'Sem Sub_id' && !clickSubIds.has(canonical)) {
                const possibleMatch = Array.from(clickSubIds).find(c => c.includes(canonical) || canonical.includes(c));
                if (possibleMatch) canonical = possibleMatch;
            }

            if (!subIdStats[canonical]) subIdStats[canonical] = { clicks: 0, orders: 0, commission: 0, channels: new Set() };
            subIdStats[canonical].orders += 1;
            subIdStats[canonical].commission += netComm;

            if (!subIdDetails[canonical]) subIdDetails[canonical] = { products: {}, channelBreakdown: {}, orders: [] };
            const prodName = item['Nome do Item'] || 'Item Desconhecido';
            if (!subIdDetails[canonical].products[prodName]) subIdDetails[canonical].products[prodName] = { count: 0, commission: 0 };
            subIdDetails[canonical].products[prodName].count += 1;
            subIdDetails[canonical].products[prodName].commission += netComm;
            subIdDetails[canonical].orders.push({ orderId: item['ID do pedido'] || '—', product: prodName, commission: netComm, status: item['Status do Pedido'] || '—', date: item['Horário do pedido'] || '—' });

            if (!productCounts[prodName]) productCounts[prodName] = { count: 0, commission: 0 };
            productCounts[prodName].count += 1;
            productCounts[prodName].commission += netComm;

            const catName = item['Categoria Global L1'] || 'Sem Categoria';
            if (!categoryStats[catName]) categoryStats[catName] = { count: 0, commission: 0 };
            categoryStats[catName].count += 1;
            categoryStats[catName].commission += netComm;

            let assignedChannel = item['Canal'] && item['Canal'] !== 'Desconhecido' ? item['Canal'] : 'Desconhecido';

            // Allow tracking link to establish the channel if not provided directly
            if (assignedChannel === 'Desconhecido' && canonical !== 'Sem Sub_id') {
                const matchedTrack = dbTracks.find(t => t.sub_id && (t.sub_id === canonical || canonical.includes(t.sub_id) || t.sub_id.includes(canonical)));
                if (matchedTrack && matchedTrack.channel) {
                    assignedChannel = matchedTrack.channel;
                }
            }

            if (assignedChannel === 'Desconhecido' && subIdStats[canonical]?.channels.size > 0) {
                assignedChannel = Array.from(subIdStats[canonical].channels).find(c => c !== 'Desconhecido') || Array.from(subIdStats[canonical].channels)[0];
            } else if (assignedChannel === 'Desconhecido' && subIdToChannel.has(canonical)) {
                assignedChannel = subIdToChannel.get(canonical) || 'Desconhecido';
            }

            if (!channelStats[assignedChannel]) channelStats[assignedChannel] = { clicks: 0, orders: 0, commission: 0 };
            channelStats[assignedChannel].orders += 1;
            channelStats[assignedChannel].commission += netComm;

            if (!subIdDetails[canonical].channelBreakdown[assignedChannel]) subIdDetails[canonical].channelBreakdown[assignedChannel] = { clicks: 0, orders: 0, commission: 0 };
            subIdDetails[canonical].channelBreakdown[assignedChannel].orders += 1;
            subIdDetails[canonical].channelBreakdown[assignedChannel].commission += netComm;

            const dateObj = parseShopeeDate(item['Horário do pedido']);
            if (dateObj) {
                const dayStr = format(dateObj, 'dd/MM');
                dailyOrders[dayStr] = (dailyOrders[dayStr] || 0) + 1;
            }

            const cTime = parseShopeeDate(item['Tempo dos Cliques']);
            const oTime = parseShopeeDate(item['Horário do pedido']);
            if (cTime && oTime) {
                const diffMs = oTime.getTime() - cTime.getTime();
                if (diffMs >= 0) timeToBuyMinutes.push(Math.floor(diffMs / 60000));
            }

            // Push granular order details
            allOrders.push({
                id: item['ID do pedido'] || (item._isFromDb ? item.conversion_id : Math.random().toString(36).substr(2, 9)),
                date: item['Horário do pedido'] || '—',
                productName: prodName,
                imageUrl: item._image || item._parsedImage || null,
                qty: Number(item._qty) || Number(item['Quantidade de itens']) || 1,
                channel: assignedChannel,
                subId: canonical,
                status: item['Status do Pedido'] || item['Status do pedido'] || 'Pendente',
                type: (['DIRECT', 'direct', 'Direta', 'ORDERED_IN_SAME_SHOP'].includes(item._attribution || item._attributionType || item['Tipo de atribuição']))
                    ? 'Direta'
                    : 'Indireta',
                commission: netComm
            });
        });

        // Ensure orders are sorted by most recent
        allOrders.sort((a, b) => {
            const dateA = parseShopeeDate(a.date);
            const dateB = parseShopeeDate(b.date);
            if (dateA && dateB) return dateB.getTime() - dateA.getTime();
            return 0;
        });

        const allProducts = Object.entries(productCounts).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.commission - a.commission);
        const productRanking = allProducts.slice(0, 5);
        const categoriesRanking = Object.entries(categoryStats).map(([name, s]) => ({ category: name, ...s })).sort((a, b) => b.commission - a.commission);
        const channelsRanking = Object.entries(channelStats).map(([name, s]) => ({ channel: name, ...s })).sort((a, b) => b.commission - a.commission);

        // === Simplified Funnel: Independent Clicks and Orders ===
        const funnelSubIdMap: Record<string, { clicks: number, orders: number, revenue: number, commission: number }> = {};
        const funnelChannelMap: Record<string, { clicks: number, orders: number, revenue: number, commission: number }> = {};

        // Initialize funnel maps from all clicks
        filteredClicks.forEach(click => {
            const rawSubId = click['Sub_id'] || '';
            const subId = rawSubId.split('-').filter(Boolean).join('-') || 'Sem Sub_id';
            const channel = click['Referenciador'] || 'Desconhecido';

            if (!funnelSubIdMap[subId]) funnelSubIdMap[subId] = { clicks: 0, orders: 0, revenue: 0, commission: 0 };
            funnelSubIdMap[subId].clicks += 1;

            if (!funnelChannelMap[channel]) funnelChannelMap[channel] = { clicks: 0, orders: 0, revenue: 0, commission: 0 };
            funnelChannelMap[channel].clicks += 1;
        });

        // Add commission-side orders to funnel maps
        unifiedCommission.forEach(item => {
            const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
            let subId = parts.join('-') || 'Sem Sub_id';
            if (subId !== 'Sem Sub_id' && !funnelSubIdMap[subId]) {
                const match = Object.keys(funnelSubIdMap).find(k => k.includes(subId) || subId.includes(k));
                if (match) subId = match;
            }
            const channel = item['Canal'] || 'Desconhecido';
            const netComm = parseFloat(item['Comissão líquida do afiliado(R$)']?.toString().replace(',', '.') || '0');
            const orderVal = parseFloat(item['Valor de Compra(R$)']?.toString().replace(',', '.') || '0');

            if (!funnelSubIdMap[subId]) funnelSubIdMap[subId] = { clicks: 0, orders: 0, revenue: 0, commission: 0 };
            funnelSubIdMap[subId].orders += 1;
            funnelSubIdMap[subId].revenue += orderVal;
            funnelSubIdMap[subId].commission += netComm;

            if (!funnelChannelMap[channel]) funnelChannelMap[channel] = { clicks: 0, orders: 0, revenue: 0, commission: 0 };
            funnelChannelMap[channel].orders += 1;
            funnelChannelMap[channel].revenue += orderVal;
            funnelChannelMap[channel].commission += netComm;
        });

        const epc = totalClicks > 0 ? totalNetCommission / totalClicks : 0;

        const funnelBySubId = Object.entries(funnelSubIdMap)
            .map(([subId, s]) => ({
                subId,
                clicks: s.clicks,
                orders: s.orders,
                conversion: s.clicks > 0 ? ((s.orders / s.clicks) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00',
                revenue: s.revenue,
                commission: s.commission,
                epc: s.clicks > 0 ? s.commission / s.clicks : 0,
            }))
            .sort((a, b) => b.commission - a.commission);

        const funnelByChannel = Object.entries(funnelChannelMap)
            .map(([channel, s]) => ({
                channel,
                clicks: s.clicks,
                orders: s.orders,
                conversion: s.clicks > 0 ? ((s.orders / s.clicks) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00',
                revenue: s.revenue,
                commission: s.commission,
                epc: s.clicks > 0 ? s.commission / s.clicks : 0,
            }))
            .sort((a, b) => b.commission - a.commission);

        return {
            isEmpty: commissionData.length === 0 && clickData.length === 0 && dbConversions.length === 0 && dbTracks.length === 0,
            totalOrders, totalNetCommission, totalOrderValue, totalClicks,
            epc,
            funnelBySubId,
            funnelByChannel,
            dailyChart: Object.entries(dailyOrders).map(([date, count]) => ({ date, count })),
            allOrders, productRanking, allProducts, categoriesRanking, channelsRanking,
            conversionRate: totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00',
            directsVsIndirects: [
                { name: 'Diretas', value: directsCount, fill: '#f2a20d' },
                { name: 'Indiretas', value: indirectsCount, fill: '#3b82f6' }
            ],
            funnelStats: { completed: completedCount, pending: pendingCount, cancelled: cancelledCount },
            buyerStats: { new: newBuyersCount, existing: existingBuyersCount },
            commissionSource: { shopee: shopeeCommissionTotal, seller: sellerCommissionTotal },
            subIdRanking: Object.entries(subIdStats).map(([name, s]) => ({
                subId: name,
                clicks: s.clicks,
                orders: s.orders,
                conversion: s.clicks > 0 ? ((s.orders / s.clicks) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00',
                commission: s.commission,
                channels: Array.from(s.channels).join(', ') || 'N/A'
            })).sort((a, b) => b.commission - a.commission),
            subIdDetails: Object.fromEntries(Object.entries(subIdDetails).map(([subId, detail]) => [
                subId, {
                    products: Object.entries(detail.products).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.commission - a.commission),
                    channelBreakdown: Object.entries(detail.channelBreakdown).map(([channel, s]) => ({ channel, ...s })).sort((a, b) => b.clicks - a.clicks),
                    orders: detail.orders.sort((a, b) => b.commission - a.commission)
                }
            ])),
            lastSync,
            isOffline
        };
    }, [unifiedCommission, filteredClicks, clickData, dbTracks, dateFilter, customRange, lastSync, isOffline]);

    return metrics;
}
