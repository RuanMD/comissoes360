import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastContext';
import { Loader2, Search, ChevronLeft, ChevronRight, Download, Trash2, UserPlus, CalendarDays, TrendingUp } from 'lucide-react';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Papa from 'papaparse';

interface Lead {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    created_at: string;
    plans: { name: string }[] | { name: string } | null;
}

function getPlanName(plans: Lead['plans']): string {
    if (!plans) return 'Sem plano';
    if (Array.isArray(plans)) return plans[0]?.name || 'Sem plano';
    return plans.name || 'Sem plano';
}

interface PlanOption {
    id: string;
    name: string;
}

const PAGE_SIZE = 20;

export function AdminLeads() {
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('all');
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [stats, setStats] = useState({ total: 0, thisWeek: 0, thisMonth: 0 });
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const { showToast } = useToast();

    useEffect(() => {
        fetchPlans();
        fetchStats();
    }, []);

    useEffect(() => {
        fetchLeads();
    }, [page, planFilter]);

    const fetchPlans = async () => {
        const { data } = await supabase.from('plans').select('id, name').order('name');
        if (data) setPlans(data);
    };

    const fetchStats = async () => {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const monthStart = startOfMonth(now).toISOString();

        const [totalRes, weekRes, monthRes] = await Promise.all([
            supabase.from('leads').select('*', { count: 'exact', head: true }),
            supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
            supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        ]);

        setStats({
            total: totalRes.count ?? 0,
            thisWeek: weekRes.count ?? 0,
            thisMonth: monthRes.count ?? 0,
        });
    };

    const fetchLeads = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('leads')
                .select('id, name, email, phone, created_at, plans(name)', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (planFilter !== 'all') {
                query = query.eq('plan_id', planFilter);
            }

            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to);

            const { data, count, error } = await query;
            if (error) throw error;
            setLeads(data ?? []);
            setTotalCount(count ?? 0);
        } catch (error) {
            console.error('Erro ao carregar leads', error);
            showToast('Erro ao carregar leads.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredLeads = useMemo(() => {
        if (!search.trim()) return leads;
        const q = search.toLowerCase();
        return leads.filter(l =>
            l.email.toLowerCase().includes(q) ||
            (l.name && l.name.toLowerCase().includes(q))
        );
    }, [leads, search]);

    const handleExport = async () => {
        try {
            showToast('Exportando leads...', 'info');
            let query = supabase
                .from('leads')
                .select('name, email, phone, created_at, plans(name)')
                .order('created_at', { ascending: false });

            if (planFilter !== 'all') {
                query = query.eq('plan_id', planFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            const csvData = data.map((l: any) => ({
                Nome: l.name || '',
                Email: l.email,
                Telefone: l.phone || '',
                Plano: getPlanName(l.plans),
                Data: formatDate(l.created_at),
            }));

            const csv = Papa.unparse(csvData);
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Leads exportados com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao exportar leads.', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este lead?')) return;
        setActionLoading(id);
        try {
            const { error } = await supabase.from('leads').delete().eq('id', id);
            if (error) throw error;
            setLeads(prev => prev.filter(l => l.id !== id));
            setTotalCount(prev => prev - 1);
            setStats(prev => ({ ...prev, total: prev.total - 1 }));
            showToast('Lead excluído.');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir lead.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const statCards = [
        { label: 'Total de Leads', value: stats.total, icon: UserPlus, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Esta Semana', value: stats.thisWeek, icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Este Mês', value: stats.thisMonth, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
    ];

    if (loading && leads.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {statCards.map(card => (
                    <div key={card.label} className="bg-surface-dark border border-border-dark rounded-2xl p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${card.bg}`}>
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                        <div>
                            <span className="text-2xl font-bold text-white">{card.value}</span>
                            <p className="text-xs text-text-secondary">{card.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search, Filter, Export */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            className="w-full bg-background-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors"
                            placeholder="Buscar por nome ou email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                        value={planFilter}
                        onChange={(e) => { setPlanFilter(e.target.value); setPage(0); }}
                    >
                        <option value="all">Todos os planos</option>
                        {plans.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-highlight border border-border-dark text-sm text-white hover:text-primary transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-dark">
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Nome</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Email</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Telefone</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Plano</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Data</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
                                        Nenhum lead encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map(lead => (
                                    <tr key={lead.id} className="border-b border-border-dark last:border-0 hover:bg-surface-highlight/50 transition-colors">
                                        <td className="px-4 py-3 text-white">{lead.name || '—'}</td>
                                        <td className="px-4 py-3 text-white">{lead.email}</td>
                                        <td className="px-4 py-3 text-text-secondary">{lead.phone || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">
                                                {getPlanName(lead.plans)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary text-xs">{formatDate(lead.created_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => handleDelete(lead.id)}
                                                    disabled={actionLoading === lead.id}
                                                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    title="Excluir lead"
                                                >
                                                    {actionLoading === lead.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                        Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-dark border border-border-dark text-sm text-white hover:bg-surface-highlight disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Anterior
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-dark border border-border-dark text-sm text-white hover:bg-surface-highlight disabled:opacity-50 transition-colors"
                        >
                            Próximo
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
