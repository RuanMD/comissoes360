import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { ProfileModal } from './ProfileModal';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { useMetrics } from '../../hooks/useMetrics';
import { OfflineBanner } from './OfflineBanner';
import { MobileNav } from './MobileNav';
import { MobileMenu } from './MobileMenu';
import { NAV_ITEMS, DEFAULT_NAV_ORDER, loadNavOrderFromStorage, loadNavLabelsFromStorage } from '../../config/navItems';
import type { FeatureKey } from '../../hooks/useFeatureAccess';
import { supabase } from '../../lib/supabase';

interface AppLayoutProps {
    children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const { handleFileUpload } = useData();
    const { user, signOut, isAdmin } = useAuth();
    const location = useLocation();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { hasAccess } = useFeatureAccess();
    const metrics = useMetrics();
    const [navOrder, setNavOrder] = useState<FeatureKey[]>(() => loadNavOrderFromStorage() ?? DEFAULT_NAV_ORDER);
    const [navLabels, setNavLabels] = useState<Record<string, string>>(() => loadNavLabelsFromStorage() ?? {});

    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
            const prefs = data?.user_preferences as { nav_order?: FeatureKey[], nav_labels?: Record<string, string> } | null;
            if (prefs?.nav_order?.length) {
                setNavOrder(prefs.nav_order);
            }
            if (prefs?.nav_labels) {
                setNavLabels(prefs.nav_labels);
            }
        })();
    }, [user]);

    // Listen for nav order/labels changes from admin panel
    useEffect(() => {
        const orderHandler = (e: Event) => {
            const order = (e as CustomEvent<FeatureKey[]>).detail;
            setNavOrder(order);
        };
        const labelsHandler = (e: Event) => {
            const labels = (e as CustomEvent<Record<string, string>>).detail;
            setNavLabels(labels);
        };
        window.addEventListener('nav-order-changed', orderHandler);
        window.addEventListener('nav-labels-changed', labelsHandler);
        return () => {
            window.removeEventListener('nav-order-changed', orderHandler);
            window.removeEventListener('nav-labels-changed', labelsHandler);
        };
    }, []);

    const visibleNavItems = NAV_ITEMS
        .filter(item => hasAccess(item.featureKey))
        .sort((a, b) => {
            const ai = navOrder.indexOf(a.featureKey);
            const bi = navOrder.indexOf(b.featureKey);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

    const isCurrent = (path: string) => location.pathname === path;
    const userMetaName = user?.user_metadata?.full_name;

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark text-white font-sans antialiased text-base">
            {/* Sidebar Desktop */}
            <div className="hidden md:flex flex-col w-72 bg-surface-dark border-r border-border-dark h-full justify-between p-4">
                <div className="flex flex-col gap-6">
                    {/* User Profile Mock & Logout */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-highlight/50 border border-border-dark group cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setIsProfileModalOpen(true)}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold group-hover:bg-primary/30 transition-colors">
                                {userMetaName ? userMetaName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'C')}
                            </div>
                            <div className="flex flex-col overflow-hidden max-w-[120px]">
                                <h1 className="text-white text-sm font-bold leading-tight truncate group-hover:text-primary transition-colors">
                                    {userMetaName || (user?.email ? user.email.split('@')[0] : 'Comissões Lab')}
                                </h1>
                                <p className="text-text-secondary text-xs font-normal leading-normal truncate">Dashboard 2.0</p>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                signOut();
                            }}
                            className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Sair"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-2">
                        {visibleNavItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive
                                        ? 'bg-primary text-background-dark shadow-lg shadow-primary/20 hover:shadow-primary/40'
                                        : 'text-text-secondary hover:bg-surface-highlight hover:text-white'
                                    }`
                                }
                            >
                                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isCurrent(item.path) ? 'text-background-dark' : ''}`} />
                                <span className={`text-sm ${isCurrent(item.path) ? 'font-bold' : 'font-medium'}`}>
                                    {navLabels[item.featureKey] || item.label}
                                </span>
                            </NavLink>
                        ))}

                        {isAdmin && (
                            <NavLink
                                to="/admin"
                                className={() => {
                                    const active = location.pathname.startsWith('/admin');
                                    return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all group mt-4 border border-dashed border-primary/30 ${active
                                        ? 'bg-primary/10 text-primary shadow-lg shadow-primary/5'
                                        : 'text-[#f2a20d] hover:bg-[#f2a20d]/10'
                                        }`;
                                }}
                            >
                                <Settings className="w-5 h-5 transition-transform group-hover:rotate-90" />
                                <span className={`text-sm ${location.pathname.startsWith('/admin') ? 'font-bold' : 'font-medium'}`}>
                                    Painel Admin
                                </span>
                            </NavLink>
                        )}
                    </nav>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
                <OfflineBanner isOffline={metrics.isOffline} lastSync={metrics.lastSync} />

                {/* Mobile Header */}
                <div className="md:hidden flex items-center justify-between p-3 border-b border-border-dark bg-surface-dark">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30"
                        >
                            {userMetaName ? userMetaName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'C')}
                        </button>
                        <div className="font-bold text-primary flex items-center gap-2">
                            <LayoutDashboard className="w-5 h-5" />
                            <span className="truncate max-w-[150px]">Comissões Lab</span>
                        </div>
                    </div>
                </div>

                {/* Page Content Scrollable Area */}
                <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 scroll-smooth w-full max-w-full pb-20 md:pb-8">
                    <div className="w-full max-w-7xl mx-auto min-w-0">
                        {children}
                    </div>
                </main>

                <MobileNav onOpenMore={() => setIsMobileMenuOpen(true)} />
                <MobileMenu
                    isOpen={isMobileMenuOpen}
                    onClose={() => setIsMobileMenuOpen(false)}
                    onFileUpload={handleFileUpload}
                    onRefresh={() => {
                        window.location.reload();
                    }}
                />
            </div>

            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </div>
    );
}
