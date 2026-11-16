const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
const APK_PATH = path.join(__dirname, 'app/build/outputs/apk/debug/app-debug.apk');
const ZIP_PATH = path.join(__dirname, 'Cliente_VIP_src.zip');
const PACKAGE_NAME = 'com.aistudio.clientevip.rkpxzt';
const DEBUG_SHA256 = '22:65:2B:03:15:CB:0A:4B:54:A6:40:39:09:4D:51:3E:D5:99:6B:71:CC:13:A9:9B:B7:65:7C:B5:71:6B:FA:FC';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'gen-lang-client-0491529511';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-android-clientev-8b967b88-b5cb-4b16-94b7-b2062e126e54';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBTObrDur7bdrVn44sIfxd1I6rSQ2dO6Ks';
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

let cachedServiceAccountToken = null;
let cachedServiceAccountExpiry = 0;
let cachedMetadataToken = null;
let cachedMetadataTokenExpiry = 0;

// Cloud Run supplies short-lived credentials to the service's runtime identity.
// This keeps passenger registration independent from a passenger Google login.
async function getCloudRunAccessToken() {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.ALLOW_CLOUD_RUN_METADATA !== 'true') {
    return null;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedMetadataToken && nowSec < cachedMetadataTokenExpiry - 60) {
    return cachedMetadataToken;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (!settled) {
        settled = true;
        clearTimeout(hardTimer);
        resolve(val);
      }
    };

    const options = {
      hostname: 'metadata.google.internal',
      path: '/computeMetadata/v1/instance/service-accounts/default/token',
      method: 'GET',
      headers: { 'Metadata-Flavor': 'Google' },
      timeout: 1200
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode === 200 && data.access_token) {
            cachedMetadataToken = data.access_token;
            cachedMetadataTokenExpiry = nowSec + Number(data.expires_in || 3600);
            finish(cachedMetadataToken);
          } else {
            finish(null);
          }
        } catch (_) {
          finish(null);
        }
      });
    });
    const hardTimer = setTimeout(() => {
      req.destroy();
      finish(null);
    }, 1500);
    req.on('timeout', () => { req.destroy(); finish(null); });
    req.on('error', () => finish(null));
    req.end();
  });
}

function getCertificateFingerprints() {
  const fps = [DEBUG_SHA256];
  const extra = (process.env.RELEASE_SHA256 || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/.test(s));
  for (const fp of extra) {
    if (!fps.includes(fp)) fps.push(fp);
  }
  return fps;
}

function findApkPath() {
  const candidatePaths = [
    APK_PATH,
    path.join(__dirname, '.build-outputs/app-debug.apk'),
    path.join(__dirname, 'app-debug.apk')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getFileMeta(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractVipCode(raw) {
  if (!raw) return '';
  const text = String(raw).trim();
  const explicitMatch = text.match(/VIP-[A-Z0-9]{2,12}-[A-Z0-9]{2,12}/i);
  if (explicitMatch) return explicitMatch[0].toUpperCase();
  const paramMatch = text.match(/[?&]code=([^&\s]+)/i);
  if (paramMatch) {
    const decoded = decodeURIComponent(paramMatch[1]).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return decoded;
  }
  return text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function isValidVipCodeFormat(code) {
  return /^VIP-[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(String(code || ''));
}

function normalizeBrPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    const candidate = digits.slice(2);
    const ddd = parseInt(candidate.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) {
      digits = candidate;
    }
  }
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) {
    const candidate = digits.slice(1);
    const ddd = parseInt(candidate.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) {
      digits = candidate;
    }
  }
  return digits;
}

function isValidBrPhone(raw) {
  const digits = normalizeBrPhone(raw);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

function httpJsonRequest(targetUrl, method, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const payload = bodyObj !== undefined && bodyObj !== null ? JSON.stringify(bodyObj) : null;
    const reqHeaders = Object.assign({}, headers || {});
    if (payload !== null) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json; charset=utf-8';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: reqHeaders,
        timeout: 12000
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = rawBody ? JSON.parse(rawBody) : null;
          } catch (_) {
            json = null;
          }
          resolve({ status: res.statusCode || 500, data: json, raw: rawBody });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Tempo esgotado ao consultar o servidor Firebase.'));
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

function loadServiceAccountConfig() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    if (raw.trim().startsWith('{')) {
      return JSON.parse(raw);
    }
    if (fs.existsSync(raw.trim())) {
      return JSON.parse(fs.readFileSync(raw.trim(), 'utf8'));
    }
  } catch (err) {
    console.error('Erro ao ler FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
  }
  return null;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getServiceAccountAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedServiceAccountToken && nowSec < cachedServiceAccountExpiry - 60) {
    return cachedServiceAccountToken;
  }
  const sa = loadServiceAccountConfig();
  if (!sa || !sa.client_email || !sa.private_key) return null;

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec
    })
  );
  const unsigned = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64UrlEncode(signer.sign(sa.private_key));
  const assertion = `${unsigned}.${signature}`;

  const formBody = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`;
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const res = await new Promise((resolve, reject) => {
    const u = new URL(tokenUri);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formBody)
        },
        timeout: 10000
      },
      (r) => {
        const chunks = [];
        r.on('data', (d) => chunks.push(d));
        r.on('end', () => {
          try {
            resolve({ status: r.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(formBody);
    req.end();
  });

  if (res.status === 200 && res.data && res.data.access_token) {
    cachedServiceAccountToken = res.data.access_token;
    cachedServiceAccountExpiry = nowSec + (res.data.expires_in || 3600);
    return cachedServiceAccountToken;
  }
  return null;
}

function getFirestoreBaseUrl() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    return `http://${emulatorHost}/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
  }
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

async function resolveFirestoreAuthHeaders(idToken) {
  const cleanIdToken = (idToken || '').trim();
  if (cleanIdToken) {
    const payload = decodeJwtPayload(cleanIdToken);
    const uid = payload && (payload.user_id || payload.sub) ? String(payload.user_id || payload.sub) : null;
    return {
      headers: { Authorization: `Bearer ${cleanIdToken}` },
      uid,
      mode: 'user'
    };
  }
  // Prefer an explicitly configured service account key when supplied.
  const saToken = await getServiceAccountAccessToken();
  if (saToken) {
    return {
      headers: { Authorization: `Bearer ${saToken}` },
      uid: null,
      mode: 'service_account'
    };
  }

  // On Cloud Run, use the service identity (Application Default Credentials)
  // instead of asking every passenger to sign in with Google.
  const runtimeToken = await getCloudRunAccessToken();
  if (runtimeToken) {
    return {
      headers: { Authorization: `Bearer ${runtimeToken}` },
      uid: null,
      mode: 'service_account'
    };
  }
  return { headers: {}, uid: null, mode: 'anonymous' };
}

function fromFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue.fields || {});
  return null;
}

function fromFirestoreFields(fields) {
  const out = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') return { mapValue: { fields: toFirestoreFields(val) } };
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function fullDocResourceName(collection, docId) {
  return `projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/${collection}/${docId}`;
}

async function firestoreGetDoc(collection, docId, authHeaders) {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  return httpJsonRequest(url, 'GET', authHeaders, null);
}

async function firestoreCommit(writes, authHeaders) {
  const url = `${getFirestoreBaseUrl()}:commit`;
  return httpJsonRequest(url, 'POST', authHeaders, { writes });
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error('Payload muito grande.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(payload));
}

function extractBearerToken(req, body) {
  const hdr = req.headers && req.headers.authorization ? String(req.headers.authorization) : '';
  if (hdr.toLowerCase().startsWith('bearer ')) {
    return hdr.slice(7).trim();
  }
  return body && body.idToken ? String(body.idToken).trim() : '';
}

async function handleValidateQrApi(req, res) {
  try {
    const body = await readJsonBody(req);
    const code = extractVipCode(body.code || '');
    if (!isValidVipCodeFormat(code)) {
      sendJson(res, 400, {
        ok: false,
        status: 'INVALID_FORMAT',
        error: 'Código QR inválido. Formato esperado: VIP-XXXX-XXXX.'
      });
      return;
    }

    const authCtx = await resolveFirestoreAuthHeaders(extractBearerToken(req, body));
    const docRes = await firestoreGetDoc('qrcodes', code, authCtx.headers);

    if (docRes.status === 401 || docRes.status === 403) {
      sendJson(res, 401, {
        ok: false,
        status: 'AUTH_REQUIRED',
        authRequired: true,
        codeId: code,
        error: 'O servidor ainda não está conectado ao Firebase. Peça ao motorista para verificar a configuração do serviço.'
      });
      return;
    }

    if (docRes.status === 404) {
      sendJson(res, 404, {
        ok: false,
        status: 'NOT_FOUND',
        codeId: code,
        error: 'QR Code não encontrado no sistema CLIENTE VIP.'
      });
      return;
    }

    if (docRes.status !== 200 || !docRes.data || !docRes.data.fields) {
      sendJson(res, 502, {
        ok: false,
        status: 'ERROR',
        error: 'Não foi possível verificar o QR Code no momento. Tente novamente.'
      });
      return;
    }

    const qr = fromFirestoreFields(docRes.data.fields);
    if (qr.status === 'USED') {
      sendJson(res, 409, {
        ok: false,
        status: 'USED',
        codeId: code,
        usedByName: qr.usedByName || null,
        usedAt: qr.usedAt || null,
        error: 'Este QR Code já foi utilizado e perdeu a validade (uso único por corrida).'
      });
      return;
    }

    const expiresMs = qr.expiresAt ? Date.parse(qr.expiresAt) : NaN;
    if (qr.status === 'EXPIRED' || (!isNaN(expiresMs) && expiresMs < Date.now())) {
      sendJson(res, 410, {
        ok: false,
        status: 'EXPIRED',
        codeId: code,
        error: 'Este QR Code expirou (validade máxima de 15 minutos). Solicite um novo código ao motorista.'
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      status: 'VALID',
      codeId: qr.codeId || code,
      driverId: qr.driverId || '',
      driverName: qr.driverName || 'Motorista VIP',
      expiresAt: qr.expiresAt || null
    });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      status: 'ERROR',
      error: err.message || 'Erro interno ao validar QR Code.'
    });
  }
}

async function handleLookupClientApi(req, res) {
  try {
    const body = await readJsonBody(req);
    const normalizedPhone = normalizeBrPhone(body.phone || '');
    const driverId = String(body.driverId || '').trim();
    if (!isValidBrPhone(normalizedPhone) || !driverId) {
      sendJson(res, 200, { ok: true, client: null });
      return;
    }

    const authCtx = await resolveFirestoreAuthHeaders(extractBearerToken(req, body));
    if (authCtx.mode === 'anonymous') {
      sendJson(res, 200, { ok: true, client: null });
      return;
    }

    const clientId = `${driverId}_${normalizedPhone}`;
    const docRes = await firestoreGetDoc('clients', clientId, authCtx.headers);
    let matchedDoc = docRes.status === 200 && docRes.data && docRes.data.fields
      ? fromFirestoreFields(docRes.data.fields)
      : null;

    if (!matchedDoc && docRes.status === 404) {
      const legacyRes = await firestoreGetDoc('clients', normalizedPhone, authCtx.headers);
      if (legacyRes.status === 200 && legacyRes.data && legacyRes.data.fields) {
        const legacy = fromFirestoreFields(legacyRes.data.fields);
        if (!legacy.driverId || legacy.driverId === driverId) {
          matchedDoc = legacy;
        }
      }
    }

    if (matchedDoc) {
      sendJson(res, 200, {
        ok: true,
        client: {
          name: matchedDoc.name || '',
          phone: normalizedPhone,
          points: Number(matchedDoc.points || 0),
          totalRides: Number(matchedDoc.totalRides || 0),
          rewardsAvailable: Number(matchedDoc.rewardsAvailable || 0),
          rewardsRedeemed: Number(matchedDoc.rewardsRedeemed || 0)
        }
      });
      return;
    }

    sendJson(res, 200, { ok: true, client: null });
  } catch (_) {
    sendJson(res, 200, { ok: true, client: null });
  }
}

async function handleRegisterRideApi(req, res) {
  try {
    const body = await readJsonBody(req);
    const cleanCode = extractVipCode(body.code || '');
    const cleanName = String(body.name || '').trim();
    const normalizedPhone = normalizeBrPhone(body.phone || '');

    if (!isValidVipCodeFormat(cleanCode)) {
      sendJson(res, 400, { ok: false, error: 'Código QR inválido. Formato esperado: VIP-XXXX-XXXX.' });
      return;
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      sendJson(res, 400, { ok: false, error: 'Informe seu nome completo (mínimo 2 caracteres).' });
      return;
    }
    if (!isValidBrPhone(normalizedPhone)) {
      sendJson(res, 400, { ok: false, error: 'Informe um telefone válido com DDD (ex: 11987654321).' });
      return;
    }

    const authCtx = await resolveFirestoreAuthHeaders(extractBearerToken(req, body));
    if (authCtx.mode === 'anonymous') {
      sendJson(res, 401, {
        ok: false,
        authRequired: true,
        error: 'O servidor ainda não está conectado ao Firebase. Tente novamente mais tarde ou avise o motorista.'
      });
      return;
    }

    // 1. Fetch QR Code on server
    const qrRes = await firestoreGetDoc('qrcodes', cleanCode, authCtx.headers);
    if (qrRes.status === 401 || qrRes.status === 403) {
      sendJson(res, 401, {
        ok: false,
        authRequired: true,
        error: 'Não foi possível acessar o Firebase pelo servidor. Avise o motorista.'
      });
      return;
    }
    if (qrRes.status === 404) {
      sendJson(res, 404, { ok: false, status: 'NOT_FOUND', error: 'QR Code não encontrado no sistema CLIENTE VIP.' });
      return;
    }
    if (qrRes.status !== 200 || !qrRes.data || !qrRes.data.fields) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar o QR Code no servidor.' });
      return;
    }

    const qr = fromFirestoreFields(qrRes.data.fields);
    const qrUpdateTime = qrRes.data.updateTime;

    if (qr.status !== 'ACTIVE') {
      sendJson(res, 409, {
        ok: false,
        status: 'USED',
        error: 'Este QR Code já foi utilizado e perdeu a validade (uso único por corrida).'
      });
      return;
    }
    const expiresMs = qr.expiresAt ? Date.parse(qr.expiresAt) : NaN;
    if (!isNaN(expiresMs) && expiresMs < Date.now()) {
      sendJson(res, 410, {
        ok: false,
        status: 'EXPIRED',
        error: 'Este QR Code expirou (validade máxima de 15 minutos). Solicite um novo código ao motorista.'
      });
      return;
    }

    const driverId = String(qr.driverId || '').trim();
    const driverName = String(qr.driverName || 'Motorista VIP').trim() || 'Motorista VIP';
    if (!driverId) {
      sendJson(res, 400, { ok: false, error: 'QR Code inválido (motorista não identificado).' });
      return;
    }

    const scopedClientId = `${driverId}_${normalizedPhone}`;
    let targetClientId = scopedClientId;
    let clientRes = await firestoreGetDoc('clients', scopedClientId, authCtx.headers);

    if (clientRes.status === 404) {
      const legacyRes = await firestoreGetDoc('clients', normalizedPhone, authCtx.headers);
      if (legacyRes.status === 200 && legacyRes.data && legacyRes.data.fields) {
        const legacyFields = fromFirestoreFields(legacyRes.data.fields);
        if (!legacyFields.driverId || legacyFields.driverId === driverId) {
          clientRes = legacyRes;
          targetClientId = normalizedPhone;
        }
      }
    }

    if (clientRes.status === 403) {
      sendJson(res, 403, {
        ok: false,
        error: 'Este telefone já está vinculado a outra conta Google. Entre com a conta Google usada no primeiro cadastro ou use outro número.'
      });
      return;
    }
    if (clientRes.status !== 200 && clientRes.status !== 404) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar dados do cliente.' });
      return;
    }

    const existingClient = clientRes.status === 200 && clientRes.data && clientRes.data.fields
      ? fromFirestoreFields(clientRes.data.fields)
      : null;

    // Preserve a real Firebase Auth UID if the passenger previously used the Android app.
    const passengerUid = authCtx.uid ||
      (existingClient && existingClient.passengerUid && !String(existingClient.passengerUid).startsWith('web_')
        ? String(existingClient.passengerUid)
        : `web_${normalizedPhone}`);

    let currentTotalRides;
    let currentPoints;
    let rewardsAvailable;
    let rewardsRedeemed;
    let earnedFreeRide = false;
    let persistedPhone = normalizedPhone;

    const writes = [];
    const clientResourceName = fullDocResourceName('clients', targetClientId);

    if (existingClient) {
      const existingRides = Number(existingClient.totalRides || 0);
      const existingPoints = Number(existingClient.points || 0);
      rewardsAvailable = Number(existingClient.rewardsAvailable || 0);
      rewardsRedeemed = Number(existingClient.rewardsRedeemed || 0);
      persistedPhone = existingClient.phone ? String(existingClient.phone) : normalizedPhone;

      currentTotalRides = existingRides + 1;
      let nextPoints = existingPoints + 1;
      while (nextPoints >= 10) {
        nextPoints -= 10;
        rewardsAvailable += 1;
        earnedFreeRide = true;
      }
      currentPoints = nextPoints;

      writes.push({
        currentDocument: { updateTime: clientRes.data.updateTime },
        update: {
          name: clientResourceName,
          fields: toFirestoreFields({
            id: targetClientId,
            driverId,
            passengerUid,
            lastQrCodeId: cleanCode,
            name: cleanName,
            phone: persistedPhone,
            totalRides: currentTotalRides,
            points: currentPoints,
            rewardsAvailable,
            rewardsRedeemed,
            isArchived: false,
            createdAt: existingClient.createdAt ? new Date(existingClient.createdAt) : new Date()
          })
        },
        updateTransforms: [
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
        ]
      });
    } else {
      currentTotalRides = 1;
      currentPoints = 1;
      rewardsAvailable = 0;
      rewardsRedeemed = 0;

      writes.push({
        currentDocument: { exists: false },
        update: {
          name: clientResourceName,
          fields: toFirestoreFields({
            id: scopedClientId,
            driverId,
            passengerUid,
            lastQrCodeId: cleanCode,
            name: cleanName,
            phone: normalizedPhone,
            totalRides: 1,
            points: 1,
            rewardsAvailable: 0,
            rewardsRedeemed: 0,
            isArchived: false
          })
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
        ]
      });
    }

    // Consume QR Code atomically with updateTime precondition to prevent replay
    writes.push({
      currentDocument: { updateTime: qrUpdateTime },
      updateMask: { fieldPaths: ['status', 'usedByPhone', 'usedByName'] },
      update: {
        name: fullDocResourceName('qrcodes', cleanCode),
        fields: toFirestoreFields({
          status: 'USED',
          usedByPhone: persistedPhone,
          usedByName: cleanName
        })
      },
      updateTransforms: [
        { fieldPath: 'usedAt', setToServerValue: 'REQUEST_TIME' }
      ]
    });

    // Record immutable ride log
    const rideId = `RIDE-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    writes.push({
      currentDocument: { exists: false },
      update: {
        name: fullDocResourceName('rides', rideId),
        fields: toFirestoreFields({
          id: rideId,
          clientPhone: persistedPhone,
          clientName: cleanName,
          driverId,
          driverName,
          qrCodeId: cleanCode,
          pointsEarned: 1
        })
      },
      updateTransforms: [
        { fieldPath: 'timestamp', setToServerValue: 'REQUEST_TIME' }
      ]
    });

    // Create AVAILABLE reward entry when reaching 10 points
    if (earnedFreeRide) {
      const rewardId = `REW-${cleanCode}`;
      writes.push({
        currentDocument: { exists: false },
        update: {
          name: fullDocResourceName('rewards', rewardId),
          fields: toFirestoreFields({
            id: rewardId,
            clientPhone: persistedPhone,
            clientName: cleanName,
            driverId,
            qrCodeId: cleanCode,
            status: 'AVAILABLE'
          })
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }
        ]
      });
    }

    const commitRes = await firestoreCommit(writes, authCtx.headers);
    if (commitRes.status === 409) {
      sendJson(res, 409, {
        ok: false,
        status: 'USED',
        error: 'Este QR Code acabou de ser utilizado em outra leitura simultânea.'
      });
      return;
    }
    if (commitRes.status === 403 || commitRes.status === 401) {
      sendJson(res, 403, {
        ok: false,
        error: 'O servidor não tem permissão para gravar no Firestore. O administrador precisa conceder acesso à identidade do Cloud Run.'
      });
      return;
    }
    if (commitRes.status !== 200) {
      const errMsg = commitRes.data && commitRes.data.error && commitRes.data.error.message
        ? commitRes.data.error.message
        : 'Não foi possível concluir o registro da corrida.';
      sendJson(res, 400, { ok: false, error: errMsg });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      result: {
        clientName: cleanName,
        clientPhone: normalizeBrPhone(persistedPhone),
        driverName,
        currentPoints,
        totalRides: currentTotalRides,
        rewardsAvailable,
        earnedFreeRide
      }
    });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err.message || 'Erro interno ao registrar corrida.'
    });
  }
}

function renderDownloadHtml(apkInfo, zipInfo) {
  const apkMeta = apkInfo ? `(${apkInfo.sizeMb} MB) &bull; Compilado em: ${apkInfo.updatedAt}` : '(indisponível)';
  const zipButton = zipInfo
    ? `<a href="/cliente-vip-source.zip" download="Cliente_VIP_src.zip" class="btn-secondary">
         📦 BAIXAR CÓDIGO-FONTE COMPLETO (.ZIP - ${zipInfo.sizeMb} MB)
       </a>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baixar CLIENTE VIP - App Android</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top, #1e293b 0%, #0f172a 50%, #070b14 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px 40px;
      text-align: center;
      overflow-y: auto;
    }
    .card {
      background: rgba(15, 23, 42, 0.92);
      border: 1.5px solid #eab308;
      border-radius: 24px;
      padding: 28px 22px;
      max-width: 440px;
      width: 100%;
      margin: auto 0;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(234, 179, 8, 0.15);
    }
    .badge {
      display: inline-block;
      background: #eab308;
      color: #000;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1.5px;
      padding: 4px 12px;
      border-radius: 12px;
      margin-bottom: 16px;
      text-transform: uppercase;
    }
    .icon-box {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #ffd700 0%, #ca8a04 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      box-shadow: 0 8px 24px rgba(234, 179, 8, 0.4);
      font-size: 40px;
    }
    h1 { font-size: 26px; font-weight: 900; letter-spacing: 1px; color: #ffd700; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 24px; line-height: 1.4; }
    .btn-download {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #ffd700 0%, #eab308 100%);
      color: #0f172a;
      text-decoration: none;
      font-size: 17px;
      font-weight: 800;
      padding: 18px 20px;
      border-radius: 16px;
      margin-bottom: 12px;
      box-shadow: 0 10px 25px rgba(234, 179, 8, 0.35);
      letter-spacing: 0.5px;
      border: none;
      cursor: pointer;
    }
    .btn-download:disabled { opacity: 0.7; cursor: wait; }
    .btn-secondary {
      display: block;
      width: 100%;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid #475569;
      color: #f8fafc;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      padding: 13px 16px;
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .status-box {
      display: none;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid #eab308;
      border-radius: 12px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #fde047;
      font-weight: 700;
    }
    .info { font-size: 12px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5; }
    .steps {
      background: rgba(30, 41, 59, 0.7);
      border-radius: 14px;
      padding: 16px;
      text-align: left;
      font-size: 13px;
      color: #cbd5e1;
    }
    .steps h3 { font-size: 12px; font-weight: 700; color: #ffd700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .steps ol { padding-left: 18px; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Versão Oficial Android</div>
    <div class="icon-box">🚗</div>
    <h1>CLIENTE VIP</h1>
    <p class="subtitle">Programa de Fidelidade Exclusivo para Motoristas e Clientes VIP</p>

    <button type="button" id="btnSmartDownload" onclick="startSmartApkDownload()" class="btn-download">
      📥 BAIXAR APLICATIVO AGORA (.APK)
    </button>
    <div id="downloadStatus" class="status-box"></div>
    <a href="/cliente-vip.apk" download="Cliente_VIP.apk" class="btn-secondary">
      🔗 LINK DIRETO ALTERNATIVO (Cliente_VIP.apk)
    </a>
    ${zipButton}

    <div class="info">Arquivo: <strong>Cliente_VIP.apk</strong> ${apkMeta} &bull; Android 7.0+</div>

    <div class="steps">
      <h3>Como Instalar no Celular:</h3>
      <ol>
        <li>Toque no botão amarelo acima para iniciar o download.</li>
        <li>Quando terminar, toque na notificação ou no arquivo <strong>Cliente_VIP.apk</strong> na pasta Downloads.</li>
        <li>Se o celular pedir, ative <strong>"Permitir desta fonte"</strong>.</li>
        <li>Toque em <strong>Instalar</strong> e pronto!</li>
      </ol>
    </div>
  </div>
  <script>
    var KNOWN_APK_SIZE = ${apkInfo ? apkInfo.sizeBytes : 0};
    async function startSmartApkDownload() {
      var btn = document.getElementById('btnSmartDownload');
      var status = document.getElementById('downloadStatus');
      btn.disabled = true;
      status.style.display = 'block';
      status.style.color = '#fde047';
      status.textContent = 'Conectando ao servidor...';
      try {
        var total = KNOWN_APK_SIZE;
        try {
          var headRes = await fetch('/cliente-vip.apk', { method: 'HEAD', credentials: 'include' });
          var headType = (headRes.headers.get('content-type') || '').toLowerCase();
          if (!headRes.ok || headType.indexOf('text/html') !== -1) {
            throw new Error('Sessão não autenticada neste navegador (' + headRes.status + ')');
          }
          var hdrLen = parseInt(headRes.headers.get('content-length') || '0', 10);
          if (hdrLen > 0) total = hdrLen;
        } catch (headErr) {
          if (String(headErr && headErr.message).indexOf('Sessão') !== -1) {
            throw headErr;
          }
        }

        if (total > 0) {
          var CHUNK_SIZE = 4 * 1024 * 1024;
          var offset = 0;
          var chunks = [];
          while (offset < total) {
            var end = Math.min(offset + CHUNK_SIZE - 1, total - 1);
            var partRes = await fetch('/cliente-vip.apk', {
              credentials: 'include',
              headers: { 'Range': 'bytes=' + offset + '-' + end }
            });
            var partType = (partRes.headers.get('content-type') || '').toLowerCase();
            if (partType.indexOf('text/html') !== -1) {
              throw new Error('Sessão não autenticada neste navegador.');
            }
            if (!(partRes.status === 206 || partRes.status === 200)) {
              throw new Error('Falha HTTP ' + partRes.status);
            }
            var buf = await partRes.arrayBuffer();
            chunks.push(new Uint8Array(buf));
            offset += buf.byteLength;
            var pct = Math.min(100, Math.round((offset / total) * 100));
            status.textContent = 'Baixando Cliente_VIP.apk: ' + pct + '% (' + (offset / 1048576).toFixed(1) + ' / ' + (total / 1048576).toFixed(1) + ' MB)';
            if (partRes.status === 200 || buf.byteLength === 0) break;
          }
          var blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
          triggerBlobSave(blob, 'Cliente_VIP.apk');
          status.style.color = '#34d399';
          status.textContent = 'Download concluído! Toque no arquivo Cliente_VIP.apk na pasta Downloads para instalar.';
        } else {
          throw new Error('Tamanho do APK indisponível no servidor.');
        }
      } catch (err) {
        var msg = err && err.message ? err.message : 'erro desconhecido';
        status.style.color = '#fca5a5';
        status.innerHTML = 'Não foi possível concluir o download automático (' + msg + ').<br>Toque em <strong>LINK DIRETO ALTERNATIVO</strong>.';
      } finally {
        btn.disabled = false;
      }
    }
    function triggerBlobSave(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 4000);
    }
  </script>
</body>
</html>`;
}

function renderRideDeepLinkHtml(rawCode, apkInfo, publicBaseUrl) {
  const cleanCode = extractVipCode(rawCode || '');
  const safeCode = escapeHtml(cleanCode);
  const fallbackEncoded = encodeURIComponent(`${publicBaseUrl}/ride?code=${encodeURIComponent(cleanCode)}`);
  const intentUrl = `intent://ride?code=${encodeURIComponent(cleanCode)}#Intent;scheme=clientevip;package=${PACKAGE_NAME};S.browser_fallback_url=${fallbackEncoded};end`;
  const apkMeta = apkInfo ? `(${apkInfo.sizeMb} MB)` : '';

  const firebaseWebConfig = {
    apiKey: FIREBASE_WEB_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registrar Corrida VIP - CLIENTE VIP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top, #1e293b 0%, #0f172a 55%, #070b14 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 20px 14px 48px;
      text-align: center;
      overflow-y: auto;
    }
    .card {
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid #eab308;
      border-radius: 24px;
      padding: 24px 18px;
      max-width: 440px;
      width: 100%;
      margin: 8px auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.65);
    }
    .badge {
      display: inline-block;
      background: rgba(234, 179, 8, 0.16);
      border: 1px solid #eab308;
      color: #ffd700;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1px;
      padding: 5px 12px;
      border-radius: 16px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    h1 { font-size: 24px; font-weight: 900; color: #ffd700; margin-bottom: 6px; letter-spacing: 1px; }
    .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.45; }
    .code-box {
      background: #1e293b;
      border: 1px dashed #eab308;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .code-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .code-value { font-size: 22px; font-weight: 900; color: #ffd700; letter-spacing: 2px; word-break: break-all; }
    .status-banner {
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
      text-align: left;
    }
    .status-loading { background: rgba(30, 41, 59, 0.85); border: 1px solid #475569; color: #cbd5e1; }
    .status-valid { background: rgba(16, 185, 129, 0.14); border: 1px solid #10b981; color: #6ee7b7; }
    .status-error { background: rgba(239, 68, 68, 0.16); border: 1px solid #ef4444; color: #fca5a5; }
    .status-warn { background: rgba(245, 158, 11, 0.16); border: 1px solid #f59e0b; color: #fde047; }
    .form-group { text-align: left; margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
    .form-group input {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #475569;
      background: #0f172a;
      color: #ffffff;
      font-size: 15px;
      outline: none;
    }
    .form-group input:focus { border-color: #ffd700; }
    .hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .returning-box {
      display: none;
      background: rgba(234, 179, 8, 0.14);
      border: 1px solid #eab308;
      border-radius: 12px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      color: #fde047;
      text-align: left;
    }
    .btn-primary {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #ffd700 0%, #eab308 100%);
      color: #0f172a;
      text-decoration: none;
      font-size: 15px;
      font-weight: 800;
      padding: 16px;
      border-radius: 14px;
      margin-bottom: 10px;
      border: none;
      cursor: pointer;
      min-height: 48px;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      background: #ffffff;
      color: #111827;
      font-size: 14px;
      font-weight: 800;
      padding: 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      margin-bottom: 12px;
      min-height: 48px;
    }
    .btn-secondary {
      display: block;
      width: 100%;
      background: #1e293b;
      border: 1px solid #475569;
      color: #f8fafc;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      padding: 13px;
      border-radius: 12px;
      margin-bottom: 10px;
      cursor: pointer;
      min-height: 46px;
    }
    .btn-apk {
      display: block;
      width: 100%;
      background: rgba(16, 185, 129, 0.14);
      border: 1px solid #10b981;
      color: #34d399;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      padding: 13px;
      border-radius: 12px;
      margin-bottom: 10px;
    }
    .success-card {
      display: none;
      background: rgba(16, 185, 129, 0.12);
      border: 1.5px solid #10b981;
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .success-card h2 { color: #34d399; font-size: 19px; margin-bottom: 8px; }
    .points-pill {
      display: inline-block;
      background: #eab308;
      color: #000000;
      font-weight: 900;
      font-size: 18px;
      padding: 8px 18px;
      border-radius: 12px;
      margin: 10px 0;
    }
    .stars-row { font-size: 18px; letter-spacing: 3px; color: #ffd700; margin: 8px 0; }
    .free-ride-box {
      background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
      color: #111827;
      border-radius: 12px;
      padding: 12px;
      font-weight: 800;
      font-size: 13px;
      margin-top: 10px;
    }
    .divider { height: 1px; background: #334155; margin: 14px 0; }
    .copied { color: #34d399; font-size: 12px; font-weight: 700; min-height: 18px; margin-bottom: 6px; }
    .user-chip {
      display: none;
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Registro de Corrida VIP</div>
    <h1>CLIENTE VIP</h1>
    <p class="subtitle">Valide seu código no navegador para ganhar +1 ponto. A cada 10 pontos você ganha 1 corrida grátis na cidade!</p>

    <div class="code-box">
      <div class="code-label">Código da Corrida</div>
      <div class="code-value" id="vipCodeDisplay">${safeCode || 'SEM CÓDIGO'}</div>
    </div>

    <div id="statusBanner" class="status-banner status-loading">
      Verificando validade do QR Code no servidor...
    </div>

    <div id="formSection" style="display:none;">
      <div id="returningBox" class="returning-box"></div>
      <form id="rideForm" onsubmit="submitRideForm(event)">
        <div class="form-group">
          <label for="passengerName">Seu Nome Completo</label>
          <input id="passengerName" type="text" placeholder="Ex: Maria da Silva" required minlength="2" maxlength="100" autocomplete="name" />
        </div>
        <div class="form-group">
          <label for="passengerPhone">Seu Telefone com DDD</label>
          <input id="passengerPhone" type="tel" inputmode="numeric" placeholder="Ex: (11) 98765-4321" required autocomplete="tel" oninput="onPhoneInputChanged()" />
          <div class="hint">Se você já for cliente VIP, seus pontos serão somados automaticamente!</div>
        </div>
        <div id="formError" class="status-banner status-error" style="display:none;"></div>
        <button type="submit" id="btnSubmitRide" class="btn-primary">
          ⭐ CONFIRMAR CORRIDA (+1 PONTO)
        </button>
      </form>
    </div>

    <div id="successCard" class="success-card">
      <h2 id="successTitle">Corrida Confirmada!</h2>
      <p id="successGreeting" style="font-size:13px; color:#e2e8f0; margin-bottom:6px;"></p>
      <div id="pointsPill" class="points-pill">+1 PONTO</div>
      <div id="starsRow" class="stars-row"></div>
      <p id="successSub" style="font-size:12px; color:#cbd5e1;"></p>
      <div id="freeRideBox" class="free-ride-box" style="display:none;"></div>
    </div>

    <div class="divider"></div>

    ${cleanCode ? `<a href="${intentUrl}" class="btn-secondary">📱 Abrir no App CLIENTE VIP (se instalado)</a>` : ''}
    <button type="button" class="btn-secondary" onclick="copyVipCode()">📋 Copiar Código VIP</button>
    <div class="copied" id="copyStatus"></div>
    <a href="/cliente-vip.apk" download="Cliente_VIP.apk" class="btn-apk">📥 Não tem o app? Baixar APK ${apkMeta}</a>
  </div>

  <script>
    var VIP_CODE = ${JSON.stringify(cleanCode)};
    var FIREBASE_CONFIG = ${JSON.stringify(firebaseWebConfig)};
    var currentDriverId = '';
    var lookupTimer = null;

    function showBanner(cls, text) {
      var b = document.getElementById('statusBanner');
      b.className = 'status-banner ' + cls;
      b.textContent = text;
    }

    function normalizeBrDigits(val) {
      var d = String(val || '').replace(/\\D/g, '');
      if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) {
        var c = d.slice(2);
        var ddd = parseInt(c.slice(0, 2), 10);
        if (ddd >= 11 && ddd <= 99) d = c;
      }
      if ((d.length === 11 || d.length === 12) && d.indexOf('0') === 0) {
        var c0 = d.slice(1);
        var ddd0 = parseInt(c0.slice(0, 2), 10);
        if (ddd0 >= 11 && ddd0 <= 99) d = c0;
      }
      return d;
    }

    function formatBrPhoneInput(digits) {
      if (digits.length === 11) {
        return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
      }
      if (digits.length === 10) {
        return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
      }
      return digits;
    }

    async function validateCodeOnServer() {
      if (!VIP_CODE) {
        showBanner('status-error', 'Nenhum código VIP foi informado no link do QR Code.');
        return;
      }
      showBanner('status-loading', 'Validando QR Code no servidor...');
      try {
        var resp = await fetch('/api/ride/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: VIP_CODE })
        });
        var data = await resp.json();
        if (resp.ok && data.ok) {
          currentDriverId = data.driverId || '';
          var expText = '';
          if (data.expiresAt) {
            var minsLeft = Math.max(0, Math.ceil((Date.parse(data.expiresAt) - Date.now()) / 60000));
            expText = ' • Expira em ~' + minsLeft + ' min';
          }
          showBanner('status-valid', '✅ QR Code válido! Motorista: ' + (data.driverName || 'Motorista VIP') + expText + '. Preencha seus dados abaixo.');
          document.getElementById('formSection').style.display = 'block';
          loadSavedPassenger();
          return;
        }
        document.getElementById('formSection').style.display = 'none';
        showBanner('status-error', (data && data.error) || 'QR Code inválido ou indisponível.');
      } catch (err) {
        showBanner('status-error', 'Falha de conexão ao validar o QR Code. Verifique sua internet e tente novamente.');
      }
    }

    function loadSavedPassenger() {
      try {
        var savedName = localStorage.getItem('vip_passenger_name') || '';
        var savedPhone = localStorage.getItem('vip_passenger_phone') || '';
        var nameEl = document.getElementById('passengerName');
        var phoneEl = document.getElementById('passengerPhone');
        if (savedName && !nameEl.value) nameEl.value = savedName;
        if (savedPhone && !phoneEl.value) {
          phoneEl.value = formatBrPhoneInput(normalizeBrDigits(savedPhone));
          lookupReturningClient(normalizeBrDigits(savedPhone));
        }
      } catch (_) {}
    }

    function onPhoneInputChanged() {
      clearTimeout(lookupTimer);
      var phoneEl = document.getElementById('passengerPhone');
      var digits = normalizeBrDigits(phoneEl.value);
      if (digits.length === 10 || digits.length === 11) {
        lookupTimer = setTimeout(function() {
          lookupReturningClient(digits);
        }, 300);
      } else {
        document.getElementById('returningBox').style.display = 'none';
      }
    }

    async function lookupReturningClient(digits) {
      if (!currentDriverId || !digits) return;
      try {
        var resp = await fetch('/api/ride/client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digits, driverId: currentDriverId })
        });
        var data = await resp.json();
        var box = document.getElementById('returningBox');
        if (data && data.ok && data.client) {
          var nameEl = document.getElementById('passengerName');
          if (!nameEl.value.trim() && data.client.name) {
            nameEl.value = data.client.name;
          }
          box.style.display = 'block';
          box.textContent = '👋 Bem-vindo(a) de volta, ' + data.client.name + '! Saldo atual: ' + data.client.points + '/10 pontos (' + data.client.totalRides + ' corridas).';
        } else {
          box.style.display = 'none';
        }
      } catch (_) {}
    }

    async function submitRideForm(ev) {
      ev.preventDefault();
      var btn = document.getElementById('btnSubmitRide');
      var errEl = document.getElementById('formError');
      errEl.style.display = 'none';

      var name = document.getElementById('passengerName').value.trim();
      var phoneRaw = document.getElementById('passengerPhone').value;
      var phone = normalizeBrDigits(phoneRaw);

      if (name.length < 2) {
        errEl.style.display = 'block';
        errEl.textContent = 'Informe seu nome completo.';
        return;
      }
      if (phone.length < 10 || phone.length > 11) {
        errEl.style.display = 'block';
        errEl.textContent = 'Informe um telefone válido com DDD (ex: 11987654321).';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Confirmando Corrida...';
      try {
        var resp = await fetch('/api/ride/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: VIP_CODE,
            name: name,
            phone: phone
          })
        });
        var data = await resp.json();
        if (resp.ok && data.ok && data.result) {
          try {
            localStorage.setItem('vip_passenger_name', data.result.clientName);
            localStorage.setItem('vip_passenger_phone', data.result.clientPhone);
          } catch (_) {}
          showSuccessCard(data.result);
          return;
        }
        errEl.style.display = 'block';
        errEl.textContent = (data && data.error) || 'Não foi possível registrar sua corrida.';
      } catch (err) {
        errEl.style.display = 'block';
        errEl.textContent = 'Erro de conexão ao registrar a corrida. Tente novamente.';
      } finally {
        btn.disabled = false;
        btn.textContent = '⭐ CONFIRMAR CORRIDA (+1 PONTO)';
      }
    }

    function showSuccessCard(r) {
      document.getElementById('formSection').style.display = 'none';
      showBanner('status-valid', '✅ Corrida registrada e código VIP utilizado com sucesso!');
      var card = document.getElementById('successCard');
      card.style.display = 'block';
      document.getElementById('successTitle').textContent = r.earnedFreeRide ? '🎉 PARABÉNS! CORRIDA GRÁTIS!' : 'Corrida Confirmada!';
      document.getElementById('successGreeting').textContent = 'Olá ' + r.clientName + ', sua pontuação foi atualizada em tempo real com o motorista ' + (r.driverName || '') + '.';
      document.getElementById('pointsPill').textContent = r.currentPoints + '/10 PONTOS VIP';

      var stars = '';
      for (var i = 1; i <= 10; i++) {
        stars += (i <= r.currentPoints ? '★' : '☆');
      }
      document.getElementById('starsRow').textContent = stars;
      document.getElementById('successSub').textContent = 'Total de corridas registradas: ' + r.totalRides + (r.earnedFreeRide ? '' : ' • Faltam ' + (10 - r.currentPoints) + ' corrida(s) para sua corrida gratuita!');

      if (r.earnedFreeRide) {
        var freeBox = document.getElementById('freeRideBox');
        freeBox.style.display = 'block';
        freeBox.textContent = '🎁 Você completou 10 pontos e ganhou 1 corrida gratuita na cidade! Total disponível: ' + r.rewardsAvailable + '.';
      }
    }

    function copyVipCode() {
      if (navigator.clipboard && VIP_CODE) {
        navigator.clipboard.writeText(VIP_CODE).then(function() {
          document.getElementById('copyStatus').textContent = 'Código copiado: ' + VIP_CODE;
        });
      }
    }

    validateCodeOnServer();
  </script>
</body>
</html>`;
}

function sendFileDownload(req, res, filePath, downloadName, contentType) {
  if (!filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado no servidor.');
    return;
  }
  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const rangeHeader = req.headers && req.headers.range ? String(req.headers.range) : '';
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), totalSize - 1) : totalSize - 1;
    if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= totalSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }
    const chunkSize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${downloadName}"`,
    'Accept-Ranges': 'bytes',
    'Content-Length': totalSize,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsed = urlModule.parse(req.url, true);
  const pathname = (parsed.pathname || '/').toLowerCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/ride/validate' && req.method === 'POST') {
    handleValidateQrApi(req, res);
    return;
  }

  if (pathname === '/api/ride/client' && req.method === 'POST') {
    handleLookupClientApi(req, res);
    return;
  }

  if (pathname === '/api/ride/register' && req.method === 'POST') {
    handleRegisterRideApi(req, res);
    return;
  }

  if (pathname === '/.well-known/assetlinks.json') {
    const assetLinks = [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: getCertificateFingerprints()
        }
      }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(assetLinks, null, 2));
    return;
  }

  if (pathname === '/cliente-vip.apk' || pathname === '/cliente_vip.apk' || pathname === '/app-debug.apk' || pathname === '/download' || pathname.endsWith('.apk')) {
    sendFileDownload(req, res, findApkPath(), 'Cliente_VIP.apk', 'application/vnd.android.package-archive');
    return;
  }

  if (pathname === '/cliente-vip-source.zip' || pathname === '/source.zip') {
    sendFileDownload(req, res, ZIP_PATH, 'Cliente_VIP_src.zip', 'application/zip');
    return;
  }

  if (pathname === '/ride' || pathname.startsWith('/r/')) {
    const codeFromQuery = parsed.query && parsed.query.code ? String(parsed.query.code) : '';
    const codeFromPath = pathname.startsWith('/r/') ? parsed.pathname.slice(3).split('/')[0] : '';
    const rawCode = codeFromQuery || codeFromPath;
    const apkInfo = getFileMeta(findApkPath());
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app';
    const publicBaseUrl = `${proto}://${host}`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(renderRideDeepLinkHtml(rawCode, apkInfo, publicBaseUrl));
    return;
  }

  const apkInfo = getFileMeta(findApkPath());
  const zipInfo = getFileMeta(ZIP_PATH);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(renderDownloadHtml(apkInfo, zipInfo));
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Download server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { server, extractVipCode, isValidVipCodeFormat, normalizeBrPhone, isValidBrPhone };
