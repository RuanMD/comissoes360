# Guia de APIs de Ofertas (Busca de Produtos e Lojas)

As APIs de ofertas permitem que você encontre produtos e lojas que participam do programa de afiliados, permitindo filtrar por comissão, preço e popularidade.

## 1. Busca de Produtos (`productOfferV2`)

Esta é a API mais usada. Ela permite buscar produtos individuais.

### Como usar:
- **Keyword**: Use para buscar por nome (ex: "iphone", "maquiagem").
- **isAMSOffer**: Se `true`, retorna apenas produtos com comissão **XTRA** (pagas pelo vendedor), que costumam ser bem maiores.
- **sortType**: 
  - `2`: Mais vendidos (bom para conversão).
  - `5`: Maior comissão.

### Exemplo de Fluxo:
1. Busque produtos populares de um nicho.
2. Identifique os que possuem `sellerCommissionRate` alto.
3. Use o `itemId` para gerar um link direto.

---

## 2. Busca de Lojas/Marcas (`shopOfferV2`)

Ideal para criar páginas de "Lojas Favoritas" ou promover marcas específicas.

### Destaques:
- **shopType**: Filtre por lojas Oficiais (`1`) para passar mais confiança ao comprador.
- **remainingBudget**: Fique atento a este campo. Se for `1` (Muito baixo), a campanha de comissão da loja pode acabar em breve.

---

## 3. Ofertas Especiais Shopee (`shopeeOfferV2`)

Retorna coleções curadas pela própria Shopee (ex: "Tudo por R$ 10", "Destaques da Semana").

---

**Dica Técnica**: Sempre verifique o campo `ratingStar`. Produtos com menos de 4.5 estrelas costumam ter taxas de devolução maiores, o que pode afetar sua comissão final.
