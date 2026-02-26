import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, ArrowRight, Loader2, PlaySquare, ChevronLeft } from 'lucide-react';

export function ForgotPassword() {
    const { sendPasswordResetEmail } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const { error } = await sendPasswordResetEmail(email);
            if (error) throw error;
            setSuccess(true);
        } catch (err: any) {
            setErrorMsg(err.message || 'Erro ao tentar enviar o e-mail de recuperação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center -mt-20 px-4">
            <div className="mb-8 flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <PlaySquare className="w-4 h-4 text-[#f2a20d]" />
                <span className="text-xs font-semibold tracking-wider text-neutral-300">RECUPERAÇÃO</span>
            </div>

            <div className="w-full max-w-md p-8 sm:p-10 rounded-2xl border border-white/5 bg-[#18181A] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-[#f2a20d]/5 blur-[64px] rounded-full" />

                <div className="relative z-10 text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-3">Esqueceu a senha?</h1>
                    <p className="text-sm text-neutral-400">
                        Insira seu e-mail para receber as instruções de recuperação.
                    </p>
                </div>

                {success ? (
                    <div className="relative z-10 space-y-6">
                        <div className="text-center bg-[#f2a20d]/10 border border-[#f2a20d]/30 text-[#f2a20d] p-4 rounded-xl">
                            <p className="font-medium text-sm">
                                E-mail enviado! Verifique sua caixa de entrada e siga as instruções para criar uma nova senha.
                            </p>
                        </div>
                        <Link
                            to="/login"
                            className="w-full flex items-center justify-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Voltar para o login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                                E-mail de cadastro
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-neutral-500 group-focus-within:text-[#f2a20d] transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 py-3 bg-[#111113] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#f2a20d] focus:border-transparent transition-all"
                                    placeholder="seu@email.com"
                                />
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
                                    Enviar E-mail
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <div className="text-center">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-white/40 hover:text-[#f2a20d] transition-colors text-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Voltar para o login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
