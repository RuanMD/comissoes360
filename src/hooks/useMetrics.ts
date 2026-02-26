import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { isWithinInterval, startOfDay, endOfDay, subDays, format } from 'date-fns';


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

    // 1. Filter Data by Date
    const filteredCommission = useMemo(() => {
        if (!commissionData.length) return [];
        if (dateFilter === 'all') return commissionData;

        const now = new Date();
        let start: Date = new Date(0); // Fallback to avoid undefined crashes
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case '2days':
                start = startOfDay(subDays(now, 2));
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
                return commissionData;
        }

        return commissionData.filter(item => {
            const dateStr = item['Horário do pedido'];
            const dateObj = parseShopeeDate(dateStr);
            if (!dateObj) return true; // keep if no date
            return isWithinInterval(dateObj, { start, end });
        });
    }, [commissionData, dateFilter, customRange]);

    const filteredClicks = useMemo(() => {
        if (!clickData.length) return [];
        if (dateFilter === 'all') return clickData;

        const now = new Date();
        let start: Date = new Date(0); // Fallback to avoid undefined crashes
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case '2days':
                start = startOfDay(subDays(now, 2));
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

    // 2. Correlate Data
    const metrics = useMemo(() => {
        let totalNetCommission = 0;
        let totalOrderValue = 0;
        let totalOrders = filteredCommission.length;
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

        // Structure for cross-referencing Sub IDs
        const subIdStats: Record<string, { clicks: number, orders: number, commission: number, channels: Set<string> }> = {};
        const subIdDetails: Record<string, {
            products: Record<string, { count: number, commission: number }>,
            channelBreakdown: Record<string, { clicks: number, orders: number, commission: number }>,
            orders: Array<{ orderId: string, product: string, commission: number, status: string, date: string }>
        }> = {};
        const channelStats: Record<string, { clicks: number, orders: number, commission: number }> = {};

        // Aggregate Clicks by Sub_ID
        const clickSubIds = new Set<string>();

        filteredClicks.forEach(click => {
            const rawSubId = click['Sub_id'] || '';
            const canonical = rawSubId.split('-').filter(Boolean).join('-') || 'Sem Sub_id';
            clickSubIds.add(canonical);

            const ref = click['Referenciador'] || 'Desconhecido';

            if (!subIdStats[canonical]) {
                subIdStats[canonical] = { clicks: 0, orders: 0, commission: 0, channels: new Set() };
            }
            subIdStats[canonical].clicks += 1;

            if (ref) subIdStats[canonical].channels.add(ref);

            // Channel breakdown per Sub ID (click count per channel)
            if (!subIdDetails[canonical]) {
                subIdDetails[canonical] = { products: {}, channelBreakdown: {}, orders: [] };
            }
            if (!subIdDetails[canonical].channelBreakdown[ref]) {
                subIdDetails[canonical].channelBreakdown[ref] = { clicks: 0, orders: 0, commission: 0 };
            }
            subIdDetails[canonical].channelBreakdown[ref].clicks += 1;

            if (!channelStats[ref]) {
                channelStats[ref] = { clicks: 0, orders: 0, commission: 0 };
            }
            channelStats[ref].clicks += 1;
        });

        // Aggregate Commissions by Sub_ID and other general metrics
        filteredCommission.forEach(item => {
            const netComm = parseFloat(item['Comissão líquida do afiliado(R$)']?.toString().replace(',', '.') || '0');
            const orderVal = parseFloat(item['Valor de Compra(R$)']?.toString().replace(',', '.') || '0');
            totalNetCommission += netComm;
            totalOrderValue += orderVal;

            // Types and Statuses
            const attribution = item['Tipo de atribuição'] || '';
            if (attribution.toLowerCase().includes('mesma loja')) {
                directsCount++;
            } else if (attribution.toLowerCase().includes('diferente')) {
                indirectsCount++;
            }

            const status = item['Status do Pedido'] || '';
            if (status.toLowerCase() === 'cancelado') cancelledCount++;
            if (status.toLowerCase() === 'pendente') pendingCount++;
            if (status.toLowerCase() === 'concluído') completedCount++;

            // Buyer Type
            const buyerType = item['Status do Comprador'] || '';
            if (buyerType.toLowerCase() === 'novo') newBuyersCount++;
            else if (buyerType.toLowerCase() === 'existente') existingBuyersCount++;

            // Commission Source
            const shopeeComm = parseFloat(item['Comissão Shopee(R$)']?.toString().replace(',', '.') || '0');
            const sellerComm = parseFloat(item['Comissão do vendedor(R$)']?.toString().replace(',', '.') || '0');
            shopeeCommissionTotal += shopeeComm;
            sellerCommissionTotal += sellerComm;

            // Group by Sub_ID to cross reference
            const parts = [
                item['Sub_id1'],
                item['Sub_id2'],
                item['Sub_id3'],
                item['Sub_id4'],
                item['Sub_id5']
            ].filter(Boolean);
            let canonical = parts.join('-') || 'Sem Sub_id';

            // Smart Linkage: If we don't have an exact click, see if any click Sub_ID contains this logic.
            // Example: click has "TOALHA-INTERESSES01", commission has "INTERESSES01"
            if (canonical !== 'Sem Sub_id' && !clickSubIds.has(canonical)) {
                const possibleMatch = Array.from(clickSubIds).find(c => c.includes(canonical) || canonical.includes(c));
                if (possibleMatch) {
                    canonical = possibleMatch;
                }
            }

            if (!subIdStats[canonical]) {
                subIdStats[canonical] = { clicks: 0, orders: 0, commission: 0, channels: new Set() };
            }
            subIdStats[canonical].orders += 1;
            subIdStats[canonical].commission += netComm;

            // Sub ID details: products and orders
            if (!subIdDetails[canonical]) {
                subIdDetails[canonical] = { products: {}, channelBreakdown: {}, orders: [] };
            }
            const detailProductName = item['Nome do Item'] || 'Item Desconhecido';
            if (!subIdDetails[canonical].products[detailProductName]) {
                subIdDetails[canonical].products[detailProductName] = { count: 0, commission: 0 };
            }
            subIdDetails[canonical].products[detailProductName].count += 1;
            subIdDetails[canonical].products[detailProductName].commission += netComm;

            subIdDetails[canonical].orders.push({
                orderId: item['ID do pedido'] || '—',
                product: detailProductName,
                commission: netComm,
                status: item['Status do Pedido'] || '—',
                date: item['Horário do pedido'] || '—',
            });

            // Products and Categories
            const productName = item['Nome do Item'] || 'Item Desconhecido';
            if (!productCounts[productName]) productCounts[productName] = { count: 0, commission: 0 };
            productCounts[productName].count += 1;
            productCounts[productName].commission += netComm;

            const categoryName = item['Categoria Global L1'] || 'Sem Categoria';
            if (!categoryStats[categoryName]) categoryStats[categoryName] = { count: 0, commission: 0 };
            categoryStats[categoryName].count += 1;
            categoryStats[categoryName].commission += netComm;

            // Channel attribution (heuristic: use the first available channel for this subId)
            let assignedChannel = 'Desconhecido';
            if (subIdStats[canonical] && subIdStats[canonical].channels.size > 0) {
                assignedChannel = Array.from(subIdStats[canonical].channels)[0];
                if (!channelStats[assignedChannel]) {
                    channelStats[assignedChannel] = { clicks: 0, orders: 0, commission: 0 };
                }
                channelStats[assignedChannel].orders += 1;
                channelStats[assignedChannel].commission += netComm;
            } else {
                if (!channelStats['Desconhecido']) channelStats['Desconhecido'] = { clicks: 0, orders: 0, commission: 0 };
                channelStats['Desconhecido'].orders += 1;
                channelStats['Desconhecido'].commission += netComm;
            }

            // Also add orders and commission to subIdDetails channelBreakdown
            if (!subIdDetails[canonical].channelBreakdown[assignedChannel]) {
                subIdDetails[canonical].channelBreakdown[assignedChannel] = { clicks: 0, orders: 0, commission: 0 };
            }
            subIdDetails[canonical].channelBreakdown[assignedChannel].orders += 1;
            subIdDetails[canonical].channelBreakdown[assignedChannel].commission += netComm;

            // Daily chart logic
            const dateObj = parseShopeeDate(item['Horário do pedido']);
            if (dateObj) {
                const dayStr = format(dateObj, 'dd/MM');
                dailyOrders[dayStr] = (dailyOrders[dayStr] || 0) + 1;
            }

            // Time to Buy (Difference between Clique and Horário do pedido)
            const clickTimeStr = item['Tempo dos Cliques'];
            const orderTimeStr = item['Horário do pedido'];
            if (clickTimeStr && orderTimeStr) {
                const clickDate = parseShopeeDate(clickTimeStr);
                const orderDate = parseShopeeDate(orderTimeStr);
                if (clickDate && orderDate) {
                    const diffMs = orderDate.getTime() - clickDate.getTime();
                    if (diffMs >= 0) {
                        const diffMins = Math.floor(diffMs / (1000 * 60));
                        timeToBuyMinutes.push(diffMins);
                    }
                }
            }
        });

        const allProducts = Object.entries(productCounts)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.commission - a.commission);

        const productRanking = allProducts.slice(0, 5);

        const categoriesRanking = Object.entries(categoryStats)
            .map(([name, stats]) => ({ category: name, ...stats }))
            .sort((a, b) => b.commission - a.commission);

        const avgTimeToBuyMins = timeToBuyMinutes.length > 0
            ? timeToBuyMinutes.reduce((a, b) => a + b, 0) / timeToBuyMinutes.length
            : 0;

        const channelsRanking = Object.entries(channelStats)
            .map(([name, stats]) => ({ channel: name, ...stats }))
            .sort((a, b) => b.commission - a.commission);

        const subIdRanking = Object.entries(subIdStats)
            .map(([name, stats]) => ({
                subId: name,
                clicks: stats.clicks,
                orders: stats.orders,
                conversion: stats.clicks > 0 ? ((stats.orders / stats.clicks) * 100).toFixed(2) : '0.00',
                commission: stats.commission,
                channels: Array.from(stats.channels).join(', ') || 'N/A'
            }))
            .sort((a, b) => b.commission - a.commission);

        return {
            isEmpty: commissionData.length === 0 && clickData.length === 0,
            totalOrders,
            totalNetCommission,
            totalOrderValue,
            totalClicks,
            dailyChart: Object.entries(dailyOrders).map(([date, count]) => ({ date, count })),
            productRanking,
            allProducts,
            categoriesRanking,
            avgTimeToBuyMins,
            channelsRanking,
            subIdRanking,
            subIdDetails: Object.fromEntries(
                Object.entries(subIdDetails).map(([subId, detail]) => [
                    subId,
                    {
                        products: Object.entries(detail.products)
                            .map(([name, stats]) => ({ name, count: stats.count, commission: stats.commission }))
                            .sort((a, b) => b.commission - a.commission),
                        channelBreakdown: Object.entries(detail.channelBreakdown)
                            .map(([channel, stats]) => ({ channel, clicks: stats.clicks, orders: stats.orders, commission: stats.commission }))
                            .sort((a, b) => b.clicks - a.clicks),
                        orders: detail.orders.sort((a, b) => b.commission - a.commission),
                    }
                ])
            ) as Record<string, {
                products: Array<{ name: string, count: number, commission: number }>,
                channelBreakdown: Array<{ channel: string, clicks: number, orders: number, commission: number }>,
                orders: Array<{ orderId: string, product: string, commission: number, status: string, date: string }>
            }>,
            conversionRate: totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : '0.00',
            directsVsIndirects: [
                { name: 'Diretas', value: directsCount, fill: '#f2a20d' },
                { name: 'Indiretas', value: indirectsCount, fill: '#3b82f6' }
            ],
            funnelStats: {
                completed: completedCount,
                pending: pendingCount,
                cancelled: cancelledCount
            },
            buyerStats: {
                new: newBuyersCount,
                existing: existingBuyersCount
            },
            commissionSource: {
                shopee: shopeeCommissionTotal,
                seller: sellerCommissionTotal
            }
        };

    }, [filteredCommission, filteredClicks]);

    return metrics;
}
