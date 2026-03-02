import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, ArrowRight, Loader2, PlaySquare } from 'lucide-react';

export function Login() {
    const { signInWithPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const { error } = await signInWithPassword(email, password);
            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('E-mail ou senha incorretos.');
                }
                throw error;
            }

            if (password === '123456') {
                localStorage.setItem('mustReset', 'true');
                // O roteador (PublicOnlyRoute) cuidará do redirecionamento porque a session mudará
            } else {
                localStorage.removeItem('mustReset');
            }

        } catch (err: any) {
            setErrorMsg(err.message || 'Erro ao tentar fazer login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 min-h-[calc(100vh-80px)]">
            <Helmet>
                <title>Login | Comissões Lab</title>
                <meta name="description" content="Acesse sua conta no Comissões Lab para gerenciar suas vendas e comissões da Shopee." />
                <meta name="robots" content="noindex, follow" />
            </Helmet>
            {/* Top Badge - Hidden on small mobile to save space */}
            <div className="hidden sm:flex mb-8 items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <PlaySquare className="w-4 h-4 text-[#f2a20d]" />
                <span className="text-xs font-semibold tracking-wider text-neutral-300">SAAS PRODUCT</span>
            </div>

            {/* Login Card */}
            <div className="w-full max-w-md p-4 sm:p-6 md:p-10 rounded-2xl border border-white/5 bg-[#18181A] shadow-2xl relative overflow-hidden">
                {/* Subtle backglow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-[#f2a20d]/5 blur-[64px] rounded-full" />

                <div className="relative z-10 text-center mb-6 sm:mb-8">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-3">Acesse sua conta</h1>
                    <p className="text-xs sm:text-sm text-neutral-400">
                        Insira seu e-mail e senha para acessar.
                    </p>
                </div>

                {/* Removido o success block temporário, pois o login agora é direto */}
                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                            E-mail
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-neutral-500 group-focus-within:text-[#f2a20d] transition-colors" />
                            </div>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                autoComplete="username"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-11 py-3 bg-[#111113] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#f2a20d] focus:border-transparent transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                            Senha
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-neutral-500 group-focus-within:text-[#f2a20d] transition-colors" />
                            </div>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 py-3 bg-[#111113] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#f2a20d] focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="flex justify-end mt-1">
                            <Link
                                to="/forgot-password"
                                className="text-xs text-neutral-500 hover:text-[#f2a20d] transition-colors"
                            >
                                Esqueceu a senha?
                            </Link>
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
                                Entrar
                                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="relative z-10 mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-sm text-neutral-500">
                        Novo por aqui?{' '}
                        <a href="/#preco" className="text-[#f2a20d] hover:text-[#d98f0a] font-medium transition-colors">
                            Ainda não sou assinante <span className="text-lg">›</span>
                        </a>
                    </p>
                </div>
            </div>

            {/* Bottom Form Footer Links */}
            <div className="mt-8 flex items-center justify-center gap-4 text-xs font-medium text-neutral-600">
                <a href="#" className="hover:text-neutral-400 transition-colors">Privacidade</a>
                <span className="w-px h-3 bg-neutral-800" />
                <a href="#" className="hover:text-neutral-400 transition-colors">Termos</a>
                <span className="w-px h-3 bg-neutral-800" />
                <a href="#" className="hover:text-neutral-400 transition-colors">Ajuda</a>
            </div>
        </div>
    );
}
