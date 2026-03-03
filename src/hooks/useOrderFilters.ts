import { useState, useMemo } from 'react';

export type FilterOperator = 'eq' | 'gt' | 'lt';

export interface AdvancedFilters {
    quantity: { operator: FilterOperator; value: number | null };
    channel: string[];
    subId: string;
    status: string[];
    type: string;
    commission: { operator: FilterOperator; value: number | null };
}

const initialFilters: AdvancedFilters = {
    quantity: { operator: 'eq', value: null },
    channel: [],
    subId: '',
    status: [],
    type: '',
    commission: { operator: 'gt', value: null },
};

export function useOrderFilters(allOrders: any[]) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<AdvancedFilters>(initialFilters);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const filteredOrders = useMemo(() => {
        return allOrders.filter((order) => {
            // 1. Text Search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchProduct = order.productName.toLowerCase().includes(query);
                const matchSubId = (order.subId || '').toLowerCase().includes(query);
                const matchOrderId = (order.id || '').toLowerCase().includes(query);
                const matchChannel = (order.channel || '').toLowerCase().includes(query);

                if (!matchProduct && !matchSubId && !matchOrderId && !matchChannel) {
                    return false;
                }
            }

            // 2. Advanced Filters
            if (filters.channel.length > 0 && !filters.channel.includes(order.channel)) return false;

            // For SubId exact match in advanced filters (optional, usually text search is enough but good to have)
            if (filters.subId && order.subId !== filters.subId) return false;

            // Status grouping/multi-match
            if (filters.status.length > 0) {
                const normalizedStatus = (order.status || '').toUpperCase();

                const matchesAnySelected = filters.status.some(filterValue => {
                    const filterStatus = filterValue.toUpperCase();

                    if (filterStatus === 'CONCLUÍDO') {
                        return ['PAID', 'VALIDATED', 'COMPLETED', 'CONCLUÍDO'].includes(normalizedStatus);
                    } else if (filterStatus === 'CANCELADO') {
                        return ['CANCELLED', 'INVALID', 'FAILED', 'UNPAID', 'CANCELADO'].includes(normalizedStatus);
                    } else if (filterStatus === 'PENDENTE') {
                        return !['PAID', 'VALIDATED', 'COMPLETED', 'CONCLUÍDO', 'CANCELLED', 'INVALID', 'FAILED', 'UNPAID', 'CANCELADO'].includes(normalizedStatus);
                    }
                    return normalizedStatus === filterStatus;
                });

                if (!matchesAnySelected) return false;
            }

            if (filters.type) {
                const isDireta = ['DIRECT', 'direct', 'Direta'].includes(order.type);
                if (filters.type === 'Direta' && !isDireta) return false;
                if (filters.type === 'Indireta' && isDireta) return false;
            }

            if (filters.quantity.value !== null) {
                const v = filters.quantity.value;
                const o = filters.quantity.operator;
                if (o === 'eq' && order.qty !== v) return false;
                if (o === 'gt' && order.qty < v) return false; // Use < because we want to include >= or perhaps >. Usually 'Maior que' means strictly greater. We'll use strict for 'gt', 'lt'
                if (o === 'gt' && order.qty <= v) return false;
                if (o === 'lt' && order.qty >= v) return false;
            }

            if (filters.commission.value !== null) {
                const v = filters.commission.value;
                const o = filters.commission.operator;
                if (o === 'eq' && order.commission !== v) return false;
                if (o === 'gt' && order.commission <= v) return false;
                if (o === 'lt' && order.commission >= v) return false;
            }

            return true;
        });
    }, [allOrders, searchQuery, filters]);

    const handleFilterChange = (key: keyof AdvancedFilters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setSearchQuery('');
        setFilters(initialFilters);
    };

    // Extract unique values for dropdowns
    const uniqueChannels = useMemo(() => Array.from(new Set(allOrders.map(o => o.channel).filter(Boolean))), [allOrders]);

    // Calculate aggregate metrics based on filtered results
    const filteredMetrics = useMemo(() => {
        const uniqueProducts = new Set(filteredOrders.map(o => o.productName));
        const totalUnits = filteredOrders.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
        const totalCommission = filteredOrders.reduce((sum, o) => sum + (Number(o.commission) || 0), 0);

        const statusCounts = {
            completed: 0,
            pending: 0,
            cancelled: 0
        };

        filteredOrders.forEach(order => {
            const s = (order.status || '').toUpperCase();
            if (['PAID', 'VALIDATED', 'COMPLETED', 'CONCLUÍDO'].includes(s)) {
                statusCounts.completed++;
            } else if (['CANCELLED', 'INVALID', 'FAILED', 'UNPAID', 'CANCELADO'].includes(s)) {
                statusCounts.cancelled++;
            } else {
                statusCounts.pending++;
            }
        });

        return {
            uniqueProductsCount: uniqueProducts.size,
            totalUnits,
            totalCommission,
            statusCounts
        };
    }, [filteredOrders]);

    return {
        searchQuery,
        setSearchQuery,
        filters,
        handleFilterChange,
        showAdvanced,
        setShowAdvanced,
        filteredOrders,
        clearFilters,
        uniqueChannels,
        filteredMetrics
    };
}
