import { parse, isValid } from 'date-fns';

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

/**
 * Parses a Shopee date string into a Date object.
 * Supports:
 * - dd-MM-yyyy HH:mm (CSV format)
 * - yyyy-MM-dd HH:mm:ss (DB/Sync format)
 */
export function parseShopeeDate(dateStr: string) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Try formats
    const formats = ['dd-MM-yyyy HH:mm', 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm:ss.SSS'];

    for (const fmt of formats) {
        try {
            const parsed = parse(dateStr, fmt, new Date());
            if (isValid(parsed) && parsed.getFullYear() > 2000) {
                return parsed;
            }
        } catch {
            continue;
        }
    }

    // Last resort: native parser if it looks like ISO
    const native = new Date(dateStr);
    return isValid(native) ? native : null;
}

/**
 * Normalizes a Sub ID for matching and aggregation.
 * Removes spaces, dashes, commas, and converts to lowercase.
 */
export function normalizeSubIdForMatch(sid: any): string {
    if (!sid || typeof sid !== 'string') return 'semsub_id';
    return sid.toString().replace(/[-\s,]+/g, '').toLowerCase().trim();
}

/**
 * Formata um Sub ID para exibição (mantém legibilidade)
 */
export function formatSubIdForDisplay(sid: any): string {
    if (!sid || typeof sid !== 'string') return 'Sem Sub_id';
    const normalized = sid.split('-').filter(Boolean).join('-').trim();
    return normalized === '' ? 'Sem Sub_id' : normalized;
}

/**
 * Helper for fuzzy matching Sub_IDs (handles plurals like INTERESSE vs INTERESSES)
 */
export function isSubIdMatch(s1: string, s2: string): boolean {
    const n1 = normalizeSubIdForMatch(s1);
    const n2 = normalizeSubIdForMatch(s2);
    if (n1 === 'semsub_id' || n2 === 'semsub_id') return n1 === n2;
    if (n1 === n2) return true;

    // Strip plurals 's' at the end of tokens OR before digits to handle INTERESSE/INTERESSES/INTERESSES01
    const simplify = (s: string) => {
        return s.replace(/([a-z]{3,})s(?=\d|-|$)/g, '$1');
    };

    const sim1 = simplify(n1);
    const sim2 = simplify(n2);
    if (sim1 === sim2) return true;

    return n1.includes(n2) || n2.includes(n1);
}
