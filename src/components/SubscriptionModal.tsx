import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, X } from 'lucide-react';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    planId: string;
    checkoutUrl: string;
    showName: boolean;
    showPhone: boolean;
    webhookUrl?: string;
}

export function SubscriptionModal({ isOpen, onClose, planId, checkoutUrl, showName, showPhone, webhookUrl }: SubscriptionModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email) {
            setError('O e-mail é obrigatório.');
            return;
        }

        setLoading(true);

        try {
            // Salva o lead no Supabase
            const { error: insertError } = await supabase
                .from('leads')
                .insert([{
                    name: showName ? name : null,
                    email,
                    phone: showPhone ? phone : null,
                    plan_id: planId
                }]);

            if (insertError) throw insertError;

            // Trigger Webhook if configured
            if (webhookUrl) {
                try {
                    await fetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name: showName ? name : null,
                            email,
                            phone: showPhone ? phone : null,
                            plan_id: planId,
                            timestamp: new Date().toISOString()
                        }),
                    });
                } catch (webhookError) {
                    // Silently fail webhook so it doesn't block the checkout redirect
                    console.error('Erro ao enviar webhook:', webhookError);
                }
            }

            // Redireciona para o checkout do Kiwify ou equivalente
            window.location.href = checkoutUrl;

        } catch (err: any) {
            console.error('Erro ao salvar lead:', err);
            setError('Ocorreu um erro ao processar seu pedido. Tente novamente.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-border-dark bg-surface-highlight/30">
                    <div>
                        <h3 className="text-xl font-bold text-white">Quase lá!</h3>
                        <p className="text-text-secondary text-sm mt-1">Preencha seus dados para acessar o checkout.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center">
                            {error}
                        </div>
                    )}

                    {showName && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-neutral-300">Nome Completo</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                placeholder="João da Silva"
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-neutral-300">E-mail</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            placeholder="joao@email.com"
                        />
                    </div>

                    {showPhone && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-neutral-300">WhatsApp</label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-primary text-background-dark font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-opacity-90 disabled:opacity-70 transition-all shadow-[0_0_20px_rgba(242,162,13,0.3)] hover:shadow-[0_0_25px_rgba(242,162,13,0.5)]"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            'Ir para o Pagamento Segura →'
                        )}
                    </button>

                    <p className="text-center text-xs text-text-secondary mt-2 flex items-center justify-center gap-1">
                        🔒 Seus dados estão seguros.
                    </p>
                </form>
            </div>
        </div>
    );
}
