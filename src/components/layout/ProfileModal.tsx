import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { X, User as UserIcon, Mail, Lock, Key, AlertCircle, Save, Eye, EyeOff, Trash2, ShieldCheck, Loader2, ShoppingBag } from 'lucide-react';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'profile' | 'email' | 'password' | 'api' | 'shopee';

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, signInWithPassword } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Form states
    const [fullName, setFullName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [facebookKey, setFacebookKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ valid: boolean; details: string; accounts?: string[] } | null>(null);

    // Shopee API states
    const [shopeeAppId, setShopeeAppId] = useState('');
    const [shopeeSecret, setShopeeSecret] = useState('');
    const [showShopeeAppId, setShowShopeeAppId] = useState(false);
    const [showShopeeSecret, setShowShopeeSecret] = useState(false);
    const [shopeeVerifying, setShopeeVerifying] = useState(false);
    const [shopeeVerificationResult, setShopeeVerificationResult] = useState<{ valid: boolean; details: string } | null>(null);

    // User metadata state
    const [userMetaName, setUserMetaName] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            setMessage(null);
            // Load user data
            setFullName(user.user_metadata?.full_name || '');
            setUserMetaName(user.user_metadata?.full_name || '');
            setNewEmail(user.email || '');
            fetchFacebookKey();
            fetchShopeeCredentials();
        }
    }, [isOpen, user]);

    const fetchFacebookKey = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('users')
                .select('facebook_api_key')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            if (data && data.facebook_api_key) {
                setFacebookKey(data.facebook_api_key);
            } else {
                setFacebookKey('');
            }
        } catch (error) {
            console.error('Error fetching facebook key:', error);
        }
    };

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            });

            if (error) throw error;
            setUserMetaName(fullName);
            setMessage({ text: 'Nome atualizado com sucesso!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao atualizar nome.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (!user?.email) return;

        try {
            // Re-authenticate user for security
            const { error: signInError } = await signInWithPassword(user.email, currentPasswordForEmail);

            if (signInError) {
                throw new Error('Senha atual incorreta. Não é possível alterar o email.');
            }

            // Update Email
            const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });

            if (updateError) throw updateError;

            setMessage({ text: 'Email atualizado! Verifique as caixas de entrada de ambos os emails para confirmar a alteração.', type: 'success' });
            setCurrentPasswordForEmail('');
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao atualizar email.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (!user?.email) return;
        if (newPassword !== confirmPassword) {
            setMessage({ text: 'As novas senhas não coincidem.', type: 'error' });
            setLoading(false);
            return;
        }

        try {
            // Re-authenticate user for security
            const { error: signInError } = await signInWithPassword(user.email, currentPassword);

            if (signInError) {
                throw new Error('Senha atual incorreta.');
            }

            // Update Password
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

            if (updateError) throw updateError;

            setMessage({ text: 'Senha atualizada com sucesso!', type: 'success' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao atualizar senha.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFacebookKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (!user) return;

        try {
            const { error } = await supabase
                .from('users')
                .update({ facebook_api_key: facebookKey })
                .eq('id', user.id);

            if (error) throw error;

            setMessage({ text: 'Chave da API do Facebook salva com sucesso!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao salvar chave da API.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFacebookKey = async () => {
        setLoading(true);
        setMessage(null);

        if (!user) return;

        try {
            const { error } = await supabase
                .from('users')
                .update({ facebook_api_key: null })
                .eq('id', user.id);

            if (error) throw error;

            setFacebookKey('');
            setMessage({ text: 'Chave da API do Facebook removida com sucesso!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao remover chave da API.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyToken = async () => {
        if (!facebookKey) return;
        setVerifying(true);
        setVerificationResult(null);
        setMessage(null);

        try {
            // 1. Verificar validade do token via debug_token
            const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(facebookKey)}&access_token=${encodeURIComponent(facebookKey)}`);
            const debugData = await debugRes.json();

            if (debugData.error || !debugData.data?.is_valid) {
                const errorMsg = debugData.error?.message || debugData.data?.error?.message || 'Token inválido ou expirado.';
                setVerificationResult({ valid: false, details: errorMsg });
                return;
            }

            const tokenData = debugData.data;
            const scopes: string[] = tokenData.scopes || [];
            const hasAdsRead = scopes.includes('ads_read') || scopes.includes('ads_management');

            let expiresInfo = '';
            if (tokenData.expires_at === 0) {
                expiresInfo = 'Token permanente (sem expiração).';
            } else {
                const expiresDate = new Date(tokenData.expires_at * 1000);
                expiresInfo = `Expira em: ${expiresDate.toLocaleDateString('pt-BR')} às ${expiresDate.toLocaleTimeString('pt-BR')}.`;
            }

            // 2. Tentar puxar contas de anúncio
            const accountsRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${encodeURIComponent(facebookKey)}&fields=name,account_status&limit=10`);
            const accountsData = await accountsRes.json();

            if (accountsData.error) {
                // Token válido mas sem permissão de ads
                setVerificationResult({
                    valid: true,
                    details: `✅ Token válido! ${expiresInfo}\n⚠️ Sem acesso a contas de anúncio: ${accountsData.error.message}${!hasAdsRead ? '\n💡 O token não possui a permissão ads_read ou ads_management.' : ''}`,
                });
                return;
            }

            const adAccounts = (accountsData.data || []).map((acc: any) => {
                const statusMap: Record<number, string> = { 1: '🟢 Ativa', 2: '🔴 Desativada', 3: '🟡 Pendente', 7: '⏸️ Pausada', 100: '🔒 Análise', 101: '⏳ Em graça' };
                return `${acc.name || acc.id} — ${statusMap[acc.account_status] || 'Status ' + acc.account_status}`;
            });

            if (adAccounts.length === 0) {
                setVerificationResult({
                    valid: true,
                    details: `✅ Token válido! ${expiresInfo}\n⚠️ Nenhuma conta de anúncio encontrada associada a este token.`,
                });
            } else {
                setVerificationResult({
                    valid: true,
                    details: `✅ Token válido! ${expiresInfo}\n📊 ${adAccounts.length} conta(s) de anúncio encontrada(s):`,
                    accounts: adAccounts,
                });
            }
        } catch (error: any) {
            setVerificationResult({
                valid: false,
                details: `Erro de conexão: ${error.message || 'Não foi possível conectar à API do Facebook.'}`,
            });
        } finally {
            setVerifying(false);
        }
    };

    // === Shopee API Functions ===
    const fetchShopeeCredentials = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase.rpc('get_shopee_credentials');
            if (error) throw error;
            if (data && data.length > 0) {
                setShopeeAppId(data[0].shopee_app_id || '');
                setShopeeSecret(data[0].shopee_secret || '');
            } else {
                setShopeeAppId('');
                setShopeeSecret('');
            }
        } catch (error) {
            console.error('Error fetching shopee credentials:', error);
        }
    };

    const handleSaveShopeeCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        if (!user) return;
        try {
            const { error } = await supabase.rpc('save_shopee_credentials', {
                p_app_id: shopeeAppId || null,
                p_secret: shopeeSecret || null,
            });
            if (error) throw error;
            setMessage({ text: 'Credenciais da API Shopee salvas com sucesso!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao salvar credenciais da Shopee.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveShopeeCredentials = async () => {
        setLoading(true);
        setMessage(null);
        if (!user) return;
        try {
            const { error } = await supabase.rpc('save_shopee_credentials', {
                p_app_id: null,
                p_secret: null,
            });
            if (error) throw error;
            setShopeeAppId('');
            setShopeeSecret('');
            setShopeeVerificationResult(null);
            setMessage({ text: 'Credenciais da Shopee removidas com sucesso!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Erro ao remover credenciais.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyShopeeCredentials = async () => {
        if (!shopeeAppId || !shopeeSecret) return;
        setShopeeVerifying(true);
        setShopeeVerificationResult(null);
        setMessage(null);
        try {
            const response = await fetch('/api/generate-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originUrl: 'https://shopee.com.br/product/1/1',
                    subIds: [],
                    shopeeAppId,
                    shopeeSecret,
                }),
            });
            const data = await response.json();
            if (response.ok && data.shortLink) {
                setShopeeVerificationResult({
                    valid: true,
                    details: 'Credenciais verificadas com sucesso! A API da Shopee respondeu corretamente.',
                });
            } else {
                const errMsg = data.error || 'Erro desconhecido';
                // Auth errors typically mean invalid credentials
                const isAuthError = errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('signature');
                setShopeeVerificationResult({
                    valid: !isAuthError && response.ok,
                    details: isAuthError
                        ? `Credenciais inválidas: ${errMsg}`
                        : `API respondeu (credenciais válidas): ${errMsg}`,
                });
            }
        } catch (error: any) {
            setShopeeVerificationResult({
                valid: false,
                details: `Erro de conexão: ${error.message || 'Não foi possível conectar à API.'}`,
            });
        } finally {
            setShopeeVerifying(false);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'profile', label: 'Perfil', icon: UserIcon },
        { id: 'email', label: 'E-mail', icon: Mail },
        { id: 'password', label: 'Senha', icon: Lock },
        { id: 'api', label: 'Facebook API', icon: Key },
        { id: 'shopee', label: 'Shopee API', icon: ShoppingBag },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
            <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Sidebar com tabs */}
                <div className="w-full md:w-64 bg-surface-highlight/20 border-b md:border-b-0 md:border-r border-border-dark p-4 shrink-0 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white">Configurações</h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors md:hidden"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-highlight/50 border border-border-dark mb-6">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {userMetaName ? userMetaName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'C')}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <h3 className="text-white text-sm font-bold truncate">
                                {userMetaName || (user?.email ? user.email.split('@')[0] : 'Usuário')}
                            </h3>
                            <p className="text-text-secondary text-xs truncate">Administrador</p>
                        </div>
                    </div>

                    <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto hide-scrollbar">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setMessage(null);
                                    }}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap text-sm font-medium ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-text-secondary hover:text-white hover:bg-surface-highlight'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-6 overflow-y-auto w-full min-w-0">
                    <div className="hidden md:flex justify-end mb-4">
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${message.type === 'success'
                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                            }`}>
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-sm">{message.text}</p>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Perfil do Usuário</h3>
                            <p className="text-text-secondary text-sm mb-6">Como as pessoas verão você na plataforma.</p>

                            <form onSubmit={handleUpdateName} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="Seu nome"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !fullName || fullName === userMetaName}
                                        className="flex items-center gap-2 bg-primary text-background-dark px-5 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base max-w-full"
                                    >
                                        <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                        Salvar Alterações
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'email' && (
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Atualizar E-mail</h3>
                            <p className="text-text-secondary text-sm mb-6">Mude o endereço de e-mail associado à sua conta.</p>

                            <form onSubmit={handleUpdateEmail} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">E-mail Atual</label>
                                    <input
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="w-full bg-background-dark/50 border border-border-dark rounded-lg px-4 py-2.5 text-neutral-500 focus:outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Novo E-mail</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        required
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="novo@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Senha Atual (Confirmação de Segurança)</label>
                                    <input
                                        type="password"
                                        value={currentPasswordForEmail}
                                        onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                                        required
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                    />
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Necessário para confirmar que é você realizando a alteração.
                                    </p>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !newEmail || !currentPasswordForEmail || newEmail === user?.email}
                                        className="flex items-center gap-2 bg-primary text-background-dark px-5 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base max-w-full"
                                    >
                                        <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                        Atualizar E-mail
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'password' && (
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Atualizar Senha</h3>
                            <p className="text-text-secondary text-sm mb-6">Mantenha sua conta segura trocando a senha regularmente.</p>

                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Senha Atual</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Nova Senha</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Repetir Nova Senha</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                                        className="flex items-center gap-2 bg-primary text-background-dark px-5 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base max-w-full"
                                    >
                                        <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                        Atualizar Senha
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">API do Facebook</h3>
                            <p className="text-text-secondary text-sm mb-6">Configure o seu Token da API de Conversões do Facebook (CAPI).</p>

                            <form onSubmit={handleSaveFacebookKey} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Access Token (CAPI)</label>
                                    <div className="relative">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={facebookKey}
                                            onChange={(e) => setFacebookKey(e.target.value)}
                                            className="w-full bg-background-dark border border-border-dark rounded-lg pl-4 pr-12 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                            placeholder="EAA..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                                        >
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-2">
                                        A chave é usada em automações e envios via webhook para o Facebook.
                                    </p>
                                </div>

                                {/* Verify Token Button */}
                                <button
                                    type="button"
                                    onClick={handleVerifyToken}
                                    disabled={verifying || !facebookKey}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 px-5 py-2.5 rounded-lg font-bold hover:bg-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {verifying ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4" /> Verificar Token</>
                                    )}
                                </button>

                                {/* Verification Result */}
                                {verificationResult && (
                                    <div className={`p-4 rounded-xl text-sm space-y-2 ${verificationResult.valid
                                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                        }`}>
                                        {verificationResult.details.split('\n').map((line, i) => (
                                            <p key={i}>{line}</p>
                                        ))}
                                        {verificationResult.accounts && verificationResult.accounts.length > 0 && (
                                            <ul className="mt-2 space-y-1 pl-1">
                                                {verificationResult.accounts.map((acc, i) => (
                                                    <li key={i} className="text-xs text-green-300/80 flex items-center gap-1.5">
                                                        <span className="w-1 h-1 rounded-full bg-green-400 shrink-0" />
                                                        {acc}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleRemoveFacebookKey}
                                        disabled={loading || !facebookKey}
                                        className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remover
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-primary text-background-dark px-5 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base max-w-full"
                                    >
                                        <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                        Salvar API Token
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'shopee' && (
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">API da Shopee</h3>
                            <p className="text-text-secondary text-sm mb-6">Configure suas credenciais da API de Afiliados Shopee para gerar links encurtados.</p>

                            <form onSubmit={handleSaveShopeeCredentials} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">App ID</label>
                                    <div className="relative">
                                        <input
                                            type={showShopeeAppId ? "text" : "password"}
                                            value={shopeeAppId}
                                            onChange={(e) => setShopeeAppId(e.target.value)}
                                            className="w-full bg-background-dark border border-border-dark rounded-lg pl-4 pr-12 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                            placeholder="Ex: 18364470827"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowShopeeAppId(!showShopeeAppId)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                                        >
                                            {showShopeeAppId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Secret Key</label>
                                    <div className="relative">
                                        <input
                                            type={showShopeeSecret ? "text" : "password"}
                                            value={shopeeSecret}
                                            onChange={(e) => setShopeeSecret(e.target.value)}
                                            className="w-full bg-background-dark border border-border-dark rounded-lg pl-4 pr-12 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                                            placeholder="Ex: DHF6Z324UX..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowShopeeSecret(!showShopeeSecret)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                                        >
                                            {showShopeeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-2">
                                        Suas credenciais são criptografadas antes de serem armazenadas no banco de dados.
                                    </p>
                                </div>

                                {/* Verify Credentials Button */}
                                <button
                                    type="button"
                                    onClick={handleVerifyShopeeCredentials}
                                    disabled={shopeeVerifying || !shopeeAppId || !shopeeSecret}
                                    className="w-full flex items-center justify-center gap-2 bg-orange-600/10 text-orange-400 border border-orange-500/20 px-5 py-2.5 rounded-lg font-bold hover:bg-orange-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {shopeeVerifying ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4" /> Verificar Credenciais</>
                                    )}
                                </button>

                                {/* Verification Result */}
                                {shopeeVerificationResult && (
                                    <div className={`p-4 rounded-xl text-sm space-y-2 ${shopeeVerificationResult.valid
                                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                        }`}>
                                        <p>{shopeeVerificationResult.details}</p>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleRemoveShopeeCredentials}
                                        disabled={loading || (!shopeeAppId && !shopeeSecret)}
                                        className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remover
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-primary text-background-dark px-5 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base max-w-full"
                                    >
                                        <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                        Salvar Credenciais
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
