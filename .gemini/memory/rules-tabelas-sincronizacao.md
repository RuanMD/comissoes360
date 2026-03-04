# 📊 Regra de Negócio: Sincronização e Totais de Relatórios
> ℹ️ **Localização deste arquivo:** `.gemini/memory/rules-tabelas-sincronizacao.md`
> *(Use este caminho para solicitar atualizações ou referenciar esta regra)*

Esta regra deve ser aplicada a todos os novos componentes de tabela e relatórios deste projeto para garantir integridade de dados e cálculos precisos.

## 🔗 1. Lógica de Sincronização (Matching)
Ao criar ou modificar tabelas que envolvam dados de cliques (Shopee), conversões e anúncios (FB Ads):
- **Identificador Único**: Use sempre o `Sub_ID` como chave primária de correlação.
- **Master Registry**: Utilize (ou siga a lógica do) `useMetrics.ts` para consolidar os dados. 
- **Atribuição Proporcional**: Se um investimento de anúncio estiver vinculado a um `Sub_ID` que aparece em múltiplos canais, o custo deve ser distribuído proporcionalmente ao volume de cliques de cada canal.
- **Dados Sem Conversão**: Nunca oculte um `Sub_ID` que teve cliques mas ainda não teve pedidos. Ele deve aparecer com métricas de custo/clique e 0 em pedidos/comissão.

## 🧮 2. Cálculo de Totais (Footer/tfoot)
**PROIBIDO**: Usar estados globais genéricos ou métricas não filtradas para o rodapé da tabela.
**OBRIGATÓRIO**: O rodapé (`tfoot`) deve ser uma agregação dinâmica do array de dados que está alimentando as linhas (`tbody`).
- **Somas**: Use `.reduce()` no array de dados da tabela para somar Cliques, Pedidos, Investimento e Comissão.
- **Taxas/Ratios**: Recalcule a Conversão e o ROAS no Total usando os valores somados (ex: `SomaPedidos / SomaCliques`).
- **Exemplo de Implementação**:
```tsx
const totalClicks = data.reduce((s, i) => s + i.clicks, 0);
const totalOrders = data.reduce((s, i) => s + i.orders, 0);
const totalConversion = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;
```

## 📱 3. Responsividade e UX
- Siga as regras de **Tabelas Responsivas** do `MEMORY[user_global]`: use wrappers com `overflow-x-auto` e `min-w-full`.
- Use `font-mono` para valores numéricos e financeiros para garantir alinhamento visual.

## 🔀 4. Ordenação de Colunas
**OBRIGATÓRIO**: Todos os cabeçalhos de tabela (`thead th`) devem ser clicáveis e permitir ordenação (Crescente/Decrescente).
- **Indicadores Visuais**: Adicione ícones (ex: `ChevronUp`, `ChevronDown` ou `ArrowUpDown`) para indicar a coluna ativa e a direção da ordenação.
- **Tipos de Dados**: A ordenação deve tratar corretamente strings (alfabética) e números/valores financeiros (numérica).
- **Estado Local**: Utilize um estado `sortConfig` no componente para gerenciar a chave (`key`) e a direção (`direction`).

## 📐 5. Dimensões Multidimensionais (1-N)
**REGRA**: Se uma dimensão (ex: Sub_ID) puder estar associada a múltiplos valores de outra dimensão (ex: Canais), **NÃO** exiba essa segunda dimensão como uma coluna única na tabela principal.
- **Motivo**: Dados multidimensionais em colunas simples causam poluição visual e informações incompletas.
- **Padrão Aceito**: Use **Tabelas Expansíveis**. A tabela principal exibe a dimensão agregadora, e o detalhamento específico (Canais, Produtos, Histórico) deve ser acessível via abas dento da linha expandida.
