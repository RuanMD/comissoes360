import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Database,
    Clapperboard,
    Target,
    MoreHorizontal
} from 'lucide-react';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { useState, useEffect } from 'react';
import { loadNavLabelsFromStorage } from '../../config/navItems';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface MobileNavProps {
    onOpenMore: () => void;
}

export function MobileNav({ onOpenMore }: MobileNavProps) {
    const { hasAccess } = useFeatureAccess();
    const { user } = useAuth();
    const [navLabels, setNavLabels] = useState<Record<string, string>>(() => loadNavLabelsFromStorage() ?? {});

    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
            const prefs = data?.user_preferences as { nav_labels?: Record<string, string> } | null;
            if (prefs?.nav_labels) {
                setNavLabels(prefs.nav_labels);
            }
        })();
    }, [user]);

    // Listen for nav labels changes from admin panel
    useEffect(() => {
        const handler = (e: Event) => {
            const labels = (e as CustomEvent<Record<string, string>>).detail;
            setNavLabels(labels);
        };
        window.addEventListener('nav-labels-changed', handler);
        return () => window.removeEventListener('nav-labels-changed', handler);
    }, []);

    const mainItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Home', featureKey: 'dashboard' },
        { path: '/criativo-track', icon: Clapperboard, label: 'Tracks', featureKey: 'criativo_track' },
        { path: '/funil', icon: Target, label: 'Funil', featureKey: 'funil_builder' },
        { path: '/sub-id', icon: Database, label: 'Origens', featureKey: 'sub_id' },
    ];

    const visibleItems = mainItems.filter(item => hasAccess(item.featureKey as any));

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-dark/95 backdrop-blur-lg border-t border-border-dark flex items-center justify-around pt-2 px-1 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            {visibleItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-all relative ${isActive ? 'text-primary' : 'text-text-secondary hover:text-white'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <item.icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                            <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                {navLabels[item.featureKey] || item.label}
                            </span>
                            {isActive && (
                                <div className="absolute -top-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(242,162,13,0.8)]" />
                            )}
                        </>
                    )}
                </NavLink>
            ))}

            <button
                onClick={onOpenMore}
                className="flex flex-col items-center gap-1 text-text-secondary hover:text-white transition-all"
            >
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[10px] font-bold tracking-tight opacity-70">Mais</span>
            </button>
        </div>
    );
}
