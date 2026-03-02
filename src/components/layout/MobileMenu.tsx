import { NavLink } from 'react-router-dom';
import {
    X, LogOut, Settings, BarChart3, TrendingUp,
    Package, Moon, Link, Upload, RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { motion, AnimatePresence } from 'framer-motion';
import { loadNavLabelsFromStorage } from '../../config/navItems';
import { supabase } from '../../lib/supabase';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRefresh?: () => void;
}

export function MobileMenu({ isOpen, onClose, onFileUpload, onRefresh }: MobileMenuProps) {
    const { signOut, isAdmin, user } = useAuth();
    const { hasAccess } = useFeatureAccess();
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

    const otherItems = [
        { path: '/relatorio', icon: TrendingUp, label: 'Relatório', featureKey: 'relatorio' },
        { path: '/canais', icon: TrendingUp, label: 'Canais', featureKey: 'canais' },
        { path: '/produtos', icon: Package, label: 'Produtos', featureKey: 'produtos' },
        { path: '/temporal', icon: BarChart3, label: 'Temporal', featureKey: 'temporal' },
        { path: '/diretas-vs-indiretas', icon: Moon, label: 'Diretas x Indiretas', featureKey: 'diretas_indiretas' },
        { path: '/gerador-links', icon: Link, label: 'Gerador de Links', featureKey: 'gerador_links' },
    ];

    const visibleOthers = otherItems.filter(item => hasAccess(item.featureKey as any));

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-dark border-t border-border-dark rounded-t-3xl p-4 sm:p-6 z-[70] max-h-[85vh] overflow-y-auto"
                    >
                        <div className="w-12 h-1.5 bg-border-dark rounded-full mx-auto mb-4" />

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">Mais Opções</h2>
                            <button onClick={onClose} className="p-2 bg-surface-highlight rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:gap-3 mb-5">
                            <label className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-primary text-background-dark rounded-2xl active:scale-95 transition-all font-bold cursor-pointer w-full box-border text-sm sm:text-base">
                                <Upload className="w-5 h-5" />
                                <span>Importar Vendas (CSV)</span>
                                <input type="file" accept=".csv" onChange={(e) => { onFileUpload(e); onClose(); }} className="hidden" />
                            </label>

                            {onRefresh && (
                                <button
                                    onClick={() => { onRefresh(); onClose(); }}
                                    className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-surface-highlight border border-border-dark text-white rounded-2xl active:scale-95 transition-all font-bold w-full box-border text-sm sm:text-base mb-2"
                                >
                                    <RefreshCw className="w-5 h-5 text-primary" />
                                    <span>Forçar atualização das métricas</span>
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                                {visibleOthers.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-surface-highlight/40 border border-border-dark rounded-2xl active:scale-95 transition-all"
                                    >
                                        <item.icon className="w-5 h-5 text-primary" />
                                        <span className="text-sm font-semibold">{navLabels[item.featureKey] || item.label}</span>
                                    </NavLink>
                                ))}
                                {isAdmin && (
                                    <NavLink
                                        to="/admin"
                                        onClick={onClose}
                                        className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-primary/10 border border-primary/20 rounded-2xl active:scale-95 transition-all"
                                    >
                                        <Settings className="w-5 h-5 text-primary" />
                                        <span className="text-sm font-semibold text-primary">Admin</span>
                                    </NavLink>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-border-dark pt-4 flex flex-col gap-2 sm:gap-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                            <button
                                onClick={() => { onClose(); signOut(); }}
                                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 font-bold active:scale-95 transition-all w-full box-border text-sm sm:text-base"
                            >
                                <LogOut className="w-5 h-5" />
                                <span>Sair da Conta</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
