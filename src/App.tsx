import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { ProtectedRoute, PublicOnlyRoute, AdminRoute, FeatureGuard } from './components/auth/ProtectedRoute';

// Páginas Seguras
import { Dashboard } from './pages/Dashboard';
import { SubIdAnalysis } from './pages/SubIdAnalysis';
import { Channels } from './pages/Channels';
import { Products } from './pages/Products';
import { TemporalAnalysis } from './pages/TemporalAnalysis';
import { DirectsVsIndirects } from './pages/DirectsVsIndirects';
import { FunnelAnalysis } from './pages/FunnelAnalysis';
import { CreativeTrack } from './pages/CreativeTrack';
import { FunnelBuilder } from './pages/FunnelBuilder';
import { LinkGenerator } from './pages/LinkGenerator';

// Admin
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminSeoSettings } from './pages/admin/AdminSeoSettings';
import { AdminPlans } from './pages/admin/AdminPlans';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminLeads } from './pages/admin/AdminLeads';

// Páginas Públicas & Auth
import { Login } from './pages/auth/Login';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { CheckoutRedirect } from './pages/auth/CheckoutRedirect';
import { LandingPage } from './pages/LandingPage';
import { useSiteSettings } from './hooks/useSiteSettings';

function SiteHead() {
    useSiteSettings();
    return null;
}

export default function App() {
    return (
        <AuthProvider>
            <SiteHead />
            <ToastProvider>
                <DataProvider>
                    <BrowserRouter>
                        <Routes>
                            {/* Rotas Públicas */}
                            <Route element={<PublicLayout><PublicOnlyRoute /></PublicLayout>}>
                                <Route path="/" element={<LandingPage />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/forgot-password" element={<ForgotPassword />} />
                            </Route>

                            {/* Rota Específica para Falha de Assinatura */}
                            <Route path="/checkout" element={<CheckoutRedirect />} />

                            {/* Rotas Privadas (Dashboard) */}
                            <Route element={<ProtectedRoute />}>
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route element={<AppLayout><Outlet /></AppLayout>}>
                                    <Route path="/dashboard" element={<FeatureGuard><Dashboard /></FeatureGuard>} />
                                    <Route path="/relatorio" element={<FeatureGuard><FunnelAnalysis /></FeatureGuard>} />
                                    <Route path="/funil" element={<FeatureGuard><FunnelBuilder /></FeatureGuard>} />
                                    <Route path="/sub-id" element={<FeatureGuard><SubIdAnalysis /></FeatureGuard>} />
                                    <Route path="/canais" element={<FeatureGuard><Channels /></FeatureGuard>} />
                                    <Route path="/produtos" element={<FeatureGuard><Products /></FeatureGuard>} />
                                    <Route path="/temporal" element={<FeatureGuard><TemporalAnalysis /></FeatureGuard>} />
                                    <Route path="/diretas-vs-indiretas" element={<FeatureGuard><DirectsVsIndirects /></FeatureGuard>} />
                                    <Route path="/criativo-track" element={<FeatureGuard><CreativeTrack /></FeatureGuard>} />
                                    <Route path="/gerador-links" element={<FeatureGuard><LinkGenerator /></FeatureGuard>} />
                                </Route>
                            </Route>

                            {/* Rotas Privadas (Admin) */}
                            <Route element={<AdminRoute />}>
                                <Route element={<AppLayout><Outlet /></AppLayout>}>
                                    <Route path="/admin" element={<AdminLayout />}>
                                        <Route index element={<Navigate to="/admin/overview" replace />} />
                                        <Route path="overview" element={<AdminOverview />} />
                                        <Route path="settings" element={<AdminSettings />} />
                                        <Route path="seo" element={<AdminSeoSettings />} />
                                        <Route path="plans" element={<AdminPlans />} />
                                        <Route path="users" element={<AdminUsers />} />
                                        <Route path="leads" element={<AdminLeads />} />
                                    </Route>
                                </Route>
                            </Route>

                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </DataProvider>
            </ToastProvider>
        </AuthProvider>
    );
}
