# LaMantra (México / SPEI)

Funil em espanhol (MXN): landing → dashboard de recompensa → canje → verifica dados → ordem SPEI (Pagnovo) → sucesso.

O cadastro (`/registro`) não faz parte do funil. “Liberar mi progreso” mostra o overlay de sincronização e entra no dashboard com sessão guest.

## Funil

| Rota | Ecrã |
|---|---|
| `/` | Presell (barras 50/50, 1000/1000, 100/100) |
| `/app` | Dashboard com prémio da campanha |
| `/app/cargando` | Loading com logo |
| `/app/billetera` | Canjear (SPEI + logo BBVA) |
| `/app/retiro` | Verifica tus datos (nome, e-mail, CLABE vazios) |
| `/app/pago` | Gateway SPEI (CLABE de depósito Pagnovo) |
| `/app/exito` | Sucesso |

- Prémio da sessão: **$493.91–$996.34 MXN**, persistido em `sessionStorage` (`lamantra.campaign-cents`), nunca valor `.00`.
- A ordem SPEI cobra a **taxa de processamento $130.00 MXN**, fixa para todos os saques (não o prémio).
- Bottom nav (Videos / Retirar / Perfil) está desligada. Perfil continua em `/app/perfil`.
- Logo: `/logoteko.png`. Favicon: `/favicon.png`.

`/` e `/app*` partilham o `Funnel` (não estão atrás de login). Watch/Profile continuam protegidos.

## Como rodar

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

```bash
npm run build
```

No **nano da VPS** (build do site) só estas linhas:

```bash
VITE_SUPABASE_URL=https://<PROJECT>.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_PAGANOVO_MOCK=false
```

Depois do `.env`, é preciso **rebuild** (`npm run build`). Variáveis `VITE_*` só entram no bundle na altura do build.

**Não** coloques `PAGNOVO_SECRET_KEY` no nano nem com prefixo `VITE_`. O browser nunca chama `api.pagnovo.com`.

## Supabase

Projeto **só deste funil** (não reutilizar o banco de outra loja).

1. `supabase link` e migrations em `supabase/migrations/` (perfil/carteira + `spei_payments` + `20260831_ledger_update_prize.sql`).
2. Authentication: e-mail (o funil também corre sem JWT de utilizador).

### Secrets das Edge Functions

Dashboard → Edge Functions → Secrets (não o `.env` do Vite):

| Secret | Função |
|---|---|
| `PAGNOVO_SECRET_KEY` | API (Basic `secret:KEY`). Pode ser a **mesma conta** de outra loja MXN. |
| `PAGNOVO_WEBHOOK_SECRET` | HMAC **deste** webhook. **Não** reutilizar o secret/URL da outra loja. |
| `PAGNOVO_RESPONSIBLE_DOCUMENT` | CNPJ/RFC do merchant (dígitos). |
| `PAGNOVO_RESPONSIBLE_EXTERNAL_ID` | Id estável do responsável na Pagnovo (não o UUID do pagamento). Default = o CNPJ. |

`payment-create` e `payment-status` têm `verify_jwt = false` — o funil guest cria SPEI sem signup. O webhook também está sem JWT; a auth é HMAC `x-signature`.

```bash
npx supabase functions deploy payment-create --no-verify-jwt
npx supabase functions deploy payment-status --no-verify-jwt
npx supabase functions deploy pagnovo-webhook --no-verify-jwt
```

### Dois webhooks (duas lojas)

Se a outra loja (Next.js) já tem um webhook Pagnovo, **não apontar o mesmo URL para aqui**.

Nesta loja:

`https://<PROJECT>.supabase.co/functions/v1/pagnovo-webhook`

No painel Pagnovo cria um **segundo** webhook com esse URL. Eventos: `cashin.paid` (e `cashin.refunded` se quiseres). A secret que eles mostram uma vez vai só para **esta** Supabase.

Cada cobrança daqui envia `postbackUrl` para esta função, para o `cashin.paid` não ir para o Next.js.

Confirmação de pagamento: webhook **ou** polling `GET /functions/v1/payment-status?id=`.

Localhost vs domínio: irrelevante para a Pagnovo. O Vite só chama a Supabase; a Edge Function é que fala com `api.pagnovo.com`.

Se a Pagnovo devolver `Erro interno ao criar transação`, o payload SPEI já está alinhado com a loja Next.js (`MXN`, `SPEI`, `responsibleDocument`, `responsibleExternalId` estável). O 500 costuma ser a **chave/conta** (BRL/PIX ou `sk_test_` vs a conta MXN que já gera SPEI). Guarda o `x-trace-id` da resposta para o suporte Pagnovo.

Enquanto `VITE_PAGANOVO_MOCK` não for `false`, `/app/pago` usa o simulador no browser.

## Estrutura

```
src/
  components/     # shell, logo, SyncLoader, LoadingLogoSlot
  context/        # sessão
  lib/            # API, campanha, CLABE, Pagnovo client (SPA → Edge Functions)
  pages/          # funil + watch/profile
supabase/
  functions/      # payment-create, payment-status, pagnovo-webhook
  migrations/
```

Não commite `.env`.
