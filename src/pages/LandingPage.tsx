import {
    BarChart3, Clock, LineChart, Banknote, FileX2, EyeOff, LayoutDashboard, Zap, Users, ChevronDown, CheckCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SubscriptionModal } from '../components/SubscriptionModal';

// === DADOS MOCKADOS E COMPONENTES AUXILIARES ===

const PROBLEM_POINTS = [
    {
        icon: <FileX2 className="w-6 h-6 text-red-400" />,
        title: "Relatórios Confusos",
        desc: "Planilhas intermináveis que não dizem onde está o lucro real e misturam dados irrelevantes."
    },
    {
        icon: <Clock className="w-6 h-6 text-red-400" />,
        title: "Perda de Tempo",
        desc: "Horas gastas tentando cruzar dados manualmente no Excel sem sucesso."
    },
    {
        icon: <EyeOff className="w-6 h-6 text-red-400" />,
        title: "Links sem Rastreio",
        desc: "Você espalha links em grupos mas não sabe qual grupo gerou a venda específica."
    },
    {
        icon: <Banknote className="w-6 h-6 text-red-400" />,
        title: "Dinheiro na Mesa",
        desc: "Investindo em tráfego pago para produtos que não convertem e você nem sabe."
    }
];

const SOLUTION_POINTS = [
    { icon: <LayoutDashboard className="w-6 h-6 text-[#f2a20d]" />, title: "Análise por SubID", desc: "Saiba exatamente qual link gerou a venda. Identifique grupos de WhatsApp, canais ou campanhas vencedoras." },
    { icon: <Clock className="w-6 h-6 text-[#f2a20d]" />, title: "Vendas por Hora", desc: "Descubra os horários de pico da sua audiência para programar postagens nos momentos de maior conversão." },
    { icon: <BarChart3 className="w-6 h-6 text-[#f2a20d]" />, title: "Ranking de Produtos", desc: "Veja quais produtos estão vendendo mais e foque seus esforços no que realmente traz retorno financeiro." },
    { icon: <LineChart className="w-6 h-6 text-[#f2a20d]" />, title: "Conversão Real por Canal", desc: "Pare de adivinhar. Veja métricas exatas de clique para compra de cada um dos seus canais de divulgação." },
    { icon: <Banknote className="w-6 h-6 text-[#f2a20d]" />, title: "Comissão Líquida Consolidada", desc: "Acompanhe seus ganhos reais, já descontando compras canceladas ou com falhas de pagamento." },
    { icon: <Users className="w-6 h-6 text-[#f2a20d]" />, title: "Diretas vs Indiretas", desc: "Descubra quanto da sua comissão vem de cross-selling vs vendas diretas do link original que você divulgou." }
];

const FAQS = [
    { q: "Como faço para importar minhas planilhas?", a: "É extremamente simples. Basta baixar o relatório oficial em '.csv' fornecido pelo painel de afiliados da Shopee e fazer o upload diretamente no nosso sistema. Nós processamos o resto em segundos." },
    { q: "O sistema é seguro?", a: "Sim! Não pedimos sua senha da Shopee. Nós apenas lemos o arquivo CSV que você mesmo já baixou, transformando dados mortos em dashboards interativos. Seus dados são privados e não são compartilhados." },
    { q: "Posso cancelar a qualquer momento?", a: "Sim, não há contratos de fidelidade. Você pode assinar e cancelar diretamente pela plataforma de pagamentos sem nenhuma burocracia." },
    { q: "Existe um período de teste gratuito?", a: "Você tem 7 dias de garantia incondicional após a assinatura. Se a ferramenta não te trouxer mais clareza sobre suas vendas, nós devolvemos 100% do seu dinheiro, sem perguntas." }
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
                        <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform ${openIndex === i ? 'rotate-180 text-[#f2a20d]' : ''}`} />
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

    // Modal state
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

            {/* 1ª Dobra - Hero */}
            <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-40 px-4 w-full flex justify-center items-center min-h-[90vh]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#f2a20d]/10 via-[#121212]/0 to-[#121212] -z-10" />

                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8 text-center lg:text-left z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f2a20d]/30 bg-[#f2a20d]/10 text-[#f2a20d] text-sm font-semibold mb-2">
                            <Zap className="w-4 h-4" /> Novidade: Versão 2.0 Disponível
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                            Descubra quais <span className="text-[#f2a20d]">SubIDs</span> realmente dão lucro
                        </h1>

                        <p className="text-lg lg:text-xl text-neutral-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                            A ferramenta definitiva para afiliados Shopee. Pare de perder dinheiro com estratégias cegas. Identifique exatamente de onde vêm suas conversões.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                            <a href="#preco" className="px-8 py-4 w-full sm:w-auto rounded-xl bg-[#f2a20d] hover:bg-[#d98f0a] text-black font-bold text-lg transition-all shadow-[0_0_30px_rgba(242,162,13,0.3)] hover:scale-105 active:scale-95 text-center">
                                Quero analisar minhas comissões
                            </a>
                            <a href="#como-funciona" className="px-8 py-4 w-full sm:w-auto rounded-xl border border-white/10 hover:bg-white/5 text-white font-semibold text-lg transition-all text-center">
                                Ver demonstração
                            </a>
                        </div>

                        <div className="pt-8 flex items-center justify-center lg:justify-start gap-4 text-sm text-neutral-500">
                            <div className="flex -space-x-3">
                                <div className="w-10 h-10 rounded-full border-2 border-[#121212] bg-neutral-800" />
                                <div className="w-10 h-10 rounded-full border-2 border-[#121212] bg-neutral-700" />
                                <div className="w-10 h-10 rounded-full border-2 border-[#121212] bg-neutral-600" />
                            </div>
                            <span>Usado por +2.000 afiliados</span>
                        </div>
                    </div>

                    <div className="relative z-10 hidden lg:block perspective-[1000px]">
                        {/* Mockup Dashboard Hero */}
                        <div className="w-full aspect-[16/10] bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-2xl p-4 transform rotate-y-[-12deg] rotate-x-[5deg] transition-transform duration-500 hover:rotate-0 hover:scale-105">
                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                            {/* Fake UI Content */}
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
                                    <span className="text-lg font-bold text-white truncate">grupo-promo-vip-01</span>
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

            {/* 2ª Dobra - Problema */}
            <section className="py-24 bg-black/40 border-y border-white/5" id="problema">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid lg:grid-cols-3 gap-16">
                        <div className="lg:col-span-1">
                            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">Os problemas que você enfrenta hoje</h2>
                            <p className="text-lg text-neutral-400">
                                Você provavelmente está cansado de relatórios confusos e falta de dados claros na plataforma padrão.
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

            {/* 3ª Dobra - Solução */}
            <section className="py-24" id="recursos">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Funcionalidades</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">A Solução Definitiva</h2>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-16">
                        Transforme dados brutos em inteligência de mercado com nossas ferramentas exclusivas.
                    </p>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {SOLUTION_POINTS.map((item, idx) => (
                            <div key={idx} className="bg-[#18181A] border border-white/5 p-8 rounded-2xl group hover:bg-[#1C1C1E] transition-all duration-300">
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

            {/* 4ª Dobra - Como Funciona */}
            <section className="py-24 bg-gradient-to-b from-[#121212] via-black/40 to-[#121212] border-y border-white/5" id="como-funciona">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold text-white mb-16">3 passos para a clareza total</h2>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-[#f2a20d]/20 to-transparent z-0" />

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-[#18181A] border border-white/10 flex items-center justify-center text-2xl font-black text-white mb-6 shadow-xl">
                                1
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Exporte da Shopee</h3>
                            <p className="text-neutral-400 text-sm">Baixe seu relatório de pedidos oficial (CSV) diretamente do painel da Shopee.</p>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-[#f2a20d] border border-[#f2a20d] flex items-center justify-center text-2xl font-black text-black mb-6 shadow-[0_0_20px_rgba(242,162,13,0.3)]">
                                2
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Faça o Upload</h3>
                            <p className="text-neutral-400 text-sm">Jogue a planilha no nosso sistema mágico. Sem precisar mapear colunas nem configurar nada.</p>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-[#18181A] border border-white/10 flex items-center justify-center text-2xl font-black text-white mb-6 shadow-xl">
                                3
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Lucre Mais</h3>
                            <p className="text-neutral-400 text-sm">Pronto! Veja os dashboards instantâneos e escale as campanhas que estão te dando dinheiro.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7ª Dobra - Preço */}
            <section className="py-24 relative" id="preco">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#f2a20d]/5 via-[#121212] to-[#121212] -z-10" />

                <div className="max-w-7xl mx-auto px-4 text-center">
                    <span className="text-[#f2a20d] font-bold tracking-widest text-sm uppercase mb-4 block">Investimento</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Preço Simples e Transparente</h2>
                    <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-16">
                        Sem taxas escondidas. Sem contratos de fidelidade. Apenas o que você precisa para crescer suas comissões.
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
                                            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-black bg-[#f2a20d] rounded-full">Mais Popular</span>
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
                                        className={`w-full flex items-center justify-center px-6 py-4 rounded-xl font-bold text-lg mb-8 transition-colors ${plan.is_popular
                                            ? 'bg-[#f2a20d] hover:bg-[#d98f0a] text-black'
                                            : 'bg-white/10 hover:bg-white/20 text-white'
                                            }`}
                                    >
                                        Assinar Agora
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
                                </div>
                            </div>
                        ))}

                        {plans.length === 0 && (
                            <div className="text-neutral-400 text-center w-full">Carregando planos...</div>
                        )}
                    </div>
                </div>
            </section>

            {/* 8ª Dobra - FAQ */}
            <section className="py-24 bg-black/40 border-t border-white/5" id="faq">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-4">Perguntas Frequentes</h2>
                        <p className="text-neutral-400">Tudo o que você precisa saber sobre a plataforma antes de começar.</p>
                    </div>

                    <FAQAccordion />
                </div>
            </section>

            {/* 9ª Dobra - Final CTA */}
            <section className="py-32 relative overflow-hidden border-t border-white/10">
                <div className="absolute inset-x-0 bottom-0 h-full bg-[#f2a20d]/5" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />

                <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f2a20d]/30 bg-[#f2a20d]/10 text-[#f2a20d] text-sm font-semibold mb-6">
                        Vagas limitadas para o plano atual
                    </span>
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tight">
                        Pare de trabalhar no <span className="text-[#f2a20d]">escuro</span>
                    </h2>
                    <p className="text-xl text-neutral-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Junte-se a mais de 1.500 afiliados que já aumentaram seus lucros entendendo exatamente onde estão ganhando dinheiro.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="#preco" className="w-full sm:w-auto px-10 py-5 rounded-xl bg-[#f2a20d] hover:bg-[#d98f0a] text-black font-bold text-lg transition-all shadow-[0_0_40px_rgba(242,162,13,0.4)] flex items-center justify-center gap-2">
                            Assinar Agora <ChevronDown className="w-5 h-5 -rotate-90" />
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
                    <p className="mt-6 text-sm text-neutral-500">Garantia de 7 dias ou seu dinheiro de volta.</p>
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
