package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class QrCode(
    val codeId: String = "",
    val driverId: String = "",
    val driverName: String = "",
    val status: String = "ACTIVE",
    val usedByPhone: String? = null,
    val usedByName: String? = null,
    val usedAt: Timestamp? = null,
    @ServerTimestamp
    val createdAt: Timestamp? = null,
    val expiresAt: Timestamp? = null
)
