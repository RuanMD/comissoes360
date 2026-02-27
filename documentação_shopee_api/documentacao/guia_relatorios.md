# Guia de Relatórios de Conversão e Validação

Estes endpoints são essenciais para acompanhar seu faturamento e entender quais produtos seu público está comprando de fato.

## 1. Relatório em Tempo Real (`conversionReport`)

Mostra os pedidos assim que são gerados (status: PENDING, UNPAID, CANCELLED, etc).

### Campos Chave:
- **`netCommission`**: O valor real que você receberá após taxas de MCN (se houver).
- **`displayItemStatus`**: Um campo novo que resume se o item está válido para comissão ou não.
- **`fraudStatus`**: Indica se o pedido foi marcado por sistemas anti-fraude.

---

## 2. Relatório de Conciliação (`validatedReport`)

Este relatório contém apenas os pedidos que já passaram pelo período de garantia e foram **confirmados**. Use este para fazer o fechamento do seu caixa.

### Diferença Crítica:
- O `conversionReport` mostra a intenção de compra.
- O `validatedReport` mostra o dinheiro garantido.

---

## Como Filtrar por Data:
Os campos `purchaseTimeStart` e `purchaseTimeEnd` usam o formato **Unix Timestamp** (segundos). 

**Exemplo para pegar dados de hoje no Javacript:**
```javascript
const agora = Math.floor(Date.now() / 1000);
const inicioDoDia = agora - (agora % 86400);
```

---

**Nota sobre Fraude**: Se você notar muitos pedidos com `fraudStatus` ativo, verifique a origem do seu tráfego (referrers). A Shopee é rigorosa com tráfego vindo de bots ou incentivado de forma irregular.
