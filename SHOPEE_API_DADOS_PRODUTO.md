# Dados Extraíveis da API Shopee via Link de Produto

## URL Testada
```
https://shopee.com.br/product/421843853/18499182927
```

### Estrutura da URL
| Parte | Valor | Significado |
|-------|-------|-------------|
| `421843853` | Shop ID | Identificador único da **loja** |
| `18499182927` | Item ID | Identificador único do **produto** |

---

## 1. Dados do Produto (`productOfferV2`) - Consulta em Tempo Real

Query utilizada:
```graphql
{
  productOfferV2(listType: 0, limit: 1, itemId: 18499182927) {
    nodes { ... todos os campos ... }
  }
}
```

### Resultado Completo

| Campo | Tipo | Valor Extraído | Descrição |
|-------|------|----------------|-----------|
| `itemId` | Int64 | `18499182927` | ID único do produto |
| `productName` | String | `"Kit 2 Mesinhas De Canto Redonda Pés Tripé Ferro Dourado"` | Nome do produto |
| `price` | String | `"146.2"` | Preço atual (R$) |
| `priceMin` | String | `"146.2"` | Preço mínimo (variações) |
| `priceMax` | String | `"146.2"` | Preço máximo (variações) |
| `priceDiscountRate` | Int | `26` | Desconto atual (%) |
| `imageUrl` | String | `"https://cf.shopee.com.br/file/sg-11134201-7rbnk-lqnmjd5auueo28"` | URL da imagem principal |
| `ratingStar` | String | `"4.9"` | Avaliação (0-5 estrelas) |
| `sales` | Int64 | `796` | Quantidade de vendas |
| `productLink` | String | `"https://shopee.com.br/product/421843853/18499182927"` | Link original do produto |
| `offerLink` | String | `"https://s.shopee.com.br/2qPSD4gPzF"` | Link de afiliado gerado |
| `shopId` | Int64 | `421843853` | ID da loja |
| `shopName` | String | `"VARIEDADES DA RDS"` | Nome da loja |
| `shopType` | [Int] | `[2]` | Tipo da loja (2 = Loja Favorita Shopee) |
| `productCatIds` | [Int] | `[100636, 100713, 101169]` | IDs de categorias (nível 1, 2, 3) |
| `periodStartTime` | Int64 | `1750906800` | Início da oferta de comissão (timestamp) |
| `periodEndTime` | Int64 | `32503651199` | Fim da oferta (timestamp - praticamente "sem fim") |

### Dados de Comissão (Detalhados)

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `commissionRate` | `0.28` (28%) | Taxa de comissão **total** por venda |
| `sellerCommissionRate` | `0.25` (25%) | Comissão paga pelo **vendedor** (XTRA) |
| `shopeeCommissionRate` | `0.03` (3%) | Comissão base da **Shopee** |
| `commission` | `R$ 40,94` | Valor em reais da comissão por venda |
| `appExistRate` | `0.28` (28%) | Comissão - usuário existente via App |
| `appNewRate` | `0.28` (28%) | Comissão - usuário novo via App |
| `webExistRate` | `0.28` (28%) | Comissão - usuário existente via Web |
| `webNewRate` | `0.28` (28%) | Comissão - usuário novo via Web |

---

## 2. Dados da Loja (`shopOfferV2`)

Query utilizada:
```graphql
{
  shopOfferV2(limit: 1, shopId: 421843853) {
    nodes { ... todos os campos ... }
  }
}
```

### Resultado Completo

| Campo | Tipo | Valor Extraído | Descrição |
|-------|------|----------------|-----------|
| `shopId` | Int64 | `421843853` | ID da loja |
| `shopName` | String | `"VARIEDADES DA RDS"` | Nome da loja |
| `commissionRate` | String | `"0.28"` (28%) | Comissão geral da loja |
| `ratingStar` | String | `"4.8"` | Avaliação média da loja |
| `remainingBudget` | Int | `0` | Orçamento restante (0 = Ilimitado) |
| `offerLink` | String | `"https://s.shopee.com.br/2B9lPwc41Y"` | Link de afiliado da loja |
| `imageUrl` | String | `"https://cf.shopee.com.br/file/br-11134216-7qukw-ljzwt4h0ud9fc7"` | Logo/avatar da loja |
| `originalLink` | String | `"https://shopee.com.br/shop/421843853"` | Link original da loja |
| `shopType` | [Int] | `[2]` | Tipo da loja |
| `sellerCommCoveRatio` | String | `"0.9720"` | Cobertura de comissão do vendedor (97.2%) |
| `periodStartTime` | Int64 | `1728503489` | Início da oferta da loja |
| `periodEndTime` | Int64 | `32503651199` | Fim da oferta |
| `bannerInfo` | Object | `null` | Banners da loja (quando disponível) |

### Valores de `remainingBudget`
| Valor | Significado |
|-------|-------------|
| `0` | Orçamento ilimitado |
| `1` | Muito baixo (pode acabar em breve) |
| `2` | Baixo |
| `3` | Moderado |

### Valores de `shopType`
| Valor | Significado |
|-------|-------------|
| `1` | Loja Oficial (Shopee Mall) |
| `2` | Loja Favorita Shopee |

---

## 3. Feed de Dados Completo (`getItemFeedData`) - DADOS EXTRAS

Este endpoint retorna dados **muito mais ricos** do que o `productOfferV2`. Cada produto no feed contém um JSON com campos adicionais como **categorias com nome**, **descrição completa**, **variações de modelo**, **likes** e mais.

### Feeds Disponíveis

| Feed | Nome | Total de Itens | Modo |
|------|------|----------------|------|
| `428535457031659520_FULL_2026-02-26` | Shopee Brasil - 2022 | 10.000 | FULL |
| `428536169534861312_FULL_2026-02-26` | Shopee Oficial BR - 2022 | 100.000 | FULL |
| `428535457031659520_DELTA_2026-02-26` | Shopee Brasil - 2022 | 19.686 | DELTA (atualizações) |
| `428536169534861312_DELTA_2026-02-26` | Shopee Oficial BR - 2022 | 160.813 | DELTA (atualizações) |

### Campos Disponíveis no Feed (JSON por produto)

| Campo | Exemplo Real | Descrição |
|-------|-------------|-----------|
| `title` | `"Lanterna Traseira Canto Honda Civic..."` | Nome/título do produto |
| `description` | `"CARACTERÍSTICAS:\r\n• Produto Novo..."` | **Descrição completa** do produto |
| `price` | `"403.52"` | Preço original |
| `sale_price` | `"403.52"` | **Preço de venda** (com desconto) |
| `discount_percentage` | `"5"` | Porcentagem de desconto |
| `image_link` | `"https://cf.shopee.com.br/file/..."` | Imagem principal |
| `image_link_3` | `"https://cf.shopee.com.br/file/..."` | **Imagem adicional** |
| `item_rating` | `"4.88"` | Avaliação do produto |
| `itemid` | `"3028688077"` | ID do produto |
| `like` | `"55"` | **Quantidade de likes/favoritos** |
| `condition` | `"New"` | **Condição** (Novo/Usado) |
| `cb_option` | `"Non-Cross border"` | **Cross-border** (importado ou não) |
| `global_category1` | `"Home & Living"` | **Nome da Categoria Nível 1** |
| `global_category2` | `"Dinnerware"` | **Nome da Categoria Nível 2** |
| `global_category3` | `"Cups, Mugs & Glasses"` | **Nome da Categoria Nível 3** |
| `global_catid1` | `"100636"` | ID da Categoria Nível 1 |
| `global_catid2` | `"100718"` | ID da Categoria Nível 2 |
| `global_catid3` | `"101240"` | ID da Categoria Nível 3 |
| `model_ids` | `"110905659070\|110905659071"` | **IDs das variações** (separados por \|) |
| `model_names` | `"Direito\|Esquerdo"` | **Nomes das variações** (cores, tamanhos, etc.) |
| `shop_name` | `"São Paulo Auto Peças"` | Nome da loja |
| `shop_rating` | `"4.77"` | Avaliação da loja |
| `product_link` | `"https://shopee.com.br/product/..."` | Link do produto |
| `product_short link` | `"https://shopee.com.br/universal-link/..."` | Link curto de afiliado |

### Mapeamento de Categorias (Descoberto via Feed)

Os `productCatIds` retornados pelo `productOfferV2` correspondem aos IDs de categoria do feed:

| productCatIds | global_catid | Categoria (Nome) |
|--------------|-------------|------------------|
| `100636` | `global_catid1` | **Home & Living** (Casa e Decoração) |
| `100713` | `global_catid2` | *(subcategoria nível 2)* |
| `101169` | `global_catid3` | *(subcategoria nível 3)* |

### Limitação do Feed
O `getItemFeedData` **NÃO permite filtrar por `itemId`**. Ele retorna dados em massa (bulk) — é necessário percorrer todo o feed para encontrar um produto específico. Para consulta individual por produto, use o `productOfferV2`.

---

## 4. Listagem de Produtos por Loja

Query utilizada:
```graphql
{
  productOfferV2(listType: 0, limit: 5, shopId: 421843853) {
    nodes { itemId productName price commission commissionRate sales ratingStar imageUrl }
  }
}
```

Usando o `shopId`, é possível listar todos os produtos da loja que participam do programa de afiliados:

| Produto | Preço | Comissão (R$) | Taxa | Vendas | Avaliação |
|---------|-------|---------------|------|--------|-----------|
| Kit 2 Mesinhas De Canto Redonda Pés Tripé Ferro Dourado | R$ 146,20 | R$ 40,94 | 28% | 796 | 4.9 |
| Aparador de Sala Estilo Industrial Mesa Buffet Balcão Pé Dourado | R$ 132,54 | R$ 34,46 | 26% | 202 | 4.8 |
| Mesa Buffet Balcão Aparador Industrial MDF Pé Preto 68X30X90 | R$ 148,07 | R$ 34,06 | 23% | 36 | 4.8 |
| Mesa Buffet Balcão Aparador Industrial MDF Pés Preto 68X30X76 | R$ 158,70 | R$ 36,50 | 23% | 29 | 4.8 |
| Aparador Balcão Mesa Industrial Pé Nivelador Rosé Gold 68X45X90 | R$ 159,36 | R$ 36,65 | 23% | 6 | 4.6 |

---

## 5. Resumo Completo: Campos Úteis para o CreativeTrack

### Via `productOfferV2` (Consulta em tempo real por itemId)

| Funcionalidade | Campo da API | Disponível | Exemplo |
|----------------|-------------|------------|---------|
| **Nome do produto** | `productName` | SIM | "Kit 2 Mesinhas De Canto..." |
| **Foto do produto** | `imageUrl` | SIM | URL da imagem |
| **Preço atual** | `price` | SIM | R$ 146,20 |
| **Faixa de preço** | `priceMin` / `priceMax` | SIM | R$ 146,20 - R$ 146,20 |
| **Desconto** | `priceDiscountRate` | SIM | 26% |
| **Comissão (R$)** | `commission` | SIM | R$ 40,94 |
| **Taxa de comissão total** | `commissionRate` | SIM | 28% |
| **Comissão vendedor** | `sellerCommissionRate` | SIM | 25% |
| **Comissão Shopee** | `shopeeCommissionRate` | SIM | 3% |
| **Comissão App/Web** | `appExistRate`, `appNewRate`, `webExistRate`, `webNewRate` | SIM | 28% |
| **Avaliação** | `ratingStar` | SIM | 4.9 |
| **Qtd vendas** | `sales` | SIM | 796 |
| **Nome da loja** | `shopName` | SIM | "VARIEDADES DA RDS" |
| **ID da loja** | `shopId` | SIM | 421843853 |
| **Tipo da loja** | `shopType` | SIM | 2 (Loja Favorita) |
| **IDs de categorias** | `productCatIds` | SIM | [100636, 100713, 101169] |
| **Link de afiliado** | `offerLink` | SIM | https://s.shopee.com.br/... |
| **Link original** | `productLink` | SIM | https://shopee.com.br/product/... |

### Via `shopOfferV2` (Dados extras da loja)

| Funcionalidade | Campo da API | Disponível | Exemplo |
|----------------|-------------|------------|---------|
| **Logo da loja** | `imageUrl` | SIM | URL do avatar |
| **Avaliação da loja** | `ratingStar` | SIM | 4.8 |
| **Orçamento restante** | `remainingBudget` | SIM | 0 (ilimitado) |
| **Cobertura comissão** | `sellerCommCoveRatio` | SIM | 97.2% |
| **Link da loja** | `originalLink` | SIM | https://shopee.com.br/shop/... |
| **Banners** | `bannerInfo` | SIM (quando existir) | Imagens de banner |

### Via `getItemFeedData` (Dados extras - bulk)

| Funcionalidade | Campo da API | Disponível | Exemplo |
|----------------|-------------|------------|---------|
| **Descrição completa** | `description` | SIM | Texto detalhado do produto |
| **Nome da Categoria 1** | `global_category1` | SIM | "Home & Living" |
| **Nome da Categoria 2** | `global_category2` | SIM | "Dinnerware" |
| **Nome da Categoria 3** | `global_category3` | SIM | "Cups, Mugs & Glasses" |
| **Condição** | `condition` | SIM | "New" |
| **Cross-border** | `cb_option` | SIM | "Non-Cross border" |
| **Likes/Favoritos** | `like` | SIM | 55 |
| **Variações (IDs)** | `model_ids` | SIM | "110905659070\|110905659071" |
| **Variações (Nomes)** | `model_names` | SIM | "Direito\|Esquerdo" |
| **Preço de venda** | `sale_price` | SIM | "56.91" |
| **Imagens adicionais** | `image_link_3` | SIM | URL da 3a imagem |
| **Frete grátis** | - | **NAO** | Não disponível em nenhum endpoint |

---

## 6. Estratégia Recomendada para o CreativeTrack

### Abordagem Principal (Rápida - por produto)
1. Usuário cola a URL do produto
2. Extrair `shopId` e `itemId` da URL via regex
3. Chamar `productOfferV2(itemId: X)` para dados do produto
4. Chamar `shopOfferV2(shopId: X)` para dados da loja
5. Preencher automaticamente: nome, foto, preço, desconto, comissão, avaliação, vendas, loja

### Abordagem Complementar (Para categorias com nome)
- Manter um cache local das categorias mapeando `productCatIds` → nomes
- Popular o cache periodicamente via `getItemFeedData`
- Ou simplesmente exibir os IDs de categoria (menos informativo)

---

## 7. Como Extrair os IDs da URL

```
https://shopee.com.br/product/{shopId}/{itemId}
```

Regex para extrair:
```javascript
const match = url.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/);
if (match) {
  const shopId = match[1];  // 421843853
  const itemId = match[2];  // 18499182927
}
```

### Outros formatos de URL Shopee
```
https://shopee.com.br/Nome-Do-Produto-i.421843853.18499182927
// O formato é: i.{shopId}.{itemId}
```

Regex alternativo:
```javascript
const match = url.match(/i\.(\d+)\.(\d+)/);
```

---

## 8. Parâmetros Disponíveis para Busca (`productOfferV2`)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `listType` | Int | Tipo de listagem (0 = padrão) |
| `itemId` | Int64 | Filtrar por ID do produto |
| `shopId` | Int64 | Filtrar por ID da loja |
| `keyword` | String | Buscar por palavra-chave |
| `sortType` | Int | Ordenação (2=Mais vendidos, 5=Maior comissão) |
| `productCatId` | Int | Filtrar por categoria |
| `isAMSOffer` | Boolean | Apenas ofertas com comissão XTRA |
| `isKeySeller` | Boolean | Apenas vendedores-chave |
| `matchId` | Int64 | ID de correspondência |
| `page` | Int | Página da listagem |
| `limit` | Int | Limite de resultados |

---

## 9. Endpoints Disponíveis na API (Resumo)

| Endpoint | Tipo | Descrição |
|----------|------|-----------|
| `productOfferV2` | Query | Busca produtos com comissão (consulta por itemId/shopId/keyword) |
| `shopOfferV2` | Query | Busca lojas com programa de afiliados |
| `shopeeOfferV2` | Query | Campanhas e coleções especiais da Shopee |
| `conversionReport` | Query | Relatório de conversões/vendas em tempo real |
| `validatedReport` | Query | Relatório validado para conciliação financeira |
| `partnerOrderReport` | Query | Relatório de pedidos de parceiros |
| `listItemFeeds` | Query | Lista feeds de dados disponíveis |
| `getItemFeedData` | Query | Dados em massa de produtos (com descrição, categorias, variações) |
| `checkAffiliateId` | Query | Verificar ID de afiliado |
| `generateShortLink` | Mutation | Gerar link encurtado de afiliado |
| `productOffer` (v1) | Query | **DEPRECADO** - usar productOfferV2 |

---

*Documento gerado em 27/02/2026 via testes diretos na API Shopee Affiliate.*
