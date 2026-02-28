/**
 * Shopee API Proxy Service
 * Todas as chamadas à API da Shopee são roteadas via Supabase Edge Function
 * (funciona tanto em desenvolvimento quanto em produção).
 */

const SHOPEE_EDGE_FN = 'https://yiyfmdbhzvwsfkpberve.supabase.co/functions/v1/shopee-api';

interface GenerateLinkParams {
    originUrl: string;
    subIds?: string[];
    shopeeAppId: string;
    shopeeSecret: string;
}

interface GenerateLinkResult {
    shortLink: string;
}

interface FetchProductParams {
    shopId: number | string;
    itemId: number | string;
    shopeeAppId: string;
    shopeeSecret: string;
}

interface FetchProductResult {
    product: any | null;
    shop: any | null;
}

async function callShopeeProxy(body: Record<string, unknown>): Promise<Response> {
    return fetch(SHOPEE_EDGE_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/**
 * Gera um link curto de afiliado Shopee via Edge Function (proxy seguro).
 */
export async function generateShopeeLink(params: GenerateLinkParams): Promise<GenerateLinkResult> {
    const response = await callShopeeProxy({
        action: 'generate-link',
        ...params,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erro do servidor (${response.status})`);
    }

    if (!data.shortLink) {
        throw new Error('A Shopee retornou resposta vazia. Tente novamente.');
    }

    return { shortLink: data.shortLink };
}

/**
 * Resolve uma URL encurtada da Shopee (s.shopee.com.br/xxx) para a URL completa do produto.
 * Chama /api/resolve-shopee-url diretamente (não precisa de credenciais Shopee).
 */
export async function resolveShopeeUrl(shortUrl: string): Promise<string> {
    const response = await fetch('/api/resolve-shopee-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erro ao resolver URL (${response.status})`);
    }

    if (!data.resolvedUrl) {
        throw new Error('Não foi possível resolver a URL encurtada.');
    }

    return data.resolvedUrl;
}

/**
 * Busca dados de produto e loja via Edge Function (proxy seguro).
 */
export async function fetchShopeeProduct(params: FetchProductParams): Promise<FetchProductResult> {
    const response = await callShopeeProxy({
        action: 'fetch-product',
        ...params,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erro do servidor (${response.status})`);
    }

    return { product: data.product ?? null, shop: data.shop ?? null };
}
