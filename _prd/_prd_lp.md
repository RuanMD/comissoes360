# **📄 PRD — Landing Page \+ Sistema de Login por E-mail (SaaS de Comissões)**

**Produto:** Comissões 360  
 **Versão:** 1.0  
 **Data:** 26/02/2026  
 **Modelo de negócio:** Assinatura mensal  
 **Stack recomendada:** Next.js \+ Supabase (Auth \+ Database)

---

# **🧾 RESUMO EXECUTIVO**

Este PRD define:

1. A estrutura completa da **Landing Page de vendas**

2. O fluxo de **Login apenas com e-mail (passwordless)**

3. A lógica de **validação de assinatura ativa**

4. Integração com **Supabase**

5. Regras de acesso ao sistema

O modelo será SaaS por assinatura mensal, com controle simples:

* Usuário informa e-mail

* Sistema verifica se o e-mail existe no Supabase

* Verifica se a assinatura está ativa e dentro da validade

* Se válido → acesso liberado

* Se expirado → redireciona para pagamento

Sem senha. Sem recuperação de senha. Fluxo simples e direto.

---

# **🧩 1\. LANDING PAGE — PRD COMPLETO**

---

# **🎯 OBJETIVO DA LANDING**

Converter afiliados Shopee (e marketplaces) em assinantes do sistema.

---

# **🏗 ESTRUTURA DA LANDING (Dobras)**

---

## **🔝 1ª Dobra — Hero Section (Acima da dobra)**

### **Objetivo:**

Capturar atenção \+ comunicar proposta de valor clara.

### **Layout:**

* Headline forte

* Subheadline

* CTA principal

* Botão secundário

* Mockup do dashboard

* Header fixo

---

### **✍ COPY**

**Headline:**

Descubra quais SubIDs realmente dão lucro — antes de perder dinheiro

**Subheadline:**

Pare de adivinhar. Saiba exatamente quais links, horários e canais estão gerando comissão real na Shopee.

---

### **CTA Primário:**

🔶 "Quero analisar minhas comissões"

### **CTA Secundário:**

🔹 "Ver como funciona"

---

### **Header**

* Logo

* Menu:

  * Recursos

  * Como funciona

  * Depoimentos

  * Preço

* Botão:  
   🔘 Login

---

### **Requisitos Técnicos**

* Header fixo

* Scroll suave

* Responsivo

Estimativa: S  
 Prioridade: MUST

---

## **💥 2ª Dobra — O Problema**

### **Copy**

Você está investindo tempo, tráfego e conteúdo…  
 Mas não sabe qual SubID realmente está convertendo.

Bullets:

* ❌ Não sabe qual horário vende mais

* ❌ Não sabe qual canal traz lucro real

* ❌ Não sabe qual produto realmente compensa

* ❌ Depende de relatórios confusos

---

Objetivo: Gerar dor \+ identificação

---

## **🚀 3ª Dobra — A Solução**

Headline:

Um painel que transforma seus CSVs em inteligência estratégica

Lista de recursos:

* 📊 Análise por SubID

* 📈 Conversão real por canal

* 🕒 Vendas por hora e dia

* 💰 Comissão líquida consolidada

* 🔎 Ranking de produtos

* 🔄 Diretas vs Indiretas

CTA:  
 🔶 "Quero acesso agora"

---

## **🧠 4ª Dobra — Como Funciona**

Passo 1:  
 Envie seu relatório CSV da Shopee

Passo 2:  
 O sistema processa automaticamente

Passo 3:  
 Você visualiza:

* SubIDs mais lucrativos

* Horários campeões

* Canais com maior ROI

---

## **📊 5ª Dobra — Preview do Sistema**

* Prints do dashboard

* Destaques:

  * Comissão total

  * Pedidos por hora

  * Ranking SubID

Objetivo: Prova visual

---

## **💬 6ª Dobra — Prova Social (Opcional)**

Depoimentos (placeholder)

---

## **💳 7ª Dobra — Preço**

Modelo:

Plano Único  
 R$ XX / mês

Inclui:

* Upload ilimitado

* Relatórios completos

* Histórico

* Suporte

Botão:  
 🔶 Assinar Agora

---

## **❓ 8ª Dobra — FAQ**

* Precisa instalar algo?

* Funciona com qualquer conta Shopee?

* Tem fidelidade?

* Posso cancelar quando quiser?

---

## **🏁 9ª Dobra — CTA Final**

Headline:

Pare de trabalhar no escuro.

Botão:  
 🔶 Começar agora

---

# **🎨 Diretrizes Visuais**

* Dark mode

* Laranja como cor principal

* Visual SaaS moderno

* Layout focado em conversão

---

# **📈 Métricas da Landing**

* Taxa de conversão

* CTR botão login

* CTR botão comprar

* Taxa de scroll

---

# **🔐 2\. PRD — SISTEMA DE LOGIN (APENAS E-MAIL)**

---

# **🎯 OBJETIVO**

Permitir acesso apenas para usuários com assinatura ativa.

Sem senha.

---

# **🏗 FLUXO DE LOGIN**

1. Usuário clica em "Login"

2. Vai para tela /login

3. Insere e-mail

4. Sistema verifica:

   * E-mail existe?

   * Assinatura ativa?

   * Data de validade \>= hoje?

5. Se válido:  
    → Redireciona para /dashboard

6. Se inválido:  
    → Redireciona para /checkout

---

# **🖥️ TELA: LOGIN**

---

## **Layout**

* Logo

* Headline:

   Acesse sua conta

* Campo:  
   E-mail

* Botão:  
   Entrar

* Link:  
   "Ainda não sou assinante"

---

## **Regras de Validação**

* Campo obrigatório

* E-mail válido (regex)

* Não precisa senha

---

# **🧠 LÓGICA NO SUPABASE**

---

## **Tabela: users**

| Campo | Tipo |
| ----- | ----- |
| id | uuid |
| email | text |
| subscription\_status | text |
| subscription\_expires\_at | timestamp |
| created\_at | timestamp |

---

## **Regras de Acesso**

### **Acesso permitido se:**

subscription\_status \= "active"  
AND  
subscription\_expires\_at \>= now()  
---

## **Caso assinatura vencida:**

* Mostrar mensagem:

   Sua assinatura expirou. Renove para continuar.

* Redirecionar para pagamento

---

# **🔁 Fluxo Técnico**

Front:

* Envia e-mail

Backend:

* Consulta Supabase

* Verifica status

* Gera sessão JWT

Sessão:

* Expira automaticamente

* Armazenada em cookie httpOnly

---

# **🔒 Segurança**

* Não revelar se e-mail existe ou não

* Mensagem genérica:

   Se sua assinatura estiver ativa, você será redirecionado.

* Rate limit por IP

---

# **⚙️ Estados da Tela**

1. Idle

2. Loading

3. Sucesso (redirect)

4. Assinatura expirada

5. Erro genérico

---

# **📊 Critérios de Aceite**

* Login válido redireciona corretamente

* Login inválido não revela dados

* Assinatura vencida bloqueia acesso

* Não há necessidade de senha
