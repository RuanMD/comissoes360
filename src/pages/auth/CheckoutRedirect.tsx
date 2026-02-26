import { CreditCard, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function CheckoutRedirect() {
    const { signOut } = useAuth();

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

                <div className="space-y-4 relative z-10">
                    <a
                        href="/#preco"
                        className="w-full flex items-center justify-center gap-2 bg-[#f2a20d] hover:bg-[#d98f0a] text-black font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg"
                    >
                        <CreditCard className="w-5 h-5" />
                        Renovar Assinatura
                    </a>
                    <button
                        onClick={signOut}
                        className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
                    >
                        Sair da conta
                    </button>
                </div>
            </div>
        </div>
    );
}
