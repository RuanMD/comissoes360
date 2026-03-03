/**
 * Shopee API Proxy Service
 * Todas as chamadas à API da Shopee são roteadas via Supabase Edge Function
 * (funciona tanto em desenvolvimento quanto em produção).
 */

import { supabase } from './supabase';

const SHOPEE_EDGE_FN = 'shopee-api';

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

async function callShopeeProxy(body: Record<string, unknown>): Promise<any> {
    const { data, error } = await supabase.functions.invoke(SHOPEE_EDGE_FN, {
        body: body,
    });

    if (error) throw error;
    return data;
}

/**
 * Gera um link curto de afiliado Shopee via Edge Function (proxy seguro).
 */
export async function generateShopeeLink(params: GenerateLinkParams): Promise<GenerateLinkResult> {
    const data = await callShopeeProxy({
        action: 'generate-link',
        ...params,
    });

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
    const data = await callShopeeProxy({
        action: 'fetch-product',
        ...params,
    });

    return { product: data.product ?? null, shop: data.shop ?? null };
}

// ── Conversion Report Types ──

export interface ConversionOrderItem {
    shopId: number | null;
    shopName: string | null;
    completeTime: number | null;
    promotionId: number | null;
    modelId: number | null;
    itemId: number | null;
    itemName: string | null;
    itemPrice: number | null;
    displayItemStatus: string | null;
    actualAmount: number | null;
    refundAmount: number | null;
    qty: number | null;
    imageUrl: string | null;
    itemCommission: number | null;
    grossBrandCommission: number | null;
    itemTotalCommission: number | null;
    itemSellerCommission: number | null;
    itemSellerCommissionRate: number | null;
    itemShopeeCommissionCapped: number | null;
    itemShopeeCommissionRate: number | null;
    itemNotes: string | null;
    categoryLv1Name: string | null;
    categoryLv2Name: string | null;
    categoryLv3Name: string | null;
    globalCategoryLv1Name: string | null;
    globalCategoryLv2Name: string | null;
    globalCategoryLv3Name: string | null;
    fraudStatus: string | null;
    fraudReason: string | null;
    attributionType: string | null;
    channelType: string | null;
    campaignPartnerName: string | null;
    campaignType: string | null;
}

export interface ConversionOrder {
    orderId: string | null;
    shopType: string | null;
    orderStatus: string | null;
    items: ConversionOrderItem[];
}

export interface ConversionNode {
    clickTime: number | null;
    purchaseTime: number | null;
    checkoutId: string | null;
    conversionId: string | null;
    conversionStatus: string | null;
    grossCommission: number | null;
    cappedCommission: number | null;
    totalBrandCommission: number | null;
    estimatedTotalCommission: number | null;
    shopeeCommissionCapped: number | null;
    sellerCommission: number | null;
    totalCommission: number | null;
    netCommission: number | null;
    mcnManagementFeeRate: number | null;
    mcnManagementFee: number | null;
    mcnContractId: number | null;
    linkedMcnName: string | null;
    buyerType: string | null;
    utmContent: string | null;
    device: string | null;
    productType: string | null;
    referrer: string | null;
    orders: ConversionOrder[];
}

interface FetchReportParams {
    shopeeAppId: string;
    shopeeSecret: string;
    purchaseTimeStart?: number;
    purchaseTimeEnd?: number;
    limit?: number;
    scrollId?: string;
}

interface ReportResult {
    nodes: ConversionNode[];
    hasNextPage: boolean;
    scrollId?: string;
}

/**
 * Busca relatório de conversões em tempo real (pedidos recentes) via endpoint local.
 * Usa /api/fetch-conversions que constrói a query GraphQL completa com TODOS os campos.
 */
export async function fetchConversionReport(params: FetchReportParams): Promise<ReportResult> {
    const response = await fetch('/api/fetch-conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erro do servidor (${response.status})`);
    }

    return {
        nodes: data.nodes || [],
        hasNextPage: data.pageInfo?.hasNextPage ?? false,
        scrollId: data.pageInfo?.scrollId
    };
}

