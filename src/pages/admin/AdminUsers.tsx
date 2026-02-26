import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { Loader2, Search, ChevronLeft, ChevronRight, Shield, ShieldOff, CalendarPlus, ToggleLeft, ToggleRight } from 'lucide-react';
import { format, addDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserRow {
    id: string;
    email: string;
    subscription_status: string;
    subscription_expires_at: string | null;
    is_admin: boolean;
    created_at: string;
}

type FilterType = 'all' | 'active' | 'expired' | 'admins';

const PAGE_SIZE = 20;

export function AdminUsers() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [extendingUser, setExtendingUser] = useState<string | null>(null);

    const { user: currentUser } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        fetchUsers();
    }, [page, filter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('users')
                .select('id, email, subscription_status, subscription_expires_at, is_admin, created_at', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (filter === 'active') {
                query = query.eq('subscription_status', 'active');
            } else if (filter === 'expired') {
                query = query.neq('subscription_status', 'active');
            } else if (filter === 'admins') {
                query = query.eq('is_admin', true);
            }

            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to);

            const { data, count, error } = await query;
            if (error) throw error;
            setUsers(data ?? []);
            setTotalCount(count ?? 0);
        } catch (error) {
            console.error('Erro ao carregar usuários', error);
            showToast('Erro ao carregar usuários.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        if (!search.trim()) return users;
        const q = search.toLowerCase();
        return users.filter(u => u.email.toLowerCase().includes(q));
    }, [users, search]);

    const toggleSubscription = async (user: UserRow) => {
        setActionLoading(user.id);
        try {
            const isActive = user.subscription_status === 'active';
            const updates: Record<string, unknown> = {
                subscription_status: isActive ? 'expired' : 'active',
                updated_at: new Date().toISOString(),
            };
            if (!isActive) {
                updates.subscription_expires_at = addDays(new Date(), 30).toISOString();
            }
            const { error } = await supabase.from('users').update(updates).eq('id', user.id);
            if (error) throw error;
            showToast(isActive ? 'Assinatura desativada.' : 'Assinatura ativada por 30 dias!');
            fetchUsers();
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar assinatura.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const extendSubscription = async (userId: string, days: number) => {
        setActionLoading(userId);
        try {
            const { error } = await supabase.from('users').update({
                subscription_status: 'active',
                subscription_expires_at: addDays(new Date(), days).toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', userId);
            if (error) throw error;
            showToast(`Assinatura estendida por ${days} dias!`);
            setExtendingUser(null);
            fetchUsers();
        } catch (error) {
            console.error(error);
            showToast('Erro ao estender assinatura.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const toggleAdmin = async (user: UserRow) => {
        if (user.id === currentUser?.id) {
            if (!window.confirm('Você está removendo seu próprio acesso de administrador. Tem certeza?')) return;
        }
        if (!user.is_admin && !window.confirm(`Conceder acesso de administrador para ${user.email}?`)) return;

        setActionLoading(user.id);
        try {
            const { error } = await supabase.from('users').update({
                is_admin: !user.is_admin,
                updated_at: new Date().toISOString(),
            }).eq('id', user.id);
            if (error) throw error;
            showToast(user.is_admin ? 'Acesso admin removido.' : 'Acesso admin concedido!');
            fetchUsers();
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar permissão.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        try {
            return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    if (loading && users.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header with search and filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            className="w-full bg-background-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors"
                            placeholder="Buscar por email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                        value={filter}
                        onChange={(e) => { setFilter(e.target.value as FilterType); setPage(0); }}
                    >
                        <option value="all">Todos</option>
                        <option value="active">Ativos</option>
                        <option value="expired">Expirados</option>
                        <option value="admins">Admins</option>
                    </select>
                </div>
                <span className="text-sm text-text-secondary whitespace-nowrap">{totalCount} usuário(s)</span>
            </div>

            {/* Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-dark">
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Email</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Expira em</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Admin</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Cadastro</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isExpired = user.subscription_status !== 'active' ||
                                        (user.subscription_expires_at && isPast(new Date(user.subscription_expires_at)));
                                    const isCurrentUser = user.id === currentUser?.id;

                                    return (
                                        <tr key={user.id} className="border-b border-border-dark last:border-0 hover:bg-surface-highlight/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white truncate max-w-[200px]">{user.email}</span>
                                                    {isCurrentUser && (
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">Você</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                                    isExpired
                                                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                                        : 'bg-green-500/10 text-green-400 border border-green-500/30'
                                                }`}>
                                                    {isExpired ? 'Expirado' : 'Ativo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-sm ${isExpired ? 'text-red-400' : 'text-white'}`}>
                                                    {formatDate(user.subscription_expires_at)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => toggleAdmin(user)}
                                                    disabled={actionLoading === user.id}
                                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                                                        user.is_admin
                                                            ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                                                            : 'bg-surface-highlight text-text-secondary border border-border-dark hover:text-white'
                                                    }`}
                                                >
                                                    {user.is_admin ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                                                    {user.is_admin ? 'Admin' : 'Usuário'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-text-secondary">{formatDate(user.created_at)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => toggleSubscription(user)}
                                                        disabled={actionLoading === user.id}
                                                        title={isExpired ? 'Ativar assinatura (30 dias)' : 'Desativar assinatura'}
                                                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                                            isExpired
                                                                ? 'text-green-400 hover:bg-green-500/10'
                                                                : 'text-red-400 hover:bg-red-500/10'
                                                        }`}
                                                    >
                                                        {actionLoading === user.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : isExpired ? (
                                                            <ToggleLeft className="w-4 h-4" />
                                                        ) : (
                                                            <ToggleRight className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setExtendingUser(extendingUser === user.id ? null : user.id)}
                                                        title="Estender assinatura"
                                                        className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    >
                                                        <CalendarPlus className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Extend Subscription Dropdown */}
                                                {extendingUser === user.id && (
                                                    <div className="absolute right-4 mt-2 bg-surface-dark border border-border-dark rounded-xl p-3 shadow-xl z-10 min-w-[180px]">
                                                        <p className="text-xs text-text-secondary mb-2 font-medium">Estender por:</p>
                                                        <div className="flex flex-col gap-1">
                                                            {[
                                                                { days: 7, label: '7 dias' },
                                                                { days: 30, label: '30 dias' },
                                                                { days: 90, label: '90 dias' },
                                                                { days: 365, label: '1 ano' },
                                                            ].map(opt => (
                                                                <button
                                                                    key={opt.days}
                                                                    onClick={() => extendSubscription(user.id, opt.days)}
                                                                    disabled={actionLoading === user.id}
                                                                    className="text-left text-sm text-white px-3 py-2 rounded-lg hover:bg-surface-highlight transition-colors disabled:opacity-50"
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
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
