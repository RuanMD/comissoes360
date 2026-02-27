# Documentação da API de Afiliados Shopee (Open API) - Versão 2026 (Final)

Esta documentação definitiva foi gerada em Fevereiro de 2026 via introspecção direta do servidor GraphQL, garantindo precisão total de campos, inclusive para as rotas instáveis no portal.

## Visão Geral

**Endpoint:** `https://open-api.affiliate.shopee.com.br/graphql`

---

## 1. Endpoints de Busca (Ofertas)

### `productOfferV2` (Produtos)
Principal busca de produtos. Novos filtros habilitados: `shopId`, `itemId`, `productCatId`.
- **Campos Principais:** `itemId`, `productName`, `priceMin`, `priceMax`, `sellerCommissionRate`, `shopeeCommissionRate`, `commission` (valor total), `ratingStar`.

### `shopOfferV2` (Marcas/Lojas)
Busca ofertas por loja.
- **Campos Principais:** `shopId`, `shopName`, `commissionRate`, `ratingStar`, `remainingBudget` (0: Ilimitado, 1-3: Níveis de alerta).

### `shopeeOfferV2` (Campanhas Shopee)
Busca coleções e categorias especiais.
- **Campos Principais:** `offerName`, `offerLink`, `periodStartTime`, `periodEndTime`.

---

## 2. Relatórios de Desempenho (Vendas)

### `conversionReport` (Relatório de Conversão)
Dados em tempo real de pedidos realizados.
- **Campos de Nó:** `clickTime`, `purchaseTime`, `conversionId`, `checkoutId`, `conversionStatus`, `netCommission`, `orders`.
- **Estrutura de Pedido/Item:**
  - `orders`: Lista de pedidos.
  - `items`: 
    - `itemId`, `itemName`, `itemPrice`, `qty`.
    - `displayItemStatus`: Status consolidado (Novo).
    - `itemTotalCommission`, `itemSellerCommission`, `itemShopeeCommissionCapped`.
    - `globalCategoryLv1-3Name`: Categorias globais Shopee.
    - `fraudStatus`, `fraudReason`: Detalhes de segurança.
    - `campaignType`, `attributionType`, `channelType`.

### `validatedReport` (Relatório Validado)
Utilizado para conciliação financeira final.
- **Campos de Nó:** `clickTime`, `purchaseTime`, `conversionId`, `totalCommission`, `netCommission`, `mcnManagementFee`, `orders`.
- **Estrutura de Pedido/Item:**
  - `orders`: `orderId`, `shopType`, `orderStatus`.
  - `items`: Mesmos campos de detalhe do `conversionReport`, incluindo `fraudStatus` e `attributionType`.

---

## 3. Ferramentas de Link

### `generateShortLink` (Mutation)
- **Input:** `originUrl`, `subIds` (Array de até 5 tags).
- **Output:** `shortLink`.

---

## 4. Endpoints Adicionais (Backlog)
- `partnerOrderReport`: Relatório focado em parceiros.
- `getItemFeedData`: Extração massiva de dados de produtos via Feed.
- `listItemFeeds`: Listagem de arquivos de feed disponíveis.

---

## Verificação Técnica
Todas as rotas acima foram testadas e validadas com sucesso em 27/02/2026.
O script de validação local `validate_2026_apis.js` confirma o acesso a todos os campos listados.
