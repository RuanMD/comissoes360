import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.comissoeslab.com.br';

/**
 * Retorna meta tags específicas por rota.
 * Landing page: SEO completo + JSON-LD.
 * Rotas privadas: noindex.
 */
function getRouteMeta(pathname, defaults) {
    const siteName = "Comissões Lab";
    switch (pathname) {
        case '/':
            return {
                title: defaults.title || `${siteName} | Ferramenta de Análise para Afiliados Shopee`,
                description: defaults.description || 'A ferramenta definitiva para afiliados Shopee. Descubra quais SubIDs dão lucro, analise vendas por hora e tracking de canais em tempo real.',
                canonical: `${BASE_URL}/`,
                robots: 'index, follow',
                ogType: 'website',
                jsonLd: [
                    {
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "name": siteName,
                        "alternateName": ["Comissoes Lab", "ComissoesLab"],
                        "url": `${BASE_URL}/`
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        "name": siteName,
                        "applicationCategory": "BusinessApplication",
                        "operatingSystem": "Web",
                        "description": defaults.description || 'Ferramenta de análise avançada para afiliados Shopee. Rastreamento por SubID, análise de canais e relatórios de comissão em tempo real.',
                        "url": `${BASE_URL}/`,
                        "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "BRL"
                        },
                        "publisher": {
                            "@type": "Organization",
                            "name": siteName,
                            "url": `${BASE_URL}/`,
                            "logo": {
                                "@type": "ImageObject",
                                "url": `${BASE_URL}/favicon.png`
                            }
                        }
                    }
                ]
            };
        case '/login':
            return {
                title: `Login | ${siteName}`,
                description: `Acesse sua conta no ${siteName} para gerenciar suas vendas e comissões da Shopee.`,
                canonical: `${BASE_URL}/login`,
                robots: 'noindex, follow',
                ogType: 'website',
                jsonLd: null
            };
        case '/privacidade':
            return {
                title: `Política de Privacidade | ${siteName}`,
                description: `Política de Privacidade do ${siteName}. Saiba como tratamos seus dados pessoais em conformidade com a LGPD.`,
                canonical: `${BASE_URL}/privacidade`,
                robots: 'index, follow',
                ogType: 'website',
                jsonLd: null
            };
        case '/forgot-password':
            return {
                title: `Recuperar Senha | ${siteName}`,
                description: `Recupere o acesso à sua conta no ${siteName}.`,
                canonical: `${BASE_URL}/forgot-password`,
                robots: 'noindex, follow',
                ogType: 'website',
                jsonLd: null
            };
        default:
            return {
                title: defaults.title || siteName,
                description: defaults.description || 'Plataforma avançada para gestão de vendas e relatórios de afiliados Shopee.',
                canonical: `${BASE_URL}${pathname}`,
                robots: 'noindex, nofollow',
                ogType: 'website',
                jsonLd: null
            };
    }
}

export default async function handler(req, res) {
    const filePath = path.join(process.cwd(), 'dist', 'index.html');
    let html = '';

    try {
        html = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error("Erro ao ler index.html na raiz/dist", err);
        return res.status(500).send('Servidor temporariamente indisponível.');
    }

    // Detectar pathname da request
    const pathname = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';

    // Buscar configurações do Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    let siteTitle = "Comissões Lab";
    let siteDescription = "Plataforma avançada para gestão de vendas e relatórios de afiliados Shopee.";
    let bannerUrl = "";
    let faviconUrl = "/favicon.png";

    if (supabaseUrl && supabaseKey) {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.1&select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    const settings = data[0];
                    if (settings.title) siteTitle = settings.title;
                    if (settings.description) siteDescription = settings.description;
                    if (settings.banner_url) bannerUrl = settings.banner_url;
                    if (settings.favicon_url) faviconUrl = settings.favicon_url;
                }
            }
        } catch (e) {
            console.error("Erro na comunicação com Supabase (Site Settings):", e);
        }
    }

    // Obter meta tags específicas da rota
    const meta = getRouteMeta(pathname, {
        title: siteTitle,
        description: siteDescription
    });

    const ogImage = bannerUrl || `${BASE_URL}/icons/pwa-512x512.png`;

    // Substituir <title>
    html = html.replace(/<title>(.*?)<\/title>/is, `<title>${meta.title}</title>`);

    // Substituir meta description existente
    html = html.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${meta.description}" />`
    );

    // Substituir meta robots existente
    html = html.replace(
        /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="robots" content="${meta.robots}" />`
    );

    // Substituir canonical existente
    html = html.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${meta.canonical}" />`
    );

    // Substituir favicons e apple-touch-icon
    if (faviconUrl) {
        html = html.replace(/<link[^>]+rel="icon"[^>]*>/is, `<link rel="icon" href="${faviconUrl}" />`);
        html = html.replace(/<link[^>]+rel="apple-touch-icon"[^>]*>/is, `<link rel="apple-touch-icon" href="${faviconUrl}" />`);
    }

    // Montar bloco de tags OG + Twitter + JSON-LD antes de </head>
    const headInsert = `
    <!-- SEO Dinâmico - Vercel -->
    <meta property="og:type" content="${meta.ogType}" />
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:url" content="${meta.canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="Comissões Lab" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <meta name="twitter:image" content="${ogImage}" />
    ${meta.jsonLd ? meta.jsonLd.map(ld => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`).join('\n    ') : ''}
    </head>
  `;

    html = html.replace('</head>', headInsert);
    // ... rest of the file ...


    // Headers de segurança + cache
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

    return res.status(200).send(html);
}
