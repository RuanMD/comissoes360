import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Lock, ArrowRight, Loader2, PlaySquare, Eye, EyeOff } from 'lucide-react';

export function ResetPassword() {
    const { updatePassword, clearMustResetBlock } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg('As senhas não coincidem.');
            return;
        }

        if (password === '123456') {
            setErrorMsg('Sua nova senha não pode ser a senha padrão.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Limpa a flag no banco ANTES de atualizar a senha
            //    Isso evita race condition: updatePassword dispara onAuthStateChange,
            //    que chama checkSubscription e re-lê force_password_change do BD.
            //    Se a flag ainda fosse true, o usuário seria redirecionado de volta.
            const { error: rpcError } = await supabase.rpc('clear_force_password_change');
            if (rpcError) {
                console.error('Erro ao limpar flag de troca de senha:', rpcError);
            }

            // 2. Limpa o estado local (localStorage + context) antes do updatePassword
            clearMustResetBlock();

            // 3. Agora atualiza a senha (onAuthStateChange vai disparar, mas a flag já está false)
            const { error } = await updatePassword(password);
            if (error) throw error;

            // 4. Sucesso! Redireciona para o dashboard
            navigate('/dashboard');
        } catch (err: any) {
            // Se a atualização da senha falhou, re-ativar a flag local para forçar nova tentativa
            localStorage.setItem('mustReset', 'true');
            setErrorMsg(err.message || 'Erro ao tentar atualizar a senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#111113]">
            <div className="flex-1 flex flex-col items-center justify-center -mt-20 px-4">
                <div className="mb-8 flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                    <PlaySquare className="w-4 h-4 text-[#f2a20d]" />
                    <span className="text-xs font-semibold tracking-wider text-neutral-300">SEGURANÇA</span>
                </div>

                <div className="w-full max-w-md p-4 sm:p-6 md:p-10 rounded-2xl border border-white/5 bg-[#18181A] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-[#f2a20d]/5 blur-[64px] rounded-full" />

                    <div className="relative z-10 text-center mb-6 sm:mb-8">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-3">Atualize sua senha</h1>
                        <p className="text-sm text-neutral-400">
                            Por motivos de segurança, você precisa alterar sua senha inicial antes de acessar o sistema.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-neutral-300">
                                    Nova Senha
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-neutral-500 group-focus-within:text-[#f2a20d] transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-11 py-3 bg-[#111113] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#f2a20d] focus:border-transparent transition-all"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-neutral-300">
                                    Confirmar Nova Senha
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-neutral-500 group-focus-within:text-[#f2a20d] transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="block w-full pl-11 py-3 bg-[#111113] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#f2a20d] focus:border-transparent transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            {errorMsg && (
                                <p className="text-sm text-red-500 mt-2">{errorMsg}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-[#f2a20d] hover:bg-[#d98f0a] text-black font-semibold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_0_20px_rgba(242,162,13,0.3)]"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Salvar e Entrar
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
