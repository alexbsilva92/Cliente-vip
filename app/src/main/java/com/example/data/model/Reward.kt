package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class Reward(
    val id: String = "",
    val clientPhone: String = "",
    val clientName: String = "",
    val driverId: String = "",
    val qrCodeId: String = "",
    val status: String = "AVAILABLE",
    @ServerTimestamp
    val createdAt: Timestamp? = null,
    val redeemedAt: Timestamp? = null
)
