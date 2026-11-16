const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_PROJECT_ID = "demo-no-project";
process.env.FIRESTORE_DATABASE_ID = "(default)";

const { server, normalizeBrPhone, isValidBrPhone, extractVipCode } = require("./server");

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

test("Helper functions: BR phone normalization and VIP code extraction", () => {
  assert.equal(normalizeBrPhone("+55 (11) 98765-4321"), "11987654321");
  assert.equal(normalizeBrPhone("011987654321"), "11987654321");
  assert.equal(isValidBrPhone("+55 11 98765-4321"), true);
  assert.equal(isValidBrPhone("12345"), false);
  assert.equal(extractVipCode("https://example.com/ride?code=vip-1234-5678"), "VIP-1234-5678");
});

test("GET /.well-known/assetlinks.json returns valid package and SHA-256", async () => {
  const res = await requestJson(`${baseUrl}/.well-known/assetlinks.json`, "GET", null);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json));
  assert.equal(res.json[0].target.package_name, "com.aistudio.clientevip.rkpxzt");
  assert.ok(res.json[0].target.sha256_cert_fingerprints[0].startsWith("22:65:2B:03"));
});

test("GET /ride?code=VIP-6944-2412 serves the public passenger portal without forced app redirect or Google login", async () => {
  const res = await requestJson(`${baseUrl}/ride?code=VIP-6944-2412`, "GET", null);
  assert.equal(res.status, 200);
  assert.ok(res.text.includes("VIP-6944-2412"));
  assert.ok(res.text.includes("/api/ride/validate"));
  assert.ok(res.text.includes("/api/ride/register"));
  assert.equal(res.text.includes("window.location.href"), false);
  assert.equal(res.text.includes("clientevip://ride"), false);
  assert.equal(res.text.includes("Entrar com Google para Registrar"), false);
  assert.ok(res.text.includes("Seu Nome Completo"));
  assert.ok(res.text.includes("CONFIRMAR CORRIDA"));
});

test("Server /api/ride/validate, /api/ride/register, /api/ride/client and replay protection via emulators", async () => {
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
    const driver = await createEmulatorUser(`driver_srv_${Date.now()}@clientevip.com`);
    const passenger = await createEmulatorUser(`pass_srv_${Date.now()}@clientevip.com`);
    const codeId = `VIP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const expIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Driver creates ACTIVE QR code under rules via Firestore REST
    const createQrRes = await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/qrcodes?documentId=${codeId}`,
      "POST",
      {
        fields: {
          codeId: { stringValue: codeId },
          driverId: { stringValue: driver.localId },
          driverName: { stringValue: "Motorista Web" },
          status: { stringValue: "ACTIVE" },
          createdAt: { timestampValue: nowIso },
          expiresAt: { timestampValue: expIso },
        },
      },
      { Authorization: `Bearer ${driver.idToken}` }
    );
    assert.equal(createQrRes.status, 200);

    // 1. Validate without token prompts Google Auth cleanly
    const unauthVal = await requestJson(`${baseUrl}/api/ride/validate`, "POST", { code: codeId });
    assert.equal(unauthVal.status, 401);
    assert.equal(unauthVal.json.authRequired, true);

    // 2. Validate with passenger token succeeds
    const validRes = await requestJson(`${baseUrl}/api/ride/validate`, "POST", {
      code: codeId,
      idToken: passenger.idToken,
    });
    assert.equal(validRes.status, 200);
    assert.equal(validRes.json.ok, true);
    assert.equal(validRes.json.driverName, "Motorista Web");

    // 3. Register ride atomically via server
    const regRes = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: codeId,
      name: "Passageiro Web",
      phone: "+55 (11) 98765-4321",
      idToken: passenger.idToken,
    });
    assert.equal(regRes.status, 200);
    assert.equal(regRes.json.ok, true);
    assert.equal(regRes.json.result.clientPhone, "11987654321");
    assert.equal(regRes.json.result.currentPoints, 1);
    assert.equal(regRes.json.result.totalRides, 1);

    // 4. Lookup recognizes returning client
    const lookupRes = await requestJson(`${baseUrl}/api/ride/client`, "POST", {
      phone: "11987654321",
      driverId: driver.localId,
      idToken: passenger.idToken,
    });
    assert.equal(lookupRes.status, 200);
    assert.equal(lookupRes.json.client.name, "Passageiro Web");
    assert.equal(lookupRes.json.client.points, 1);

    // 5. Replay validation and registration are blocked with 409 USED
    const replayVal = await requestJson(`${baseUrl}/api/ride/validate`, "POST", {
      code: codeId,
      idToken: passenger.idToken,
    });
    assert.equal(replayVal.status, 409);
    assert.equal(replayVal.json.status, "USED");

    const replayReg = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: codeId,
      name: "Outro Passageiro",
      phone: "11911112222",
      idToken: passenger.idToken,
    });
    assert.equal(replayReg.status, 409);

    // 6. Second ride via service-account-style token (uid=null, like Cloud Run ADC) increments score and preserves existing passengerUid
    const codeId2 = `VIP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const createQr2Res = await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/qrcodes?documentId=${codeId2}`,
      "POST",
      {
        fields: {
          codeId: { stringValue: codeId2 },
          driverId: { stringValue: driver.localId },
          driverName: { stringValue: "Motorista Web" },
          status: { stringValue: "ACTIVE" },
          createdAt: { timestampValue: nowIso },
          expiresAt: { timestampValue: expIso },
        },
      },
      { Authorization: `Bearer ${driver.idToken}` }
    );
    assert.equal(createQr2Res.status, 200);

    const reg2Res = await requestJson(`${baseUrl}/api/ride/register`, "POST", {
      code: codeId2,
      name: "Passageiro Web",
      phone: "11987654321",
      idToken: "owner",
    });
    assert.equal(reg2Res.status, 200);
    assert.equal(reg2Res.json.result.currentPoints, 2);
    assert.equal(reg2Res.json.result.totalRides, 2);

    const clientCheck = await requestJson(
      `http://${FIRESTORE_HOST}/v1/projects/demo-no-project/databases/(default)/documents/clients/${driver.localId}_11987654321`,
      "GET",
      null,
      { Authorization: "Bearer owner" }
    );
    assert.equal(clientCheck.status, 200);
    assert.equal(clientCheck.json.fields.passengerUid.stringValue, passenger.localId);
  } finally {
    await testEnv.cleanup();
  }
});
