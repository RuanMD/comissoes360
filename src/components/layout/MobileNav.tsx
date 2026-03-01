import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Database,
    Clapperboard,
    Target,
    MoreHorizontal
} from 'lucide-react';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';

interface MobileNavProps {
    onOpenMore: () => void;
}

export function MobileNav({ onOpenMore }: MobileNavProps) {
    const { hasAccess } = useFeatureAccess();

    const mainItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Home', featureKey: 'dashboard' },
        { path: '/criativo-track', icon: Clapperboard, label: 'Tracks', featureKey: 'criativo_track' },
        { path: '/funil', icon: Target, label: 'Funil', featureKey: 'funil_builder' },
        { path: '/sub-id', icon: Database, label: 'Origens', featureKey: 'sub_id' },
    ];

    const visibleItems = mainItems.filter(item => hasAccess(item.featureKey as any));

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-dark/95 backdrop-blur-lg border-t border-border-dark flex items-center justify-around pt-3 pb-8 px-2 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
            {visibleItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1.5 transition-all relative ${isActive ? 'text-primary' : 'text-text-secondary hover:text-white'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                            <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                {item.label}
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
                className="flex flex-col items-center gap-1.5 text-text-secondary hover:text-white transition-all"
            >
                <MoreHorizontal className="w-6 h-6" />
                <span className="text-[10px] font-bold tracking-tight opacity-70">Mais</span>
            </button>
        </div>
    );
}
