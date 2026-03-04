import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, CreditCard, Users, UserPlus, Globe } from 'lucide-react';

const adminTabs = [
    { path: '/admin/overview', icon: LayoutDashboard, label: 'Visão Geral' },
    { path: '/admin/settings', icon: Settings, label: 'Formulário' },
    { path: '/admin/seo', icon: Globe, label: 'Link Preview' },
    { path: '/admin/plans', icon: CreditCard, label: 'Planos' },
    { path: '/admin/status', icon: Settings, label: 'Gestão de Status' },
    { path: '/admin/users', icon: Users, label: 'Usuários' },
    { path: '/admin/leads', icon: UserPlus, label: 'Leads' },
];

export function AdminLayout() {
    const location = useLocation();

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <header className="flex justify-between items-center bg-surface-dark p-6 rounded-2xl border border-border-dark">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Painel Administrativo</h1>
                    <p className="text-text-secondary text-sm">Gerencie configurações, planos, usuários e leads.</p>
                </div>
            </header>

            {/* Tab Bar */}
            <nav className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {adminTabs.map(tab => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <NavLink
                            key={tab.path}
                            to={tab.path}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-medium transition-all ${isActive
                                ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
                                : 'bg-surface-dark text-text-secondary border border-border-dark hover:bg-surface-highlight hover:text-white'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Active Tab Content */}
            <Outlet />
        </div>
    );
}
