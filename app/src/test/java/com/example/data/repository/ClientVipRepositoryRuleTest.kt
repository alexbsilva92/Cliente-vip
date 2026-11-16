package com.example.data.repository

import com.example.base.FirestoreEmulatorTestBase
import com.google.firebase.Timestamp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Date

class ClientVipRepositoryRuleTest : FirestoreEmulatorTestBase() {

    @Test
    fun generateQrCode_authenticatedDriver_createsActiveCode() = runBlocking {
        signInTestUser(DRIVER_EMAIL)
        val repository = ClientVipRepository(firestore, auth)

        val result = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.generateQrCode("Motorista Teste")
        }
        assertTrue(result.isSuccess)
        val qrCode = result.getOrThrow()
        assertEquals("ACTIVE", qrCode.status)
        assertTrue(qrCode.codeId.startsWith("VIP-"))
    }

    @Test
    fun registerRide_validQrCode_addsPointAndConsumesQrCode() = runBlocking {
        signInTestUser(DRIVER_EMAIL)
        val driverRepo = ClientVipRepository(firestore, auth)
        val qr = withTimeout(DEFAULT_TIMEOUT_MS) {
            driverRepo.generateQrCode("Motorista Teste").getOrThrow()
        }

        signInTestUser(PASSENGER_EMAIL)
        val passengerRepo = ClientVipRepository(firestore, auth)
        val testPhone = "119" + (10000000..99999999).random().toString()
        val rideResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.registerRideWithQrCode(qr.codeId, "Cliente VIP Teste", testPhone)
        }
        assertTrue(rideResult.isSuccess)
        val reg = rideResult.getOrThrow()
        assertEquals(1L, reg.currentPoints)
        assertEquals(1L, reg.totalRides)

        val clientResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.getClientByPhone(testPhone)
        }
        assertTrue(clientResult.isSuccess)
        val client = clientResult.getOrThrow()
        assertNotNull(client)
        assertEquals(1L, client!!.points)
        assertFalse(client.isArchived)
    }

    @Test
    fun registerRide_normalizesBrazilianCountryCode_preventingDuplicateClients() = runBlocking {
        val driverUid = signInTestUser(DRIVER_EMAIL)
        val driverRepo = ClientVipRepository(firestore, auth)
        val qr1 = withTimeout(DEFAULT_TIMEOUT_MS) { driverRepo.generateQrCode("Motorista").getOrThrow() }
        val qr2 = withTimeout(DEFAULT_TIMEOUT_MS) { driverRepo.generateQrCode("Motorista").getOrThrow() }

        val suffix = (10000000..99999999).random().toString()
        val canonicalPhone = "119$suffix"
        val formattedWithCountry = "+55 (11) 9${suffix.take(4)}-${suffix.drop(4)}"

        signInTestUser(PASSENGER_EMAIL)
        val passengerRepo = ClientVipRepository(firestore, auth)
        val r1 = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.registerRideWithQrCode(qr1.codeId, "Cliente Duplicado", formattedWithCountry)
        }
        assertTrue(r1.isSuccess)
        assertEquals(canonicalPhone, r1.getOrThrow().clientPhone)
        assertEquals(1L, r1.getOrThrow().currentPoints)

        val r2 = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.registerRideWithQrCode(qr2.codeId, "Cliente Duplicado", canonicalPhone)
        }
        assertTrue(r2.isSuccess)
        assertEquals(2L, r2.getOrThrow().currentPoints)
        assertEquals(2L, r2.getOrThrow().totalRides)

        signInTestUser(DRIVER_EMAIL)
        val clients = driverRepo.observeClients().first().filter { it.phone == canonicalPhone }
        assertEquals(1, clients.size)
        assertEquals("${driverUid}_$canonicalPhone", clients.first().id)
    }

    @Test
    fun registerRide_replayAttempt_failsBecauseCodeIsUsed() = runBlocking {
        signInTestUser(DRIVER_EMAIL)
        val driverRepo = ClientVipRepository(firestore, auth)
        val qr = withTimeout(DEFAULT_TIMEOUT_MS) {
            driverRepo.generateQrCode("Motorista Teste").getOrThrow()
        }

        signInTestUser(PASSENGER_EMAIL)
        val passengerRepo = ClientVipRepository(firestore, auth)
        val phone1 = "11988880001"
        val firstResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.registerRideWithQrCode(qr.codeId, "Cliente 1", phone1)
        }
        assertTrue(firstResult.isSuccess)

        val phone2 = "11988880002"
        val secondResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.registerRideWithQrCode(qr.codeId, "Cliente 2", phone2)
        }
        assertTrue(secondResult.isFailure)
    }

    @Test
    fun registerRide_expiredQrCode_failsInRules() = runBlocking {
        val driverUid = signInTestUser(DRIVER_EMAIL)

        // 1. Rules reject creating an already-expired QR code directly
        val preExpiredCodeId = "VIP-BAD1-${(1000..9999).random()}"
        try {
            com.google.android.gms.tasks.Tasks.await(
                firestore.collection("qrcodes").document(preExpiredCodeId).set(
                    mapOf(
                        "codeId" to preExpiredCodeId,
                        "driverId" to driverUid,
                        "driverName" to "Motorista",
                        "status" to "ACTIVE",
                        "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "expiresAt" to Timestamp(Date(System.currentTimeMillis() - 60_000L))
                    )
                )
            )
            fail("Expected rules to reject creating an already-expired QR code")
        } catch (expected: Exception) {
            assertNotNull(expected.unwrapFirestoreException())
        }

        // 2. Create a valid short-lived QR code, wait for it to expire, and verify claim fails in rules
        val shortLivedCodeId = "VIP-EXP1-${(1000..9999).random()}"
        com.google.android.gms.tasks.Tasks.await(
            firestore.collection("qrcodes").document(shortLivedCodeId).set(
                mapOf(
                    "codeId" to shortLivedCodeId,
                    "driverId" to driverUid,
                    "driverName" to "Motorista Expirado",
                    "status" to "ACTIVE",
                    "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    "expiresAt" to Timestamp(Date(System.currentTimeMillis() + 1500L))
                )
            )
        )
        delay(2200L)

        signInTestUser(PASSENGER_EMAIL)
        val passengerRepo = ClientVipRepository(firestore, auth)
        val verifyResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.checkQrCodeStatus(shortLivedCodeId)
        }
        assertTrue(verifyResult.getOrThrow() is QrCodeVerification.Expired)

        val registerResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            passengerRepo.registerRideWithQrCode(shortLivedCodeId, "Passageiro Teste", "11988881234")
        }
        assertTrue(registerResult.isFailure)
    }

    @Test
    fun registerRide_tenthRide_resetsPointsAndGrantsFreeRide_andRedeemPreventsNegativeBalance() = runBlocking {
        val driverUid = signInTestUser(DRIVER_EMAIL)
        val driverRepo = ClientVipRepository(firestore, auth)
        val passengerRepo = ClientVipRepository(firestore, auth)
        val phone = "119" + (10000000..99999999).random().toString()

        // Register 9 rides
        for (i in 1..9) {
            signInTestUser(DRIVER_EMAIL)
            val qr = driverRepo.generateQrCode("Motorista").getOrThrow()
            signInTestUser(PASSENGER_EMAIL)
            val r = passengerRepo.registerRideWithQrCode(qr.codeId, "Fidelidade VIP", phone).getOrThrow()
            assertEquals(i.toLong(), r.currentPoints)
            assertFalse(r.earnedFreeRide)
        }

        // 10th ride grants 1 free ride, resets points to 0, and creates an AVAILABLE reward doc
        signInTestUser(DRIVER_EMAIL)
        val qr10 = driverRepo.generateQrCode("Motorista").getOrThrow()
        signInTestUser(PASSENGER_EMAIL)
        val res10 = passengerRepo.registerRideWithQrCode(qr10.codeId, "Fidelidade VIP", phone).getOrThrow()
        assertEquals(0L, res10.currentPoints)
        assertEquals(10L, res10.totalRides)
        assertEquals(1L, res10.rewardsAvailable)
        assertTrue(res10.earnedFreeRide)

        // Driver sees AVAILABLE reward, redeems it -> transitions to REDEEMED, then second redeem fails
        signInTestUser(DRIVER_EMAIL)
        val availableRewards = driverRepo.observeRewards().first().filter { it.clientPhone == phone }
        assertEquals(1, availableRewards.size)
        assertEquals("AVAILABLE", availableRewards.first().status)
        assertEquals(qr10.codeId, availableRewards.first().qrCodeId)

        val driverClients = driverRepo.observeClients().first()
        val targetClient = driverClients.first { it.id == "${driverUid}_$phone" }
        val redeem1 = driverRepo.redeemReward(targetClient)
        assertTrue(redeem1.isSuccess)

        val afterRewards = driverRepo.observeRewards().first().filter { it.clientPhone == phone }
        assertEquals(1, afterRewards.size)
        assertEquals("REDEEMED", afterRewards.first().status)
        assertNotNull(afterRewards.first().redeemedAt)

        val redeem2 = driverRepo.redeemReward(targetClient)
        assertTrue(redeem2.isFailure)
    }

    @Test
    fun archiveRestoreAndDeleteClient_behavesConsistentlyAndPreservesOtherClients() = runBlocking {
        val driverUid = signInTestUser(DRIVER_EMAIL)
        val driverRepo = ClientVipRepository(firestore, auth)
        val phoneA = "119" + (10000000..99999999).random().toString()
        val phoneB = "119" + (10000000..99999999).random().toString()

        val qrA = driverRepo.generateQrCode("Motorista").getOrThrow()
        val qrB = driverRepo.generateQrCode("Motorista").getOrThrow()

        signInTestUser(PASSENGER_EMAIL)
        val passengerRepo = ClientVipRepository(firestore, auth)
        passengerRepo.registerRideWithQrCode(qrA.codeId, "Cliente A", phoneA).getOrThrow()
        passengerRepo.registerRideWithQrCode(qrB.codeId, "Cliente B", phoneB).getOrThrow()

        signInTestUser(DRIVER_EMAIL)
        val clientsBefore = driverRepo.observeClients().first()
        val clientA = clientsBefore.first { it.id == "${driverUid}_$phoneA" }

        // Archive Client A
        assertTrue(driverRepo.archiveClient(clientA).isSuccess)
        val afterArchive = driverRepo.observeClients().first().first { it.id == clientA.id }
        assertTrue(afterArchive.isArchived)
        assertEquals(1L, afterArchive.points)
        assertEquals(1L, afterArchive.totalRides)

        // Restore Client A
        assertTrue(driverRepo.restoreClient(afterArchive).isSuccess)
        val afterRestore = driverRepo.observeClients().first().first { it.id == clientA.id }
        assertFalse(afterRestore.isArchived)
        assertEquals(1L, afterRestore.points)

        // Permanently delete Client A -> Client A + its rides deleted; Client B + its rides preserved
        assertTrue(driverRepo.deleteClientPermanently(afterRestore).isSuccess)
        val remainingClients = driverRepo.observeClients().first()
        assertNull(remainingClients.firstOrNull { it.id == clientA.id })
        assertNotNull(remainingClients.firstOrNull { it.id == "${driverUid}_$phoneB" })

        val remainingRides = driverRepo.observeRides().first()
        assertTrue(remainingRides.none { it.clientPhone == phoneA })
        assertTrue(remainingRides.any { it.clientPhone == phoneB })
    }

    @Test
    fun crossDriverIsolation_secondDriverCannotReadArchiveOrDeleteFirstDriverClient() = runBlocking {
        val driverAUid = signInTestUser(DRIVER_EMAIL)
        val driverARepo = ClientVipRepository(firestore, auth)
        val qr = driverARepo.generateQrCode("Motorista A").getOrThrow()
        val phone = "119" + (10000000..99999999).random().toString()

        signInTestUser(PASSENGER_EMAIL)
        ClientVipRepository(firestore, auth).registerRideWithQrCode(qr.codeId, "Cliente Privado", phone).getOrThrow()

        signInTestUser(DRIVER_EMAIL)
        val privateClient = driverARepo.observeClients().first().first { it.id == "${driverAUid}_$phone" }

        // Switch to Driver B
        signInTestUser(OTHER_DRIVER_EMAIL)
        val driverBRepo = ClientVipRepository(firestore, auth)
        val driverBClients = driverBRepo.observeClients().first()
        assertTrue(driverBClients.none { it.id == privateClient.id })
        assertTrue(driverBRepo.archiveClient(privateClient).isFailure)
        assertTrue(driverBRepo.deleteClientPermanently(privateClient).isFailure)
    }

    @Test
    fun observeClients_unauthenticated_fails() = runBlocking {
        auth.signOut()
        val repository = ClientVipRepository(firestore, auth)

        try {
            withTimeout(3000L) {
                repository.observeClients().first()
            }
            fail("Expected exception when unauthenticated")
        } catch (e: Exception) {
            assertNotNull(e)
        }
    }

    private companion object {
        const val DRIVER_EMAIL = "driver@clientevip.com"
        const val OTHER_DRIVER_EMAIL = "driver2@clientevip.com"
        const val PASSENGER_EMAIL = "passenger@clientevip.com"
        const val DEFAULT_TIMEOUT_MS = 10000L
    }
}
