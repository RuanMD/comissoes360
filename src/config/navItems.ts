import { LayoutDashboard, Filter, Database, TrendingUp, BarChart3, Moon, Package, Clapperboard, Target, Link } from 'lucide-react';
import type { FeatureKey } from '../hooks/useFeatureAccess';

export interface NavItem {
    path: string;
    icon: typeof LayoutDashboard;
    label: string;
    featureKey: FeatureKey;
}

export const NAV_ITEMS: NavItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', featureKey: 'dashboard' },
    { path: '/relatorio', icon: Filter, label: 'Relatório', featureKey: 'relatorio' },
    { path: '/funil', icon: Target, label: 'Funil', featureKey: 'funil_builder' },
    { path: '/sub-id', icon: Database, label: 'Origens (Sub_ID)', featureKey: 'sub_id' },
    { path: '/canais', icon: TrendingUp, label: 'Canais', featureKey: 'canais' },
    { path: '/produtos', icon: Package, label: 'Produtos', featureKey: 'produtos' },
    { path: '/temporal', icon: BarChart3, label: 'Temporal', featureKey: 'temporal' },
    { path: '/diretas-vs-indiretas', icon: Moon, label: 'Diretas x Indiretas', featureKey: 'diretas_indiretas' },
    { path: '/criativo-track', icon: Clapperboard, label: 'Criativo Track', featureKey: 'criativo_track' },
    { path: '/gerador-links', icon: Link, label: 'Gerador de Links', featureKey: 'gerador_links' },
];

export const DEFAULT_NAV_ORDER: FeatureKey[] = NAV_ITEMS.map(i => i.featureKey);

const NAV_ORDER_STORAGE_KEY = 'shopee_analisar_nav_order';

export function loadNavOrderFromStorage(): FeatureKey[] | null {
    try {
        const stored = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return null;
}

export function saveNavOrderToStorage(order: FeatureKey[]): void {
    localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(order));
}
