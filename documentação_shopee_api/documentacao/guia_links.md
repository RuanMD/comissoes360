# Guia de Geração de Links (`generateShortLink`)

Para ganhar comissão, você **precisa** converter o link comum da Shopee em um link de afiliado.

## Como Funciona:
A Mutation `generateShortLink` recebe uma URL original e devolve um link encurtado (formato `s.shopee.com.br/...`).

### Uso de Sub IDs (Trackeamento):
Você pode passar até 5 `subIds`. Isso é fundamental para saber **de onde** veio a venda.

**Exemplo de Estratégia:**
- `subIds[0]`: "Instagram"
- `subIds[1]`: "Bio_Link"
- `subIds[2]`: "Promo_Verao"

Se uma venda ocorrer, o `conversionReport` mostrará esses IDs, e você saberá que o post no Instagram funcionou melhor que o do WhatsApp, por exemplo.

---

## Limites:
Atualmente, não há um limite rígido de geração de links por hora (além do limite global da API), mas evite gerar milhares de links idênticos. O link gerado para o mesmo `AppID` + `OriginUrl` + `SubIDs` costuma ser persistente.
