/**
 * Formatação de valores monetários e percentuais no padrão brasileiro.
 * Sempre 2 casas decimais, vírgula como separador decimal, ponto como milhar.
 */

/** Formata valor monetário: R$ 1.234,56 */
export function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** Formata porcentagem: 12,5% (1 casa decimal) */
export function formatPct(value: number): string {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
}

/** Formata porcentagem: 12,50% (2 casas decimais) */
export function formatPct2(value: number): string {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
