# CashUp — documentação completa do sistema

Documento de repasse para quem for continuar o desenvolvimento (pessoa ou IA). Descreve o que o sistema faz, como está construído, as regras de negócio, a segurança, o deploy e o que está pendente. Idioma da interface e do código de domínio: **português do Brasil**.

- Repositório: `le7martins/meu_financeiro` (branch de produção: `main`)
- Site: https://le7martins.github.io/meu_financeiro/
- Projeto Firebase: `meu-financeiro-13919`
- Público: uso pessoal e familiar (poucas contas). Meta de infraestrutura: **custo zero**.

> Convenção deste documento: o que foi conferido no código está afirmado direto; o que depende de consoles externos (Firebase, GitHub, Google Cloud) e não foi verificado está marcado como **[não verificado]**.

---

## 1. O que é

CashUp é um PWA de finanças pessoais: lançamentos de receitas e despesas (únicos, fixos, parcelados, semanais/quinzenais), dívidas, cartões de crédito com faturas, contas/carteiras, orçamentos por categoria, metas, análise gráfica, projeção, "saúde financeira", notificações de vencimento, exportação/importação e backup. Os dados ficam no Firestore de cada usuário, com cache local e funcionamento offline.

## 2. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Front | React 19 + Vite (SPA/PWA), sem roteador (navegação por abas em estado), CSS em JS (`src/styles.js`) + tokens CSS (`src/appCss.js`) |
| Hospedagem | GitHub Pages, base `/meu_financeiro/` (não há servidor próprio) |
| Backend | Firebase: Auth (Google + e-mail/senha), Firestore, Cloud Messaging (FCM), App Check (opcional) |
| Cache/offline | `localStorage` (`mf2_{uid}_*`) + cache persistente do Firestore (IndexedDB, multi-aba) + service worker |
| Cron | GitHub Actions (`notify.yml`) executa `scripts/notify.mjs` (firebase-admin) todo dia 11:00 UTC (08:00 BRT) |
| Testes | Vitest + Testing Library (jsdom). ESLint com `react-hooks` |

Não existe backend próprio (sem Cloud Functions). Tudo que roda no servidor é o script do cron, com Admin SDK, que ignora as regras do Firestore.

### Estrutura de pastas

```
src/
  App.jsx                 portão de autenticação (login → verificação de e-mail → lista de convidados → app)
  main.jsx, firebase.js   inicialização (Auth, Firestore com cache persistente, Messaging, App Check)
  db.js                   toda a leitura/escrita no Firestore (dados, perfis, convidados, aviso global, exclusão de conta)
  logic.js                REGRAS DE NEGÓCIO puras (faturas, saldo acumulado, saúde, dívidas, alertas de vencimento)
  entryActions.js         ações sobre lançamentos (editar com escopo, pagar fatura, validar, backup, CSV)
  categoryMigration.js    categorias por tipo + migração idempotente
  utils.js, constants.js  formatação, datas, categorias padrão
  hooks/                  useUserData (sincronização), useMonthStats, useToast, useToday
  screens/                Home (Contas), Chart (Análise, com abas em screens/chart/), Cartao, Dividas, Saude, Profile, Admin, Onboarding
  components/ modals/     peças de interface e formulários
  LoginScreen, VerifyEmailScreen, PendingAccessScreen
  pdfReport.js            relatório mensal em HTML/PDF (escapado e com CSP própria)
public/sw.js              service worker (cache do app + push em segundo plano)
scripts/notify.mjs        cron de notificações; scripts/gen-icons.mjs gera os ícones
firestore.rules           regras de segurança (publicadas MANUALMENTE no console)
.github/workflows/        ci.yml, deploy.yml, notify.yml; dependabot.yml
```

## 3. Modelo de dados (Firestore)

```
users/{uid}/data/{entries|dividas|cards|purchases|faturas|settings}   →  { v: <valor> }
userProfiles/{uid}                                                    →  perfil (campos fixos, ver regras)
allowedEmails/{email-minúsculo}                                       →  { addedAt }   (lista de convidados)
config/announcement                                                   →  { text, updatedAt }  (aviso global)
```

- Cada documento de dados guarda o valor inteiro em `v` (lista ou mapa). **Limitações conhecidas:** teto de 1 MB por documento e última-gravação-vence entre aparelhos. Migrar para um documento por lançamento é a melhoria estrutural mais importante, ainda não feita.
- `entries` (lista): `id, description, amount, date (YYYY-MM-DD), type ('receita'|'despesa'), status, category, recurrence ('none'|'fixed'|'installment'|'weekly'|'biweekly'), installments, endMonth, notes, tags[], statusByMonth{}, overrides{}, paidDate, paidDateByMonth{}`.
- `dividas`, `cards` (`name, closeDay, dueDay, color, limite`), `purchases` (compras no cartão: `cardId, amount, purchaseDate, parcelas`), `faturas` (mapa com o estado de pagamento por cartão/mês).
- `settings` (mapa) guarda, entre outros: `accounts` (contas/carteiras com saldo inicial), categorias, `budgets` (limite por categoria), `goals`, `notifSettings` (`enabled, daysBefore, overdueAlert, incomeAlert`) e `theme`.
- Os campos exatos estão em `src/logic.js`, `src/entryActions.js`, `src/hooks/useUserData.js` (mapa `COLLECTIONS`) e `src/demoData.js` (exemplo completo).

## 4. Regras de negócio (decididas com o dono do produto)

1. **Fatura de cartão conta no mês do VENCIMENTO**, não no do fechamento (é quando o dinheiro sai). Se `dueDay > closeDay`, vence no mesmo mês do fechamento; senão, no mês seguinte (`faturaDueOffset`).
2. Pagar fatura **acumula** valores (pagamentos parciais). Fatura ainda aberta aparece como "em aberto" e não entra em alertas.
3. **Categorias separadas por tipo** (despesa × receita). `divida` e `cartao` são reservadas (usadas automaticamente, não aparecem nos seletores). Dívida não tem seletor de categoria.
4. Editar lançamento recorrente/parcelado pede o **escopo**: "só este mês" ou "este e próximos" (regra de divisão em `applyEntryEdit`). Dá para restaurar o valor padrão de um mês ajustado.
5. Saldo acumulado considera meses anteriores e as contas/carteiras (`accumulatedBalance`, `accountBalances`).
6. **Saúde financeira** (`computeHealth`): nota de 0 a 100 com penalidades por gastos fixos altos (>30/50/70% da renda), poupança baixa (<20/10%) e pendências >30% da renda. Níveis: Saudável ≥80, Atenção ≥60, Crítico.
7. Valores sempre exibidos como `1.234,56`, **sem "R$"**. Abreviações em pt-BR (`1,5k`).
8. Datas sempre no fuso local (`todayISO`), nunca `toISOString()`.
9. Parcelas: o resto do arredondamento vai na 1ª parcela, de modo que a soma é exata (`installmentAmount`).
10. CSV de exportação: separador `;`, decimal com vírgula, com proteção contra fórmula (`=+-@`).

## 5. Funcionalidades por tela

Navegação inferior: **Contas · Análise · Cartões · Dívidas · Mais**. O cabeçalho tem busca global (lupa), alternância de tema e o indicador de saúde financeira.

- **Contas (Home):** lista do mês com seletor de mês; resumo (receitas, despesas, saldo); cartões de lançamento com marcar pago/recebido (toque ou deslizar), menu de ações (editar, clonar, excluir), avisos de orçamento estourado/valor ajustado; filtros (tipo, status, categoria); botão flutuante para novo lançamento (despesa, receita, compra no cartão, dívida).
- **Análise:** abas Visão geral, Categorias, Projeção (3/6/12 meses), Comparar (mês a mês) e Cartões; período selecionável; insights; relatório compartilhável em imagem (canvas) e relatório mensal em PDF/HTML.
- **Cartões:** cadastro de cartões, compras (inclusive parceladas), faturas por mês, limite usado, pagamento total/parcial, plano de faturas.
- **Dívidas:** cadastro com parcelas, acompanhamento de quitação e estatísticas (`debtStats`).
- **Saúde:** detalhamento da nota de saúde financeira e histórico.
- **Mais (Perfil):** conta (alterar nome/senha, **excluir minha conta**, sair), notificações (permissão e preferências), contas e carteiras, exportar (CSV por mês/intervalo/tudo, PDF), importar CSV (com mapeamento de colunas e detecção de duplicados), backup/restauração JSON, dados (limpar), aparência (tema claro/escuro), sobre. Para o administrador há também o **Painel Admin**.
- **Onboarding:** tela inicial para novos usuários. **Modo demo** (dados fictícios, isolado do Firestore).
- **Painel Admin** (somente `gomesmartins2302@gmail.com` com login Google): lista de contas com etiquetas (liberado/aguardando, e-mail confirmado, notificações ativas, inativo há 30+ dias), liberar/revogar acesso, liberar e-mail antes do cadastro, enviar redefinição de senha, copiar UID, publicar/remover **aviso global**.

## 6. Autenticação e acesso

Fluxo de entrada em `App.jsx`:
1. Login (Google ou e-mail/senha; senha mínima de 8 caracteres).
2. **Verificação de e-mail** obrigatória só para contas e-mail/senha criadas a partir de 12/11/2026 (`VERIFY_REQUIRED_FROM`); contas antigas e contas Google ficam isentas.
3. **Lista de convidados:** só e-mails em `allowedEmails` usam o app (o admin é isento). Quem não está vê "Aguardando liberação". As regras do Firestore também exigem isso; a tela é só a mensagem amigável.
4. App.

Excluir conta (LGPD): reautentica (senha ou popup Google), exige digitar EXCLUIR, apaga os 6 documentos de dados e o perfil, exclui o login e limpa o cache local. Logout limpa `localStorage` e o cache do Firestore (IndexedDB) e recarrega.

## 7. Segurança

Implementado (ver também `SECURITY.md`):
- `firestore.rules`: dados só do dono e só nos 6 documentos esperados (formato `{v}` e limites de tamanho); perfil com campos fixos e e-mail igual ao do token; admin exige e-mail verificado **e** provedor Google; lista de convidados gerenciada só pelo admin; aviso global (admin escreve, convidados leem); resto negado.
- Relatório PDF: todo texto do usuário escapado, cores validadas, CSP com nonce, sem `onclick` inline.
- Backup/CSV importados validados (números finitos, limites de lista/tamanho, cores hex, IDs simples, arquivo ≤ 1 MB).
- Service worker limita tamanho de título/corpo de notificações. CSV exportado neutraliza fórmulas.
- Workflows com permissões mínimas (`contents: read` onde possível); chave do cron com `umask 077` e removida no fim.
- Dependabot semanal (npm) e mensal (actions). `.gitignore` cobre `.env*` e chaves de service account.

**Pendências que dependem do dono (consoles) [não verificado se já feitas]:**
1. Publicar o `firestore.rules` atual no console do Firebase (é manual; **sempre liberar os parentes no painel antes de publicar**, senão perdem acesso).
2. Restringir a chave de API por referrer HTTP (domínio do GitHub Pages + `meu-financeiro-13919.firebaseapp.com`).
3. App Check: chave reCAPTCHA Enterprise, segredo `VITE_RECAPTCHA_SITE_KEY` no GitHub, observar métricas e só então ativar enforcement.
4. Authentication: modelo do e-mail de verificação em português, domínios autorizados, proteção contra enumeração de e-mails, política de senha.
5. Service account do cron com permissão mínima (hoje é a conta com acesso total), segredo `FIREBASE_SERVICE_ACCOUNT`.
6. GitHub: proteção da `main`, secret scanning, 2FA, Dependabot alerts; confirmar visibilidade do repositório.
7. Alerta de orçamento no Google Cloud e backup/PITR do Firestore.
- Sem CSP no `index.html` (precisa ser testada com o login do Google). Os 4 avisos altos do `npm audit` são da cadeia `firebase → grpc-js` (lado servidor, fora do bundle); a única correção oferecida seria rebaixar o Firebase.
- As regras não têm testes automatizados (exigem o emulador do Firestore).

## 8. Notificações

- **Em primeiro plano:** `src/notifications.js` (`checkAndNotify`) usa `src/logic.js` (`collectDueAlerts`/`formatDueAlerts`) e dispara ao abrir o app, no máximo uma vez por dia.
- **Com o app fechado (push):** `scripts/notify.mjs` roda no GitHub Actions, lê cada usuário com `fcmToken` e envia **uma** notificação resumida via FCM. O token é gravado no perfil por `src/fcm.js` (precisa do segredo `VITE_VAPID_KEY` no build e da permissão do usuário). O service worker (`public/sw.js`) exibe a mensagem e abre o app ao tocar.
- **Problema aberto (investigado em 12/11/2026):** a última execução do cron registrada foi em 14/08/2026 ("0 enviados, 3 sem alertas/token"). O GitHub desativa agendamentos de repositórios inativos por 60 dias; o workflow aparece como ativo agora, mas não foi confirmada nova execução. Melhorias propostas e **ainda não implementadas**: passo no workflow que se reativa a cada execução; log que diferencie "sem token" de "sem alertas"; enviar mensagens só com `data` para evitar notificação duplicada (hoje a mensagem tem `notification` e o SW também chama `showNotification`); diagnóstico no Perfil ("ativas/inativas" + botão reativar); segundo horário diário. Fatores do aparelho: economia de bateria no Android; iPhone exige PWA instalado (iOS ≥ 16.4).
- Versões: o service worker importa Firebase compat **11.0.0** do gstatic, enquanto o app usa Firebase 12 (não foi verificado se o URL/versão continua válido).

## 9. Build, testes e deploy

- `npm ci` · `npm run dev` · `npm run lint` (deve ter 0 avisos) · `npm test` (122 testes) · `npm run build`.
- **Deploy:** push na `main` → `deploy.yml` (instala, lint, testes, build com `VITE_VAPID_KEY` e `VITE_RECAPTCHA_SITE_KEY` dos segredos, publica em `gh-pages` com `peaceiris/actions-gh-pages`). `ci.yml` roda em outras branches e PRs.
- Variáveis de ambiente de build: `VITE_VAPID_KEY`, `VITE_RECAPTCHA_SITE_KEY` (opcional; sem ela o App Check fica inativo).
- Service worker: cache `mf-v5`; navegação rede-primeiro, `/assets/*` cache-primeiro. **Ao mudar assets ou lógica do SW, incrementar `CACHE`.** Depois de um deploy, o PWA instalado pode precisar ser fechado e reaberto para pegar a versão nova.
- Os testes cobrem lógica de negócio (`logic`, `entryActions`, `categoryMigration`, `utils`), segurança (`security.test.js`), componentes e um teste de fumaça do app inteiro com Firebase mockado.

## 10. Convenções de desenvolvimento

- Regras de negócio **puras** em `src/logic.js`/`entryActions.js`, com "hoje" injetável (`today = todayISO()`), para testar sem relógio. O cron reutiliza `logic.js`: qualquer mudança lá afeta as notificações.
- Estilo: CSS em JS com tokens (`var(--fs-md)`, cores semânticas como `--danger`, `--success`, `--accent`); tamanhos de fonte mínimos 11px; alvos de toque ≥ 44px; temas claro e escuro (conferir contraste nos dois).
- Textos do usuário nunca vão para HTML cru (React escapa; no relatório use `esc()`).
- Toda gravação no Firestore passa por `src/db.js`; novas coleções exigem atualizar `firestore.rules` (que é publicado manualmente) e o mock de `../db` no teste de fumaça.
- Preferência do dono: interface limpa e funcional; menos botões e mais ícones; avaliar com análise antes de mudanças grandes; infraestrutura gratuita.

## 11. Roadmap e ideias não implementadas

1. Um documento Firestore por lançamento (remove o limite de 1 MB e o conflito de última-gravação).
2. Correções de notificação da seção 8.
3. CSP no `index.html` testada com o login do Google.
4. Testes das regras do Firestore com o emulador.
5. Integração com WhatsApp + IA (registrar despesa e consultar por mensagem): exigiria conta Meta, plano Blaze do Firebase e chave de API de IA; implica servidor (Cloud Functions), portanto sair do "custo zero".
6. Avisos do `npm audit` na cadeia `firebase`: aguardar versão corrigida.
7. Atualizações abertas do Dependabot (react, firebase 13, vite plugin, actions): testar login e salvamento antes de aceitar.
