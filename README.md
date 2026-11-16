# CLIENTE VIP

Projeto Android + servidor web/API para registro de corridas por QR Code.

## Fluxo do passageiro

1. O motorista gera um QR Code de uso único.
2. O passageiro lê o QR Code com a câmera do celular.
3. O navegador abre `/ride?code=...` sem exigir instalação do app ou login Google.
4. O servidor valida o código e grava a corrida no Firestore.
5. O QR Code é consumido atomicamente para impedir reutilização.

## Executar o servidor localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm start
```

O servidor escuta a porta definida em `PORT` (padrão 3000).

## Configuração obrigatória no Google Cloud Run

O servidor foi preparado para usar a identidade de execução do Cloud Run (Application Default Credentials) para acessar o Firestore. Não coloque chave privada de conta de serviço no APK, no ZIP público ou no código do navegador.

1. Configure o serviço Cloud Run para usar uma conta de serviço dedicada.
2. No projeto Firebase/GCP (`gen-lang-client-0491529511`) que contém o Firestore configurado em `FIRESTORE_DATABASE_ID`, conceda a essa conta o papel **Cloud Datastore User** (`roles/datastore.user`).
3. Garanta que o serviço Cloud Run permita acesso HTTP público ao portal `/ride`, `/cliente-vip.apk` e às APIs `/api/ride/*`. A gravação no Firestore continua sendo feita pelo servidor usando a identidade de execução.
4. Configure `FIREBASE_PROJECT_ID` e `FIRESTORE_DATABASE_ID` para o projeto e banco corretos, se forem diferentes dos valores padrão.
5. Publique o serviço usando o `Dockerfile` incluído na raiz do projeto:

```bash
# 1. Defina o projeto GCP
gcloud config set project gen-lang-client-0491529511

# 2. (Opcional) Crie uma conta de serviço dedicada e conceda acesso ao Firestore
gcloud iam service-accounts create cliente-vip-web \
  --display-name="CLIENTE VIP Web Portal"

gcloud projects add-iam-policy-binding gen-lang-client-0491529511 \
  --member="serviceAccount:cliente-vip-web@gen-lang-client-0491529511.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# 3. Faça o deploy no Cloud Run a partir da pasta do projeto (usa o Dockerfile automaticamente)
gcloud run deploy cliente-vip \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --service-account="cliente-vip-web@gen-lang-client-0491529511.iam.gserviceaccount.com" \
  --set-env-vars="FIREBASE_PROJECT_ID=gen-lang-client-0491529511,FIRESTORE_DATABASE_ID=ai-studio-android-clientev-8b967b88-b5cb-4b16-94b7-b2062e126e54"
```

Após o deploy, o Cloud Run exibirá a URL pública (`https://cliente-vip-...run.app`):
- Baixar APK no celular: `https://SUA-URL/cliente-vip.apk`
- Página pública do passageiro: `https://SUA-URL/ride?code=VIP-XXXX-XXXX`

Se a URL gerada for diferente de `https://ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app`, atualize `WEB_BASE_URL` em `app/src/main/java/com/example/util/QrCodeDeepLink.kt` e `android:host` em `app/src/main/AndroidManifest.xml` e recompile o APK.

A identidade do Cloud Run usa IAM para acessar o Firestore; as regras do Firestore continuam protegendo o acesso direto de clientes Android/Web. A API pública deve ser mantida protegida por códigos curtos, de uso único e com validade limitada, como implementado no servidor.

## Testes

```bash
npm run test:server
npm run test:rules
```

Os testes de integração dependem dos emuladores do Firebase Auth e Firestore. Use o Firebase CLI para iniciar os emuladores nas portas configuradas em `firebase.json`.

## Android

Abra a pasta do projeto no Android Studio. O projeto requer Android SDK compatível com `compileSdk 36.1` e Gradle 9.3.1. O arquivo `google-services.json` incluído pertence à configuração existente do projeto; confirme se corresponde ao Firebase correto antes de publicar uma nova versão.

## Google AI Studio

Projeto original: https://ai.studio/apps/8b967b88-b5cb-4b16-94b7-b2062e126e54
