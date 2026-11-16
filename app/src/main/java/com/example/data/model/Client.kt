package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class Client(
    val id: String = "",
    val driverId: String = "",
    val passengerUid: String = "",
    val lastQrCodeId: String = "",
    val name: String = "",
    val phone: String = "",
    val totalRides: Long = 0L,
    val points: Long = 0L,
    val rewardsAvailable: Long = 0L,
    val rewardsRedeemed: Long = 0L,
    @ServerTimestamp
    val createdAt: Timestamp? = null,
    @ServerTimestamp
    val updatedAt: Timestamp? = null,
    @get:PropertyName("isArchived")
    @set:PropertyName("isArchived")
    var isArchived: Boolean = false
)
