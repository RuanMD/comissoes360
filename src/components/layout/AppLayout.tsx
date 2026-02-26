import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Upload, LayoutDashboard, Database, TrendingUp, BarChart3, Moon, Package, LogOut, Settings } from 'lucide-react';

interface AppLayoutProps {
    children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const { handleFileUpload } = useData();
    const { user, signOut, isAdmin } = useAuth();
    const location = useLocation();

    const navItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/sub-id', icon: Database, label: 'Origens (Sub_ID)' },
        { path: '/canais', icon: TrendingUp, label: 'Canais' },
        { path: '/produtos', icon: Package, label: 'Produtos' },
        { path: '/temporal', icon: BarChart3, label: 'Temporal' },
        { path: '/diretas-vs-indiretas', icon: Moon, label: 'Diretas x Indiretas' },
    ];

    const isCurrent = (path: string) => location.pathname === path;

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark text-white font-sans antialiased text-base">
            {/* Sidebar Desktop */}
            <div className="hidden md:flex flex-col w-72 bg-surface-dark border-r border-border-dark h-full justify-between p-4">
                <div className="flex flex-col gap-6">
                    {/* User Profile Mock & Logout */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-highlight/50 border border-border-dark">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                CI
                            </div>
                            <div className="flex flex-col overflow-hidden max-w-[120px]">
                                <h1 className="text-white text-sm font-bold leading-tight truncate">
                                    {user?.email ? user.email.split('@')[0] : 'Comissões 360'}
                                </h1>
                                <p className="text-text-secondary text-xs font-normal leading-normal truncate">Dashboard 2.0</p>
                            </div>
                        </div>
                        <button
                            onClick={signOut}
                            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Sair"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive
                                        ? 'bg-primary text-background-dark shadow-lg shadow-primary/20 hover:shadow-primary/40'
                                        : 'text-text-secondary hover:bg-surface-highlight hover:text-white'
                                    }`
                                }
                            >
                                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isCurrent(item.path) ? 'text-background-dark' : ''}`} />
                                <span className={`text-sm ${isCurrent(item.path) ? 'font-bold' : 'font-medium'}`}>
                                    {item.label}
                                </span>
                            </NavLink>
                        ))}

                        {isAdmin && (
                            <NavLink
                                to="/admin"
                                className={() => {
                                    const active = location.pathname.startsWith('/admin');
                                    return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all group mt-4 border border-dashed border-primary/30 ${active
                                        ? 'bg-primary/10 text-primary shadow-lg shadow-primary/5'
                                        : 'text-[#f2a20d] hover:bg-[#f2a20d]/10'
                                    }`;
                                }}
                            >
                                <Settings className="w-5 h-5 transition-transform group-hover:rotate-90" />
                                <span className={`text-sm ${location.pathname.startsWith('/admin') ? 'font-bold' : 'font-medium'}`}>
                                    Painel Admin
                                </span>
                            </NavLink>
                        )}
                    </nav>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">

                {/* Mobile Header (replaces sidebar on small screens) */}
                <div className="md:hidden flex items-center justify-between p-4 border-b border-border-dark bg-surface-dark">
                    <div className="flex items-center gap-2 font-bold text-primary">
                        <LayoutDashboard className="w-5 h-5" />
                        Comissões 2.0
                    </div>
                    <label className="flex items-center justify-center size-9 rounded-lg bg-primary text-background-dark shadow-lg">
                        <Upload className="w-4 h-4" />
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                    </label>
                </div>

                {/* Mobile Nav Scroll (simplistic for Mobile-First PRD rules) */}
                <div className="md:hidden overflow-x-auto flex items-center gap-2 p-3 bg-background-dark border-b border-border-dark hide-scrollbar">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold ${isActive
                                    ? 'bg-primary text-background-dark'
                                    : 'bg-surface-highlight text-text-secondary border border-border-dark'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                    {isAdmin && (
                        <NavLink
                            to="/admin"
                            className={() => {
                                const active = location.pathname.startsWith('/admin');
                                return `flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold ${active
                                    ? 'bg-[#f2a20d]/20 text-[#f2a20d] border border-[#f2a20d]/50'
                                    : 'bg-surface-highlight text-[#f2a20d] border border-dashed border-[#f2a20d]/30'
                                }`;
                            }}
                        >
                            Admin
                        </NavLink>
                    )}
                </div>

                {/* Page Content Scrollable Area */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth w-full max-w-full">
                    <div className="w-full max-w-7xl mx-auto min-w-0">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
