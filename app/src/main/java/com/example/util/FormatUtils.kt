package com.example.util

import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object FormatUtils {

    /**
     * Normalizes Brazilian phone numbers to DDD + 8/9 subscriber digits (10 or 11 digits)
     * so variations like "+55 (11) 98765-4321", "011987654321", and "11987654321"
     * always resolve to the same canonical client record.
     */
    fun normalizeBrPhone(phone: String): String {
        var digits = phone.filter { it.isDigit() }
        if (digits.length in 12..13 && digits.startsWith("55")) {
            val withoutCountry = digits.substring(2)
            if (withoutCountry.length in 10..11 && withoutCountry.take(2).toIntOrNull()?.let { it in 11..99 } == true) {
                digits = withoutCountry
            }
        }
        if (digits.length in 11..12 && digits.startsWith("0")) {
            val withoutTrunk = digits.substring(1)
            if (withoutTrunk.length in 10..11 && withoutTrunk.take(2).toIntOrNull()?.let { it in 11..99 } == true) {
                digits = withoutTrunk
            }
        }
        return digits
    }

    fun isValidBrPhone(phone: String): Boolean {
        val normalized = normalizeBrPhone(phone)
        if (normalized.length !in 10..11) return false
        val ddd = normalized.take(2).toIntOrNull() ?: return false
        if (ddd !in 11..99) return false
        if (normalized.length == 11 && normalized[2] != '9') return false
        return true
    }

    fun formatPhone(phone: String): String {
        val digits = normalizeBrPhone(phone)
        return when (digits.length) {
            11 -> "(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}"
            10 -> "(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}"
            else -> phone
        }
    }

    fun formatTimestamp(timestamp: Timestamp?): String {
        if (timestamp == null) return "Data recente"
        val date: Date = timestamp.toDate()
        val sdf = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale.forLanguageTag("pt-BR"))
        return sdf.format(date)
    }
}
