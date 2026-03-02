import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Users, CheckCircle, XCircle, UserPlus, CreditCard, GripVertical, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NAV_ITEMS, DEFAULT_NAV_ORDER, loadNavOrderFromStorage, saveNavOrderToStorage, loadNavLabelsFromStorage, saveNavLabelsToStorage } from '../../config/navItems';
import type { FeatureKey } from '../../hooks/useFeatureAccess';

interface Stats {
    totalUsers: number;
    activeUsers: number;
    expiredUsers: number;
    totalLeads: number;
    leadsThisMonth: number;
    activePlans: number;
}

interface RecentUser {
    email: string;
    subscription_status: string;
    created_at: string;
}

interface RecentLead {
    name: string | null;
    email: string;
    created_at: string;
    plans: { name: string }[] | { name: string } | null;
}

function getPlanName(plans: RecentLead['plans']): string {
    if (!plans) return 'Sem plano';
    if (Array.isArray(plans)) return plans[0]?.name || 'Sem plano';
    return plans.name || 'Sem plano';
}

const navItemMap = Object.fromEntries(NAV_ITEMS.map(item => [item.featureKey, item]));

function SortableNavItem({ id, label, onLabelChange }: { id: string, label: string, onLabelChange: (id: string, newLabel: string) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    const item = navItemMap[id];
    if (!item) return null;
    const Icon = item.icon;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-highlight/30 border border-border-dark select-none hover:border-primary/30 transition-colors group"
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-surface-highlight rounded">
                <GripVertical className="w-4 h-4 text-text-secondary/50 shrink-0" />
            </div>
            <Icon className="w-4 h-4 text-primary shrink-0" />
            <input
                type="text"
                value={label}
                onChange={(e) => onLabelChange(id, e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm text-white font-medium w-full p-0 h-auto"
                placeholder={item.label}
            />
        </div>
    );
}

export function AdminOverview() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, expiredUsers: 0, totalLeads: 0, leadsThisMonth: 0, activePlans: 0 });
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
    const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
    const [navOrder, setNavOrder] = useState<FeatureKey[]>(() => loadNavOrderFromStorage() ?? DEFAULT_NAV_ORDER);
    const [navLabels, setNavLabels] = useState<Record<string, string>>(() => loadNavLabelsFromStorage() ?? {});
    const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

    const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
    const dndSensors = useSensors(pointerSensor, touchSensor);

    useEffect(() => {
        fetchOverview();
    }, []);

    // Load nav order from Supabase on mount
    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
            const prefs = data?.user_preferences as { nav_order?: FeatureKey[], nav_labels?: Record<string, string> } | null;
            if (prefs?.nav_order?.length) {
                setNavOrder(prefs.nav_order);
                saveNavOrderToStorage(prefs.nav_order);
            }
            if (prefs?.nav_labels) {
                setNavLabels(prefs.nav_labels);
                saveNavLabelsToStorage(prefs.nav_labels);
                window.dispatchEvent(new CustomEvent('nav-labels-changed', { detail: prefs.nav_labels }));
            }
        })();
    }, [user]);

    const savePreferencesToSupabase = (order: FeatureKey[], labels: Record<string, string>) => {
        if (!user) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
            const currentPrefs = (data?.user_preferences as Record<string, unknown>) ?? {};
            await supabase.from('users').update({
                user_preferences: { ...currentPrefs, nav_order: order, nav_labels: labels },
            }).eq('id', user.id);
        }, 800);
    };

    const handleNavDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setNavOrder((items) => {
                const oldIndex = items.indexOf(active.id as FeatureKey);
                const newIndex = items.indexOf(over.id as FeatureKey);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                saveNavOrderToStorage(newOrder);
                savePreferencesToSupabase(newOrder, navLabels);
                window.dispatchEvent(new CustomEvent('nav-order-changed', { detail: newOrder }));
                return newOrder;
            });
        }
    };

    const handleLabelChange = (id: string, newLabel: string) => {
        const newLabels = { ...navLabels, [id]: newLabel };
        setNavLabels(newLabels);
        saveNavLabelsToStorage(newLabels);
        savePreferencesToSupabase(navOrder, newLabels);
        window.dispatchEvent(new CustomEvent('nav-labels-changed', { detail: newLabels }));
    };

    const handleResetPreferences = () => {
        setNavOrder(DEFAULT_NAV_ORDER);
        setNavLabels({});
        saveNavOrderToStorage(DEFAULT_NAV_ORDER);
        saveNavLabelsToStorage({});
        savePreferencesToSupabase(DEFAULT_NAV_ORDER, {});
        window.dispatchEvent(new CustomEvent('nav-order-changed', { detail: DEFAULT_NAV_ORDER }));
        window.dispatchEvent(new CustomEvent('nav-labels-changed', { detail: {} }));
    };

    const fetchOverview = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const [
                totalUsersRes,
                activeUsersRes,
                totalLeadsRes,
                leadsMonthRes,
                activePlansRes,
                recentUsersRes,
                recentLeadsRes,
            ] = await Promise.all([
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('users').select('*', { count: 'exact', head: true })
                    .eq('subscription_status', 'active')
                    .gte('subscription_expires_at', now.toISOString()),
                supabase.from('leads').select('*', { count: 'exact', head: true }),
                supabase.from('leads').select('*', { count: 'exact', head: true })
                    .gte('created_at', startOfMonth),
                supabase.from('plans').select('*', { count: 'exact', head: true })
                    .eq('is_active', true),
                supabase.from('users').select('email, subscription_status, created_at')
                    .order('created_at', { ascending: false }).limit(5),
                supabase.from('leads').select('name, email, created_at, plans(name)')
                    .order('created_at', { ascending: false }).limit(5),
            ]);

            const totalUsers = totalUsersRes.count ?? 0;
            const activeUsers = activeUsersRes.count ?? 0;

            setStats({
                totalUsers,
                activeUsers,
                expiredUsers: totalUsers - activeUsers,
                totalLeads: totalLeadsRes.count ?? 0,
                leadsThisMonth: leadsMonthRes.count ?? 0,
                activePlans: activePlansRes.count ?? 0,
            });

            if (recentUsersRes.data) setRecentUsers(recentUsersRes.data);
            if (recentLeadsRes.data) setRecentLeads(recentLeadsRes.data);
        } catch (error) {
            console.error('Erro ao carregar overview', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const statCards = [
        { label: 'Total Usuários', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Assinaturas Ativas', value: stats.activeUsers, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Assinaturas Expiradas', value: stats.expiredUsers, icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
        { label: 'Total de Leads', value: stats.totalLeads, icon: UserPlus, color: 'text-primary', bg: 'bg-primary/10', subtitle: `${stats.leadsThisMonth} este mês` },
        { label: 'Planos Ativos', value: stats.activePlans, icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    ];

    const isDefaultOrder = JSON.stringify(navOrder) === JSON.stringify(DEFAULT_NAV_ORDER);

    return (
        <div className="flex flex-col gap-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {statCards.map((card) => (
                    <div key={card.label} className="bg-surface-dark border border-border-dark rounded-2xl p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{card.label}</span>
                            <div className={`p-2 rounded-lg ${card.bg}`}>
                                <card.icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-white">{card.value}</span>
                        {card.subtitle && <span className="text-xs text-text-secondary">{card.subtitle}</span>}
                    </div>
                ))}
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Customizar Menu Lateral</h3>
                    {(!isDefaultOrder || Object.keys(navLabels).length > 0) && (
                        <button
                            onClick={handleResetPreferences}
                            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors px-3 py-1.5 rounded-lg border border-border-dark hover:border-primary/30"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar Padrão
                        </button>
                    )}
                </div>
                <p className="text-xs text-text-secondary mb-4">Reordene as abas e edite os nomes para personalizar sua navegação. Clique no nome para editar.</p>
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
                    <SortableContext items={navOrder} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-2">
                            {navOrder.map((key) => (
                                <SortableNavItem
                                    key={key}
                                    id={key}
                                    label={navLabels[key] ?? navItemMap[key]?.label ?? ''}
                                    onLabelChange={handleLabelChange}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Users */}
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Últimos Cadastros</h3>
                    {recentUsers.length === 0 ? (
                        <p className="text-sm text-text-secondary">Nenhum usuário cadastrado.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {recentUsers.map((user, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-border-dark last:border-0">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm text-white truncate">{user.email}</span>
                                        <span className="text-xs text-text-secondary">{formatDate(user.created_at)}</span>
                                    </div>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${user.subscription_status === 'active'
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                        }`}>
                                        {user.subscription_status === 'active' ? 'Ativo' : 'Expirado'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Leads */}
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Últimos Leads</h3>
                    {recentLeads.length === 0 ? (
                        <p className="text-sm text-text-secondary">Nenhum lead capturado.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {recentLeads.map((lead, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-border-dark last:border-0">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm text-white truncate">{lead.name || lead.email}</span>
                                        <span className="text-xs text-text-secondary">{formatDate(lead.created_at)}</span>
                                    </div>
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 whitespace-nowrap">
                                        {getPlanName(lead.plans)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
