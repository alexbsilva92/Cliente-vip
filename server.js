const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');

const { renderQrSvg } = require('./qrcode-svg');
const {
  renderDriverPortalHtml,
  renderRideWebHtml
} = require('./web-views');

const PORT = parseInt(process.env.PORT || '3000', 10);
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

function getFirebaseWebConfig() {
  return {
    apiKey: FIREBASE_WEB_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID
  };
}

function getPublicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return String(process.env.PUBLIC_BASE_URL).trim().replace(/\/+$/, '');
  }
  const forwardedHost = req && req.headers && req.headers['x-forwarded-host']
    ? String(req.headers['x-forwarded-host']).split(',')[0].trim()
    : '';
  const rawHost = forwardedHost || (req && req.headers && req.headers.host) || 'ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app';
  const safeHost = String(rawHost).replace(/[^a-zA-Z0-9.:-]/g, '') || 'ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app';
  const isLocalHost = /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(safeHost);
  if (isLocalHost) {
    const protoHeader = req && req.headers && req.headers['x-forwarded-proto']
      ? String(req.headers['x-forwarded-proto']).split(',')[0].trim().toLowerCase()
      : '';
    return `${protoHeader === 'https' ? 'https' : 'http'}://${safeHost}`;
  }
  return `https://${safeHost}`;
}

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
  const databaseId = process.env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || FIREBASE_PROJECT_ID;
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    return `http://${emulatorHost}/v1/projects/${projectId}/databases/${databaseId}/documents`;
  }
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

function getFirestoreDatabaseResourcePrefix() {
  const databaseId = process.env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || FIREBASE_PROJECT_ID;
  return `projects/${projectId}/databases/${databaseId}/documents`;
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
    const isEmulatorOwner = Boolean(process.env.FIRESTORE_EMULATOR_HOST && cleanIdToken === 'owner');
    return {
      headers: { Authorization: `Bearer ${cleanIdToken}` },
      uid,
      mode: isEmulatorOwner ? 'service_account' : 'user'
    };
  }
  const saToken = await getServiceAccountAccessToken();
  if (saToken) {
    return {
      headers: { Authorization: `Bearer ${saToken}` },
      uid: null,
      mode: 'service_account'
    };
  }

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

function requireDriverAuth(req, body) {
  const token = extractBearerToken(req, body);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'Faça login com sua conta Google de motorista para acessar este painel.'
    };
  }
  const payload = decodeJwtPayload(token);
  const uid = payload && (payload.user_id || payload.sub) ? String(payload.user_id || payload.sub) : '';
  const isExpired = Boolean(payload && typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now());
  if (!uid || isExpired) {
    return {
      ok: false,
      status: 401,
      error: 'Sessão de motorista inválida ou expirada. Entre novamente com o Google.'
    };
  }
  return {
    ok: true,
    uid,
    token,
    payload,
    headers: { Authorization: `Bearer ${token}` }
  };
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
  return `${getFirestoreDatabaseResourcePrefix()}/${collection}/${docId}`;
}

async function firestoreGetDoc(collection, docId, authHeaders) {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  return httpJsonRequest(url, 'GET', authHeaders, null);
}

async function firestoreCommit(writes, authHeaders) {
  const url = `${getFirestoreBaseUrl()}:commit`;
  return httpJsonRequest(url, 'POST', authHeaders, { writes });
}

async function firestoreRunQueryByField(collectionId, fieldPath, stringValue, authHeaders) {
  const url = `${getFirestoreBaseUrl()}:runQuery`;
  const res = await httpJsonRequest(url, 'POST', authHeaders, {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: 'EQUAL',
          value: { stringValue }
        }
      }
    }
  });
  if (res.status !== 200 || !Array.isArray(res.data)) {
    return { status: res.status, data: res.data, docs: [] };
  }
  const docs = res.data
    .filter((entry) => entry && entry.document && entry.document.fields)
    .map((entry) => ({
      docId: entry.document.name.split('/').pop(),
      updateTime: entry.document.updateTime || null,
      fields: fromFirestoreFields(entry.document.fields)
    }));
  return { status: 200, docs };
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

function serializeClientDoc(doc) {
  const f = doc.fields || {};
  return {
    id: f.id || doc.docId,
    driverId: f.driverId || '',
    name: f.name || '',
    phone: normalizeBrPhone(f.phone || ''),
    points: Number(f.points || 0),
    totalRides: Number(f.totalRides || 0),
    rewardsAvailable: Number(f.rewardsAvailable || 0),
    rewardsRedeemed: Number(f.rewardsRedeemed || 0),
    isArchived: Boolean(f.isArchived),
    createdAt: f.createdAt || null,
    updatedAt: f.updatedAt || null
  };
}

function serializeRideDoc(doc) {
  const f = doc.fields || {};
  return {
    id: f.id || doc.docId,
    clientName: f.clientName || '',
    clientPhone: normalizeBrPhone(f.clientPhone || ''),
    driverId: f.driverId || '',
    driverName: f.driverName || '',
    qrCodeId: f.qrCodeId || '',
    pointsEarned: Number(f.pointsEarned || 1),
    timestamp: f.timestamp || null
  };
}

function serializeRewardDoc(doc) {
  const f = doc.fields || {};
  return {
    id: f.id || doc.docId,
    clientName: f.clientName || '',
    clientPhone: normalizeBrPhone(f.clientPhone || ''),
    driverId: f.driverId || '',
    qrCodeId: f.qrCodeId || '',
    status: f.status || 'AVAILABLE',
    createdAt: f.createdAt || null,
    redeemedAt: f.redeemedAt || null
  };
}

function buildPwaManifestJson() {
  return JSON.stringify({
    id: '/',
    name: 'CLIENTE VIP',
    short_name: 'CLIENTE VIP',
    description: 'Sistema Web de Fidelidade VIP para Motoristas e Passageiros',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070B14',
    theme_color: '#0F172A',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, null, 2);
}

function buildServiceWorkerJs() {
  return `'use strict';
const CACHE_NAME = 'cliente-vip-pwa-v1';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ride') || url.pathname.startsWith('/r/')) {
    return;
  }
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }
  if (req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/motorista')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
`;
}

async function migrateLegacyClientsForDriverWeb(uid, rideDocs, existingClientDocs, authHeaders) {
  try {
    const ownedPhones = new Set();
    for (const c of existingClientDocs || []) {
      const p = c && c.fields ? normalizeBrPhone(c.fields.phone || '') : '';
      if (p) ownedPhones.add(p);
    }
    const candidateIds = new Set();
    for (const r of rideDocs) {
      const rawDigits = String(r.clientPhone || '').replace(/\D/g, '');
      const norm = normalizeBrPhone(rawDigits);
      if (norm && norm.length >= 8 && !ownedPhones.has(norm)) {
        candidateIds.add(norm);
        if (rawDigits && rawDigits !== norm && rawDigits.length >= 8) {
          candidateIds.add(rawDigits);
        }
      }
    }
    if (candidateIds.size === 0) return false;

    let migratedAny = false;
    for (const legacyId of candidateIds) {
      // Blind Rule-D conditional claim: succeeds strictly when doc exists without a driverId,
      // never issuing an open read or overwriting another driver's client or counters.
      const claimRes = await firestoreCommit([{
        currentDocument: { exists: true },
        updateMask: { fieldPaths: ['driverId', 'isArchived'] },
        update: {
          name: fullDocResourceName('clients', legacyId),
          fields: toFirestoreFields({
            driverId: uid,
            isArchived: false
          })
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]
      }], authHeaders).catch(() => null);
      if (claimRes && claimRes.status === 200) {
        migratedAny = true;
      }
    }
    return migratedAny;
  } catch (_) {
    return false;
  }
}

// ======================= DRIVER API =======================

async function handleDriverClientsApi(req, res) {
  try {
    const auth = requireDriverAuth(req, null);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const [initialClientsRes, qrRes, ridesRes, rewardsRes] = await Promise.all([
      firestoreRunQueryByField('clients', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('qrcodes', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('rides', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('rewards', 'driverId', auth.uid, auth.headers)
    ]);

    if (initialClientsRes.status === 401 || initialClientsRes.status === 403) {
      sendJson(res, initialClientsRes.status, {
        ok: false,
        authRequired: initialClientsRes.status === 401,
        error: 'Sua sessão expirou ou não tem permissão neste banco. Faça login novamente com o Google.'
      });
      return;
    }
    if (initialClientsRes.status !== 200) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar lista de clientes no Firestore.' });
      return;
    }

    const rides = ridesRes.status === 200
      ? ridesRes.docs.map(serializeRideDoc).sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0))
      : [];

    let clientsRes = initialClientsRes;
    if (rides.length > 0) {
      const migratedAny = await migrateLegacyClientsForDriverWeb(auth.uid, rides, initialClientsRes.docs, auth.headers);
      if (migratedAny) {
        const refreshed = await firestoreRunQueryByField('clients', 'driverId', auth.uid, auth.headers);
        if (refreshed.status === 200) clientsRes = refreshed;
      }
    }

    const clients = clientsRes.docs
      .map(serializeClientDoc)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
      });

    const rewards = rewardsRes.status === 200
      ? rewardsRes.docs.map(serializeRewardDoc).sort((a, b) =>
          Date.parse(b.redeemedAt || b.createdAt || 0) - Date.parse(a.redeemedAt || a.createdAt || 0)
        )
      : [];

    const publicBaseUrl = getPublicBaseUrl(req);
    let activeQr = null;
    if (qrRes.status === 200 && Array.isArray(qrRes.docs)) {
      const nowMs = Date.now();
      const validQrs = qrRes.docs
        .map((d) => d.fields)
        .filter((q) => q.status === 'ACTIVE' && q.expiresAt && Date.parse(q.expiresAt) > nowMs)
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      if (validQrs.length > 0) {
        const latest = validQrs[0];
        const rideUrl = `${publicBaseUrl}/ride?code=${encodeURIComponent(latest.codeId)}`;
        activeQr = {
          codeId: latest.codeId,
          driverId: latest.driverId,
          driverName: latest.driverName || 'Motorista VIP',
          status: latest.status,
          expiresAt: latest.expiresAt,
          rideUrl,
          qrSvg: renderQrSvg(rideUrl)
        };
      }
    }

    sendJson(res, 200, {
      ok: true,
      clients,
      rides,
      rewards,
      activeQr
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro interno ao listar clientes.' });
  }
}

async function handleDriverBackupApi(req, res) {
  try {
    const auth = requireDriverAuth(req, null);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const [clientsRes, ridesRes, rewardsRes, qrRes] = await Promise.all([
      firestoreRunQueryByField('clients', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('rides', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('rewards', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('qrcodes', 'driverId', auth.uid, auth.headers)
    ]);

    const allResponses = [clientsRes, ridesRes, rewardsRes, qrRes];
    const authErr = allResponses.find((r) => r.status === 401 || r.status === 403);
    if (authErr) {
      sendJson(res, authErr.status, { ok: false, error: 'Sem permissão para exportar backup.' });
      return;
    }
    if (allResponses.some((r) => r.status !== 200)) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar dados completos para backup no Firestore.' });
      return;
    }

    const backupPayload = {
      exportedAt: new Date().toISOString(),
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID,
      firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID,
      driverId: auth.uid,
      clients: clientsRes.docs.map(serializeClientDoc),
      rides: ridesRes.docs.map(serializeRideDoc),
      rewards: rewardsRes.docs.map(serializeRewardDoc),
      qrcodes: qrRes.docs.map((d) => d.fields)
    };

    const filename = `cliente-vip-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro ao exportar backup.' });
  }
}

async function handleDriverCreateQrApi(req, res) {
  try {
    const body = await readJsonBody(req);
    const auth = requireDriverAuth(req, body);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const rawName = String(body.driverName || (auth.payload && (auth.payload.name || auth.payload.email)) || 'Motorista VIP').trim();
    const driverName = (rawName || 'Motorista VIP').slice(0, 100);
    const p1 = crypto.randomInt(1000, 10000);
    const p2 = crypto.randomInt(1000, 10000);
    const codeId = `VIP-${p1}-${p2}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const writes = [
      {
        currentDocument: { exists: false },
        update: {
          name: fullDocResourceName('qrcodes', codeId),
          fields: toFirestoreFields({
            codeId,
            driverId: auth.uid,
            driverName,
            status: 'ACTIVE',
            expiresAt
          })
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }
        ]
      }
    ];

    const commitRes = await firestoreCommit(writes, auth.headers);
    if (commitRes.status === 401 || commitRes.status === 403) {
      sendJson(res, commitRes.status, {
        ok: false,
        error: 'Sem permissão para criar QR Code. Verifique seu login Google.'
      });
      return;
    }
    if (commitRes.status !== 200) {
      const msg = commitRes.data && commitRes.data.error && commitRes.data.error.message
        ? commitRes.data.error.message
        : 'Não foi possível criar o QR Code.';
      sendJson(res, 400, { ok: false, error: msg });
      return;
    }

    const publicBaseUrl = getPublicBaseUrl(req);
    const rideUrl = `${publicBaseUrl}/ride?code=${encodeURIComponent(codeId)}`;
    sendJson(res, 200, {
      ok: true,
      qrCode: {
        codeId,
        driverId: auth.uid,
        driverName,
        status: 'ACTIVE',
        expiresAt: expiresAt.toISOString(),
        rideUrl,
        qrSvg: renderQrSvg(rideUrl)
      }
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro interno ao gerar QR Code.' });
  }
}

async function handleDriverGetQrStatusApi(req, res, rawCodeId) {
  try {
    const auth = requireDriverAuth(req, null);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const codeId = extractVipCode(rawCodeId);
    if (!isValidVipCodeFormat(codeId)) {
      sendJson(res, 400, { ok: false, error: 'Código QR inválido.' });
      return;
    }

    const docRes = await firestoreGetDoc('qrcodes', codeId, auth.headers);
    if (docRes.status === 404) {
      sendJson(res, 404, { ok: false, error: 'QR Code não encontrado.' });
      return;
    }
    if (docRes.status !== 200 || !docRes.data || !docRes.data.fields) {
      sendJson(res, docRes.status === 403 ? 403 : 502, { ok: false, error: 'Erro ao consultar QR Code.' });
      return;
    }

    const qr = fromFirestoreFields(docRes.data.fields);
    if (qr.driverId && qr.driverId !== auth.uid) {
      sendJson(res, 403, { ok: false, error: 'Este QR Code pertence a outro motorista.' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      qrCode: {
        codeId: qr.codeId || codeId,
        status: qr.status || 'ACTIVE',
        usedByName: qr.usedByName || null,
        usedByPhone: qr.usedByPhone || null,
        usedAt: qr.usedAt || null,
        expiresAt: qr.expiresAt || null
      }
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro ao consultar status do QR Code.' });
  }
}

async function handleDriverRedeemClientApi(req, res, clientId) {
  try {
    const body = await readJsonBody(req);
    const auth = requireDriverAuth(req, body);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const clientRes = await firestoreGetDoc('clients', clientId, auth.headers);
    if (clientRes.status === 404) {
      sendJson(res, 404, { ok: false, error: 'Cliente não encontrado.' });
      return;
    }
    if (clientRes.status === 401 || clientRes.status === 403) {
      sendJson(res, clientRes.status, { ok: false, error: 'Permissão negada para resgatar prêmio deste cliente.' });
      return;
    }
    if (clientRes.status !== 200 || !clientRes.data || !clientRes.data.fields) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar cliente.' });
      return;
    }

    const client = fromFirestoreFields(clientRes.data.fields);
    if (client.driverId !== auth.uid) {
      sendJson(res, 403, { ok: false, error: 'Permissão negada para resgatar recompensa deste cliente.' });
      return;
    }

    const available = Number(client.rewardsAvailable || 0);
    const redeemed = Number(client.rewardsRedeemed || 0);
    if (available <= 0) {
      sendJson(res, 400, { ok: false, error: 'Cliente não possui corridas gratuitas disponíveis para resgate.' });
      return;
    }

    const normPhone = normalizeBrPhone(client.phone || '');
    const rewardsRes = await firestoreRunQueryByField('rewards', 'driverId', auth.uid, auth.headers);
    const availRewardDoc = rewardsRes.status === 200
      ? rewardsRes.docs.find((d) =>
          d.fields.status === 'AVAILABLE' &&
          normalizeBrPhone(d.fields.clientPhone || '') === normPhone
        )
      : null;

    const writes = [
      {
        currentDocument: { updateTime: clientRes.data.updateTime },
        updateMask: { fieldPaths: ['rewardsAvailable', 'rewardsRedeemed'] },
        update: {
          name: fullDocResourceName('clients', clientId),
          fields: toFirestoreFields({
            rewardsAvailable: available - 1,
            rewardsRedeemed: redeemed + 1
          })
        },
        updateTransforms: [
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
        ]
      }
    ];

    if (availRewardDoc && availRewardDoc.updateTime) {
      writes.push({
        currentDocument: { updateTime: availRewardDoc.updateTime },
        updateMask: { fieldPaths: ['status'] },
        update: {
          name: fullDocResourceName('rewards', availRewardDoc.docId),
          fields: toFirestoreFields({ status: 'REDEEMED' })
        },
        updateTransforms: [
          { fieldPath: 'redeemedAt', setToServerValue: 'REQUEST_TIME' }
        ]
      });
    } else {
      const fallbackRewardId = `REW-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      writes.push({
        currentDocument: { exists: false },
        update: {
          name: fullDocResourceName('rewards', fallbackRewardId),
          fields: toFirestoreFields({
            id: fallbackRewardId,
            clientPhone: normPhone || String(client.phone || ''),
            clientName: client.name || 'Cliente VIP',
            driverId: auth.uid,
            status: 'REDEEMED'
          })
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'redeemedAt', setToServerValue: 'REQUEST_TIME' }
        ]
      });
    }

    const commitRes = await firestoreCommit(writes, auth.headers);
    if (commitRes.status !== 200) {
      const msg = commitRes.data && commitRes.data.error && commitRes.data.error.message
        ? commitRes.data.error.message
        : 'Não foi possível concluir o resgate da corrida gratuita.';
      sendJson(res, commitRes.status === 409 ? 409 : 400, { ok: false, error: msg });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      rewardsAvailable: available - 1,
      rewardsRedeemed: redeemed + 1
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro interno ao resgatar prêmio.' });
  }
}

async function handleDriverUpdateClientApi(req, res, clientId) {
  try {
    const body = await readJsonBody(req);
    const auth = requireDriverAuth(req, body);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const cleanName = String(body.name || '').trim();
    const normPhone = normalizeBrPhone(body.phone || '');
    const isArchived = Boolean(body.isArchived);

    if (cleanName.length < 2 || cleanName.length > 100) {
      sendJson(res, 400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres.' });
      return;
    }
    if (!isValidBrPhone(normPhone)) {
      sendJson(res, 400, { ok: false, error: 'Informe um telefone válido com DDD.' });
      return;
    }

    const clientRes = await firestoreGetDoc('clients', clientId, auth.headers);
    if (clientRes.status === 404) {
      sendJson(res, 404, { ok: false, error: 'Cliente não encontrado.' });
      return;
    }
    if (clientRes.status === 401 || clientRes.status === 403) {
      sendJson(res, clientRes.status, { ok: false, error: 'Permissão negada para editar este cliente.' });
      return;
    }
    if (clientRes.status !== 200 || !clientRes.data || !clientRes.data.fields) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar cliente.' });
      return;
    }

    const existing = fromFirestoreFields(clientRes.data.fields);
    if (existing.driverId !== auth.uid) {
      sendJson(res, 403, { ok: false, error: 'Permissão negada para alterar cliente de outro motorista.' });
      return;
    }

    const writes = [
      {
        currentDocument: { updateTime: clientRes.data.updateTime },
        updateMask: { fieldPaths: ['name', 'phone', 'isArchived'] },
        update: {
          name: fullDocResourceName('clients', clientId),
          fields: toFirestoreFields({
            name: cleanName,
            phone: normPhone,
            isArchived
          })
        },
        updateTransforms: [
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
        ]
      }
    ];

    const commitRes = await firestoreCommit(writes, auth.headers);
    if (commitRes.status !== 200) {
      const msg = commitRes.data && commitRes.data.error && commitRes.data.error.message
        ? commitRes.data.error.message
        : 'Não foi possível atualizar os dados do cliente.';
      sendJson(res, 400, { ok: false, error: msg });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro interno ao atualizar cliente.' });
  }
}

async function handleDriverDeleteClientApi(req, res, clientId) {
  try {
    const auth = requireDriverAuth(req, null);
    if (!auth.ok) {
      sendJson(res, auth.status, { ok: false, authRequired: true, error: auth.error });
      return;
    }

    const clientRes = await firestoreGetDoc('clients', clientId, auth.headers);
    if (clientRes.status === 404) {
      sendJson(res, 404, { ok: false, error: 'Cliente não encontrado.' });
      return;
    }
    if (clientRes.status === 401 || clientRes.status === 403) {
      sendJson(res, clientRes.status, { ok: false, error: 'Permissão negada para excluir este cliente.' });
      return;
    }
    if (clientRes.status !== 200 || !clientRes.data || !clientRes.data.fields) {
      sendJson(res, 502, { ok: false, error: 'Erro ao consultar cliente.' });
      return;
    }

    const client = fromFirestoreFields(clientRes.data.fields);
    if (client.driverId !== auth.uid) {
      sendJson(res, 403, { ok: false, error: 'Permissão negada para excluir cliente de outro motorista.' });
      return;
    }

    const normPhone = normalizeBrPhone(client.phone || '');
    const [ridesRes, rewardsRes] = await Promise.all([
      firestoreRunQueryByField('rides', 'driverId', auth.uid, auth.headers),
      firestoreRunQueryByField('rewards', 'driverId', auth.uid, auth.headers)
    ]);

    const deleteWrites = [{ delete: fullDocResourceName('clients', clientId) }];

    if (ridesRes.status === 200) {
      for (const r of ridesRes.docs) {
        if (normalizeBrPhone(r.fields.clientPhone || '') === normPhone) {
          deleteWrites.push({ delete: fullDocResourceName('rides', r.docId) });
        }
      }
    }
    if (rewardsRes.status === 200) {
      for (const rw of rewardsRes.docs) {
        if (normalizeBrPhone(rw.fields.clientPhone || '') === normPhone) {
          deleteWrites.push({ delete: fullDocResourceName('rewards', rw.docId) });
        }
      }
    }

    for (let i = 0; i < deleteWrites.length; i += 450) {
      const chunk = deleteWrites.slice(i, i + 450);
      const commitRes = await firestoreCommit(chunk, auth.headers);
      if (commitRes.status !== 200) {
        sendJson(res, 400, { ok: false, error: 'Erro ao excluir registros vinculados do cliente.' });
        return;
      }
    }

    sendJson(res, 200, { ok: true, deletedCount: deleteWrites.length });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erro interno ao excluir cliente.' });
  }
}

// ======================= PASSENGER RIDE API =======================

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
  // Public phone-based lookup intentionally disabled to prevent client enumeration/PII leaks.
  sendJson(res, 403, {
    ok: false,
    error: 'Consulta pública de clientes por telefone desativada por segurança.'
  });
}

async function handleRegisterRideApi(req, res) {
  try {
    const body = await readJsonBody(req);
    const cleanCode = extractVipCode(body.code || '');
    const cleanName = String(body.name || '').trim();
    const rawPhoneDigits = String(body.phone || '').replace(/\D/g, '');
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

    if (clientRes.status === 404 && rawPhoneDigits && rawPhoneDigits !== normalizedPhone && rawPhoneDigits.length >= 10) {
      const altScopedId = `${driverId}_${rawPhoneDigits}`;
      const altScopedRes = await firestoreGetDoc('clients', altScopedId, authCtx.headers);
      if (altScopedRes.status === 200 && altScopedRes.data && altScopedRes.data.fields) {
        clientRes = altScopedRes;
        targetClientId = altScopedId;
      }
    }

    if (clientRes.status === 404) {
      const legacyCandidates = [normalizedPhone];
      if (rawPhoneDigits && rawPhoneDigits !== normalizedPhone && rawPhoneDigits.length >= 10) {
        legacyCandidates.push(rawPhoneDigits);
      }
      for (const legacyKey of legacyCandidates) {
        const legacyRes = await firestoreGetDoc('clients', legacyKey, authCtx.headers);
        if (legacyRes.status === 200 && legacyRes.data && legacyRes.data.fields) {
          const legacyFields = fromFirestoreFields(legacyRes.data.fields);
          if (!legacyFields.driverId || legacyFields.driverId === driverId) {
            clientRes = legacyRes;
            targetClientId = legacyKey;
            break;
          }
        }
      }
    }

    if (clientRes.status === 404 && authCtx.mode !== 'user') {
      const driverClientsRes = await firestoreRunQueryByField('clients', 'driverId', driverId, authCtx.headers);
      if (driverClientsRes.status === 200 && Array.isArray(driverClientsRes.docs)) {
        const matched = driverClientsRes.docs.find((d) =>
          d && d.fields && normalizeBrPhone(d.fields.phone || '') === normalizedPhone
        );
        if (matched && matched.docId) {
          const matchedRes = await firestoreGetDoc('clients', matched.docId, authCtx.headers);
          if (matchedRes.status === 200 && matchedRes.data && matchedRes.data.fields) {
            clientRes = matchedRes;
            targetClientId = matched.docId;
          }
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
    if (commitRes.status === 403 || commitRes.status === 400) {
      const recheckQr = await firestoreGetDoc('qrcodes', cleanCode, authCtx.headers);
      if (recheckQr.status === 200 && recheckQr.data && recheckQr.data.fields) {
        const latestQr = fromFirestoreFields(recheckQr.data.fields);
        if (latestQr.status !== 'ACTIVE') {
          sendJson(res, 409, {
            ok: false,
            status: 'USED',
            error: 'Este QR Code acabou de ser utilizado em outra leitura simultânea.'
          });
          return;
        }
      }
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

const rideRateLimitBuckets = new Map();

function getClientIp(req) {
  const xff = req && req.headers && req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkPublicRideRateLimit(req, res, limitPerMinute = 120) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  let stamps = rideRateLimitBuckets.get(ip) || [];
  stamps = stamps.filter((t) => t > windowStart);
  if (stamps.length >= limitPerMinute) {
    rideRateLimitBuckets.set(ip, stamps);
    sendJson(res, 429, {
      ok: false,
      error: 'Muitas tentativas em sequência. Aguarde um minuto e tente novamente.'
    });
    return false;
  }
  stamps.push(now);
  rideRateLimitBuckets.set(ip, stamps);
  if (rideRateLimitBuckets.size > 2000) {
    for (const [k, v] of rideRateLimitBuckets.entries()) {
      if (!v.some((t) => t > windowStart)) rideRateLimitBuckets.delete(k);
    }
  }
  return true;
}

const server = http.createServer((req, res) => {
  const parsed = urlModule.parse(req.url, true);
  const rawPathname = parsed.pathname || '/';
  const pathname = rawPathname.toLowerCase();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (pathname.startsWith('/api/') || pathname === '/ride' || pathname.startsWith('/r/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Cloud Run readiness & liveness probe
  if ((pathname === '/healthz' || pathname === '/_ah/health') && req.method === 'GET') {
    sendJson(res, 200, { ok: true, service: 'cliente-vip-web' });
    return;
  }

  // PWA Manifest, Service Worker & Static PNG Icons
  if (pathname === '/manifest.webmanifest' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(buildPwaManifestJson());
    return;
  }

  if (pathname === '/sw.js' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(buildServiceWorkerJs());
    return;
  }

  if (pathname.startsWith('/icons/') && req.method === 'GET') {
    const safeName = path.basename(rawPathname);
    const allowedIcons = new Set(['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']);
    const iconPath = path.join(__dirname, 'public/icons', safeName);
    if (!allowedIcons.has(safeName) || !fs.existsSync(iconPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Ícone não encontrado.');
      return;
    }
    const stat = fs.statSync(iconPath);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400'
    });
    fs.createReadStream(iconPath).pipe(res);
    return;
  }

  // Driver API routes
  if (pathname === '/api/driver/clients' && req.method === 'GET') {
    handleDriverClientsApi(req, res);
    return;
  }

  if (pathname === '/api/driver/backup' && req.method === 'GET') {
    handleDriverBackupApi(req, res);
    return;
  }

  if (pathname === '/api/driver/qrcodes' && req.method === 'POST') {
    handleDriverCreateQrApi(req, res);
    return;
  }

  const qrStatusMatch = rawPathname.match(/^\/api\/driver\/qrcodes\/([^/]+)$/i);
  if (qrStatusMatch && req.method === 'GET') {
    handleDriverGetQrStatusApi(req, res, decodeURIComponent(qrStatusMatch[1]));
    return;
  }

  const redeemMatch = rawPathname.match(/^\/api\/driver\/clients\/([^/]+)\/redeem$/i);
  if (redeemMatch && req.method === 'POST') {
    handleDriverRedeemClientApi(req, res, decodeURIComponent(redeemMatch[1]));
    return;
  }

  const updateMatch = rawPathname.match(/^\/api\/driver\/clients\/([^/]+)\/update$/i);
  if (updateMatch && req.method === 'POST') {
    handleDriverUpdateClientApi(req, res, decodeURIComponent(updateMatch[1]));
    return;
  }

  const deleteMatch = rawPathname.match(/^\/api\/driver\/clients\/([^/]+)$/i);
  if (deleteMatch && req.method === 'DELETE') {
    handleDriverDeleteClientApi(req, res, decodeURIComponent(deleteMatch[1]));
    return;
  }

  // Passenger API routes (rate-limited public surface)
  if (pathname === '/api/ride/validate' && req.method === 'POST') {
    if (!checkPublicRideRateLimit(req, res)) return;
    handleValidateQrApi(req, res);
    return;
  }

  if (pathname === '/api/ride/client' && req.method === 'POST') {
    if (!checkPublicRideRateLimit(req, res)) return;
    handleLookupClientApi(req, res);
    return;
  }

  if (pathname === '/api/ride/register' && req.method === 'POST') {
    if (!checkPublicRideRateLimit(req, res)) return;
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

  // Passenger Web Portal (browser-only, no app, name + phone only)
  if (pathname === '/ride' || pathname.startsWith('/r/')) {
    const codeFromQuery = parsed.query && parsed.query.code ? String(parsed.query.code) : '';
    const codeFromPath = pathname.startsWith('/r/') ? rawPathname.slice(3).split('/')[0] : '';
    const cleanCode = extractVipCode(codeFromQuery || codeFromPath);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(renderRideWebHtml(cleanCode));
    return;
  }

  // Retired APK/download routes redirect cleanly to Web PWA
  if (pathname === '/baixar' || pathname === '/download-app') {
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  // Driver Web Portal (default root `/` and `/motorista`)
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(renderDriverPortalHtml(getFirebaseWebConfig(), getPublicBaseUrl(req)));
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CLIENTE VIP web server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { server, extractVipCode, isValidVipCodeFormat, normalizeBrPhone, isValidBrPhone };
