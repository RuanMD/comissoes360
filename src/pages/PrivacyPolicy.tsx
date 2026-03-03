import { Helmet } from 'react-helmet-async';

export function PrivacyPolicy() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-16">
            <Helmet>
                <title>Política de Privacidade | Comissões Lab</title>
                <meta name="description" content="Política de Privacidade do Comissões Lab. Saiba como tratamos seus dados pessoais em conformidade com a LGPD." />
                <link rel="canonical" href="https://www.comissoeslab.com.br/privacidade" />
                <meta name="robots" content="index, follow" />
            </Helmet>

            <h1 className="text-4xl font-bold text-white mb-8">Política de Privacidade</h1>
            <p className="text-sm text-neutral-500 mb-12">Última atualização: 02 de março de 2026</p>

            <div className="space-y-8 text-neutral-300 leading-relaxed">
                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">1. Introdução</h2>
                    <p>
                        O <strong className="text-white">Comissões Lab</strong> ("nós", "nosso") é uma plataforma de análise de dados para afiliados Shopee.
                        Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações pessoais,
                        em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">2. Dados que Coletamos</h2>
                    <p className="mb-3">Coletamos os seguintes tipos de dados:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                        <li><strong className="text-white">Dados de cadastro:</strong> nome, e-mail e telefone fornecidos no momento da assinatura.</li>
                        <li><strong className="text-white">Dados de uso:</strong> informações sobre como você utiliza a plataforma (páginas acessadas, funcionalidades utilizadas).</li>
                        <li><strong className="text-white">Dados de relatórios:</strong> arquivos CSV que você faz upload voluntariamente, contendo dados de comissões da Shopee.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">3. Como Usamos seus Dados</h2>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>Fornecer e manter o serviço de análise de comissões.</li>
                        <li>Processar seus relatórios e gerar dashboards personalizados.</li>
                        <li>Enviar comunicações relacionadas ao serviço (atualizações, suporte).</li>
                        <li>Melhorar a experiência do usuário na plataforma.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">4. Armazenamento e Segurança</h2>
                    <p>
                        Seus dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS/TLS).
                        Utilizamos o Supabase como provedor de infraestrutura, que oferece proteção de nível empresarial.
                        Não compartilhamos, vendemos ou transferimos seus dados pessoais a terceiros, exceto quando exigido por lei.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">5. Seus Direitos (LGPD)</h2>
                    <p className="mb-3">Conforme a LGPD, você tem direito a:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>Confirmar a existência de tratamento dos seus dados.</li>
                        <li>Acessar, corrigir ou solicitar a exclusão dos seus dados pessoais.</li>
                        <li>Solicitar a portabilidade dos seus dados.</li>
                        <li>Revogar o consentimento a qualquer momento.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">6. Cookies</h2>
                    <p>
                        Utilizamos cookies essenciais para manter sua sessão autenticada.
                        Não utilizamos cookies de rastreamento ou publicidade de terceiros.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold text-white mb-4">7. Contato</h2>
                    <p>
                        Para exercer seus direitos ou esclarecer dúvidas sobre esta política,
                        entre em contato conosco através do nosso canal de suporte na plataforma.
                    </p>
                </section>
            </div>
        </div>
    );
}
