import {
    BarChart3, Clock, Banknote, FileX2, EyeOff, LayoutDashboard, Zap, Users, ChevronDown, CheckCircle, XCircle,
    Database, TrendingUp, Package, Clapperboard, Target, Link2, Filter, Shield, ArrowRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../lib/supabase';
import { SubscriptionModal } from '../components/SubscriptionModal';

// === DADOS ===

const PROBLEM_POINTS = [
    {
        icon: <FileX2 className="w-6 h-6 text-red-400" />,
        title: "Planilha da Shopee é inútil",
        desc: "O CSV que a Shopee exporta é um amontoado de dados crus. Você abre, olha 500 linhas e não sabe por onde começar a analisar."
    },
    {
        icon: <EyeOff className="w-6 h-6 text-red-400" />,
        title: "Sem saber o que funciona",
        desc: "Você divulga em 10 grupos diferentes mas não faz ideia de qual grupo gerou qual venda. Está investindo tempo no escuro."
    },
    {
        icon: <Clock className="w-6 h-6 text-red-400" />,
        title: "Horas perdidas no Excel",
        desc: "Tentando cruzar dados manualmente, criando fórmulas mirabolantes, para no final ainda não ter clareza real sobre seus resultados."
    },
    {
        icon: <Banknote className="w-6 h-6 text-red-400" />,
        title: "Lucro invisível",
        desc: "Você fatura mas não sabe quanto sobra depois de cancelamentos. Não sabe se o tráfego pago está dando ROI positivo ou negativo."
    }
];

const ESSENTIAL_FEATURES = [
    {
        icon: <LayoutDashboard className="w-6 h-6 text-[#f2a20d]" />,
        title: "Dashboard Completo",
        desc: "Visão geral instantânea: comissões, pedidos, ticket médio, taxa de conversão e tendências. Tudo num só lugar."
    },
    {
        icon: <Database className="w-6 h-6 text-[#f2a20d]" />,
        title: "Análise por SubID",
        desc: "Descubra exatamente qual link gerou cada venda. Identifique os grupos de WhatsApp, canais do Telegram ou campanhas que realmente convertem."
    },
    {
        icon: <TrendingUp className="w-6 h-6 text-[#f2a20d]" />,
        title: "Performance por Canal",
        desc: "Compare seus canais de divulgação lado a lado. Veja cliques, conversões e comissão de cada um para saber onde focar."
    },
    {
        icon: <Package className="w-6 h-6 text-[#f2a20d]" />,
        title: "Ranking de Produtos",
        desc: "Quais produtos mais vendem? Quais dão mais comissão? Pare de divulgar produto que ninguém compra."
    },
    {
        icon: <BarChart3 className="w-6 h-6 text-[#f2a20d]" />,
        title: "Análise Temporal",
        desc: "Descubra os dias da semana e horários de pico. Poste nos momentos certos e veja suas conversões dispararem."
    },
    {
        icon: <Users className="w-6 h-6 text-[#f2a20d]" />,
        title: "Diretas vs Indiretas",
        desc: "Saiba quanto vem do produto que você divulgou vs cross-selling. Entenda o real impacto de cada link compartilhado."
    },
    {
        icon: <Filter className="w-6 h-6 text-[#f2a20d]" />,
        title: "Relatório Avançado",
        desc: "Filtre por período, canal, SubID e status. Exporte os dados que importam e tome decisões com base em números reais."
    }
];

const ADVANCED_FEATURES = [
    {
        icon: <Clapperboard className="w-6 h-6 text-[#f2a20d]" />,
        title: "Criativo Track",
        desc: "Rastreie seus criativos automaticamente e descubra qual abordagem de conteúdo gera mais vendas. Se você faz tráfego com a Meta para a Shopee, a plataforma puxa as métricas e vincula ao produto — sem preencher planilha nenhuma."
    },
    {
        icon: <Target className="w-6 h-6 text-[#f2a20d]" />,
        title: "Gestão de Funil",
        desc: "Monte funis de conversão personalizados. Acompanhe cada etapa do processo e identifique exatamente onde você está perdendo vendas para otimizar sua estratégia."
    },
    {
        icon: <Link2 className="w-6 h-6 text-[#f2a20d]" />,
        title: "Gerador de Links",
        desc: "Gere links de afiliado com SubIDs personalizados em segundos. Integração direta com a API Shopee, sem sair da plataforma."
    }
];

const FAQS = [
    { q: "Preciso dar minha senha da Shopee?", a: "Jamais! No plano Essencial, você apenas faz upload do CSV que já baixou da Shopee. No plano Avançado, usamos a API oficial com suas credenciais de desenvolvedor (App ID e Secret), nunca sua senha pessoal." },
    { q: "Em quanto tempo vejo resultados?", a: "Em literalmente 30 segundos após o upload. Seus dashboards são gerados instantaneamente. Muitos afiliados descobrem na primeira análise que estavam investindo tempo em canais que não convertem." },
    { q: "Qual a diferença entre o Essencial e o Avançado?", a: "O Essencial te dá análise completa via upload de CSV: dashboard, SubIDs, canais, produtos, temporal e mais. O Avançado elimina o CSV — a plataforma sincroniza suas vendas automaticamente via API da Shopee. Além disso, se você faz tráfego pago com a Meta (Facebook/Instagram Ads), o Criativo Track puxa suas métricas e vincula ao produto automaticamente. Também inclui gestão de funil e gerador de links." },
    { q: "Posso cancelar a qualquer momento?", a: "Sim! Sem contratos, sem fidelidade, sem burocracia. Cancele direto pela plataforma de pagamento. E você ainda tem 7 dias de garantia incondicional — se não gostar, devolvemos 100% do valor." },
    { q: "Funciona para quem está começando?", a: "Com certeza. Se você já tem pelo menos um relatório CSV da Shopee, já consegue extrair insights valiosos. A ferramenta foi feita para ser simples: não precisa de conhecimento técnico." },
    { q: "Os dados são seguros?", a: "Totalmente. Seus dados são privados, criptografados e nunca compartilhados com terceiros. Cada usuário só vê seus próprios dados. Usamos infraestrutura de nível empresarial." }
];

const COMPARISON_FEATURES = [
    { name: "Dashboard completo", essential: true, advanced: true },
    { name: "Análise por SubID", essential: true, advanced: true },
    { name: "Performance por Canal", essential: true, advanced: true },
    { name: "Ranking de Produtos", essential: true, advanced: true },
    { name: "Análise Temporal (horários e dias)", essential: true, advanced: true },
    { name: "Diretas vs Indiretas", essential: true, advanced: true },
    { name: "Relatório com filtros avançados", essential: true, advanced: true },
    { name: "Sync automático com API Shopee", essential: false, advanced: true },
    { name: "Integração Meta Ads (Facebook)", essential: false, advanced: true },
    { name: "Criativo Track", essential: false, advanced: true },
    { name: "Gestão de Funil", essential: false, advanced: true },
    { name: "Gerador de Links com SubID", essential: false, advanced: true },
];

function FAQAccordion() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="w-full max-w-3xl mx-auto space-y-4">
            {FAQS.map((faq, i) => (
                <div key={i} className="border border-white/10 rounded-xl overflow-hidden bg-[#18181A] transition-all duration-200">
                    <button
                        className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                        onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    >
                        <span className="font-medium text-lg text-white">{faq.q}</span>
                        <ChevronDown className={`w-5 h-5 flex-shrink-0 text-neutral-500 transition-transform ${openIndex === i ? 'rotate-180 text-[#f2a20d]' : ''}`} />
                    </button>
                    {openIndex === i && (
                        <div className="px-6 pb-6 text-neutral-400 leading-relaxed border-t border-white/5 pt-4">
                            {faq.a}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// === PÁGINA PRINCIPAL ===

export function LandingPage() {
    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [selectedCheckoutUrl, setSelectedCheckoutUrl] = useState('');

    useEffect(() => {
        const fetchLandingData = async () => {
            try {
                const [settingsRes, plansRes] = await Promise.all([
                    supabase.from('app_settings').select('*').limit(1).single(),
                    supabase.from('plans').select('*').eq('is_active', true).order('price', { ascending: true })
                ]);

                if (settingsRes.data) setSettings(settingsRes.data);
                if (plansRes.data) setPlans(plansRes.data);
            } catch (error) {
                console.error("Erro ao carregar dados da LP:", error);
            }
        };

        fetchLandingData();
    }, []);

    const handleSubscribeClick = (planId: string, checkoutUrl: string) => {
        setSelectedPlanId(planId);
        setSelectedCheckoutUrl(checkoutUrl);
        setIsModalOpen(true);
    };

    const whatsappLink = settings?.whatsapp_number
        ? `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(settings.whatsapp_message || '')}`
        : '#';

    return (
        <div className="w-full overflow-x-hidden">
            <Helmet>
                <title>Comissões Lab | Ferramenta de Análise para Afiliados Shopee</title>
                <meta name="description" content="A ferramenta definitiva para afiliados Shopee. Descubra quais SubIDs dão lucro, analise vendas por hora e tracking de canais em tempo real." />
                <link rel="canonical" href="https://www.comissoeslab.com.br/" />
                <meta name="robots" content="index, follow" />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="Comissões Lab | Ferramenta de Análise para Afiliados Shopee" />
                <meta property="og:description" content="Saiba exatamente de onde vêm suas vendas na Shopee com rastreamento por SubID e Canais." />
                <meta property="og:url" content="https://www.comissoeslab.com.br/" />
                <meta property="og:image" content="https://www.comissoeslab.com.br/icons/pwa-512x512.png" />
                <meta property="og:locale" content="pt_BR" />
                <meta property="og:site_name" content="Comissões Lab" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Comissões Lab | Ferramenta de Análise para Afiliados Shopee" />
                <meta name="twitter:description" content="Saiba exatamente de onde vêm suas vendas na Shopee com rastreamento por SubID e Canais." />
                <meta name="twitter:image" content="https://www.comissoeslab.com.br/icons/pwa-512x512.png" />
            </Helmet>

            {/* ============ HERO ============ */}
            <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-40 px-4 w-full flex justify-center items-center min-h-[90vh]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#f2a20d]/10 via-[#121212]/0 to-[#121212] -z-10" />

                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8 text-center lg:text-left z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f2a20d]/30 bg-[#f2a20d]/10 text-[#f2a20d] text-sm font-semibold mb-2">
                            <Zap className="w-4 h-4" /> +10 dashboards de análise
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                            Pare de <span className="text-[#f2a20d]">adivinhar</span> e comece a lucrar de verdade
                        </h1>

                        <p className="text-lg lg:text-xl text-neutral-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                            A única ferramenta que transforma o CSV caótico da Shopee em dashboards que mostram <strong className="text-white">exatamente</strong> quais links, canais e produtos te dão dinheiro — e quais estão te fazendo perder tempo.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                            <a href="#preco" className="px-8 py-4 w-full sm:w-auto rounded-xl bg-[#f2a20d] hover:bg-[#d98f0a] text-black font-bold text-lg transition-all shadow-[0_0_30px_rgba(242,162,13,0.3)] hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-2">
                                Quero ver meus números reais <ArrowRight className="w-5 h-5" />
                            </a>
                            <a href="#como-funciona" className="px-8 py-4 w-full sm:w-auto rounded-xl border border-white/10 hover:bg-white/5 text-white font-semibold text-lg transition-all text-center">
                                Como funciona?
                            </a>
                        </div>

                        <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-neutral-500">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-500" />
                                <span>7 dias de garantia</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Cancele quando quiser</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-green-500" />
                                <span>Setup em 30 segundos</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 hidden lg:block perspective-[1000px]">
                        <div className="w-full aspect-[16/10] bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-2xl p-4 transform rotate-y-[-12deg] rotate-x-[5deg] transition-transform duration-500 hover:rotate-0 hover:scale-105">
                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="h-24 bg-white/5 rounded-lg border border-white/5 p-4 flex flex-col justify-end">
                                    <span className="text-sm text-neutral-500 block">Total Comissões</span>
                                    <span className="text-2xl font-bold text-white">R$ 4.250,90</span>
                                </div>
                                <div className="h-24 bg-white/5 rounded-lg border border-white/5 p-4 flex flex-col justify-end">
                                    <span className="text-sm text-neutral-500 block">Conversões</span>
                                    <span className="text-2xl font-bold text-white">482</span>
                                </div>
                                <div className="h-24 bg-[#f2a20d]/10 border border-[#f2a20d]/20 rounded-lg p-4 flex flex-col justify-end">
                                    <span className="text-sm text-[#f2a20d] block">Melhor SubID</span>
                                    <span className="text-lg font-bold text-white truncate">grupo-promo-vip</span>
                                </div>
                            </div>
                            <div className="w-full h-48 bg-gradient-to-t from-[#f2a20d]/20 to-transparent rounded-b-lg border-b-2 border-[#f2a20d] relative mt-12">
                                <div className="absolute bottom-4 left-4 w-1/4 h-1/2 bg-[#f2a20d]/40 rounded-t" />
                                <div className="absolute bottom-4 left-1/3 w-1/6 h-3/4 bg-[#f2a20d]/60 rounded-t" />
                                <div className="absolute bottom-4 left-[60%] w-1/5 h-full bg-[#f2a20d] rounded-t shadow-[0_0_20px_rgba(242,162,13,0.5)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============ PROBLEMA ============ */}
            <section className="py-24 bg-black/40 border-y border-white/5" id="problema">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid lg:grid-cols-3 gap-16">
                        <div className="lg:col-span-1">
                            <span className="text-red-400 font-bold tracking-widest text-sm uppercase mb-4 block">O problema</span>
                            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">Você está lucrando menos do que deveria</h2>
                            <p className="text-lg text-neutral-400">
                                A Shopee não te dá as ferramentas certas para analisar seus resultados. Você trabalha muito, mas não sabe onde está o dinheiro de verdade.
                            </p>
                        </div>
                        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                            {PROBLEM_POINTS.map((item, idx) => (
                                <div key={idx} className="bg-[#18181A] border border-white/5 p-8 rounded-2xl hover:border-red-500/30 transition-colors">
                                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6">
                                        {item.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                    <p className="text-neutral-400 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ============ FEATURES ESSENCIAL ============ */}
            <section className="py-24" id="recursos">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Plano Essencial</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">7 ferramentas que transformam seus dados</h2>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-16">
                        Faça upload do seu CSV da Shopee e tenha acesso instantâneo a dashboards que nenhuma planilha consegue te dar.
                    </p>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {ESSENTIAL_FEATURES.map((item, idx) => (
                            <div key={idx} className="bg-[#18181A] border border-white/5 p-8 rounded-2xl group hover:bg-[#1C1C1E] hover:border-white/10 transition-all duration-300">
                                <div className="w-12 h-12 bg-[#f2a20d]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                <p className="text-neutral-400 leading-relaxed text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============ FEATURES AVANÇADO ============ */}
            <section className="py-24 bg-gradient-to-b from-[#121212] via-[#f2a20d]/[0.03] to-[#121212] border-y border-white/5" id="avancado">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Plano Avançado</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Para quem quer escalar sem limites</h2>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-16">
                        Tudo do Essencial + integração direta com a API Shopee para automação total. Sem CSV, sem trabalho manual.
                    </p>

                    <div className="grid sm:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
                        {ADVANCED_FEATURES.map((item, idx) => (
                            <div key={idx} className="bg-[#18181A] border border-[#f2a20d]/20 p-8 rounded-2xl group hover:bg-[#1C1C1E] hover:border-[#f2a20d]/40 transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#f2a20d]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <div className="relative">
                                    <div className="w-12 h-12 bg-[#f2a20d]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        {item.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                    <p className="text-neutral-400 leading-relaxed text-sm">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============ COMO FUNCIONA ============ */}
            <section className="py-24" id="como-funciona">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Simples assim</span>
                    <h2 className="text-4xl font-bold text-white mb-16">Comece a analisar em 3 passos</h2>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-[#f2a20d]/20 to-transparent z-0" />

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-[#18181A] border border-white/10 flex items-center justify-center text-2xl font-black text-white mb-6 shadow-xl">
                                1
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Exporte da Shopee</h3>
                            <p className="text-neutral-400 text-sm">Baixe o relatório de pedidos (CSV) no painel da Shopee. Leva 10 segundos.</p>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-[#f2a20d] border border-[#f2a20d] flex items-center justify-center text-2xl font-black text-black mb-6 shadow-[0_0_20px_rgba(242,162,13,0.3)]">
                                2
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Faça o Upload</h3>
                            <p className="text-neutral-400 text-sm">Arraste o arquivo para o sistema. Sem configurar nada, sem mapear colunas. Só jogar e pronto.</p>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-[#18181A] border border-white/10 flex items-center justify-center text-2xl font-black text-white mb-6 shadow-xl">
                                3
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Tome Decisões Lucrativas</h3>
                            <p className="text-neutral-400 text-sm">Seus dashboards aparecem instantaneamente. Agora você sabe onde investir seu tempo e dinheiro.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============ COMPARAÇÃO DE PLANOS ============ */}
            <section className="py-24 bg-black/40 border-y border-white/5" id="comparar">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Compare</span>
                        <h2 className="text-4xl font-bold text-white mb-4">Essencial vs Avançado</h2>
                        <p className="text-neutral-400">Escolha o plano que faz sentido para o seu momento.</p>
                    </div>

                    <div className="bg-[#18181A] border border-white/10 rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-3 gap-0 border-b border-white/10">
                            <div className="p-6 text-sm font-bold text-neutral-500 uppercase tracking-wider">Recurso</div>
                            <div className="p-6 text-sm font-bold text-white text-center uppercase tracking-wider border-x border-white/5">Essencial</div>
                            <div className="p-6 text-sm font-bold text-[#f2a20d] text-center uppercase tracking-wider">Avançado</div>
                        </div>
                        {/* Rows */}
                        {COMPARISON_FEATURES.map((feat, idx) => (
                            <div key={idx} className={`grid grid-cols-3 gap-0 ${idx < COMPARISON_FEATURES.length - 1 ? 'border-b border-white/5' : ''}`}>
                                <div className="p-4 px-6 text-sm text-neutral-300 flex items-center">{feat.name}</div>
                                <div className="p-4 flex items-center justify-center border-x border-white/5">
                                    {feat.essential
                                        ? <CheckCircle className="w-5 h-5 text-green-500" />
                                        : <XCircle className="w-5 h-5 text-neutral-700" />
                                    }
                                </div>
                                <div className="p-4 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-[#f2a20d]" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-8">
                        <a href="#preco" className="inline-flex items-center gap-2 text-[#f2a20d] font-semibold hover:underline">
                            Ver preços <ArrowRight className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </section>

            {/* ============ PREÇO ============ */}
            <section className="py-24 relative" id="preco">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#f2a20d]/5 via-[#121212] to-[#121212] -z-10" />

                <div className="max-w-7xl mx-auto px-4 text-center">
                    <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Investimento</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Quanto custa ter clareza total?</h2>
                    <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-16">
                        Menos do que você perde por mês divulgando produtos e canais que não convertem.
                    </p>

                    <div className="flex flex-wrap justify-center gap-8">
                        {plans.map((plan) => (
                            <div key={plan.id} className="w-full max-w-md relative group">
                                {plan.is_popular && (
                                    <div className="absolute -inset-1 bg-gradient-to-r from-[#f2a20d]/40 to-[#d98f0a]/40 rounded-[2rem] blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                                )}

                                <div className="relative bg-[#18181A] border border-white/10 p-10 rounded-3xl text-left flex flex-col h-full shadow-2xl">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                                            <p className="text-neutral-400 text-sm">{plan.description}</p>
                                        </div>
                                        {plan.is_popular && (
                                            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-black bg-[#f2a20d] rounded-full whitespace-nowrap">Mais Popular</span>
                                        )}
                                    </div>

                                    <div className="mb-8 flex items-baseline text-white">
                                        <span className="text-5xl font-extrabold tracking-tight">
                                            R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="ml-2 text-xl font-medium text-neutral-400">{plan.period}</span>
                                    </div>

                                    <button
                                        onClick={() => handleSubscribeClick(plan.id, plan.checkout_url)}
                                        className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-lg mb-8 transition-all ${plan.is_popular
                                            ? 'bg-[#f2a20d] hover:bg-[#d98f0a] text-black shadow-[0_0_20px_rgba(242,162,13,0.2)]'
                                            : 'bg-white/10 hover:bg-white/20 text-white'
                                            }`}
                                    >
                                        Começar Agora <ArrowRight className="w-5 h-5" />
                                    </button>

                                    <div className="space-y-4 flex-1">
                                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 block">O QUE ESTÁ INCLUÍDO:</span>
                                        {plan.features?.map((feature: string, idx: number) => (
                                            <div key={idx} className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    <CheckCircle className="w-5 h-5 text-[#f2a20d]" />
                                                </div>
                                                <span className="text-neutral-300">{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-2 text-sm text-neutral-500">
                                        <Shield className="w-4 h-4" />
                                        <span>7 dias de garantia incondicional</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {plans.length === 0 && (
                            <div className="text-neutral-400 text-center w-full">Carregando planos...</div>
                        )}
                    </div>
                </div>
            </section>

            {/* ============ FAQ ============ */}
            <section className="py-24 bg-black/40 border-t border-white/5" id="faq">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-4">Perguntas Frequentes</h2>
                        <p className="text-neutral-400">Tire suas dúvidas antes de começar.</p>
                    </div>

                    <FAQAccordion />
                </div>
            </section>

            {/* ============ CTA FINAL ============ */}
            <section className="py-32 relative overflow-hidden border-t border-white/10">
                <div className="absolute inset-x-0 bottom-0 h-full bg-[#f2a20d]/5" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />

                <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tight">
                        Cada dia sem dados é dinheiro que você <span className="text-[#f2a20d]">deixa na mesa</span>
                    </h2>
                    <p className="text-xl text-neutral-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Enquanto você adivinha, afiliados com dados reais estão escalando as campanhas certas e faturando mais. A diferença entre um afiliado que cresce e um que estagna é informação.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="#preco" className="w-full sm:w-auto px-10 py-5 rounded-xl bg-[#f2a20d] hover:bg-[#d98f0a] text-black font-bold text-lg transition-all shadow-[0_0_40px_rgba(242,162,13,0.4)] flex items-center justify-center gap-2">
                            Quero tomar decisões com dados <ArrowRight className="w-5 h-5" />
                        </a>
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-10 py-5 rounded-xl border border-white/20 hover:bg-white/5 text-white font-bold text-lg transition-all flex items-center justify-center"
                        >
                            Falar no WhatsApp
                        </a>
                    </div>
                    <p className="mt-6 text-sm text-neutral-500">Garantia de 7 dias. Não gostou? Devolvemos 100% do valor. Sem perguntas.</p>
                </div>
            </section>

            <SubscriptionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                planId={selectedPlanId}
                checkoutUrl={selectedCheckoutUrl}
                showName={settings?.show_name_field ?? true}
                showPhone={settings?.show_phone_field ?? true}
                webhookUrl={settings?.webhook_url}
            />
        </div>
    );
}
