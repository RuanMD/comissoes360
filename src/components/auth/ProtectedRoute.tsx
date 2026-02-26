import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
    const { session, loading, subscriptionStatus, mustChangePassword } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#1E1E1E]">
                <Loader2 className="h-8 w-8 text-[#FF5722] animate-spin" />
            </div>
        );
    }

    if (!session) {
        // Usuário não logado
        return <Navigate to="/login" replace />;
    }

    // O redirect local ainda é suportado, mas agora temos verificação do BD
    const localMustReset = localStorage.getItem('mustReset') === 'true';
    const isResetPage = location.pathname === '/reset-password';

    if ((localMustReset || mustChangePassword) && !isResetPage) {
        return <Navigate to="/reset-password" replace />;
    }

    if (subscriptionStatus === 'expired') {
        // Assinatura expirada
        return <Navigate to="/checkout" replace />; // ou exibir um bloqueio na tela
    }

    // Acesso permitido
    return <Outlet />;
}

export function PublicOnlyRoute() {
    const { session, loading } = useAuth();

    if (loading) return null; // ou um loader

    if (session) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

export function AdminRoute() {
    const { session, loading, isAdmin, mustChangePassword } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#1E1E1E]">
                <Loader2 className="h-8 w-8 text-[#FF5722] animate-spin" />
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // O redirect local ainda é suportado, mas agora temos verificação do BD
    const localMustReset = localStorage.getItem('mustReset') === 'true';

    if (localMustReset || mustChangePassword) {
        return <Navigate to="/reset-password" replace />;
    }

    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
