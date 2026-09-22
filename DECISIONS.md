# Prumo — Decisões Técnicas e Arquiteturais (DECISIONS.md)

Este documento registra as decisões de engenharia adotadas para o MVP do Prumo, conforme instrução da Seção 0 do Brief do Projeto.

---

### 1. Arquitetura de Aplicação & Runtime
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4.
- **Backend:** Servidor Node/Express integrado via Vite middleware em desenvolvimento e `esbuild` para bundle único de produção (`dist/server.cjs`), rodando na porta 3000 (`0.0.0.0:3000`).
- **Segurança de Chaves:** A chave de API de IA (`GEMINI_API_KEY`) é 100% mantida no servidor Express, jamais exposta ao cliente.
- **Resiliência / Modo Offline-First:** Toda a camada de dados funciona com persistência reativa local (`localStorage` tipado e estruturado conforme o schema conceitual do Prisma) sincronizada com as APIs de IA (`/api/copiloto`, `/api/categorize`). Se a conexão com a API falhar ou se o usuário não possuir chave ativa no momento, o aplicativo mantém fallback inteligente determinístico sem travar a interface.

---

### 2. Identidade Visual e Design System
- **Paleta de cores:** Fiel aos tokens da Seção 3 do brief:
  - Claro: `--bg: #F6F3EC`, `--surface: #FFFFFF`, `--surface-2: #EFEAE0`, `--line: #DAD3C4`, `--text: #1B2430`, `--text-dim: #5C6672`, `--accent: #B5642B` (cobre), `--positive: #2F7A5C`, `--warn: #A9781E`, `--danger: #AC3B32`.
  - Escuro: `--bg: #12181F`, `--surface: #1A222B`, `--surface-2: #232D39`, `--line: #2D3947`, `--text: #EDF1F4`, `--accent: #E0975A`, etc.
- **Tipografia:** Google Fonts carregadas no `index.html`:
  - **Fraunces** (serifada editorial de alto impacto para números grandes, métricas e títulos).
  - **IBM Plex Sans** (sans-serif neutra e técnica para UI, tabelas e corpo do texto).

---

### 3. Open Finance e Agregação de Contas (`AccountAggregator`)
- **Interface Abstrata:** Criada a interface `AccountAggregator` com métodos:
  - `listInstitutions(country: 'BR' | 'AO')`
  - `connectAccount(params: ConnectParams): Promise<Account>`
  - `syncTransactions(accountId: string): Promise<Transaction[]>`
- **Brasil (BR):** Provedor baseado na arquitetura Pluggy/Belvo (Open Finance regulado), com fluxo de consentimento simulado e sincronização de bancos brasileiros (Itaú, Nubank, Banco do Brasil, Inter, Bradesco).
- **Angola (AO):** Implementação "Manual / Extrato" (conforme diretriz da Seção 2), permitindo cadastro manual de contas (BAI, BFA, BIC, Standard Bank Angola, Caixa Geral Angola) com upload/digitação de extrato ou saldo.

---

### 4. Modelo de Dados e Regras de Negócio
- Implementados conforme a Seção 4:
  - `User` (perfil com profissão, país BR|AO, meta primária, valor guardado, prazo)
  - `Account` (contas conectadas ou manuais)
  - `Transaction` (receitas e despesas com categoria, fonte e data)
  - `BudgetLimit` (orçamento mensal por categoria e verificação de status: Dentro, Atenção >80%, Acima >100%)
  - `Goal` (metas financeiras)
  - `ScenarioSimulation` (projeção de 24 meses com eventos ligáveis de receitas/despesas)
  - `ChatMessage` (histórico de conversas com o copiloto)
  - `Alert` (alertas preditivos contextuais)

---

### 5. Copiloto de IA e Prompt de Sistema
- O prompt da Seção 5 é mantido no arquivo `/prompts/copiloto-system.md`.
- A cada requisição para `/api/copiloto`, o servidor monta o bloco `"Retrato financeiro atual"` com os dados consolidados do usuário (profissão, saldo agregado, receitas, despesas dos últimos 90 dias, orçamentos, meta principal e projeções ativas) e alimenta o modelo `gemini-3.8-flash`.
- Respostas estritamente formatadas na moeda local (`R$` ou `Kz`) e variante linguística (`pt-BR` ou `pt-AO`).
