package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.credentials.CredentialManager
import androidx.lifecycle.lifecycleScope
import com.example.ui.screens.AuthScreen
import com.example.ui.screens.MainAppScreen
import com.example.ui.screens.attemptAutoSignIn
import com.example.ui.screens.signOutUser
import com.example.ui.theme.ClienteVipTheme
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth

import android.content.Intent
import com.example.util.QrCodeAnalyzer

class MainActivity : ComponentActivity() {
    private var pendingQrCode by mutableStateOf<String?>(null)
    private var qrTriggerVersion by mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        extractIntentCode(intent)

        val credentialManager = CredentialManager.create(this)
        attemptAutoSignIn(
            context = this,
            credentialManager = credentialManager,
            onAuthSuccess = {},
            onUnauthenticated = {},
            scope = lifecycleScope
        )

        setContent {
            ClienteVipTheme {
                AppContent(
                    initialQrCode = pendingQrCode,
                    qrTriggerVersion = qrTriggerVersion
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        extractIntentCode(intent)
    }

    private fun extractIntentCode(intent: Intent?) {
        intent?.data?.let { uri ->
            val rawQueryCode = uri.getQueryParameter("code")
            val candidate = when {
                !rawQueryCode.isNullOrBlank() -> QrCodeAnalyzer.extractVipCode(rawQueryCode)
                else -> QrCodeAnalyzer.extractVipCode(uri.toString())
            }
            if (QrCodeAnalyzer.isValidVipCodeFormat(candidate) || !rawQueryCode.isNullOrBlank()) {
                pendingQrCode = candidate
                qrTriggerVersion += 1
            }
        }
    }
}

@Composable
fun AppContent(
    initialQrCode: String? = null,
    qrTriggerVersion: Int = 0
) {
    var currentUser by remember { mutableStateOf(Firebase.auth.currentUser) }
    val context = LocalContext.current
    val coroutineScope = (context as? ComponentActivity)?.lifecycleScope ?: rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    DisposableEffect(Unit) {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            currentUser = auth.currentUser
        }
        Firebase.auth.addAuthStateListener(listener)
        onDispose {
            Firebase.auth.removeAuthStateListener(listener)
        }
    }

    if (currentUser == null) {
        AuthScreen(
            onAuthSuccess = {
                currentUser = Firebase.auth.currentUser
            }
        )
    } else {
        val uid = currentUser!!.uid
        key(uid) {
            MainAppScreen(
                currentUserId = uid,
                initialQrCode = initialQrCode,
                qrTriggerVersion = qrTriggerVersion,
                onSignOutClicked = {
                    signOutUser(credentialManager, coroutineScope) {
                        currentUser = null
                    }
                }
            )
        }
    }
}
