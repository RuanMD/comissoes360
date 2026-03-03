import { useMemo } from 'react';
import { useMetrics } from './useMetrics';

export interface SalesSummary {
    directs: {
        count: number;
        value: number;
        percentage: number;
    };
    indirects: {
        count: number;
        value: number;
        percentage: number;
    };
    indirectValue: number;
    indirectPercentage: number;
    directValue: number;
    directPercentage: number;

    total: {
        count: number;
        value: number;
    };
    chartData: Array<{ name: string; value: number; fill: string }>;
}

export function useSalesSummary(): SalesSummary {
    const metrics = useMetrics();

    return useMemo(() => {
        const directs = metrics.directsVsIndirects.find(d => d.name === 'Diretas') || { value: 0 };
        const indirects = metrics.directsVsIndirects.find(d => d.name === 'Indiretas') || { value: 0 };

        // We need the values in currency from the raw orders because metrics.directsVsIndirects only contains counts
        let directsValue = 0;
        let indirectsValue = 0;

        metrics.allOrders.forEach(order => {
            if (order.type === 'Direta') {
                directsValue += order.commission;
            } else {
                indirectsValue += order.commission;
            }
        });

        const totalCount = (directs.value || 0) + (indirects.value || 0);
        const totalValue = directsValue + indirectsValue;

        return {
            directs: {
                count: directs.value || 0,
                value: directsValue,
                percentage: totalCount > 0 ? ((directs.value || 0) / totalCount) * 100 : 0
            },
            indirects: {
                count: indirects.value || 0,
                value: indirectsValue,
                percentage: totalCount > 0 ? ((indirects.value || 0) / totalCount) * 100 : 0
            },
            total: {
                count: totalCount,
                value: totalValue
            },
            indirectValue: indirectsValue,
            indirectPercentage: totalCount > 0 ? Number(((indirects.value || 0) / totalCount * 100).toFixed(1)) : 0,
            directValue: directsValue,
            directPercentage: totalCount > 0 ? Number(((directs.value || 0) / totalCount * 100).toFixed(1)) : 0,

            chartData: [
                { name: 'Diretas', value: directs.value || 0, fill: '#f2a20d' },
                { name: 'Indiretas', value: indirects.value || 0, fill: '#3b82f6' }
            ]
        };
    }, [metrics.directsVsIndirects, metrics.allOrders]);
}
