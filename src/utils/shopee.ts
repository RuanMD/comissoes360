/**
 * Extract shopId and itemId from a Shopee product URL.
 *
 * Supported formats:
 *   https://shopee.com.br/product/421843853/18499182927
 *   https://shopee.com.br/Product-Name-i.421843853.18499182927
 *   https://shopee.com.br/Product-Name-i.421843853.18499182927?sp_atk=...
 */
export function extractShopeeIds(url: string): { shopId: string; itemId: string } | null {
    try {
        const parsed = new URL(url);

        // Format 1: /product/{shopId}/{itemId}
        const productMatch = parsed.pathname.match(/\/product\/(\d+)\/(\d+)/);
        if (productMatch) {
            return { shopId: productMatch[1], itemId: productMatch[2] };
        }

        // Format 2: /Name-i.{shopId}.{itemId}
        const iMatch = parsed.pathname.match(/-i\.(\d+)\.(\d+)/);
        if (iMatch) {
            return { shopId: iMatch[1], itemId: iMatch[2] };
        }

        return null;
    } catch {
        return null;
    }
}
