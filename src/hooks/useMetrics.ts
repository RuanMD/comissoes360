import { useMemo, useState, useEffect } from 'react';
import { useData } from './useData';
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { parseShopeeDate, normalizeSubIdForMatch as normalizeSubId, isSubIdMatch } from '../utils/shopee';

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
            'Sub_id1': (!item.utm_content || !item.utm_content.replace(/-/g, '').trim())
                ? 'Sem Sub_id'
                : item.utm_content || (dbTracks.find(t => t.id === item.track_id)?.sub_id) || '',
            'Tempo dos Cliques': item.click_time ? (parseShopeeDate(item.click_time) ? format(parseShopeeDate(item.click_time)!, 'yyyy-MM-dd HH:mm:ss') : item.click_time) : '',
            'Horário do pedido': item.purchase_time ? (parseShopeeDate(item.purchase_time) ? format(parseShopeeDate(item.purchase_time)!, 'yyyy-MM-dd HH:mm:ss') : item.purchase_time) : '',
            'Canal': item.referrer || 'Desconhecido',
            _isFromDb: true,
            _trackId: item.track_id,
            _itemId: item.item_id,
            _qty: item.qty,
            _image: item.image_url,
            _attribution: item.attribution_type
        }));

        const dbOrderIds = new Set(filteredDb.map(item => item['ID do pedido']).filter(Boolean));

        const combined = [
            ...filteredDb,
            ...filteredCsv.filter(item => {
                const orderId = item['ID do pedido'];
                return orderId && !dbOrderIds.has(orderId);
            })
        ];

        return combined;
    }, [commissionData, dbConversions, dateFilter, customRange]);
    // Funções utilitárias normalizeSubId e isSubIdMatch importadas de '../utils/shopee'

    // 3. Correlate Data and Calculate Metrics
    const metrics = useMemo(() => {
        let totalNetCommission = 0;
        let totalOrderValue = 0;
        let totalSalesCount = 0; // Total sum of quantities
        let totalOrders = 0; // Distinct order IDs
        const filteredCsvClicks = filteredClicks.length;
        let totalClicks = filteredCsvClicks; // Inicia com cliques do CSV filtrados por data
        let totalAdClicks = 0;
        let totalInvestment = 0;

        const dailyOrders: Record<string, number> = {};
        const productCounts: Record<string, { count: number, commission: number }> = {};
        const categoryStats: Record<string, { count: number, commission: number }> = {};
        const timeToBuyMinutes: number[] = [];

        let directsCount = 0;
        let indirectsCount = 0;
        let cancelledCount = 0;
        let pendingCount = 0;
        let completedCount = 0;
        let cancelledValue = 0;
        let pendingValue = 0;
        let completedValue = 0;
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
            commission: number,
            category: string,
            revenue: number
        }> = [];

        const subIdStats: Record<string, { clicks: number, adClicks: number, investment: number, orders: number, commission: number, channels: Set<string> }> = {};
        const subIdDetails: Record<string, {
            products: Record<string, { count: number, commission: number }>,
            channelBreakdown: Record<string, { clicks: number, adClicks: number, investment: number, orders: number, commission: number }>,
            orders: Array<{ orderId: string, product: string, commission: number, status: string, date: string }>
        }> = {};
        const channelStats: Record<string, { clicks: number, adClicks: number, investment: number, orders: number, commission: number }> = {};

        const clickSubIds = new Set<string>();
        const csvClickDatesBySubId: Record<string, Set<string>> = {};
        const subIdToChannel = new Map<string, string>();

        // Map channels from DB Conversions first
        unifiedCommission.forEach(item => {
            if (item._isFromDb && item['Canal'] && item['Canal'] !== 'Desconhecido') {
                const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
                const canonical = normalizeSubId(parts.join('-'));
                if (canonical !== 'Sem Sub_id') {
                    // Try to find a track that matches this canonical
                    const matchedTrack = dbTracks.find(t => isSubIdMatch(t.sub_id, canonical));

                    if (matchedTrack) {
                        subIdToChannel.set(normalizeSubId(matchedTrack.sub_id), item['Canal']);
                    } else {
                        subIdToChannel.set(canonical, item['Canal']);
                    }
                }
            }
        });

        filteredClicks.forEach(click => {
            const canonical = normalizeSubId(click['Sub_id']);
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

            if (!subIdStats[canonical]) subIdStats[canonical] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0, channels: new Set() };
            subIdStats[canonical].clicks += 1;
            if (ref) subIdStats[canonical].channels.add(ref);

            if (!subIdDetails[canonical]) subIdDetails[canonical] = { products: {}, channelBreakdown: {}, orders: [] };
            if (!subIdDetails[canonical].channelBreakdown[ref]) subIdDetails[canonical].channelBreakdown[ref] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
            subIdDetails[canonical].channelBreakdown[ref].clicks += 1;

            if (!channelStats[ref]) channelStats[ref] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
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
            const subId = normalizeSubId(track.sub_id);
            const entries = track.creative_track_entries || [];

            entries.forEach((entry: any) => {
                const entryDateKey = entry.date;
                const [y, m, d] = entryDateKey.split('-');
                const entryDateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);

                let inDateRange = true;
                if (dateFilter !== 'all') {
                    inDateRange = isWithinInterval(entryDateObj, { start: startBound, end: endBound });
                }
                if (!inDateRange) return;

                const channel = track.channel || subIdToChannel.get(subId) || 'Desconhecido';

                // FIX: Always add ad_clicks and investment — they come exclusively from track entries, never from CSV
                const adClicks = entry.ad_clicks || 0;
                const investment = entry.investment || 0;
                if (adClicks > 0 || investment > 0) {
                    clickSubIds.add(subId);
                    totalAdClicks += adClicks;
                    totalInvestment += investment;

                    if (!subIdStats[subId]) subIdStats[subId] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0, channels: new Set() };
                    subIdStats[subId].adClicks += adClicks;
                    subIdStats[subId].investment += investment;
                    subIdStats[subId].channels.add(channel);

                    if (!subIdDetails[subId]) subIdDetails[subId] = { products: {}, channelBreakdown: {}, orders: [] };
                    if (!subIdDetails[subId].channelBreakdown[channel]) subIdDetails[subId].channelBreakdown[channel] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
                    subIdDetails[subId].channelBreakdown[channel].adClicks += adClicks;
                    subIdDetails[subId].channelBreakdown[channel].investment += investment;

                    if (!channelStats[channel]) channelStats[channel] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
                    channelStats[channel].adClicks += adClicks;
                    channelStats[channel].investment += investment;
                }

                // FIX: Only add Shopee clicks when CSV doesn't already have them for this SubID/date (avoid double-counting)
                const shopeeClicks = entry.shopee_clicks || 0;
                if (shopeeClicks > 0) {
                    const hasCsvForThisDay = csvClickDatesBySubId[subId] && csvClickDatesBySubId[subId].has(entryDateKey);

                    if (!hasCsvForThisDay) {
                        totalClicks += shopeeClicks;
                    }

                    clickSubIds.add(subId);
                    if (!subIdStats[subId]) subIdStats[subId] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0, channels: new Set() };
                    subIdStats[subId].clicks += shopeeClicks;
                    subIdStats[subId].channels.add(channel);

                    if (!subIdDetails[subId]) subIdDetails[subId] = { products: {}, channelBreakdown: {}, orders: [] };
                    if (!subIdDetails[subId].channelBreakdown[channel]) subIdDetails[subId].channelBreakdown[channel] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
                    subIdDetails[subId].channelBreakdown[channel].clicks += shopeeClicks;

                    if (!channelStats[channel]) channelStats[channel] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
                    channelStats[channel].clicks += shopeeClicks;
                }
            });
        });

        // === UNIFIED DATA ENGINE v2 — STEP A: Snapshot Traffic Before Orders ===
        const trafficBySubId: Record<string, { clicks: number, adClicks: number, investment: number, channels: Set<string> }> = {};
        Object.entries(subIdStats).forEach(([subId, s]) => {
            trafficBySubId[subId] = {
                clicks: s.clicks,
                adClicks: s.adClicks,
                investment: s.investment,
                channels: new Set(s.channels)
            };
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
            const itemQty = Number(item._qty) || Number(item['Quantidade de itens']) || 1;
            totalSalesCount += itemQty;
            totalOrders += 1;

            const attribution = item['Tipo de atribuição'] || '';
            if (attribution.toLowerCase().includes('mesma loja')) directsCount++;
            else if (attribution.toLowerCase().includes('diferente')) indirectsCount++;

            const status = item['Status do Pedido'] || '';
            if (status.toLowerCase() === 'cancelado') {
                cancelledCount++;
                cancelledValue += netComm;
            } else if (status.toLowerCase() === 'pendente') {
                pendingCount++;
                pendingValue += netComm;
            } else if (status.toLowerCase() === 'concluído') {
                completedCount++;
                completedValue += netComm;
            }

            const buyerType = item['Status do Comprador'] || '';
            if (buyerType.toLowerCase() === 'novo') newBuyersCount++;
            else if (buyerType.toLowerCase() === 'existente') existingBuyersCount++;

            const shopeeComm = parseCurrency(item['Comissão Shopee(R$)']);
            const sellerComm = parseCurrency(item['Comissão do vendedor(R$)']);
            shopeeCommissionTotal += shopeeComm;
            sellerCommissionTotal += sellerComm;

            const parts = [item['Sub_id1'], item['Sub_id2'], item['Sub_id3'], item['Sub_id4'], item['Sub_id5']].filter(Boolean);
            let canonical = normalizeSubId(parts.join('-'));

            // Prioritize track_id link from database if available
            if (item._isFromDb && item._trackId) {
                const track = dbTracks.find(t => t.id === item._trackId);
                if (track) canonical = normalizeSubId(track.sub_id);
            } else if (canonical !== 'Sem Sub_id' && !clickSubIds.has(canonical)) {
                // Improved fuzzy match in the known set of Sub_IDs with traffic
                const possibleMatch = Array.from(clickSubIds).find(c => isSubIdMatch(c, canonical));
                if (possibleMatch) canonical = possibleMatch;
            }

            if (!subIdStats[canonical]) subIdStats[canonical] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0, channels: new Set() };
            subIdStats[canonical].orders += itemQty;
            subIdStats[canonical].commission += netComm;

            if (!subIdDetails[canonical]) subIdDetails[canonical] = { products: {}, channelBreakdown: {}, orders: [] };
            const prodName = item['Nome do Item'] || 'Item Desconhecido';
            if (!subIdDetails[canonical].products[prodName]) subIdDetails[canonical].products[prodName] = { count: 0, commission: 0 };
            subIdDetails[canonical].products[prodName].count += itemQty;
            subIdDetails[canonical].products[prodName].commission += netComm;
            subIdDetails[canonical].orders.push({
                orderId: item['ID do pedido'] || '—',
                product: prodName,
                commission: netComm,
                status: item['Status do Pedido'] || '—',
                date: item['Horário do pedido'] || '—',
                qty: itemQty
            } as any);

            if (!productCounts[prodName]) productCounts[prodName] = { count: 0, commission: 0 };
            productCounts[prodName].count += itemQty;
            productCounts[prodName].commission += netComm;

            const catName = item['Categoria Global L1'] || 'Sem Categoria';
            if (!categoryStats[catName]) categoryStats[catName] = { count: 0, commission: 0 };
            categoryStats[catName].count += itemQty;
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

            if (!channelStats[assignedChannel]) channelStats[assignedChannel] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
            channelStats[assignedChannel].orders += itemQty;
            channelStats[assignedChannel].commission += netComm;

            if (!subIdDetails[canonical].channelBreakdown[assignedChannel]) subIdDetails[canonical].channelBreakdown[assignedChannel] = { clicks: 0, adClicks: 0, investment: 0, orders: 0, commission: 0 };
            subIdDetails[canonical].channelBreakdown[assignedChannel].orders += itemQty;
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
                id: item['ID do pedido'] || (item._isFromDb ? item.conversion_id : crypto.randomUUID()),
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
                commission: netComm,
                category: catName,
                revenue: orderVal
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

        // === UNIFIED DATA ENGINE v2 — STEP B: Master Registry (The Cube) ===
        type UnifiedMetrics = { orders: number, revenue: number, commission: number, clicks: number, adClicks: number, investment: number };
        type UnifiedDimension = { subId: string, channel: string, category: string, date: string, hour: string, product: string, productName: string, isDirect: boolean };
        const masterRegistry: Array<{ dimension: UnifiedDimension, metrics: UnifiedMetrics }> = [];

        // Build unified records from all orders with proportional traffic attribution
        allOrders.forEach(order => {
            const traffic = trafficBySubId[order.subId] || { clicks: 0, adClicks: 0, investment: 0, channels: new Set() };
            const subIdOrderCount = subIdStats[order.subId]?.orders || 1;
            const ratio = 1 / subIdOrderCount;

            const dateObj = parseShopeeDate(order.date);

            // Channel enrichment: if order has no channel, try traffic sources
            let enrichedChannel = order.channel;
            if (enrichedChannel === 'Desconhecido' && traffic.channels.size > 0) {
                enrichedChannel = Array.from(traffic.channels).find(c => c !== 'Desconhecido') || Array.from(traffic.channels)[0] || 'Desconhecido';
            }

            masterRegistry.push({
                dimension: {
                    subId: order.subId,
                    channel: enrichedChannel,
                    category: order.category,
                    date: dateObj ? format(dateObj, 'yyyy-MM-dd') : 'N/A',
                    hour: dateObj ? format(dateObj, 'HH') : 'N/A',
                    product: order.productName,
                    productName: order.productName,
                    isDirect: order.type === 'Direta'
                },
                metrics: {
                    orders: order.qty,
                    revenue: order.revenue,
                    commission: order.commission,
                    clicks: traffic.clicks * ratio,
                    adClicks: traffic.adClicks * ratio,
                    investment: traffic.investment * ratio
                }
            });
        });

        // Add traffic entries that had NO orders (to preserve investment/clicks in totals)
        Object.entries(trafficBySubId).forEach(([subId, traffic]) => {
            const hasOrders = subIdStats[subId]?.orders > 0;
            if (!hasOrders && (traffic.clicks > 0 || traffic.adClicks > 0 || traffic.investment > 0)) {
                masterRegistry.push({
                    dimension: {
                        subId,
                        channel: Array.from(traffic.channels)[0] || 'Desconhecido',
                        category: 'Sem Conversão',
                        date: 'N/A',
                        hour: 'N/A',
                        product: 'N/A',
                        productName: 'N/A',
                        isDirect: false
                    },
                    metrics: {
                        orders: 0,
                        revenue: 0,
                        commission: 0,
                        clicks: traffic.clicks,
                        adClicks: traffic.adClicks,
                        investment: traffic.investment
                    }
                });
            }
        });

        // === STEP C: Generic Aggregator (Dimension Picker) ===
        const groupBy = (key: keyof UnifiedDimension) => {
            const map: Record<string, UnifiedMetrics> = {};
            masterRegistry.forEach(entry => {
                const val = String(entry.dimension[key]);
                if (!map[val]) map[val] = { orders: 0, revenue: 0, commission: 0, clicks: 0, adClicks: 0, investment: 0 };
                map[val].orders += entry.metrics.orders;
                map[val].revenue += entry.metrics.revenue;
                map[val].commission += entry.metrics.commission;
                map[val].clicks += entry.metrics.clicks;
                map[val].adClicks += entry.metrics.adClicks;
                map[val].investment += entry.metrics.investment;
            });
            return map;
        };

        // === STEP D: Report Projections ===
        const funnelBySubIdMap = groupBy('subId');
        const funnelByChannelMap = groupBy('channel');
        const funnelByCategoryMap = groupBy('category');
        const funnelByHourMap = groupBy('hour');

        const epc = totalClicks > 0 ? totalNetCommission / totalClicks : 0;
        const cpc = totalAdClicks > 0 ? totalInvestment / totalAdClicks : 0;
        const roas = totalInvestment > 0 ? totalNetCommission / totalInvestment : 0;
        const cpa = totalOrders > 0 ? totalInvestment / totalOrders : 0;

        const funnelBySubId = Object.entries(funnelBySubIdMap)
            .map(([subId, m]) => ({
                subId,
                adClicks: Math.round(m.adClicks),
                clicks: Math.round(m.clicks),
                orders: m.orders,
                investment: m.investment,
                conversion: m.clicks > 0 ? (m.orders / m.clicks * 100).toFixed(2).replace('.', ',') : '0,00',
                revenue: m.revenue,
                commission: m.commission,
                epc: m.clicks > 0 ? m.commission / m.clicks : 0,
                cpc: m.adClicks > 0 ? m.investment / m.adClicks : 0,
                channelNames: Array.from(subIdStats[subId]?.channels || []).join(', ') || '—'
            }))
            .sort((a, b) => b.commission - a.commission);

        const funnelByChannel = Object.entries(funnelByChannelMap)
            .map(([channel, m]) => ({
                channel,
                clicks: Math.round(m.clicks),
                adClicks: Math.round(m.adClicks),
                orders: m.orders,
                investment: m.investment,
                conversion: m.clicks > 0 ? (m.orders / m.clicks * 100).toFixed(2).replace('.', ',') : '0,00',
                revenue: m.revenue,
                commission: m.commission,
                epc: m.clicks > 0 ? m.commission / m.clicks : 0,
                roas: m.investment > 0 ? m.commission / m.investment : 0,
            }))
            .sort((a, b) => b.commission - a.commission);

        const funnelByCategory = Object.entries(funnelByCategoryMap)
            .map(([category, m]) => ({
                category,
                adClicks: Math.round(m.adClicks),
                clicks: Math.round(m.clicks),
                orders: m.orders,
                revenue: m.revenue,
                commission: m.commission,
                investment: m.investment,
                conversion: m.clicks > 0 ? (m.orders / m.clicks * 100).toFixed(2).replace('.', ',') : '0,00',
                epc: m.clicks > 0 ? m.commission / m.clicks : 0,
            }))
            .sort((a, b) => b.commission - a.commission);

        // funnelByProduct aggregation
        const funnelByProductMap: Record<string, any> = {};
        masterRegistry.forEach(item => {
            const key = item.dimension.productName || 'Produto Desconhecido';
            if (!funnelByProductMap[key]) {
                funnelByProductMap[key] = { orders: 0, revenue: 0, commission: 0, clicks: 0, adClicks: 0, investment: 0 };
            }
            funnelByProductMap[key].orders += item.metrics.orders;
            funnelByProductMap[key].revenue += item.metrics.revenue;
            funnelByProductMap[key].commission += item.metrics.commission;
            funnelByProductMap[key].clicks += item.metrics.clicks;
            funnelByProductMap[key].adClicks += item.metrics.adClicks;
            funnelByProductMap[key].investment += item.metrics.investment;
        });

        const funnelByProduct = Object.entries(funnelByProductMap).map(([name, m]) => ({
            name,
            orders: m.orders,
            commission: m.commission,
            clicks: Math.round(m.clicks),
            adClicks: Math.round(m.adClicks),
            investment: m.investment,
            revenue: m.revenue,
            conversion: m.clicks > 0 ? (m.orders / m.clicks * 100).toFixed(2).replace('.', ',') : '0,00',
            roas: m.investment > 0 ? (m.commission / m.investment).toFixed(2).replace('.', ',') : '0,00'
        })).sort((a, b) => b.commission - a.commission);

        // funnelByDirectVsIndirect aggregation
        const funnelByDirectVsIndirectMap: Record<string, any> = {
            'Direta': { orders: 0, revenue: 0, commission: 0, clicks: 0, adClicks: 0, investment: 0 },
            'Indireta': { orders: 0, revenue: 0, commission: 0, clicks: 0, adClicks: 0, investment: 0 }
        };

        masterRegistry.forEach(item => {
            const typeKey = item.dimension.isDirect ? 'Direta' : 'Indireta';
            funnelByDirectVsIndirectMap[typeKey].orders += item.metrics.orders;
            funnelByDirectVsIndirectMap[typeKey].revenue += item.metrics.revenue;
            funnelByDirectVsIndirectMap[typeKey].commission += item.metrics.commission;
            funnelByDirectVsIndirectMap[typeKey].clicks += item.metrics.clicks;
            funnelByDirectVsIndirectMap[typeKey].adClicks += item.metrics.adClicks;
            funnelByDirectVsIndirectMap[typeKey].investment += item.metrics.investment;
        });

        const funnelByDirectVsIndirect = Object.entries(funnelByDirectVsIndirectMap).map(([type, m]) => ({
            type,
            orders: m.orders,
            commission: m.commission,
            clicks: Math.round(m.clicks),
            adClicks: Math.round(m.adClicks),
            investment: m.investment,
            revenue: m.revenue,
            conversion: m.clicks > 0 ? (m.orders / m.clicks * 100).toFixed(2).replace('.', ',') : '0,00',
            roas: m.investment > 0 ? (m.commission / m.investment).toFixed(2).replace('.', ',') : '0,00'
        }));

        const funnelByHour = Array.from({ length: 24 }, (_, i) => {
            const h = i.toString().padStart(2, '0');
            const m = funnelByHourMap[h] || { orders: 0, revenue: 0, commission: 0, clicks: 0, adClicks: 0, investment: 0 };
            return {
                hour: `${h}:00`,
                orders: m.orders,
                commission: m.commission,
                clicks: Math.round(m.clicks),
                adClicks: Math.round(m.adClicks),
                investment: m.investment,
                revenue: m.revenue,
                conversion: m.clicks > 0 ? (m.orders / m.clicks * 100).toFixed(2).replace('.', ',') : '0,00',
            };
        });

        const uniqueDates = new Set([
            ...filteredClicks.map(c => {
                const d = parseShopeeDate(c['Tempo dos Cliques']);
                return d ? format(d, 'yyyy-MM-dd') : null;
            }).filter(Boolean),
            ...unifiedCommission.map(c => {
                const d = parseShopeeDate(c['Horário do pedido']);
                return d ? format(d, 'yyyy-MM-dd') : null;
            }).filter(Boolean)
        ]);
        const avgOrdersPerDay = uniqueDates.size > 0 ? totalOrders / uniqueDates.size : 0;
        const profitPct = totalInvestment > 0 ? ((totalNetCommission - totalInvestment) / totalInvestment) * 100 : 0;

        return {
            isEmpty: commissionData.length === 0 && clickData.length === 0 && dbConversions.length === 0 && dbTracks.length === 0,
            totalOrders, totalNetCommission, totalOrderValue, totalClicks, totalAdClicks, totalInvestment,
            epc, cpc, roas, cpa,
            totalProfit: totalNetCommission - totalInvestment,
            avgOrdersPerDay,
            profitPct,
            funnelBySubId,
            funnelByChannel,
            funnelByCategory,
            funnelByHour,
            funnelByProduct,
            funnelByDirectVsIndirect,
            dailyChart: Object.entries(dailyOrders).map(([date, count]) => ({ date, count })),
            allOrders, productRanking, allProducts, categoriesRanking, channelsRanking,
            totalSalesCount,
            conversionRate: totalClicks > 0 ? Number((totalSalesCount / totalClicks * 100).toFixed(2)) : 0,
            adClickToShopeeRate: totalAdClicks > 0 ? Number((totalClicks / totalAdClicks * 100).toFixed(2)) : 0,
            directsVsIndirects: [
                { name: 'Diretas', value: directsCount, fill: '#f2a20d' },
                { name: 'Indiretas', value: indirectsCount, fill: '#3b82f6' }
            ],
            funnelStats: {
                completed: completedCount,
                pending: pendingCount,
                cancelled: cancelledCount,
                completedValue,
                pendingValue,
                cancelledValue
            },
            buyerStats: { new: newBuyersCount, existing: existingBuyersCount },
            commissionSource: { shopee: shopeeCommissionTotal, seller: sellerCommissionTotal },
            subIdRanking: Object.entries(subIdStats).map(([name, s]) => ({
                subId: name,
                clicks: s.clicks,
                orders: s.orders,
                conversion: s.clicks > 0 ? ((s.orders / s.clicks) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00',
                commission: s.commission,
                channelNames: Array.from(s.channels).join(', ') || '—'
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
