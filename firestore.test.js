const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const DRIVER_A = "driver_alpha_uid";
const DRIVER_B = "driver_beta_uid";
const PASSENGER_A = "passenger_uid_alpha";
const PASSENGER_B = "passenger_uid_beta";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("1. Unauthenticated user: cannot read or write any collection", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("clients").get());
  await assertFails(unauthDb.collection("qrcodes").get());
  await assertFails(unauthDb.collection("rides").get());
  await assertFails(unauthDb.collection("rewards").get());
  await assertFails(unauthDb.collection("qrcodes").doc("VIP-1111-2222").get());
  await assertFails(unauthDb.collection("clients").doc("nonexistent").get());
});

test("2. QR Code creation: driver creates own ACTIVE code, cannot forge another driverId", async () => {
  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);

  await assertSucceeds(
    driverDb.collection("qrcodes").doc("VIP-1001-2001").set({
      codeId: "VIP-1001-2001",
      driverId: DRIVER_A,
      driverName: "Carlos Motorista",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: expires,
    })
  );

  await assertFails(
    driverDb.collection("qrcodes").doc("VIP-1001-9999").set({
      codeId: "VIP-1001-9999",
      driverId: DRIVER_B,
      driverName: "Impostor",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: expires,
    })
  );
});

test("3. QR Code creation bounds: rejects >20m TTL, already-expired timestamp, or pre-filled usedBy fields", async () => {
  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  const now = new Date();

  // Excessive TTL (60 min)
  await assertFails(
    driverDb.collection("qrcodes").doc("VIP-TTL-6000").set({
      codeId: "VIP-TTL-6000",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    })
  );

  // Already expired
  await assertFails(
    driverDb.collection("qrcodes").doc("VIP-TTL-PAST").set({
      codeId: "VIP-TTL-PAST",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: new Date(now.getTime() - 16 * 60 * 1000),
      expiresAt: new Date(now.getTime() - 60 * 1000),
    })
  );

  // Pre-filled usedByPhone
  await assertFails(
    driverDb.collection("qrcodes").doc("VIP-PRE-USED").set({
      codeId: "VIP-PRE-USED",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      usedByPhone: "11988887777",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    })
  );
});

test("4. QR Code listing: restricted strictly to owning driver", async () => {
  const driverADb = testEnv.authenticatedContext(DRIVER_A).firestore();
  const driverBDb = testEnv.authenticatedContext(DRIVER_B).firestore();
  const now = new Date();

  await assertSucceeds(
    driverADb.collection("qrcodes").doc("VIP-4001-1000").set({
      codeId: "VIP-4001-1000",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    })
  );

  await assertSucceeds(driverADb.collection("qrcodes").where("driverId", "==", DRIVER_A).get());
  await assertFails(driverBDb.collection("qrcodes").where("driverId", "==", DRIVER_A).get());
});

test("5. Atomic ride claim: consumes ACTIVE QR, creates Client & Ride once, blocks replay", async () => {
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("qrcodes").doc("VIP-2002-3003").set({
      codeId: "VIP-2002-3003",
      driverId: DRIVER_A,
      driverName: "Carlos Motorista",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: expires,
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  const clientId = `${DRIVER_A}_11988887777`;

  const batch = passengerDb.batch();
  batch.set(passengerDb.collection("clients").doc(clientId), {
    id: clientId,
    driverId: DRIVER_A,
    passengerUid: PASSENGER_A,
    lastQrCodeId: "VIP-2002-3003",
    name: "Maria Silva",
    phone: "11988887777",
    totalRides: 1,
    points: 1,
    rewardsAvailable: 0,
    rewardsRedeemed: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
  batch.update(passengerDb.collection("qrcodes").doc("VIP-2002-3003"), {
    status: "USED",
    usedByPhone: "11988887777",
    usedByName: "Maria Silva",
    usedAt: now,
  });
  batch.set(passengerDb.collection("rides").doc("RIDE-001"), {
    id: "RIDE-001",
    clientPhone: "11988887777",
    clientName: "Maria Silva",
    driverId: DRIVER_A,
    driverName: "Carlos Motorista",
    qrCodeId: "VIP-2002-3003",
    pointsEarned: 1,
    timestamp: now,
  });
  await assertSucceeds(batch.commit());

  // Replay attempt fails
  await assertFails(
    passengerDb.collection("qrcodes").doc("VIP-2002-3003").update({
      status: "USED",
      usedByPhone: "11999990000",
      usedByName: "Outro",
      usedAt: new Date(),
    })
  );
});

test("6. Ride forging: creating a Ride without an ACTIVE QR claim in the same commit fails", async () => {
  const now = new Date();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("qrcodes").doc("VIP-USED-0001").set({
      codeId: "VIP-USED-0001",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "USED",
      usedByPhone: "11988887777",
      usedByName: "Maria",
      usedAt: now,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  await assertFails(
    passengerDb.collection("rides").doc("RIDE-FAKE").set({
      id: "RIDE-FAKE",
      clientPhone: "11988887777",
      clientName: "Maria Silva",
      driverId: DRIVER_A,
      driverName: "Carlos",
      qrCodeId: "VIP-USED-0001",
      pointsEarned: 1,
      timestamp: now,
    })
  );
});

test("7. Point tampering: passenger cannot inflate points directly on client doc", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11988887777`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      lastQrCodeId: "VIP-1000-1000",
      name: "Maria Silva",
      phone: "11988887777",
      totalRides: 1,
      points: 1,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  await assertFails(
    passengerDb.collection("clients").doc(clientId).update({
      points: 9,
      rewardsAvailable: 5,
      updatedAt: new Date(),
    })
  );
});

test("8. Expired QR code (15-min TTL): claim fails in Firestore Rules", async () => {
  const pastCreated = new Date(Date.now() - 20 * 60 * 1000);
  const pastExpired = new Date(Date.now() - 5 * 60 * 1000);

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("qrcodes").doc("VIP-EXP-9999").set({
      codeId: "VIP-EXP-9999",
      driverId: DRIVER_A,
      driverName: "Carlos Motorista",
      status: "ACTIVE",
      createdAt: pastCreated,
      expiresAt: pastExpired,
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  await assertFails(
    passengerDb.collection("qrcodes").doc("VIP-EXP-9999").update({
      status: "USED",
      usedByPhone: "11988887777",
      usedByName: "Maria Silva",
      usedAt: new Date(),
    })
  );
});

test("9. PII leak prevention: Passenger B cannot read Passenger A's client record", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11988887777`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      lastQrCodeId: "VIP-1111-1111",
      name: "Maria Silva",
      phone: "11988887777",
      totalRides: 3,
      points: 3,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  const passengerBDb = testEnv.authenticatedContext(PASSENGER_B).firestore();
  await assertFails(passengerBDb.collection("clients").doc(clientId).get());
  await assertFails(passengerBDb.collection("clients").where("driverId", "==", DRIVER_A).get());
});

test("10. Phone immutability: passenger ride claim cannot overwrite existing client phone", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11988887777`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      lastQrCodeId: "VIP-1111-1111",
      name: "Maria Silva",
      phone: "11988887777",
      totalRides: 1,
      points: 1,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("qrcodes").doc("VIP-9999-8888").set({
      codeId: "VIP-9999-8888",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  const batch = passengerDb.batch();
  batch.update(passengerDb.collection("clients").doc(clientId), {
    phone: "11900000000", // tampered phone
    lastQrCodeId: "VIP-9999-8888",
    totalRides: 2,
    points: 2,
    updatedAt: now,
  });
  batch.update(passengerDb.collection("qrcodes").doc("VIP-9999-8888"), {
    status: "USED",
    usedByPhone: "11900000000",
    usedByName: "Maria Silva",
    usedAt: now,
  });
  await assertFails(batch.commit());
});

test("11. Multi-tenant isolation: Driver B cannot read, archive, redeem, or delete Driver A's data", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11977776666`;

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      name: "João VIP",
      phone: "11977776666",
      totalRides: 10,
      points: 0,
      rewardsAvailable: 1,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("rides").doc("RIDE-ALPHA-1").set({
      id: "RIDE-ALPHA-1",
      clientPhone: "11977776666",
      clientName: "João VIP",
      driverId: DRIVER_A,
      driverName: "Carlos",
      qrCodeId: "VIP-1111-1111",
      pointsEarned: 1,
      timestamp: now,
    });
    await db.collection("rewards").doc("REW-ALPHA-1").set({
      id: "REW-ALPHA-1",
      clientPhone: "11977776666",
      clientName: "João VIP",
      driverId: DRIVER_A,
      qrCodeId: "VIP-1111-1111",
      status: "AVAILABLE",
      createdAt: now,
    });
  });

  const driverBDb = testEnv.authenticatedContext(DRIVER_B).firestore();
  await assertFails(driverBDb.collection("clients").doc(clientId).get());
  await assertFails(driverBDb.collection("clients").where("driverId", "==", DRIVER_A).get());
  await assertFails(driverBDb.collection("rides").where("driverId", "==", DRIVER_A).get());
  await assertFails(driverBDb.collection("rewards").where("driverId", "==", DRIVER_A).get());
  await assertFails(driverBDb.collection("clients").doc(clientId).update({ isArchived: true, updatedAt: new Date() }));
  await assertFails(driverBDb.collection("clients").doc(clientId).delete());
  await assertFails(driverBDb.collection("rides").doc("RIDE-ALPHA-1").delete());
  await assertFails(driverBDb.collection("rewards").doc("REW-ALPHA-1").delete());
});

test("12. Archive & restore by owner succeed; tampering counters during archive fails", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11966665555`;

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      name: "Ana Paula",
      phone: "11966665555",
      totalRides: 6,
      points: 6,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  const driverADb = testEnv.authenticatedContext(DRIVER_A).firestore();
  await assertSucceeds(driverADb.collection("clients").doc(clientId).update({ isArchived: true, updatedAt: now }));
  await assertFails(driverADb.collection("clients").doc(clientId).update({ isArchived: false, points: 9, updatedAt: now }));
  await assertSucceeds(driverADb.collection("clients").doc(clientId).update({ isArchived: false, updatedAt: now }));
});

test("13. 10th ride rollover: points 9->0, rewardsAvailable 0->1, and atomic AVAILABLE reward creation succeed", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11955554444`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      lastQrCodeId: "VIP-0000-0009",
      name: "Roberto",
      phone: "11955554444",
      totalRides: 9,
      points: 9,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("qrcodes").doc("VIP-0010-0010").set({
      codeId: "VIP-0010-0010",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  const batch = passengerDb.batch();
  batch.update(passengerDb.collection("clients").doc(clientId), {
    driverId: DRIVER_A,
    passengerUid: PASSENGER_A,
    lastQrCodeId: "VIP-0010-0010",
    name: "Roberto",
    phone: "11955554444",
    totalRides: 10,
    points: 0,
    rewardsAvailable: 1,
    rewardsRedeemed: 0,
    isArchived: false,
    updatedAt: now,
  });
  batch.update(passengerDb.collection("qrcodes").doc("VIP-0010-0010"), {
    status: "USED",
    usedByPhone: "11955554444",
    usedByName: "Roberto",
    usedAt: now,
  });
  batch.set(passengerDb.collection("rides").doc("RIDE-0010"), {
    id: "RIDE-0010",
    clientPhone: "11955554444",
    clientName: "Roberto",
    driverId: DRIVER_A,
    driverName: "Carlos",
    qrCodeId: "VIP-0010-0010",
    pointsEarned: 1,
    timestamp: now,
  });
  batch.set(passengerDb.collection("rewards").doc("REW-VIP-0010-0010"), {
    id: "REW-VIP-0010-0010",
    clientPhone: "11955554444",
    clientName: "Roberto",
    driverId: DRIVER_A,
    qrCodeId: "VIP-0010-0010",
    status: "AVAILABLE",
    createdAt: now,
  });
  await assertSucceeds(batch.commit());
});

test("14. Reward forgery: passenger cannot create AVAILABLE reward without an active QR claim", async () => {
  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  const now = new Date();
  await assertFails(
    passengerDb.collection("rewards").doc("REW-FAKE-999").set({
      id: "REW-FAKE-999",
      clientPhone: "11955554444",
      clientName: "Roberto",
      driverId: DRIVER_A,
      qrCodeId: "VIP-NOPE-0000",
      status: "AVAILABLE",
      createdAt: now,
    })
  );
});

test("15. Reward redemption: driver transitions AVAILABLE -> REDEEMED and decrements rewardsAvailable", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11955554444`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      name: "Roberto",
      phone: "11955554444",
      totalRides: 10,
      points: 0,
      rewardsAvailable: 1,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("rewards").doc("REW-0010").set({
      id: "REW-0010",
      clientPhone: "11955554444",
      clientName: "Roberto",
      driverId: DRIVER_A,
      qrCodeId: "VIP-0010-0010",
      status: "AVAILABLE",
      createdAt: now,
    });
  });

  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  const batch = driverDb.batch();
  batch.update(driverDb.collection("clients").doc(clientId), {
    rewardsAvailable: 0,
    rewardsRedeemed: 1,
    updatedAt: now,
  });
  batch.update(driverDb.collection("rewards").doc("REW-0010"), {
    status: "REDEEMED",
    redeemedAt: now,
  });
  await assertSucceeds(batch.commit());
});

test("16. Negative reward balance prevention: redeeming when rewardsAvailable == 0 fails", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11955554444`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      name: "Roberto",
      phone: "11955554444",
      totalRides: 10,
      points: 0,
      rewardsAvailable: 0,
      rewardsRedeemed: 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  await assertFails(
    driverDb.collection("clients").doc(clientId).update({
      rewardsAvailable: -1,
      rewardsRedeemed: 2,
      updatedAt: now,
    })
  );
});

test("17. Reward immutability: once REDEEMED, driver cannot revert to AVAILABLE or alter clientPhone", async () => {
  const now = new Date();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("rewards").doc("REW-DONE-1").set({
      id: "REW-DONE-1",
      clientPhone: "11955554444",
      clientName: "Roberto",
      driverId: DRIVER_A,
      status: "REDEEMED",
      createdAt: now,
      redeemedAt: now,
    });
  });

  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  await assertFails(driverDb.collection("rewards").doc("REW-DONE-1").update({ status: "AVAILABLE" }));
  await assertFails(driverDb.collection("rewards").doc("REW-DONE-1").update({ clientPhone: "11900000000" }));
});

test("18. Ride immutability: driver and passenger cannot update ride records", async () => {
  const now = new Date();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("rides").doc("RIDE-LOCK-1").set({
      id: "RIDE-LOCK-1",
      clientPhone: "11966665555",
      clientName: "Ana Paula",
      driverId: DRIVER_A,
      driverName: "Carlos",
      qrCodeId: "VIP-3333-4444",
      pointsEarned: 1,
      timestamp: now,
    });
  });

  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  await assertFails(driverDb.collection("rides").doc("RIDE-LOCK-1").update({ pointsEarned: 5 }));
  await assertFails(passengerDb.collection("rides").doc("RIDE-LOCK-1").update({ clientName: "Alterado" }));
});

test("19. Permanent deletion: owning driver deletes client, linked rides, and linked rewards", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11966665555`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      name: "Ana Paula",
      phone: "11966665555",
      totalRides: 1,
      points: 1,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("rides").doc("RIDE-ANA-1").set({
      id: "RIDE-ANA-1",
      clientPhone: "11966665555",
      clientName: "Ana Paula",
      driverId: DRIVER_A,
      driverName: "Carlos",
      qrCodeId: "VIP-3333-4444",
      pointsEarned: 1,
      timestamp: now,
    });
    await db.collection("rewards").doc("REW-ANA-1").set({
      id: "REW-ANA-1",
      clientPhone: "11966665555",
      clientName: "Ana Paula",
      driverId: DRIVER_A,
      status: "REDEEMED",
      createdAt: now,
      redeemedAt: now,
    });
  });

  const driverDb = testEnv.authenticatedContext(DRIVER_A).firestore();
  await assertSucceeds(driverDb.collection("clients").doc(clientId).delete());
  await assertSucceeds(driverDb.collection("rides").doc("RIDE-ANA-1").delete());
  await assertSucceeds(driverDb.collection("rewards").doc("REW-ANA-1").delete());
});

test("20. Legacy unowned client migration: succeeds without altering points, fails if already owned", async () => {
  const now = new Date();
  const legacyId = "11944443333";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("clients").doc(legacyId).set({
      id: legacyId,
      name: "Cliente Legado",
      phone: legacyId,
      totalRides: 4,
      points: 4,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  const driverADb = testEnv.authenticatedContext(DRIVER_A).firestore();
  await assertSucceeds(
    driverADb.collection("clients").doc(legacyId).update({
      driverId: DRIVER_A,
      isArchived: false,
      updatedAt: now,
    })
  );

  // Driver B cannot re-claim already owned doc
  const driverBDb = testEnv.authenticatedContext(DRIVER_B).firestore();
  await assertFails(
    driverBDb.collection("clients").doc(legacyId).update({
      driverId: DRIVER_B,
      isArchived: false,
      updatedAt: now,
    })
  );
});

test("21. Cross-passenger hijacking prevention: Passenger B cannot hijack Passenger A's client record even with an ACTIVE QR", async () => {
  const now = new Date();
  const clientId = `${DRIVER_A}_11933332222`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("clients").doc(clientId).set({
      id: clientId,
      driverId: DRIVER_A,
      passengerUid: PASSENGER_A,
      lastQrCodeId: "VIP-0001-0001",
      name: "Maria VIP",
      phone: "11933332222",
      totalRides: 2,
      points: 2,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("qrcodes").doc("VIP-7777-8888").set({
      codeId: "VIP-7777-8888",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
  });

  const passengerBDb = testEnv.authenticatedContext(PASSENGER_B).firestore();
  const batch = passengerBDb.batch();
  batch.update(passengerBDb.collection("clients").doc(clientId), {
    driverId: DRIVER_A,
    passengerUid: PASSENGER_B,
    lastQrCodeId: "VIP-7777-8888",
    name: "Invasor",
    phone: "11933332222",
    totalRides: 3,
    points: 3,
    rewardsAvailable: 0,
    rewardsRedeemed: 0,
    isArchived: false,
    updatedAt: now,
  });
  batch.update(passengerBDb.collection("qrcodes").doc("VIP-7777-8888"), {
    status: "USED",
    usedByPhone: "11933332222",
    usedByName: "Invasor",
    usedAt: now,
  });
  await assertFails(batch.commit());
});

test("22. Ride/Reward consistency: phone mismatch with consumed QR usedByPhone is rejected", async () => {
  const now = new Date();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("qrcodes").doc("VIP-5555-6666").set({
      codeId: "VIP-5555-6666",
      driverId: DRIVER_A,
      driverName: "Carlos",
      status: "ACTIVE",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
  });

  const passengerDb = testEnv.authenticatedContext(PASSENGER_A).firestore();
  const batch = passengerDb.batch();
  batch.update(passengerDb.collection("qrcodes").doc("VIP-5555-6666"), {
    status: "USED",
    usedByPhone: "11988887777",
    usedByName: "Maria",
    usedAt: now,
  });
  batch.set(passengerDb.collection("rides").doc("RIDE-MISMATCH"), {
    id: "RIDE-MISMATCH",
    clientPhone: "11911112222", // does not match QR usedByPhone
    clientName: "Maria",
    driverId: DRIVER_A,
    driverName: "Carlos",
    qrCodeId: "VIP-5555-6666",
    pointsEarned: 1,
    timestamp: now,
  });
  await assertFails(batch.commit());
});

test("23. Phone guessing blocked on Firestore: random user cannot read unowned legacy clients/{phone}", async () => {
  const now = new Date();
  const legacyPhone = "11944443333";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("clients").doc(legacyPhone).set({
      id: legacyPhone,
      name: "Cliente Legado Confidencial",
      phone: legacyPhone,
      totalRides: 5,
      points: 5,
      rewardsAvailable: 0,
      rewardsRedeemed: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  const randomPassengerDb = testEnv.authenticatedContext(PASSENGER_B).firestore();
  await assertFails(randomPassengerDb.collection("clients").doc(legacyPhone).get());
  await assertFails(randomPassengerDb.collection("clients").where("phone", "==", legacyPhone).get());
});


