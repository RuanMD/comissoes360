import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * All available feature keys in the system.
 * Each key maps to a sidebar item and route.
 */
export const ALL_FEATURE_KEYS = [
    'dashboard',
    'relatorio',
    'funil_builder',
    'sub_id',
    'canais',
    'produtos',
    'temporal',
    'diretas_indiretas',
    'criativo_track',
    'status_management',
    'gerador_links',
    'legendas',
] as const;

export type FeatureKey = (typeof ALL_FEATURE_KEYS)[number];

/**
 * Maps route paths to feature keys for route protection.
 */
export const ROUTE_TO_FEATURE: Record<string, FeatureKey> = {
    '/dashboard': 'dashboard',
    '/relatorio': 'relatorio',
    '/funil': 'funil_builder',
    '/sub-id': 'sub_id',
    '/canais': 'canais',
    '/produtos': 'produtos',
    '/temporal': 'temporal',
    '/diretas-vs-indiretas': 'diretas_indiretas',
    '/criativo-track': 'criativo_track',
    '/status': 'status_management',
    '/gerador-links': 'gerador_links',
    '/legendas': 'legendas',
};

/**
 * Human-readable labels for each feature key.
 */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
    dashboard: 'Dashboard',
    relatorio: 'Relatório',
    funil_builder: 'Funil',
    sub_id: 'Origens (Sub_ID)',
    canais: 'Canais',
    produtos: 'Produtos',
    temporal: 'Temporal',
    diretas_indiretas: 'Diretas x Indiretas',
    criativo_track: 'Criativo Track',
    status_management: 'Gestão de Status',
    gerador_links: 'Gerador de Links',
    legendas: 'Legendas',
};

interface UseFeatureAccessReturn {
    /** Check if user has access to a feature */
    hasAccess: (key: FeatureKey) => boolean;
    /** All features the user has access to */
    accessibleFeatures: FeatureKey[];
    /** Loading state */
    loading: boolean;
    /** Refresh access data */
    refresh: () => void;
}

/**
 * Hook that determines which features the current user can access.
 *
 * Logic: Admin → all features. Otherwise, merge plan's feature_keys
 * with user's feature_overrides (overrides take precedence).
 */
export function useFeatureAccess(): UseFeatureAccessReturn {
    const { user, isAdmin } = useAuth();
    const [planFeatures, setPlanFeatures] = useState<string[]>([]);
    const [overrides, setOverrides] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const fetchAccess = useCallback(async () => {
        if (!user) {
            setPlanFeatures([]);
            setOverrides({});
            setLoading(false);
            return;
        }

        try {
            // Fetch user's plan_id and feature_overrides
            const { data: userData } = await supabase
                .from('users')
                .select('plan_id, feature_overrides')
                .eq('id', user.id)
                .single();

            const userOverrides = (userData?.feature_overrides as Record<string, boolean>) || {};
            setOverrides(userOverrides);

            // Fetch plan's feature_keys if user has a plan
            if (userData?.plan_id) {
                const { data: planData } = await supabase
                    .from('plans')
                    .select('feature_keys')
                    .eq('id', userData.plan_id)
                    .single();
                setPlanFeatures(planData?.feature_keys || []);
            } else {
                setPlanFeatures([]);
            }
        } catch (error) {
            console.error('Error fetching feature access:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAccess();
    }, [fetchAccess]);

    const hasAccess = useCallback((key: FeatureKey): boolean => {
        // Admin always has full access
        if (isAdmin) return true;

        // Check override first (takes precedence)
        if (key in overrides) return overrides[key];

        // Check plan features
        return planFeatures.includes(key);
    }, [isAdmin, overrides, planFeatures]);

    const accessibleFeatures = ALL_FEATURE_KEYS.filter(key => hasAccess(key));

    return { hasAccess, accessibleFeatures, loading, refresh: fetchAccess };
}
