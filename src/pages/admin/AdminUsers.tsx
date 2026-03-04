import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { Loader2, Search, ChevronLeft, ChevronRight, Shield, ShieldOff, CalendarPlus, ToggleLeft, ToggleRight, Trash2, X, AlertTriangle, Sliders } from 'lucide-react';
import { format, addDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ALL_FEATURE_KEYS, FEATURE_LABELS, FeatureKey } from '../../hooks/useFeatureAccess';
import { AddUserModal } from '../../components/admin/AddUserModal';

interface UserRow {
    id: string;
    email: string;
    subscription_status: string;
    subscription_expires_at: string | null;
    is_admin: boolean;
    created_at: string;
    plan_id: string | null;
    feature_overrides: Record<string, boolean>;
    full_name: string | null;
    phone: string | null;
}

interface PlanOption {
    id: string;
    name: string;
    feature_keys: string[];
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
    const [extendingUser, setExtendingUser] = useState<UserRow | null>(null);
    const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [overridesUser, setOverridesUser] = useState<UserRow | null>(null);
    const [tempOverrides, setTempOverrides] = useState<Record<string, boolean>>({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [customDays, setCustomDays] = useState('');

    const { user: currentUser, signInWithPassword } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        fetchUsers();
        fetchPlans();
    }, [page, filter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('users')
                .select('id, email, subscription_status, subscription_expires_at, is_admin, created_at, plan_id, feature_overrides, full_name, phone', { count: 'exact' })
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

    const fetchPlans = async () => {
        const { data } = await supabase
            .from('plans')
            .select('id, name, feature_keys')
            .eq('is_active', true)
            .order('name');
        setPlans(data || []);
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
            setCustomDays(''); // Limpa o valor personalizado
            fetchUsers();
        } catch (error) {
            console.error(error);
            showToast('Erro ao estender assinatura.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const confirmAndDeleteUser = async () => {
        if (!deletingUser || !currentUser?.email) return;
        if (!adminPassword) {
            showToast('Digite sua senha para confirmar.', 'error');
            return;
        }

        setActionLoading(deletingUser.id);

        try {
            // 1. Testa se a senha que o Admin digitou é válida logando-o "por trás dos panos"
            // Retorna erro se a senha estiver errada
            const { error: authError } = await signInWithPassword(currentUser.email, adminPassword);
            if (authError) {
                showToast('Senha de administrador incorreta.', 'error');
                setActionLoading(null);
                return;
            }

            // 2. Chama a RPC que deletará o usuário de fato (exige cargo de admin ativo)
            const { data, error: rpcError } = await supabase.rpc('delete_user_secure', {
                target_user_id: deletingUser.id
            });

            if (rpcError || (data && typeof data === 'object' && data.success === false)) {
                console.error("RPC Error:", rpcError || data);
                throw new Error(data?.error || 'Não foi possível excluir o usuário. Falta de permissões.');
            }

            showToast('Usuário e assinatura excluídos permanentemente.');
            setDeletingUser(null);
            setAdminPassword('');
            fetchUsers();
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Erro crítico ao tentar excluir usuário.', 'error');
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

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary text-background-dark font-bold px-4 py-2.5 rounded-lg hover:brightness-110 transition-all text-sm"
                    >
                        <CalendarPlus className="w-4 h-4" />
                        Novo Usuário
                    </button>
                    <span className="text-sm text-text-secondary whitespace-nowrap">{totalCount} usuário(s)</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-dark">
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Usuário</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">WhatsApp</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Plano</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Expira em</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Admin</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Cadastro</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-text-secondary">
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
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium truncate max-w-[200px]">
                                                            {user.full_name || 'Sem nome'}
                                                        </span>
                                                        {isCurrentUser && (
                                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">Você</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-text-secondary truncate max-w-[200px]">{user.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-white">
                                                    {user.phone ? (
                                                        <a
                                                            href={`https://wa.me/${user.phone.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:text-primary transition-colors flex items-center gap-1"
                                                        >
                                                            {user.phone}
                                                        </a>
                                                    ) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isExpired
                                                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                                    : 'bg-green-500/10 text-green-400 border border-green-500/30'
                                                    }`}>
                                                    {isExpired ? 'Expirado' : 'Ativo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={user.plan_id || ''}
                                                    onChange={async (e) => {
                                                        const planId = e.target.value || null;
                                                        await supabase.from('users').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('id', user.id);
                                                        showToast(planId ? 'Plano vinculado!' : 'Plano removido.');
                                                        fetchUsers();
                                                    }}
                                                    className="bg-background-dark border border-border-dark rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary max-w-[120px]"
                                                >
                                                    <option value="">Sem plano</option>
                                                    {plans.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
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
                                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${user.is_admin
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
                                                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isExpired
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
                                                        onClick={() => setExtendingUser(extendingUser?.id === user.id ? null : user)}
                                                        title="Estender assinatura"
                                                        className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    >
                                                        <CalendarPlus className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setOverridesUser(user);
                                                            setTempOverrides(user.feature_overrides || {});
                                                        }}
                                                        title="Gerenciar recursos"
                                                        className="p-2 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-colors"
                                                    >
                                                        <Sliders className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setDeletingUser(user); setAdminPassword(''); }}
                                                        disabled={user.id === currentUser?.id || actionLoading === user.id}
                                                        title={user.id === currentUser?.id ? "Você não pode excluir a si mesmo" : "Excluir Usuário"}
                                                        className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-20"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
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

            {/* Modal: Estender Assinatura (Correção de Bug de Scroll) */}
            {extendingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-surface-dark border border-border-dark rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Estender Assinatura</h3>
                                <button onClick={() => setExtendingUser(null)} className="text-text-secondary hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-text-secondary mb-4 break-words">
                                Selecione o período para estender a assinatura de <span className="text-white font-medium">{extendingUser.email}</span>:
                            </p>

                            <div className="flex flex-col gap-2">
                                {[
                                    { days: 7, label: '7 dias' },
                                    { days: 30, label: '1 Mês' },
                                    { days: 90, label: '3 Meses' },
                                    { days: 365, label: '1 Ano' },
                                ].map(opt => (
                                    <button
                                        key={opt.days}
                                        onClick={() => extendSubscription(extendingUser.id, opt.days)}
                                        disabled={actionLoading === extendingUser.id}
                                        className="w-full text-left flex justify-between items-center text-sm text-white px-4 py-3 rounded-lg border border-border-dark hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                                    >
                                        <span>+{opt.label}</span>
                                        {actionLoading === extendingUser.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : (
                                            <CalendarPlus className="w-4 h-4 text-text-secondary" />
                                        )}
                                    </button>
                                ))}

                                <div className="mt-4 pt-4 border-t border-border-dark">
                                    <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Quantidade personalizada (dias)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Ex: 45"
                                            className="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary transition-colors"
                                            value={customDays}
                                            onChange={(e) => setCustomDays(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && customDays) {
                                                    extendSubscription(extendingUser.id, parseInt(customDays));
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                const d = parseInt(customDays);
                                                if (!isNaN(d) && d > 0) {
                                                    extendSubscription(extendingUser.id, d);
                                                } else {
                                                    showToast('Insira um número válido de dias.', 'error');
                                                }
                                            }}
                                            disabled={actionLoading === extendingUser.id || !customDays}
                                            className="px-4 py-2 bg-primary text-background-dark font-bold rounded-lg text-sm hover:brightness-110 disabled:opacity-50 transition-all"
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Exclusão Física (Hard Delete) */}
            {deletingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-surface-dark border border-border-dark rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-white mb-1">Excluir Conta Permanentemente</h3>
                                    <p className="text-sm text-text-secondary break-words">
                                        Você está prestes a excluir <span className="text-white font-medium">{deletingUser.email}</span>. Isso removerá todos os dados, leads e acesso dessa pessoa imediatamente. Esta ação não pode ser desfeita.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Confirme sua Senha de Administrador
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Digite sua senha..."
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-colors"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && confirmAndDeleteUser()}
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setDeletingUser(null); setAdminPassword(''); }}
                                        className="flex-1 px-4 py-2.5 rounded-lg border border-border-dark text-white text-sm font-medium hover:bg-surface-highlight transition-colors"
                                        disabled={!!actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmAndDeleteUser}
                                        disabled={!!actionLoading || !adminPassword}
                                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === deletingUser.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Excluindo...</span>
                                            </>
                                        ) : (
                                            <span>Sim, Excluir Conta</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Gerenciar Recursos (Feature Overrides) */}
            {overridesUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-surface-dark border border-border-dark rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Gerenciar Recursos</h3>
                                <button onClick={() => setOverridesUser(null)} className="text-text-secondary hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-text-secondary mb-4 break-words">
                                Overrides para <span className="text-white font-medium">{overridesUser.email}</span>.
                                Use para forçar acesso ou bloqueio independente do plano.
                            </p>

                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                                {ALL_FEATURE_KEYS.map((key) => {
                                    const planHas = plans.find(p => p.id === overridesUser.plan_id)?.feature_keys?.includes(key) || false;
                                    const override = tempOverrides[key];
                                    const hasOverride = key in tempOverrides;

                                    return (
                                        <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-background-dark border border-border-dark">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-white">{FEATURE_LABELS[key as FeatureKey]}</span>
                                                <span className="text-[10px] text-text-secondary">
                                                    Plano: {planHas ? '✅ Incluso' : '❌ Não incluso'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        const next = { ...tempOverrides };
                                                        delete next[key];
                                                        setTempOverrides(next);
                                                    }}
                                                    className={`text-[10px] px-2 py-1 rounded ${!hasOverride ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-surface-highlight text-text-secondary border border-border-dark'}`}
                                                >
                                                    Padrão
                                                </button>
                                                <button
                                                    onClick={() => setTempOverrides({ ...tempOverrides, [key]: true })}
                                                    className={`text-[10px] px-2 py-1 rounded ${hasOverride && override === true ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-surface-highlight text-text-secondary border border-border-dark'}`}
                                                >
                                                    Ativar
                                                </button>
                                                <button
                                                    onClick={() => setTempOverrides({ ...tempOverrides, [key]: false })}
                                                    className={`text-[10px] px-2 py-1 rounded ${hasOverride && override === false ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-surface-highlight text-text-secondary border border-border-dark'}`}
                                                >
                                                    Bloquear
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-3 pt-6">
                                <button
                                    onClick={() => setOverridesUser(null)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-border-dark text-white text-sm font-medium hover:bg-surface-highlight transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        await supabase.from('users').update({
                                            feature_overrides: tempOverrides,
                                            updated_at: new Date().toISOString(),
                                        }).eq('id', overridesUser.id);
                                        showToast('Overrides salvos!');
                                        setOverridesUser(null);
                                        fetchUsers();
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-primary text-background-dark font-bold rounded-lg text-sm hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
                                >
                                    Salvar Overrides
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AddUserModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                plans={plans}
                onSuccess={fetchUsers}
            />
        </div>
    );
}
