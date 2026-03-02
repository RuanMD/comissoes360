# **📄 PRD — Sistema de Relatórios Inteligentes de Comissões e Performance (CSV-Based)**

---

# **🧾 1\. Ingestão dos Anexos**

## **📸 Análises das Imagens Enviadas**

### **1️⃣ Performance por Sub\_ID**

* Ranking de Sub\_ID por:

  * Total de cliques

  * Participação (%)

* Exemplo:

  * TOALHA-INTERESSE01 — 110 cliques (36,7%)

  * UMIDIFICADOR-INTERESSE — 89 cliques (29,7%)

* Insight: Sistema precisa calcular participação relativa automaticamente.

---

### **2️⃣ Top Produtos por Comissão**

* Ordenação por:

  * Comissão total

  * Paginação

  * Itens por página

* Métricas:

  * Nome do item

  * Itens vendidos

  * Comissão total (R$)

* Insight: Necessário suporte a ordenação dinâmica e filtros.

---

### **3️⃣ Canal — Quantidade & Comissão**

* Canais identificados:

  * Instagram

  * Websites

  * WhatsApp

  * Facebook

  * Others

  * Shopeevideo

  * Code Sharing

* Métricas:

  * Pedidos

  * Comissão total

* Insight: Sistema precisa consolidar por canal e permitir novos canais.

---

### **4️⃣ Pedidos por Hora**

* Gráfico 00h–23h

* Inclui:

  * Pendentes

  * Concluídos

* Insight: Necessário agregação por hora baseada em timestamp.

---

### **5️⃣ Dashboard Resumo Geral**

* Comissão líquida total

* Total em vendas

* Pedidos únicos

* Diretas x Indiretas

* Pendentes / Concluídos / Não pagos

* Data do relatório

---

## **📂 Arquivos CSV Recebidos**

1. `AffiliateCommissionReport202602251312.csv`  
    → Contém dados de pedidos, comissões, status e canal.

2. `WebsiteClickReport202602251249.csv`  
    → Contém dados de cliques e Sub\_ID.

---

# **🧩 2\. Mapeamento de Requisitos**

## **🎯 Core Features (MUST)**

| Requisito | Descrição | Prioridade |
| ----- | ----- | ----- |
| Upload CSV | Upload manual de 1 ou múltiplos CSVs | MUST |
| Parser Inteligente | Identificar colunas automaticamente | MUST |
| Dashboard Geral | Receita, comissão, pedidos | MUST |
| Análise por Canal | Agrupar pedidos e comissão por canal | MUST |
| Análise por Sub\_ID | Cliques, pedidos, conversão | MUST |
| Pedidos por Hora | Heatmap ou gráfico horário | MUST |
| Top Produtos | Ranking por comissão | MUST |
| Diretas vs Indiretas | Separação de vendas | MUST |

---

## **📊 Relatórios Avançados (SHOULD)**

| Relatório | Descrição |
| ----- | ----- |
| Taxa de Conversão por Sub\_ID | Pedidos ÷ Cliques |
| ROI por Sub\_ID | Comissão ÷ Cliques |
| Ticket Médio | Vendas ÷ Pedidos |
| Tendência diária | Vendas por dia |
| Ranking por Dia da Semana | Identificar melhor dia |
| Ranking por Período do Dia | Manhã, Tarde, Noite |
| Funil (Cliques → Pedido → Comissão) | Conversão completa |

---

## **🚀 Relatórios Estratégicos (COULD)**

* Análise de Sub\_ID com queda de performance

* Comparativo entre períodos

* Alertas automáticos

* Projeção mensal baseada em média diária

* Score de Sub\_ID

* Análise de dependência de canal (% concentração)

---

# **❓ 3\. Perguntas Críticas (Bloqueadoras)**

1. O sistema será:

   * (A) Web App

   * (B) Sistema Desktop

   * (C) Dashboard interno simples

2. Usuários:

   * (A) Apenas você

   * (B) Multiusuário

3. Os CSVs seguem sempre o mesmo padrão?

   * (Sim / Não)

4. Deseja salvar histórico de relatórios?

   * (Sim / Não)

5. Precisa de login/autenticação?

   * (Sim / Não)

6. Deseja exportação de relatórios em:

   * (A) PDF

   * (B) Excel

   * (C) Ambos

---

# **🔧 4\. Propostas Técnicas Automáticas**

## **Stack (Recomendação)**

### **Opção 1 – Simples e Escalável (RECOMENDADO)**

* Frontend: Next.js

* Backend: Node.js

* Banco: PostgreSQL

* Upload: S3

* Deploy: Vercel \+ Supabase

✔ Escalável  
 ✔ Fácil manutenção  
 ✔ Permite multiusuário

---

### **Opção 2 – Rápido MVP**

* Streamlit (Python)

* Sem banco (processa CSV direto)

✔ Muito rápido  
 ✖ Pouco escalável

---

### **Opção 3 – Power BI Custom**

* Upload \+ Template pronto

* Automatização via script

✔ Sem desenvolvimento pesado  
 ✖ Pouca flexibilidade

---

# **📘 5\. PRD COMPLETO**

---

# **🏷 Nome do Produto**

**Comissões Lab**

---

# **🎯 Objetivo**

Criar um sistema que processe CSVs de comissão e cliques, gere relatórios automáticos e identifique quais Sub\_IDs, canais, produtos e horários geram maior resultado.

---

# **👤 Público-Alvo**

Afiliados Shopee / Produtores digitais

---

# **🧠 Métricas-Chave (KPIs)**

* Comissão líquida total

* Taxa de conversão por Sub\_ID

* Receita por canal

* Ticket médio

* Horário de pico

* Produto campeão

---

# **🏗 Arquitetura**

Input:  
 CSV → Parser → Normalização → Banco

Processamento:  
 Agregações → Métricas → Cálculos de conversão

Output:  
 Dashboard interativo \+ Exportação

---

# **📊 Módulos do Sistema**

---

## **MÓDULO 1 — Upload & Processamento**

| Item | Descrição |
| ----- | ----- |
| Upload CSV | Drag & Drop |
| Validação | Verificar colunas obrigatórias |
| Log de processamento | Mostrar erros |

Estimativa: M  
 Dependência: Parser

Critério de Aceite:

* CSV processado sem erro

* Dados aparecem no dashboard

---

## **MÓDULO 2 — Dashboard Geral**

| Métrica | Fórmula |
| ----- | ----- |
| Comissão Líquida | Soma comissão |
| Total Vendas | Soma valor pedido |
| Pedidos | Count pedido\_id |
| Ticket Médio | Vendas / Pedidos |

Estimativa: S

---

## **MÓDULO 3 — Relatório por Sub\_ID**

| Métrica | Fórmula |
| ----- | ----- |
| Cliques | Count click\_id |
| Pedidos | Count pedido |
| Conversão | Pedidos / Cliques |
| Comissão | Soma comissão |
| ROI | Comissão / Cliques |

Estimativa: M

---

## **MÓDULO 4 — Relatório por Canal**

* Pedidos por canal

* Comissão por canal

* % participação

Estimativa: S

---

## **MÓDULO 5 — Análise Temporal**

* Por dia

* Por hora

* Por dia da semana

* Comparação períodos

Estimativa: M

---

## **MÓDULO 6 — Ranking Produtos**

* Top 10 por comissão

* Top 10 por quantidade

* Margem média por item

Estimativa: S

---

## **MÓDULO 7 — Diretas vs Indiretas**

* Separação clara

* Comissão separada

* % dependência

Estimativa: XS

---

# **🔐 Segurança & Compliance**

* Armazenamento criptografado

* LGPD: não armazenar dados sensíveis

* Logs de upload

* Backup automático

---

# **🗓 Roadmap**

| Sprint | Entrega |
| ----- | ----- |
| 1 | Upload \+ Dashboard básico |
| 2 | Sub\_ID \+ Canal |
| 3 | Temporal \+ Produtos |
| 4 | Exportação \+ Melhorias UX |

Tempo estimado: 4–6 semanas

---

# **📦 Exportações**

* PDF executivo

* Excel detalhado

* CSV normalizado

---

# **📈 Relatórios Extras Recomendados**

1. Sub\_ID com maior conversão

2. Sub\_ID com maior clique e baixa conversão (alerta)

3. Melhor horário por canal

4. Canal com maior ticket médio

5. Produtos com baixa comissão por clique

6. Comparativo mês atual vs anterior

7. Análise de concentração (80/20)

---

# **📝 Perguntas Pendentes**

* Frequência de uso?

* Volume médio de pedidos/mês?

* Deseja versão mobile?

* Vai integrar API Shopee no futuro?

---

# **📎 Apêndices**

## **Arquivos Analisados**

* AffiliateCommissionReport202602251312.csv

* WebsiteClickReport202602251249.csv

* 5 imagens de dashboard

## **Suposições**

* CSV contém:

  * pedido\_id

  * sub\_id

  * comissão

  * canal

  * status

  * data/hora

## **Decision Log**

* Recomendado stack escalável

* Dashboard modular

* Estrutura preparada para API futura
