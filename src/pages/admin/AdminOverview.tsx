import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Users, CheckCircle, XCircle, UserPlus, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export function AdminOverview() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, expiredUsers: 0, totalLeads: 0, leadsThisMonth: 0, activePlans: 0 });
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
    const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);

    useEffect(() => {
        fetchOverview();
    }, []);

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
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                                        user.subscription_status === 'active'
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
        </div>
    );
}
