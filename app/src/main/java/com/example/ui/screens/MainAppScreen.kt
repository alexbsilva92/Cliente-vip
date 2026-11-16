package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.repository.ClientVipRepository
import com.example.ui.theme.VipAmber
import com.example.ui.theme.VipGold
import com.example.ui.theme.VipGoldContainer
import com.example.ui.theme.VipGoldDark
import com.example.ui.theme.VipNavyBg
import com.example.ui.theme.VipNavyCard
import com.example.ui.theme.VipNavySurface
import com.example.ui.theme.VipNavySurfaceVariant
import com.example.ui.theme.VipTextPrimary
import com.example.ui.theme.VipTextSecondary
import com.example.ui.viewmodel.CustomerViewModel
import com.example.ui.viewmodel.DriverViewModel
import com.google.firebase.Firebase
import com.google.firebase.auth.auth

enum class ActiveArea {
    DRIVER,
    CUSTOMER
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScreen(
    currentUserId: String,
    initialQrCode: String? = null,
    qrTriggerVersion: Int = 0,
    onSignOutClicked: () -> Unit
) {
    val context = LocalContext.current
    val repository = remember(currentUserId) { ClientVipRepository(context) }
    val driverViewModel: DriverViewModel = viewModel(
        key = "driver_$currentUserId",
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return DriverViewModel(repository) as T
            }
        }
    )
    val customerViewModel: CustomerViewModel = viewModel(
        key = "customer_$currentUserId",
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return CustomerViewModel(repository) as T
            }
        }
    )

    var currentArea by remember(initialQrCode) {
        mutableStateOf(if (!initialQrCode.isNullOrBlank()) ActiveArea.CUSTOMER else ActiveArea.DRIVER)
    }

    androidx.compose.runtime.LaunchedEffect(initialQrCode, qrTriggerVersion) {
        if (!initialQrCode.isNullOrBlank()) {
            currentArea = ActiveArea.CUSTOMER
            customerViewModel.onQrCodeScannedFromCamera(initialQrCode)
        }
    }

    BackHandler(enabled = currentArea == ActiveArea.CUSTOMER) {
        currentArea = ActiveArea.DRIVER
    }

    Scaffold(
        containerColor = VipNavyBg,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(VipGold),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.DirectionsCar,
                                contentDescription = null,
                                tint = Color(0xFF1E1E1E),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "CLIENTE VIP",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                            color = VipGold,
                            letterSpacing = 1.sp
                        )
                    }
                },
                actions = {
                    val user = Firebase.auth.currentUser
                    Text(
                        text = user?.displayName ?: "VIP",
                        color = VipTextSecondary,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .widthIn(max = 120.dp)
                            .padding(end = 4.dp)
                    )
                    IconButton(
                        onClick = onSignOutClicked,
                        modifier = Modifier.testTag("sign_out_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "Sair",
                            tint = VipTextSecondary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = VipNavySurface,
                    titleContentColor = Color.White
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .consumeWindowInsets(innerPadding)
                .imePadding()
        ) {
            // Prominent Area Switcher (ÁREA DO MOTORISTA vs ÁREA DO CLIENTE)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(VipNavySurface)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(VipNavySurfaceVariant)
                        .padding(4.dp)
                ) {
                    // Motorista Tab
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (currentArea == ActiveArea.DRIVER) VipGold else Color.Transparent)
                            .clickable { currentArea = ActiveArea.DRIVER }
                            .padding(vertical = 10.dp)
                            .testTag("area_driver_tab"),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.DirectionsCar,
                                contentDescription = null,
                                tint = if (currentArea == ActiveArea.DRIVER) Color(0xFF111827) else VipTextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "MOTORISTA",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 13.sp,
                                color = if (currentArea == ActiveArea.DRIVER) Color(0xFF111827) else VipTextSecondary
                            )
                        }
                    }

                    // Cliente Tab
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (currentArea == ActiveArea.CUSTOMER) VipGold else Color.Transparent)
                            .clickable { currentArea = ActiveArea.CUSTOMER }
                            .padding(vertical = 10.dp)
                            .testTag("area_customer_tab"),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = if (currentArea == ActiveArea.CUSTOMER) Color(0xFF111827) else VipTextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "CLIENTE",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 13.sp,
                                color = if (currentArea == ActiveArea.CUSTOMER) Color(0xFF111827) else VipTextSecondary
                            )
                        }
                    }
                }
            }

            // Screen Content
            Box(modifier = Modifier.weight(1f)) {
                when (currentArea) {
                    ActiveArea.DRIVER -> DriverScreen(viewModel = driverViewModel)
                    ActiveArea.CUSTOMER -> CustomerScreen(
                        viewModel = customerViewModel,
                        qrTriggerVersion = qrTriggerVersion
                    )
                }
            }
        }
    }
}
