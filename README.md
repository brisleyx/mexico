# LaMantra

App de video para México: usuarios ganan **MXN reales** por ver campañas de marcas socias y retiran **solo lo ganado**, por **SPEI** (CLABE).

Marca propia. Cadastro, login e perfil. Sem taxa para “liberar saque”.

## O que este MVP faz

- Landing, criar conta, entrar, sair
- Feed de vídeos de parceiros
- Player que exige ~80% assistido (sem pular) para creditar
- Carteira em pesos mexicanos, teto diário de $80 MXN
- Pedido de saque SPEI a partir de $20 MXN de saldo já ganho
- Perfil com nome e CLABE (dígito verificador)

Modo atual: **demo local** (dados no navegador). Para produção, ligue um projeto Supabase **só do LaMantra**.

## Como rodar

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

```bash
npm run build
```

## Conta

1. `/registro` — nome, e-mail, senha (mín. 8)
2. `/entrar`
3. `/app/perfil` — nome e CLABE
4. `/app` — ver vídeo do sócio
5. `/app/billetera` — solicitar SPEI

No demo, a CLABE `000000000000000000` passa o checksum (só para testar a tela).

## Supabase (produção)

1. Crie um projeto novo no Supabase **só para o LaMantra** (não reutilize o banco de doações nem outro produto).
2. `supabase link` nesse projeto e rode as migrations em `supabase/migrations/` (perfil/carteira + `spei_payments`).
3. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Em Authentication, habilite e-mail.

### Pagnovo SPEI (MXN)

O browser **nunca** chama `api.pagnovo.com`. As Edge Functions em `supabase/functions/` fazem isso.

1. Dashboard Supabase → Edge Functions → Secrets:
   - `PAGNOVO_SECRET_KEY` — secret da API (Basic `secret:KEY`). **Não** use prefixo `VITE_`.
   - `PAGNOVO_WEBHOOK_SECRET` — secret do endpoint de webhook v2 (não é a API key).
2. Deploy:
   ```bash
   npx supabase functions deploy payment-create --no-verify-jwt=false
   npx supabase functions deploy payment-status
   npx supabase functions deploy pagnovo-webhook --no-verify-jwt
   ```
   (`pagnovo-webhook` tem `verify_jwt = false` no `supabase/config.toml` — a auth é HMAC `x-signature`.)
3. No painel Pagnovo, webhook v2 URL:
   `https://<PROJECT>.supabase.co/functions/v1/pagnovo-webhook`
   Evento: `cashin.paid` (e `cashin.refunded` se quiser).
4. Quando as funções e secrets estiverem no ar, no `.env` de produção: `VITE_PAGANOVO_MOCK=false`.

Enquanto `VITE_PAGANOVO_MOCK` não for `false`, o `/app/pago` continua no simulador local.

O app escolhe sozinho: com `VITE_SUPABASE_*` usa Auth/carteira Supabase; sem elas, demo local.

## Estrutura

```
src/
  components/     # shell, logo, rotas protegidas
  context/        # sessão
  lib/            # API, CLABE, dinheiro, vídeos
  pages/          # landing, auth, feed, player, carteira, perfil
supabase/migrations/
```

## GitHub

```bash
git init
git add .
git commit -m "Initial LaMantra MVP for Mexico SPEI rewards"
```

Depois crie o repositório vazio e faça `git remote add origin` + `git push`.

Não commite `.env`.
