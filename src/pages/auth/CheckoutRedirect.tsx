import { useState, useEffect } from 'react';
import { CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function CheckoutRedirect() {
    const { signOut } = useAuth();
    const [plans, setPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data } = await supabase
                    .from('plans')
                    .select('*')
                    .eq('is_active', true)
                    .order('price', { ascending: true });
                if (data) setPlans(data);
            } catch (err) {
                console.error("Erro ao buscar planos:", err);
            } finally {
                setLoadingPlans(false);
            }
        };
        fetchData();
    }, []);

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const handleRenew = () => {
        const popularPlan = plans.find(p => p.is_popular) || plans[0];
        if (popularPlan?.checkout_url) {
            window.open(popularPlan.checkout_url, '_blank');
        }
    };

    return (
        <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#18181A] border border-white/10 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-red-500/10 blur-[64px] rounded-full" />

                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 border border-red-500/30">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-2 relative z-10">Assinatura Expirada ou Inválida</h1>
                <p className="text-neutral-400 mb-8 relative z-10">
                    Sua conta não tem uma assinatura ativa vinculada. Renove seu plano para continuar acessando a Análise Avançada de SubIDs.
                </p>

                <div className="space-y-3 relative z-10">
                    <button
                        onClick={handleRenew}
                        disabled={loadingPlans || plans.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-[#f2a20d] hover:bg-[#d98f0a] disabled:opacity-50 text-black font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg"
                    >
                        {loadingPlans ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                        Renovar Assinatura
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-medium text-sm"
                    >
                        Sair da conta
                    </button>
                </div>
            </div>
        </div>
    );
}
