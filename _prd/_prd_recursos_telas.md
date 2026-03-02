# **📄 PRD — Design de Telas (UI/UX)**

**Produto:** Comissões Lab  
 **Versão:** 1.0  
 **Data:** 25/02/2026

---

# **🧾 RESUMO EXECUTIVO**

Este documento define todas as telas do sistema de relatórios de comissões baseado em CSV, detalhando estrutura, componentes, estados, regras de exibição, interações e critérios de aceite.

O objetivo é garantir que o sistema seja:

* Simples para upload

* Poderoso para análise

* Visualmente orientado à tomada de decisão

* Escalável para novos relatórios

O design segue padrão dashboard SaaS moderno, dark mode como default (baseado nas referências enviadas).

---

# **🧩 ARQUITETURA DE NAVEGAÇÃO**

Login  
└── Dashboard Geral  
     ├── Sub\_ID  
     ├── Canais  
     ├── Produtos  
     ├── Análise Temporal  
     ├── Diretas vs Indiretas  
     ├── Comparativos  
     └── Configurações  
---

# **🖥️ TELA 1 — Login (Opcional)**

### **Objetivo**

Autenticação de usuário.

### **Componentes**

* Logo

* Campo Email

* Campo Senha

* Botão Entrar

* Link "Esqueci senha"

### **Estados**

* Loading

* Erro de credencial

* Sucesso

Estimativa: XS  
 Prioridade: Should

Critério de Aceite:

* Login válido redireciona para Dashboard

---

# **🖥️ TELA 2 — Dashboard Geral**

## **Objetivo**

Visão executiva consolidada.

---

## **📊 Seção 1 — Cards Principais**

| Card | Descrição |
| ----- | ----- |
| Comissão Líquida | Soma total |
| Total em Vendas | Soma pedidos |
| Pedidos Totais | Count |
| Ticket Médio | Vendas ÷ Pedidos |
| Conversão Geral | Pedidos ÷ Cliques |

---

## **📈 Seção 2 — Gráficos**

1. Comissão por dia (linha)

2. Pedidos por hora (barras)

3. Vendas por canal (barra horizontal)

---

## **🔍 Seção 3 — Top Rankings**

* Top 5 Sub\_ID

* Top 5 Produtos

* Top 5 Canais

---

## **Filtros Globais (Persistentes)**

* Período

* Canal

* Sub\_ID

* Status (Pendentes / Concluídos / Não pagos)

---

Estimativa: M  
 Prioridade: MUST

Critério de Aceite:

* Atualização dinâmica ao mudar filtros

* Dados coerentes com CSV

---

# **🖥️ TELA 3 — Análise por Sub\_ID**

## **Objetivo**

Identificar quais Sub\_IDs geram resultado real.

---

## **Componentes**

### **📊 Tabela Principal**

| Ranking | Sub\_ID | Cliques | Pedidos | Conversão | Comissão | ROI | Participação |

---

### **📈 Gráficos**

1. Cliques vs Pedidos

2. Conversão por Sub\_ID

3. Heatmap horário por Sub\_ID

---

### **🔎 Funcionalidades**

* Ordenação por qualquer coluna

* Busca por Sub\_ID

* Expandir para ver produtos vendidos

---

Estimativa: M  
 Prioridade: MUST

Critério de Aceite:

* Conversão calculada corretamente

* Participação percentual correta

---

# **🖥️ TELA 4 — Análise por Canal**

## **Objetivo**

Entender origem das vendas.

---

## **Componentes**

### **📊 Tabela**

| Canal | Pedidos | Comissão | Ticket Médio | % Participação | Conversão |

---

### **📈 Gráficos**

* Pizza de participação

* Barra comparativa comissão

* Evolução por canal ao longo do tempo

---

Estimativa: S  
 Prioridade: MUST

Critério de Aceite:

* % soma \= 100%

---

# **🖥️ TELA 5 — Produtos**

## **Objetivo**

Descobrir produtos campeões.

---

## **Componentes**

### **📊 Tabela**

| Produto | Qtde Vendida | Comissão | Receita | Ticket Médio |

---

### **Recursos**

* Paginação

* Ordenação

* Exportar Excel

---

Estimativa: S  
 Prioridade: MUST

Critério de Aceite:

* Ranking correto por comissão

---

# **🖥️ TELA 6 — Análise Temporal**

## **Objetivo**

Identificar padrão de horário e dia.

---

## **Seções**

### **📅 Vendas por Dia**

Linha ou área

### **🕒 Vendas por Hora**

Barra 00h–23h

### **📊 Dia da Semana**

Ranking

### **🌅 Período do Dia**

* Manhã

* Tarde

* Noite

* Madrugada

---

Estimativa: M  
 Prioridade: SHOULD

Critério de Aceite:

* Horários corretos baseados no timestamp

---

# **🖥️ TELA 7 — Diretas vs Indiretas**

## **Objetivo**

Entender dependência de comissões indiretas.

---

## **Componentes**

* Card Diretas

* Card Indiretas

* % Dependência

* Gráfico comparativo

---

Estimativa: XS  
 Prioridade: MUST

Critério:

* Soma Diretas \+ Indiretas \= Total

---

# **🖥️ TELA 8 — Comparativo de Períodos**

## **Objetivo**

Comparar desempenho entre datas.

---

## **Componentes**

* Seleção Período A vs B

* Diferença %

* Crescimento ou queda

* Indicador verde/vermelho

---

Estimativa: M  
 Prioridade: COULD

---

# **🖥️ TELA 9 — Upload de CSV**

## **Objetivo**

Entrada de dados.

---

## **Componentes**

* Drag & Drop

* Selecionar arquivo

* Histórico de uploads

* Status de processamento

---

## **Regras**

* Validar colunas obrigatórias

* Exibir erros claros

* Não sobrescrever histórico

---

Estimativa: S  
 Prioridade: MUST

Critério:

* Upload com sucesso gera novo relatório

---

# **🖥️ TELA 10 — Configurações**

## **Objetivo**

Gerenciar sistema.

---

## **Componentes**

* Gerenciar usuários

* Definir padrão de período

* Configurar meta mensal

* Exportar base consolidada

---

Estimativa: S  
 Prioridade: SHOULD

---

# **🎨 Diretrizes de Design**

* Dark mode padrão

* Cores:

  * Laranja → comissão

  * Verde → crescimento

  * Vermelho → queda

  * Azul → cliques

* Layout responsivo

* Sidebar fixa

* Cards com destaque visual

---

# **⚙️ Requisitos Técnicos de Interface**

* Atualização via filtro sem reload

* Paginação server-side

* Exportação assíncrona

* Cache de consultas frequentes
