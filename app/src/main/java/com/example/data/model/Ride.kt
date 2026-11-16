package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class Ride(
    val id: String = "",
    val clientPhone: String = "",
    val clientName: String = "",
    val driverId: String = "",
    val driverName: String = "",
    val qrCodeId: String = "",
    val pointsEarned: Long = 1L,
    @ServerTimestamp
    val timestamp: Timestamp? = null
)
