import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    // Ler o HTML original gerado pelo Vite na pasta dist do Vercel Environment
    const filePath = path.join(process.cwd(), 'dist', 'index.html');
    let html = '';

    try {
        html = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error("Erro ao ler index.html na raiz/dist", err);
        // Se o fallback for ignorado pela plataforma Vercel Edge Serverless, retornar um stub amigável
        return res.status(500).send('Servidor temporariamente indisponível. Arquivo base (index.html) não econtrado no deploy.');
    }

    // Buscar configurações da Tabela no Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    let title = "Comissões Lab";
    let description = "Plataforma avançada para gestão de vendas e relatórios de afiliados Shopee.";
    let bannerUrl = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop";
    let faviconUrl = "/vite.svg";

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
                    if (settings.title) title = settings.title;
                    if (settings.description) description = settings.description;
                    if (settings.banner_url) bannerUrl = settings.banner_url;
                    if (settings.favicon_url) faviconUrl = settings.favicon_url;
                }
            }
        } catch (e) {
            console.error("Erro na comunicação com Supabase (Site Settings):", e);
        }
    }

    // Injetar Meta Tags Dinâmicas no HTML Bruto
    // Substittuir <title> 
    html = html.replace(/<title>(.*?)<\/title>/is, `<title>${title}</title>`);

    // Substituir favicon se alterado
    if (faviconUrl !== '/vite.svg') {
        html = html.replace(/<link[^>]+rel="icon"[^>]*>/is, `<link rel="icon" href="${faviconUrl}" />`);
    }

    // Limpar cabeçalho para inserção de OG Tags novas
    const headInsert = `
    <!-- Dinâmico Injetado Vercel Edge -->
    <meta name="description" content="${description}" />
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${bannerUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${bannerUrl}" />
    </head>
  `;

    html = html.replace('</head>', headInsert);

    // Exibir a página
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cachear resposta no Edge por 1 minuto; em background será revalidada (ISR Style).
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(html);
}
