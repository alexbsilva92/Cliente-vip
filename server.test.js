const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_PROJECT_ID = "demo-no-project";
process.env.FIRESTORE_DATABASE_ID = "(default)";

const { server, normalizeBrPhone, isValidBrPhone, extractVipCode } = require("./server");
const { encodeQrMatrix, renderQrSvg } = require("./qrcode-svg");

let baseUrl = "";

function requestJson(urlStr, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = body !== undefined && body !== null ? JSON.stringify(body) : null;
    const hdrs = Object.assign({}, headers);
    if (payload !== null) {
      hdrs["Content-Type"] = "application/json";
      hdrs["Content-Length"] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method,
        headers: hdrs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          resolve({ status: res.statusCode, text, json, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function createEmulatorUser(email) {
  const res = await requestJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    "POST",
    { email, password: "password123", returnSecureToken: true }
  );
  if (res.status === 200 && res.json && res.json.idToken) {
    return res.json;
  }
  const signIn = await requestJson(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    "POST",
    { email, password: "password123", returnSecureToken: true }
  );
  return signIn.json;
}

before(async () => {
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("Helper functions: BR phone normalization, VIP code extraction, and pure-JS QR SVG generation", () => {
  assert.equal(normalizeBrPhone("+55 (11) 98765-4321"), "11987654321");
  assert.equal(normalizeBrPhone("011987654321"), "11987654321");
  assert.equal(isValidBrPhone("+55 11 98765-4321"), true);
  assert.equal(isValidBrPhone("12345"), false);
  assert.equal(extractVipCode("https://example.com/ride?code=vip-1234-5678"), "VIP-1234-5678");

  const sampleUrl = "https://ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app/ride?code=VIP-1234-5678";
  const qr = encodeQrMatrix(sampleUrl);
  assert.ok(qr.version >= 4 && qr.version <= 10);
  assert.equal(qr.modules.length, qr.size);
  // Top-left 7x7 finder corners must all be dark
  assert.equal(qr.modules[0][0], 1);
  assert.equal(qr.modules[0][6], 1);
  assert.equal(qr.modules[6][0], 1);
  assert.equal(qr.modules[3][3], 1);
  assert.equal(qr.modules[1][1], 0);
  // Dark module at [size - 8][8]
  assert.equal(qr.modules[qr.size - 8][8], 1);

  const svg = renderQrSvg(sampleUrl);
  assert.ok(svg.startsWith("<svg "));
  assert.ok(svg.includes("</svg>"));
});

function requestRaw(urlStr, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = body !== undefined && body !== null ? JSON.stringify(body) : null;
    const hdrs = Object.assign({}, headers);
    if (payload !== null) {
      hdrs["Content-Type"] = "application/json";
      hdrs["Content-Length"] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method,
        headers: hdrs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          resolve({ status: res.statusCode, buffer, text, json, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

test("GET /.well-known/assetlinks.json returns valid package and SHA-256", async () => {
  const res = await requestJson(`${baseUrl}/.well-known/assetlinks.json`, "GET", null);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json));
  assert.equal(res.json[0].target.package_name, "com.aistudio.clientevip.rkpxzt");
  assert.ok(res.json[0].target.sha256_cert_fingerprints[0].startsWith("22:65:2B:03"));
});

test("PWA endpoints (/manifest.webmanifest, /sw.js, /icons/*.png) and HTML tags serve properly", async () => {
  const manifestRes = await requestJson(`${baseUrl}/manifest.webmanifest`, "GET", null);
  assert.equal(manifestRes.status, 200);
  assert.ok(String(manifestRes.headers["content-type"]).includes("application/manifest+json"));
  assert.equal(manifestRes.json.name, "CLIENTE VIP");
  assert.equal(manifestRes.json.short_name, "CLIENTE VIP");
  assert.equal(manifestRes.json.display, "standalone");
  assert.equal(manifestRes.json.start_url, "/");
  assert.ok(manifestRes.json.icons.some((i) => i.src === "/icons/icon-192.png"));
  assert.ok(manifestRes.json.icons.some((i) => i.src === "/icons/icon-512.png"));
  assert.ok(manifestRes.json.icons.some((i) => i.purpose === "maskable"));

  const swRes = await requestRaw(`${baseUrl}/sw.js`, "GET", null);
  assert.equal(swRes.status, 200);
  assert.ok(String(swRes.headers["content-type"]).includes("application/javascript"));
  assert.ok(swRes.text.includes("url.pathname.startsWith('/api/')"));
  assert.ok(swRes.text.includes("url.pathname.startsWith('/ride')"));

  for (const iconName of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
    const iconRes = await requestRaw(`${baseUrl}/icons/${iconName}`, "GET", null);
    assert.equal(iconRes.status, 200);
    assert.equal(iconRes.headers["content-type"], "image/png");
    assert.equal(iconRes.buffer[0], 0x89);
    assert.equal(iconRes.buffer.toString("ascii", 1, 4), "PNG");
  }

  const missingIcon = await requestRaw(`${baseUrl}/icons/does-not-exist.png`, "GET", null);
  assert.equal(missingIcon.status, 404);
});

test("GET /, /motorista, /baixar, and /healthz serve Web PWA, redirect legacy APK path, and expose health probe", async () => {
  for (const route of ["/", "/motorista"]) {
    const driverPage = await requestJson(`${baseUrl}${route}`, "GET", null);
    assert.equal(driverPage.status, 200);
    assert.equal(driverPage.headers["x-content-type-options"], "nosniff");
    assert.ok(driverPage.text.includes("Área do Motorista"));
    assert.ok(driverPage.text.includes("Entrar com Google"));
    assert.ok(driverPage.text.includes("/api/driver/qrcodes"));
    assert.ok(driverPage.text.includes("/api/driver/clients"));
    assert.ok(driverPage.text.includes("/api/driver/backup"));
    assert.ok(driverPage.text.includes("manifest.webmanifest"));
    assert.ok(driverPage.text.includes("navigator.serviceWorker.register('/sw.js')"));
    assert.ok(driverPage.text.includes("Corridas Registradas"));
    assert.ok(driverPage.text.includes("Recompensas"));
  }

  const retiredDownload = await requestRaw(`${baseUrl}/baixar`, "GET", null);
  assert.equal(retiredDownload.status, 302);
  assert.equal(retiredDownload.headers.location, "/");

  for (const healthRoute of ["/healthz", "/_ah/health"]) {
    const h = await requestJson(`${baseUrl}${healthRoute}`, "GET", null);
    assert.equal(h.status, 200);
    assert.equal(h.json.ok, true);
    assert.equal(h.json.service, "cliente-vip-web");
  }
});

test("GET /ride?code=VIP-6944-2412 serves browser-only passenger area without phone-lookup PII probes", async () => {
  const res = await requestJson(`${baseUrl}/ride?code=VIP-6944-2412`, "GET", null);
  assert.equal(res.status, 200);
  assert.equal(res.headers["x-robots-tag"], "noindex, nofollow");
  assert.ok(res.text.includes("VIP-6944-2412"));
  assert.ok(res.text.includes("/api/ride/validate"));
  assert.ok(res.text.includes("/api/ride/register"));
  assert.ok(res.text.includes("manifest.webmanifest"));
  assert.equal(res.text.includes("/api/ride/client"), false);
  assert.equal(res.text.includes("lookupReturningClient"), false);
  assert.equal(res.text.includes("FIREBASE_CONFIG"), false);
  assert.equal(res.text.includes("returningBox"), false);
  assert.equal(res.text.includes("window.location.href"), false);
  assert.equal(res.text.includes("clientevip://ride"), false);
  assert.equal(res.text.includes("Entrar com Google"), false);
  assert.equal(res.text.includes("Baixar APK"), false);
  assert.ok(res.text.includes("Seu Nome Completo"));
  assert.ok(res.text.includes("Seu Telefone ou WhatsApp com DDD"));
  assert.ok(res.text.includes("CONFIRMAR CORRIDA"));
});

test("Inline JavaScript inside Driver and Passenger HTML pages compiles cleanly via vm.Script", async () => {
  const vm = require("node:vm");
  for (const pathRoute of ["/", "/ride?code=VIP-1234-5678"]) {
    const page = await requestRaw(`${baseUrl}${pathRoute}`, "GET", null);
    assert.equal(page.status, 200);
    const scripts = [...page.text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 1, `Expected inline script on ${pathRoute}`);
    for (const src of scripts) {
      new vm.Script(src);
    }
  }
});

test("Full Driver Web API + Passenger API + Legacy Preservation + Expiry + Concurrency via emulators", async () => {
  const fs = require("node:fs");
  const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  const [host, portStr] = FIRESTORE_HOST.split(":");
  const testEnv = await initializeTestEnvironment({
    projectId: "demo-no-project",
    firestore: { rules, host, port: parseInt(portStr, 10) },
  });
  await testEnv.clearFirestore();

  try {
    const driverA = await createEmulatorUser(`driverA_${Date.now()}@clientevip.com`);
    const driverB = await createEmulatorUser(`driverB_${Date.now()}@clientevip.com`);
    const passenger = await createEmulatorUser(`pass_srv_${Date.now()}@clientevip.com`);

    // 1. Unauthenticated driver routes reject cleanly with 401
    const unauthList = await requestJson(`${baseUrl}/api/driver/clients`, "GET", null);
    assert.equal(unauthList.status, 401);
    const unauthQr = await requestJson(`${baseUrl}/api/driver/qrcodes`, "POST", { driverName: "X" });
    assert.equal(unauthQr.status, 401);
    const unauthBackup = await requestJson(`${baseUrl}/api/driver/backup`, "GET", null);
    assert.equal(unauthBackup.status, 401);

    // 2. Driver A generates QR Code via Web API behind HTTPS proxy headers
    const createQrRes = await requestJson(
      `${baseUrl}/api/driver/qrcodes`,
      "POST",
      { driverName: "Motorista Carlos" },
      {
        Authorization: `Bearer ${driverA.idToken}`,
        "x-forwarded-host": "cliente-vip-web.us-east1.run.app"
      }
    );
    assert.equal(createQrRes.status, 200);
    assert.equal(createQrRes.json.ok, true);
    const codeId = createQrRes.json.qrCode.codeId;
    assert.match(codeId, /^VIP-\d{4}-\d{4}$/);
    assert.ok(createQrRes.json.qrCode.qrSvg.startsWith("<svg "));
    assert.equal(
      createQrRes.json.qrCode.rideUrl,
      `https://cliente-vip-web.us-east1.run.app/ride?code=${codeId}`
    );
    assert.equal(createQrRes.json.qrCode.rideUrl.startsWith("clientevip://"), false);

    // 3. Cross-driver isolation on QR polling
    const crossPoll = await requestJson(
      `${baseUrl}/api/driver/qrcodes/${codeId}`,
      "GET",
      null,
      { Authorization: `Bearer ${driverB.idToken}` }
    );
    assert.equal(crossPoll.status, 403);

    // 4. Expired QR Code blocking on /api/ride/validate & /api/ride/register (15-min TTL enforcement)
    const expiredCode = "VIP-9999-0001";
    const pastIso = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const seedExp = await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/qrcodes?documentId=${expiredCode}`,
      "POST",
      {
        fields: {
          codeId: { stringValue: expiredCode },
          driverId: { stringValue: driverA.localId },
          driverName: { stringValue: "Motorista Carlos" },
          status: { stringValue: "ACTIVE" },
          createdAt: { timestampValue: pastIso },
          expiresAt: { timestampValue: pastIso },
        },
      },
      { Authorization: "Bearer owner" }
    );
    assert.equal(seedExp.status, 200);

    const expVal = await requestJson(`${baseUrl}/api/ride/validate`, "POST", {
      code: expiredCode,
      idToken: "owner",
    });
    assert.equal(expVal.status, 410);
    assert.equal(expVal.json.status, "EXPIRED");

    const expReg = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: expiredCode,
      name: "Passageiro Expirado",
      phone: "11999998888",
      idToken: "owner",
    });
    assert.equal(expReg.status, 410);
    assert.equal(expReg.json.status, "EXPIRED");

    // 5. Passenger validates valid QR code
    const unauthVal = await requestJson(`${baseUrl}/api/ride/validate`, "POST", { code: codeId });
    assert.equal(unauthVal.status, 401);
    assert.equal(unauthVal.json.authRequired, true);

    const validRes = await requestJson(`${baseUrl}/api/ride/validate`, "POST", {
      code: codeId,
      idToken: passenger.idToken,
    });
    assert.equal(validRes.status, 200);
    assert.equal(validRes.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(validRes.json.driverName, "Motorista Carlos");
    assert.equal("driverId" in validRes.json, false);

    // 6. Concurrent double-submit / duplicate-point protection on the SAME QR code
    const [raceA, raceB] = await Promise.all([
      requestJson(`${baseUrl}/api/ride/register`, "POST", {
        code: codeId,
        name: "Passageira Ana",
        phone: "+55 (11) 98765-4321",
        idToken: passenger.idToken,
      }),
      requestJson(`${baseUrl}/api/ride/register`, "POST", {
        code: codeId,
        name: "Passageira Ana",
        phone: "+55 (11) 98765-4321",
        idToken: passenger.idToken,
      }),
    ]);
    const raceStatuses = [raceA.status, raceB.status].sort((a, b) => a - b);
    assert.deepEqual(raceStatuses, [200, 409]);
    const winningReg = raceA.status === 200 ? raceA : raceB;
    assert.equal(winningReg.json.result.clientPhone, "11987654321");
    assert.equal(winningReg.json.result.currentPoints, 1);
    assert.equal(winningReg.json.result.totalRides, 1);

    // 7. Driver A polls QR status and sees USED + usedByName
    const pollUsed = await requestJson(
      `${baseUrl}/api/driver/qrcodes/${codeId}`,
      "GET",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(pollUsed.status, 200);
    assert.equal(pollUsed.json.qrCode.status, "USED");
    assert.equal(pollUsed.json.qrCode.usedByName, "Passageira Ana");

    // 8. Replay protection blocks another reuse after commit
    const replayReg = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: codeId,
      name: "Outro",
      phone: "11911112222",
      idToken: passenger.idToken,
    });
    assert.equal(replayReg.status, 409);

    // 9. Public phone lookup API is strictly blocked (403) to stop phone-guessing enumeration
    const lookupRes = await requestJson(`${baseUrl}/api/ride/client`, "POST", {
      phone: "11987654321",
      driverId: driverA.localId,
      idToken: passenger.idToken,
    });
    assert.equal(lookupRes.status, 403);
    assert.equal(lookupRes.json.ok, false);

    // 10. Advance 9 more rides to reach 10th point (unlocked 1 free ride) using owner token (Cloud Run ADC mode)
    for (let step = 2; step <= 10; step++) {
      const nextQr = await requestJson(
        `${baseUrl}/api/driver/qrcodes`,
        "POST",
        { driverName: "Motorista Carlos" },
        { Authorization: `Bearer ${driverA.idToken}` }
      );
      assert.equal(nextQr.status, 200);
      const nextReg = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
        code: nextQr.json.qrCode.codeId,
        name: "Passageira Ana",
        phone: "11987654321",
        idToken: "owner",
      });
      assert.equal(nextReg.status, 200);
      if (step === 10) {
        assert.equal(nextReg.json.result.currentPoints, 0);
        assert.equal(nextReg.json.result.rewardsAvailable, 1);
        assert.equal(nextReg.json.result.earnedFreeRide, true);
      }
    }

    // 11. Verify legacy unowned client (clients/{phone} with existing points=7) is preserved & migrated without point loss
    const legacyPhone = "11944445555";
    const nowIso = new Date().toISOString();
    await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/clients?documentId=${legacyPhone}`,
      "POST",
      {
        fields: {
          id: { stringValue: legacyPhone },
          name: { stringValue: "Cliente Antigo" },
          phone: { stringValue: legacyPhone },
          points: { integerValue: "7" },
          totalRides: { integerValue: "7" },
          rewardsAvailable: { integerValue: "0" },
          rewardsRedeemed: { integerValue: "1" },
          isArchived: { booleanValue: false },
          createdAt: { timestampValue: nowIso },
          updatedAt: { timestampValue: nowIso },
        },
      },
      { Authorization: "Bearer owner" }
    );
    await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/rides?documentId=RIDE-LEGACY-01`,
      "POST",
      {
        fields: {
          id: { stringValue: "RIDE-LEGACY-01" },
          clientName: { stringValue: "Cliente Antigo" },
          clientPhone: { stringValue: legacyPhone },
          driverId: { stringValue: driverA.localId },
          driverName: { stringValue: "Motorista Carlos" },
          qrCodeId: { stringValue: "VIP-0001-0001" },
          pointsEarned: { integerValue: "1" },
          timestamp: { timestampValue: nowIso },
        },
      },
      { Authorization: "Bearer owner" }
    );

    // Check passengerUid preserved & dashboard returns clients, rides, and rewards
    const clientId = `${driverA.localId}_11987654321`;
    const listA = await requestJson(
      `${baseUrl}/api/driver/clients`,
      "GET",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(listA.status, 200);
    assert.equal(listA.json.clients.length, 2);
    const migratedLegacy = listA.json.clients.find((c) => c.id === legacyPhone);
    assert.ok(migratedLegacy, "Legacy doc ID must be preserved!");
    assert.equal(migratedLegacy.points, 7);
    assert.equal(migratedLegacy.totalRides, 7);
    assert.equal(migratedLegacy.rewardsRedeemed, 1);

    const ana = listA.json.clients.find((c) => c.id === clientId);
    assert.ok(ana);
    assert.equal(ana.name, "Passageira Ana");
    assert.equal(ana.phone, "11987654321");
    assert.equal(ana.totalRides, 10);
    assert.equal(ana.rewardsAvailable, 1);
    assert.ok(listA.json.rides.length >= 11);
    assert.equal(listA.json.rewards.length, 1);

    // Returning legacy passenger registers +1 ride -> becomes 8 points on preserved doc ID!
    const legacyQr = await requestJson(
      `${baseUrl}/api/driver/qrcodes`,
      "POST",
      { driverName: "Motorista Carlos" },
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    const legacyReg = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: legacyQr.json.qrCode.codeId,
      name: "Cliente Antigo",
      phone: legacyPhone,
      idToken: "owner",
    });
    assert.equal(legacyReg.status, 200);
    assert.equal(legacyReg.json.result.currentPoints, 8);
    assert.equal(legacyReg.json.result.totalRides, 8);

    // 11b. Verify client stored under a legacy non-phone custom document ID with +55 formatted phone
    // is recognized server-side on ride registration without duplicating client records!
    const customDocId = "legacy_custom_doc_99";
    await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/clients?documentId=${customDocId}`,
      "POST",
      {
        fields: {
          id: { stringValue: customDocId },
          driverId: { stringValue: driverA.localId },
          name: { stringValue: "Marcos Custom ID" },
          phone: { stringValue: "+55 (11) 92222-1111" },
          points: { integerValue: "3" },
          totalRides: { integerValue: "3" },
          rewardsAvailable: { integerValue: "0" },
          rewardsRedeemed: { integerValue: "0" },
          isArchived: { booleanValue: false },
          createdAt: { timestampValue: nowIso },
          updatedAt: { timestampValue: nowIso },
        },
      },
      { Authorization: "Bearer owner" }
    );
    const customQr = await requestJson(
      `${baseUrl}/api/driver/qrcodes`,
      "POST",
      { driverName: "Motorista Carlos" },
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(customQr.status, 200);
    const customReg = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: customQr.json.qrCode.codeId,
      name: "Marcos Custom ID",
      phone: "11922221111",
      idToken: "owner",
    });
    assert.equal(customReg.status, 200);
    assert.equal(customReg.json.result.currentPoints, 4);
    assert.equal(customReg.json.result.totalRides, 4);

    // Driver A still has 3 clients (no duplicate created for Marcos)
    const listAfterCustom = await requestJson(
      `${baseUrl}/api/driver/clients`,
      "GET",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(listAfterCustom.status, 200);
    assert.equal(listAfterCustom.json.clients.length, 3);

    // Driver B sees empty list (zero-trust tenant isolation)
    const listB = await requestJson(
      `${baseUrl}/api/driver/clients`,
      "GET",
      null,
      { Authorization: `Bearer ${driverB.idToken}` }
    );
    assert.equal(listB.status, 200);
    assert.equal(listB.json.clients.length, 0);

    // 12. Driver A exports JSON backup via /api/driver/backup
    const backupRes = await requestJson(
      `${baseUrl}/api/driver/backup`,
      "GET",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(backupRes.status, 200);
    assert.ok(String(backupRes.headers["content-disposition"]).includes("attachment"));
    assert.equal(backupRes.json.driverId, driverA.localId);
    assert.equal(backupRes.json.clients.length, 3);
    assert.ok(backupRes.json.rides.length >= 13);
    assert.equal(backupRes.json.rewards.length, 1);

    // 13. Driver A redeems free ride
    const crossRedeem = await requestJson(
      `${baseUrl}/api/driver/clients/${clientId}/redeem`,
      "POST",
      {},
      { Authorization: `Bearer ${driverB.idToken}` }
    );
    assert.equal(crossRedeem.status, 403);

    const redeemRes = await requestJson(
      `${baseUrl}/api/driver/clients/${clientId}/redeem`,
      "POST",
      {},
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(redeemRes.status, 200);
    assert.equal(redeemRes.json.rewardsAvailable, 0);
    assert.equal(redeemRes.json.rewardsRedeemed, 1);

    // 14. Archive and Restore client
    const archiveRes = await requestJson(
      `${baseUrl}/api/driver/clients/${clientId}/update`,
      "POST",
      { name: "Ana Paula VIP", phone: "11987654321", isArchived: true },
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(archiveRes.status, 200);

    const listAfterArchive = await requestJson(
      `${baseUrl}/api/driver/clients`,
      "GET",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(listAfterArchive.json.clients.find((c) => c.id === clientId).isArchived, true);

    const restoreRes = await requestJson(
      `${baseUrl}/api/driver/clients/${clientId}/update`,
      "POST",
      { name: "Ana Paula VIP", phone: "11987654321", isArchived: false },
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(restoreRes.status, 200);

    const listAfterRestore = await requestJson(
      `${baseUrl}/api/driver/clients`,
      "GET",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(listAfterRestore.json.clients.find((c) => c.id === clientId).isArchived, false);

    // 15. Driver A deletes test client cleanly
    const delRes = await requestJson(
      `${baseUrl}/api/driver/clients/${clientId}`,
      "DELETE",
      null,
      { Authorization: `Bearer ${driverA.idToken}` }
    );
    assert.equal(delRes.status, 200);
    assert.ok(delRes.json.deletedCount >= 11);
  } finally {
    await testEnv.cleanup();
  }
});

