package com.example.util

import android.net.Uri

/**
 * Generates standard HTTPS URLs (`/ride?code=VIP-XXXX-XXXX`) using the project's
 * configured web domain so any external phone camera opens the passenger registration
 * web portal directly, while Android App Links open the installed app seamlessly.
 */
object QrCodeDeepLink {
    const val WEB_BASE_URL = "https://ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app"
    const val RIDE_ROUTE = "/ride"
    const val CUSTOM_SCHEME = "clientevip"
    const val CUSTOM_HOST = "ride"
    const val CUSTOM_SCHEME_BASE = "$CUSTOM_SCHEME://$CUSTOM_HOST"

    fun buildQrUrl(codeId: String): String {
        val clean = codeId.trim().uppercase()
        return if (clean.isBlank()) {
            "$WEB_BASE_URL$RIDE_ROUTE"
        } else {
            "$WEB_BASE_URL$RIDE_ROUTE?code=${Uri.encode(clean)}"
        }
    }

    fun buildAppSchemeUrl(codeId: String): String {
        val clean = codeId.trim().uppercase()
        return if (clean.isBlank()) CUSTOM_SCHEME_BASE else "$CUSTOM_SCHEME_BASE?code=${Uri.encode(clean)}"
    }
}
