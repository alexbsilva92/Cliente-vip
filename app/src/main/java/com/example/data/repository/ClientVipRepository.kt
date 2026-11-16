package com.example.data.repository

import android.content.Context
import com.example.R
import com.example.data.model.Client
import com.example.data.model.QrCode
import com.example.data.model.Reward
import com.example.data.model.Ride
import com.example.data.util.OperationType
import com.example.data.util.handleFirestoreError
import com.example.util.FormatUtils
import com.example.util.QrCodeAnalyzer
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Date
import java.util.UUID

data class RideRegistrationResult(
    val clientName: String,
    val clientPhone: String,
    val currentPoints: Long,
    val totalRides: Long,
    val rewardsAvailable: Long,
    val earnedFreeRide: Boolean
)

sealed class QrCodeVerification {
    data class Valid(val qrCode: QrCode) : QrCodeVerification()
    data class AlreadyUsed(val usedByName: String?, val usedAt: Timestamp?) : QrCodeVerification()
    object Expired : QrCodeVerification()
    object NotFound : QrCodeVerification()
}

class ClientVipRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth,
    private val appContext: Context? = null
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        ),
        Firebase.auth,
        context.applicationContext
    )

    fun getSavedDriverProfile(): Pair<String, String> {
        val uid = auth.currentUser?.uid ?: return "" to ""
        val prefs = appContext?.getSharedPreferences("cliente_vip_prefs", Context.MODE_PRIVATE) ?: return "" to ""
        val name = prefs.getString("driver_name_$uid", "") ?: ""
        val vehicle = prefs.getString("driver_vehicle_$uid", "") ?: ""
        return name to vehicle
    }

    fun saveDriverProfile(name: String, vehicle: String) {
        val uid = auth.currentUser?.uid ?: return
        appContext?.getSharedPreferences("cliente_vip_prefs", Context.MODE_PRIVATE)?.edit()
            ?.putString("driver_name_$uid", name.trim())
            ?.putString("driver_vehicle_$uid", vehicle.trim())
            ?.apply()
    }

    fun getSavedPassengerProfile(): Pair<String, String> {
        val uid = auth.currentUser?.uid ?: return "" to ""
        val prefs = appContext?.getSharedPreferences("cliente_vip_prefs", Context.MODE_PRIVATE) ?: return "" to ""
        val name = prefs.getString("passenger_name_$uid", "") ?: ""
        val phone = prefs.getString("passenger_phone_$uid", "") ?: ""
        return name to phone
    }

    fun savePassengerProfile(name: String, phone: String) {
        val uid = auth.currentUser?.uid ?: return
        val normalizedPhone = FormatUtils.normalizeBrPhone(phone)
        appContext?.getSharedPreferences("cliente_vip_prefs", Context.MODE_PRIVATE)?.edit()
            ?.putString("passenger_name_$uid", name.trim())
            ?.putString("passenger_phone_$uid", normalizedPhone)
            ?.apply()
    }

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("Usuário precisa estar autenticado.")
    }

    private fun scopedClientId(driverId: String, normalizedPhone: String): String {
        return "${driverId}_${normalizedPhone}"
    }

    // 1. Observe driver's own VIP clients (sorted in Kotlin to avoid missing composite indexes)
    fun observeClients(): Flow<List<Client>> = flow {
        val uid = requireUserId()
        val path = "clients"
        val query = db.collection(path).whereEqualTo("driverId", uid)
        emitAll(
            query.snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        Client::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedWith(
                        compareByDescending<Client> { it.points }
                            .thenByDescending { it.updatedAt ?: Timestamp(0, 0) }
                    )
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser != null) {
                        handleFirestoreError(exceptionToLog, OperationType.LIST, path)
                    }
                    throw error
                }
        )
    }

    /**
     * One-time backward-compatibility check for legacy client records created
     * before multi-tenant driverId scoping. Uses the driver's own rides log
     * to claim any unowned legacy client/{phone} documents safely.
     */
    suspend fun migrateLegacyClientsForDriver() = withContext(Dispatchers.IO) {
        val uid = auth.currentUser?.uid ?: return@withContext
        try {
            val driverRides = db.collection("rides")
                .whereEqualTo("driverId", uid)
                .get()
                .await()
            val candidateDocIds = driverRides.documents
                .flatMap { doc ->
                    val raw = doc.getString("clientPhone")?.filter { ch -> ch.isDigit() }.orEmpty()
                    val norm = FormatUtils.normalizeBrPhone(raw)
                    listOf(raw, norm)
                }
                .filter { it.isNotBlank() }
                .distinct()

            for (legacyDocId in candidateDocIds) {
                val legacyRef = db.collection("clients").document(legacyDocId)
                val legacySnap = try {
                    legacyRef.get().await()
                } catch (_: Exception) {
                    null
                }
                if (legacySnap != null && legacySnap.exists()) {
                    val existingDriver = legacySnap.getString("driverId")
                    if (existingDriver.isNullOrBlank()) {
                        val updates = mutableMapOf<String, Any>(
                            "driverId" to uid,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                        if (!legacySnap.contains("isArchived")) {
                            updates["isArchived"] = false
                        }
                        try {
                            legacyRef.update(updates).await()
                        } catch (_: Exception) {
                            // Ignore individual migration conflicts cleanly
                        }
                    }
                }
            }
        } catch (_: Exception) {
            // Non-fatal compatibility sweep
        }
    }

    // 2. Fetch client loyalty card by phone (supports passenger UID, driver scoped ID, and legacy ID)
    suspend fun getClientByPhone(phone: String): Result<Client?> = withContext(Dispatchers.IO) {
        val uid = requireUserId()
        val rawDigits = phone.filter { it.isDigit() }
        val normalizedPhone = FormatUtils.normalizeBrPhone(phone)
        if (normalizedPhone.length < 8) {
            return@withContext Result.failure(IllegalArgumentException("Telefone inválido"))
        }

        try {
            // 2a. Check scoped client for current user (same-device driver/passenger)
            val scopedSnap = try {
                db.collection("clients").document(scopedClientId(uid, normalizedPhone)).get().await()
            } catch (_: FirebaseFirestoreException) {
                null
            }
            if (scopedSnap != null && scopedSnap.exists()) {
                return@withContext Result.success(
                    scopedSnap.toObject(Client::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                )
            }

            // 2b. Check clients linked to this passenger's UID across any driver
            val passengerClients = db.collection("clients")
                .whereEqualTo("passengerUid", uid)
                .get()
                .await()
                .toObjects(Client::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                .filter { FormatUtils.normalizeBrPhone(it.phone) == normalizedPhone }

            if (passengerClients.isNotEmpty()) {
                val preferred = passengerClients.maxByOrNull { it.updatedAt ?: Timestamp(0, 0) }
                return@withContext Result.success(preferred)
            }

            // 2c. Legacy unscoped doc fallback (check normalized and raw digits safely)
            val legacyIds = listOf(normalizedPhone, rawDigits).filter { it.length >= 8 }.distinct()
            for (legacyId in legacyIds) {
                val legacySnap = try {
                    db.collection("clients").document(legacyId).get().await()
                } catch (_: FirebaseFirestoreException) {
                    null
                }
                if (legacySnap != null && legacySnap.exists()) {
                    return@withContext Result.success(
                        legacySnap.toObject(Client::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    )
                }
            }

            Result.success(null)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.GET, "clients/$normalizedPhone")
            Result.failure(e)
        }
    }

    // 3. Driver generates single-use QR Code (15-min validity)
    suspend fun generateQrCode(driverName: String): Result<QrCode> = withContext(Dispatchers.IO) {
        val uid = requireUserId()
        val cleanDriverName = driverName.trim().ifBlank { "Motorista VIP" }
        val randomPrefix = (1000..9999).random()
        val randomSuffix = (1000..9999).random()
        val codeId = "VIP-$randomPrefix-$randomSuffix"
        val expiresAt = Timestamp(Date(System.currentTimeMillis() + 15 * 60 * 1000))

        val docRef = db.collection("qrcodes").document(codeId)
        val payload = mapOf(
            "codeId" to codeId,
            "driverId" to uid,
            "driverName" to cleanDriverName,
            "status" to "ACTIVE",
            "createdAt" to FieldValue.serverTimestamp(),
            "expiresAt" to expiresAt
        )

        try {
            docRef.set(payload).await()
            val created = QrCode(
                codeId = codeId,
                driverId = uid,
                driverName = cleanDriverName,
                status = "ACTIVE",
                expiresAt = expiresAt
            )
            Result.success(created)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            Result.failure(e)
        }
    }

    // 4. Observe specific QR code in realtime
    fun observeQrCode(codeId: String): Flow<QrCode?> = flow {
        requireUserId()
        val docRef = db.collection("qrcodes").document(codeId)
        emitAll(
            docRef.snapshots()
                .map { snapshot ->
                    if (snapshot.exists()) {
                        snapshot.toObject(QrCode::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    } else null
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser != null) {
                        handleFirestoreError(exceptionToLog, OperationType.GET, docRef.path)
                    }
                    throw error
                }
        )
    }

    // Check QR code validity & single-use status in Firestore
    suspend fun checkQrCodeStatus(codeId: String): Result<QrCodeVerification> = withContext(Dispatchers.IO) {
        requireUserId()
        val cleanCode = QrCodeAnalyzer.extractVipCode(codeId)
        if (!QrCodeAnalyzer.isValidVipCodeFormat(cleanCode)) {
            return@withContext Result.success(QrCodeVerification.NotFound)
        }
        val docRef = db.collection("qrcodes").document(cleanCode)
        try {
            val snapshot = docRef.get().await()
            if (!snapshot.exists()) {
                return@withContext Result.success(QrCodeVerification.NotFound)
            }
            val qr = snapshot.toObject(QrCode::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                ?: return@withContext Result.success(QrCodeVerification.NotFound)

            if (qr.status == "USED") {
                return@withContext Result.success(
                    QrCodeVerification.AlreadyUsed(
                        usedByName = qr.usedByName,
                        usedAt = qr.usedAt
                    )
                )
            }
            val expiresAt = qr.expiresAt
            if (qr.status == "EXPIRED" || (expiresAt != null && expiresAt.toDate().before(Date()))) {
                return@withContext Result.success(QrCodeVerification.Expired)
            }
            Result.success(QrCodeVerification.Valid(qr))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.GET, docRef.path)
            Result.failure(e)
        }
    }

    // 5. Customer registers ride using single-use QR Code (atomic transaction + loyalty math)
    suspend fun registerRideWithQrCode(
        codeId: String,
        clientName: String,
        clientPhone: String
    ): Result<RideRegistrationResult> = withContext(Dispatchers.IO) {
        val uid = requireUserId()
        val cleanCode = QrCodeAnalyzer.extractVipCode(codeId)
        val cleanName = clientName.trim()
        val rawDigits = clientPhone.filter { it.isDigit() }
        val normalizedPhone = FormatUtils.normalizeBrPhone(clientPhone)

        if (cleanCode.isBlank() || !QrCodeAnalyzer.isValidVipCodeFormat(cleanCode)) {
            return@withContext Result.failure(IllegalArgumentException("Informe ou escaneie um QR Code VIP válido."))
        }
        if (cleanName.length < 2) {
            return@withContext Result.failure(IllegalArgumentException("Informe seu nome completo."))
        }
        if (!FormatUtils.isValidBrPhone(clientPhone)) {
            return@withContext Result.failure(IllegalArgumentException("Informe um telefone válido com DDD (ex: 11987654321)."))
        }

        val qrRef = db.collection("qrcodes").document(cleanCode)
        val legacyPhoneIds = listOf(normalizedPhone, rawDigits).filter { it.length >= 8 }.distinct()
        val candidateLegacyRef = legacyPhoneIds.firstNotNullOfOrNull { candidateId ->
            val ref = db.collection("clients").document(candidateId)
            val exists = try {
                ref.get().await().exists()
            } catch (_: Exception) {
                false
            }
            if (exists) ref else null
        }

        val rideId = "RIDE-" + UUID.randomUUID().toString().take(12)
        val rideRef = db.collection("rides").document(rideId)
        val rewardId = "REW-$cleanCode"
        val rewardRef = db.collection("rewards").document(rewardId)

        try {
            val result = db.runTransaction { transaction ->
                val qrSnapshot = transaction.get(qrRef)
                if (!qrSnapshot.exists()) {
                    throw IllegalArgumentException("QR Code não encontrado.")
                }
                val qrStatus = qrSnapshot.getString("status") ?: ""
                if (qrStatus != "ACTIVE") {
                    throw IllegalStateException("Este QR Code já foi utilizado e não é mais válido.")
                }
                val expiresAt = qrSnapshot.getTimestamp("expiresAt")
                if (expiresAt != null && expiresAt.toDate().before(Date())) {
                    throw IllegalStateException("Este QR Code expirou.")
                }

                val driverId = qrSnapshot.getString("driverId") ?: ""
                val driverName = qrSnapshot.getString("driverName") ?: "Motorista VIP"
                if (driverId.isBlank()) {
                    throw IllegalStateException("QR Code inválido (motorista não identificado).")
                }

                val scopedRef = db.collection("clients").document(scopedClientId(driverId, normalizedPhone))
                val altCountryScopedRef = if (rawDigits != normalizedPhone && rawDigits.length >= 10) {
                    db.collection("clients").document(scopedClientId(driverId, rawDigits))
                } else null

                // All transaction reads must happen before any writes
                val scopedSnapshot = transaction.get(scopedRef)
                val altScopedSnapshot = if (!scopedSnapshot.exists() && altCountryScopedRef != null) {
                    try {
                        val s = transaction.get(altCountryScopedRef)
                        if (s.exists()) s else null
                    } catch (_: Exception) {
                        null
                    }
                } else null

                val legacySnapshot = if (!scopedSnapshot.exists() && altScopedSnapshot == null && candidateLegacyRef != null) {
                    val snap = transaction.get(candidateLegacyRef)
                    if (snap.exists() && (snap.getString("driverId").isNullOrBlank() || snap.getString("driverId") == driverId)) {
                        snap
                    } else null
                } else null

                val existingSnap = when {
                    scopedSnapshot.exists() -> scopedSnapshot
                    altScopedSnapshot != null -> altScopedSnapshot
                    else -> legacySnapshot
                }
                val targetClientRef = existingSnap?.reference ?: scopedRef
                val targetClientId = targetClientRef.id

                var currentTotalRides: Long
                var currentPoints: Long
                var rewardsAvailable: Long
                var rewardsRedeemed: Long
                var earnedFreeRide = false
                val persistedPhone: String

                if (existingSnap != null && existingSnap.exists()) {
                    val existingRides = existingSnap.getLong("totalRides") ?: 0L
                    val existingPoints = existingSnap.getLong("points") ?: 0L
                    rewardsAvailable = existingSnap.getLong("rewardsAvailable") ?: 0L
                    rewardsRedeemed = existingSnap.getLong("rewardsRedeemed") ?: 0L
                    val existingStoredPhone = existingSnap.getString("phone").orEmpty()
                    persistedPhone = existingStoredPhone.ifBlank { normalizedPhone }

                    currentTotalRides = existingRides + 1L
                    var nextPoints = existingPoints + 1L
                    while (nextPoints >= 10L) {
                        nextPoints -= 10L
                        rewardsAvailable += 1L
                        earnedFreeRide = true
                    }
                    currentPoints = nextPoints

                    transaction.update(
                        targetClientRef,
                        mapOf(
                            "driverId" to driverId,
                            "passengerUid" to uid,
                            "lastQrCodeId" to cleanCode,
                            "name" to cleanName,
                            "phone" to persistedPhone,
                            "totalRides" to currentTotalRides,
                            "points" to currentPoints,
                            "rewardsAvailable" to rewardsAvailable,
                            "rewardsRedeemed" to rewardsRedeemed,
                            "isArchived" to false,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                } else {
                    currentTotalRides = 1L
                    currentPoints = 1L
                    rewardsAvailable = 0L
                    rewardsRedeemed = 0L
                    persistedPhone = normalizedPhone

                    transaction.set(
                        targetClientRef,
                        mapOf(
                            "id" to targetClientId,
                            "driverId" to driverId,
                            "passengerUid" to uid,
                            "lastQrCodeId" to cleanCode,
                            "name" to cleanName,
                            "phone" to normalizedPhone,
                            "totalRides" to 1L,
                            "points" to 1L,
                            "rewardsAvailable" to 0L,
                            "rewardsRedeemed" to 0L,
                            "isArchived" to false,
                            "createdAt" to FieldValue.serverTimestamp(),
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }

                // Invalidate QR Code (single-use)
                transaction.update(
                    qrRef,
                    mapOf(
                        "status" to "USED",
                        "usedByPhone" to persistedPhone,
                        "usedByName" to cleanName,
                        "usedAt" to FieldValue.serverTimestamp()
                    )
                )

                // Record ride in audit log
                transaction.set(
                    rideRef,
                    mapOf(
                        "id" to rideId,
                        "clientPhone" to persistedPhone,
                        "clientName" to cleanName,
                        "driverId" to driverId,
                        "driverName" to driverName,
                        "qrCodeId" to cleanCode,
                        "pointsEarned" to 1L,
                        "timestamp" to FieldValue.serverTimestamp()
                    )
                )

                // Create AVAILABLE reward entry when 10 points are completed
                if (earnedFreeRide) {
                    transaction.set(
                        rewardRef,
                        mapOf(
                            "id" to rewardId,
                            "clientPhone" to persistedPhone,
                            "clientName" to cleanName,
                            "driverId" to driverId,
                            "qrCodeId" to cleanCode,
                            "status" to "AVAILABLE",
                            "createdAt" to FieldValue.serverTimestamp()
                        )
                    )
                }

                RideRegistrationResult(
                    clientName = cleanName,
                    clientPhone = FormatUtils.normalizeBrPhone(persistedPhone),
                    currentPoints = currentPoints,
                    totalRides = currentTotalRides,
                    rewardsAvailable = rewardsAvailable,
                    earnedFreeRide = earnedFreeRide
                )
            }.await()

            Result.success(result)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, "rides/$rideId")
            Result.failure(e)
        }
    }

    // 6. Driver redeems free ride reward for client (prevents negative balance & concurrent double redemption)
    suspend fun redeemReward(client: Client): Result<Unit> = withContext(Dispatchers.IO) {
        val uid = requireUserId()
        val normalizedPhone = FormatUtils.normalizeBrPhone(client.phone)
        val docId = client.id.ifBlank { scopedClientId(uid, normalizedPhone) }
        val clientRef = db.collection("clients").document(docId)
        val fallbackRewardId = "REW-" + UUID.randomUUID().toString().take(12)
        val fallbackRewardRef = db.collection("rewards").document(fallbackRewardId)

        // Find any pre-created AVAILABLE reward document for this client to transition cleanly to REDEEMED
        val candidateAvailableRef: DocumentReference? = try {
            db.collection("rewards")
                .whereEqualTo("driverId", uid)
                .get()
                .await()
                .documents
                .firstOrNull { doc ->
                    doc.getString("status") == "AVAILABLE" &&
                        FormatUtils.normalizeBrPhone(doc.getString("clientPhone").orEmpty()) == normalizedPhone
                }
                ?.reference
        } catch (_: Exception) {
            null
        }

        try {
            db.runTransaction { transaction ->
                val clientSnapshot = transaction.get(clientRef)
                if (!clientSnapshot.exists()) {
                    throw IllegalArgumentException("Cliente não encontrado.")
                }
                val ownerDriverId = clientSnapshot.getString("driverId") ?: ""
                if (ownerDriverId.isNotBlank() && ownerDriverId != uid) {
                    throw IllegalStateException("Permissão negada para resgatar recompensa deste cliente.")
                }
                val availRewardSnap = candidateAvailableRef?.let { transaction.get(it) }

                val available = clientSnapshot.getLong("rewardsAvailable") ?: 0L
                val redeemed = clientSnapshot.getLong("rewardsRedeemed") ?: 0L

                if (available <= 0L) {
                    throw IllegalStateException("Cliente não possui corridas gratuitas disponíveis para resgate.")
                }

                transaction.update(
                    clientRef,
                    mapOf(
                        "rewardsAvailable" to (available - 1L),
                        "rewardsRedeemed" to (redeemed + 1L),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )

                if (availRewardSnap != null && availRewardSnap.exists() && availRewardSnap.getString("status") == "AVAILABLE") {
                    transaction.update(
                        availRewardSnap.reference,
                        mapOf(
                            "status" to "REDEEMED",
                            "redeemedAt" to FieldValue.serverTimestamp()
                        )
                    )
                } else {
                    transaction.set(
                        fallbackRewardRef,
                        mapOf(
                            "id" to fallbackRewardId,
                            "clientPhone" to normalizedPhone,
                            "clientName" to client.name,
                            "driverId" to uid,
                            "status" to "REDEEMED",
                            "createdAt" to FieldValue.serverTimestamp(),
                            "redeemedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            }.await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, clientRef.path)
            Result.failure(e)
        }
    }

    // 7. Archive client (moves out of active list without losing points, rides, or rewards)
    suspend fun archiveClient(client: Client): Result<Unit> = setClientArchivedState(client, archived = true)

    // 8. Restore archived client back to active list
    suspend fun restoreClient(client: Client): Result<Unit> = setClientArchivedState(client, archived = false)

    private suspend fun setClientArchivedState(client: Client, archived: Boolean): Result<Unit> = withContext(Dispatchers.IO) {
        val uid = requireUserId()
        val normalizedPhone = FormatUtils.normalizeBrPhone(client.phone)
        val docId = client.id.ifBlank { scopedClientId(uid, normalizedPhone) }
        val clientRef = db.collection("clients").document(docId)

        try {
            clientRef.update(
                mapOf(
                    "isArchived" to archived,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, clientRef.path)
            Result.failure(e)
        }
    }

    // 9. Permanently delete client and linked ride/reward records for this driver (preserves other clients)
    suspend fun deleteClientPermanently(client: Client): Result<Unit> = withContext(Dispatchers.IO) {
        val uid = requireUserId()
        val normalizedPhone = FormatUtils.normalizeBrPhone(client.phone)
        val docId = client.id.ifBlank { scopedClientId(uid, normalizedPhone) }
        val clientRef = db.collection("clients").document(docId)

        try {
            val driverRides = db.collection("rides")
                .whereEqualTo("driverId", uid)
                .get()
                .await()
                .documents
                .filter { FormatUtils.normalizeBrPhone(it.getString("clientPhone").orEmpty()) == normalizedPhone }

            val driverRewards = db.collection("rewards")
                .whereEqualTo("driverId", uid)
                .get()
                .await()
                .documents
                .filter { FormatUtils.normalizeBrPhone(it.getString("clientPhone").orEmpty()) == normalizedPhone }

            val refsToDelete = buildList {
                add(clientRef)
                driverRides.forEach { add(it.reference) }
                driverRewards.forEach { add(it.reference) }
            }

            // Execute in batches of up to 450 operations (Firestore max batch limit is 500)
            refsToDelete.chunked(450).forEach { chunk ->
                val batch = db.batch()
                chunk.forEach { batch.delete(it) }
                batch.commit().await()
            }

            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, clientRef.path)
            Result.failure(e)
        }
    }

    // 10. Observe full driver rides history (no fixed truncation limit; sorted chronologically)
    fun observeRides(): Flow<List<Ride>> = flow {
        val uid = requireUserId()
        val path = "rides"
        val query = db.collection(path).whereEqualTo("driverId", uid)
        emitAll(
            query.snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        Ride::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.timestamp ?: Timestamp(0, 0) }
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser != null) {
                        handleFirestoreError(exceptionToLog, OperationType.LIST, path)
                    }
                    throw error
                }
        )
    }

    // 11. Observe full driver rewards history (no fixed truncation limit; sorted chronologically)
    fun observeRewards(): Flow<List<Reward>> = flow {
        val uid = requireUserId()
        val path = "rewards"
        val query = db.collection(path).whereEqualTo("driverId", uid)
        emitAll(
            query.snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        Reward::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.redeemedAt ?: it.createdAt ?: Timestamp(0, 0) }
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser != null) {
                        handleFirestoreError(exceptionToLog, OperationType.LIST, path)
                    }
                    throw error
                }
        )
    }

    private suspend fun <T> kotlinx.coroutines.flow.FlowCollector<T>.emitAll(source: Flow<T>) {
        source.collect { emit(it) }
    }
}
