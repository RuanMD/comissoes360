import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

interface PublicLayoutProps {
    children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
    const location = useLocation();
    const isLoginPage = location.pathname === '/login';

    return (
        <div className="min-h-screen bg-[#121212] text-white flex flex-col font-['Manrope',sans-serif]">
            {/* Header da Landing Page / Public */}
            <header className="fixed top-0 w-full z-50 bg-[#121212]/90 backdrop-blur-md border-b border-white/5">
                <div className="w-full max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <FlaskConical className="w-8 h-8 text-[#f2a20d]" />
                        <span className="text-xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                            Comissões Lab
                        </span>
                    </Link>

                    <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
                        <a href="/#recursos" className="hover:text-white transition-colors">Recursos</a>
                        <a href="/#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
                        <a href="/#depoimentos" className="hover:text-white transition-colors">Depoimentos</a>
                        <a href="/#preco" className="hover:text-white transition-colors">Preços</a>
                    </nav>

                    <div className="flex items-center">
                        {!isLoginPage && (
                            <Link
                                to="/login"
                                className="px-6 py-2 rounded-lg bg-[#f2a20d] text-black font-semibold hover:bg-[#d98f0a] transition-all"
                            >
                                Entrar
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content (ocupa o resto da tela) */}
            <main className="flex-1 w-full flex flex-col pt-20">
                {children}
            </main>

            {/* Footer Público Simples */}
            <footer className="border-t border-white/5 bg-[#0a0a0a] py-8">
                <div className="w-full max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-sm text-neutral-500">
                    <div className="flex items-center gap-2 mb-4 md:mb-0">
                        <FlaskConical className="w-5 h-5 text-[#f2a20d]" />
                        <span>Comissões Lab</span>
                    </div>
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <Link to="/privacidade" className="hover:text-neutral-300 transition-colors">Política de Privacidade</Link>
                    </div>
                    <p>© 2026 Comissões Lab. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    );
}
