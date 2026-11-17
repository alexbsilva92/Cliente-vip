# CLIENTE VIP

Sistema 100% Web + PWA com duas áreas integradas (**Área do Motorista** e **Área do Passageiro**) conectado diretamente ao banco Firestore existente do projeto.

## Áreas do Sistema Web (PWA)

1. **Área do Motorista (`/` ou `/motorista`):**
   - **PWA instalável na tela inicial** (`/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`).
   - Login com conta Google via Firebase Auth e identificação do motorista.
   - Painel principal com clientes ativos, total de corridas registradas, recompensas disponíveis e resgatadas.
   - Gerador de QR Code individual de uso único (validade de 15 minutos, status `ACTIVE` -> `USED`) com URL HTTPS pública (`/ride?code=VIP-XXXX-XXXX`), QR SVG embutido na tela, cronômetro e detecção automática de leitura.
   - Abas completas de **Clientes**, **Histórico de Corridas** e **Controle de Recompensas**, com resgate de corrida grátis, edição, arquivamento/restauração, exclusão e exportação de **Backup JSON** (`/api/driver/backup`).

2. **Área do Passageiro (`/ride?code=VIP-XXXX-XXXX` ou `/r/VIP-XXXX-XXXX`):**
   - Abre diretamente no navegador do celular (sem aplicativo, sem download e sem login Google).
   - Solicita apenas **Nome** e **Telefone / WhatsApp com DDD**.
   - Reconhece clientes existentes com segurança apenas no servidor durante o registro atômico da corrida, somando `+1 ponto` sem duplicar cadastro e liberando **1 corrida grátis na cidade** ao completar 10 pontos.

3. **Segurança e Saúde do Servidor:**
   - Endpoint de consulta pública por telefone (`POST /api/ride/client`) desativado (`403`) e leitura aberta de documentos `clients/{phone}` sem dono removida de `firestore.rules`.
   - Proteção contra repetição e envio concorrente no consumo do QR Code, cabeçalhos de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `X-Robots-Tag`) e limitador de taxa nas rotas públicas (`/api/ride/*`).
   - Rotas de saúde para Cloud Run em `/healthz` e `/_ah/health`.

## Executar o servidor localmente

Requisitos: Node.js 20 ou superior.

```bash
npm start
```

O servidor escuta a porta definida em `PORT` (padrão `3000`; `8080` no Cloud Run).

## Publicação no Google Cloud Run

O servidor utiliza a identidade de execução do Cloud Run (Application Default Credentials) para que a Área do Passageiro registre corridas sem login Google, enquanto a Área do Motorista usa o token JWT oficial do Google do próprio motorista obedecendo às regras do Firestore. Nunca inclua chaves privadas ou credenciais no código público do navegador.

1. No projeto Google Cloud / Firebase (`gen-lang-client-0491529511`), configure ou utilize a conta de serviço do Cloud Run com o papel **Cloud Datastore User** (`roles/datastore.user`).
2. Publique o serviço usando o `Dockerfile` incluído na raiz do projeto:

```bash
gcloud config set project gen-lang-client-0491529511

gcloud iam service-accounts create cliente-vip-web \
  --display-name="CLIENTE VIP Web Portal"

gcloud projects add-iam-policy-binding gen-lang-client-0491529511 \
  --member="serviceAccount:cliente-vip-web@gen-lang-client-0491529511.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud run deploy cliente-vip \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --service-account="cliente-vip-web@gen-lang-client-0491529511.iam.gserviceaccount.com" \
  --set-env-vars="FIREBASE_PROJECT_ID=gen-lang-client-0491529511,FIRESTORE_DATABASE_ID=ai-studio-android-clientev-8b967b88-b5cb-4b16-94b7-b2062e126e54"
```

3. No **Firebase Console → Authentication → Settings → Authorized domains**, adicione o domínio HTTPS gerado pelo Cloud Run (ex.: `cliente-vip-...run.app`) para liberar o login Google da Área do Motorista.

## Testes

```bash
npx firebase emulators:exec --project demo-no-project --only auth,firestore \
  "FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node --test server.test.js && FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --test firestore.test.js"
```

## Google AI Studio

Projeto original: https://ai.studio/apps/8b967b88-b5cb-4b16-94b7-b2062e126e54
