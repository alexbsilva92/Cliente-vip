package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.Client
import com.example.ui.theme.VipAmber
import com.example.ui.theme.VipBorder
import com.example.ui.theme.VipEmerald
import com.example.ui.theme.VipEmeraldContainer
import com.example.ui.theme.VipGold
import com.example.ui.theme.VipGoldContainer
import com.example.ui.theme.VipGoldDark
import com.example.ui.theme.VipGoldLight
import com.example.ui.theme.VipNavyBg
import com.example.ui.theme.VipNavyCard
import com.example.ui.theme.VipNavySurface
import com.example.ui.theme.VipNavySurfaceVariant
import com.example.ui.theme.VipTextPrimary
import com.example.ui.theme.VipTextSecondary
import com.example.ui.viewmodel.CustomerViewModel

@Composable
fun CustomerScreen(
    viewModel: CustomerViewModel,
    qrTriggerVersion: Int = 0
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var selectedTab by remember { mutableIntStateOf(0) }
    var showCameraScanner by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(qrTriggerVersion) {
        if (qrTriggerVersion > 0) {
            showCameraScanner = false
            selectedTab = 0
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(VipNavyBg)
    ) {
        // Customer Header
        CustomerHeader()

        // Navigation Tabs: Registrar Corrida / Meus Pontos
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = VipNavySurface,
            contentColor = VipGold,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = VipGold,
                    height = 3.dp
                )
            }
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            "Registrar Corrida",
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            "Meus Pontos",
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            )
        }

        // Tab Content
        Box(modifier = Modifier.weight(1f)) {
            when (selectedTab) {
                0 -> RegisterRideTab(
                    state = state,
                    onQrCodeChanged = viewModel::onQrCodeChanged,
                    onNameChanged = viewModel::onNameChanged,
                    onPhoneChanged = viewModel::onPhoneChanged,
                    onConfirmRide = viewModel::confirmRideRegistration,
                    onOpenScanner = { showCameraScanner = true },
                    onPasteFromClipboard = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = clipboard.primaryClip
                        if (clip != null && clip.itemCount > 0) {
                            val text = clip.getItemAt(0).text?.toString() ?: ""
                            viewModel.onQrCodeChanged(text)
                            Toast.makeText(context, "Código colado!", Toast.LENGTH_SHORT).show()
                        }
                    }
                )
                1 -> ConsultPointsTab(
                    state = state,
                    onPhoneChanged = viewModel::onConsultPhoneChanged,
                    onSearch = { viewModel.consultClientPoints() }
                )
            }
        }
    }

    // Full CameraX Scanner Screen with automatic return to Passenger Screen on code detection
    if (showCameraScanner) {
        QrCodeScannerScreen(
            viewModel = viewModel,
            onQrCodeScanned = { code ->
                viewModel.onQrCodeScannedFromCamera(code)
                showCameraScanner = false
                selectedTab = 0 // Abre automaticamente a tela do passageiro
                Toast.makeText(context, "QR Code lido: $code", Toast.LENGTH_SHORT).show()
            },
            onNavigateBack = { showCameraScanner = false },
            onNavigateToPoints = {
                showCameraScanner = false
                selectedTab = 1
            }
        )
    }
    }

    // Success Dialog on Ride Confirmation
    state.registrationResult?.let { res ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissRegistrationDialog() },
            icon = {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(VipEmeraldContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (res.earnedFreeRide) Icons.Default.EmojiEvents else Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = if (res.earnedFreeRide) VipGold else VipEmerald,
                        modifier = Modifier.size(36.dp)
                    )
                }
            },
            title = {
                Text(
                    text = if (res.earnedFreeRide) "PARABÉNS! CORRIDA GRÁTIS!" else "Corrida Confirmada!",
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Olá ${res.clientName}, sua corrida foi registrada com sucesso!",
                        color = Color.White,
                        textAlign = TextAlign.Center,
                        fontSize = 14.sp
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(VipGoldContainer)
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "+1 PONTO VIP ADICIONADO", color = VipGold, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                            Text(text = "Saldo atual: ${res.currentPoints}/10 pontos", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }

                    if (res.earnedFreeRide) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Card(
                            colors = CardDefaults.cardColors(containerColor = VipGold),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "🎉 VOCÊ ATINGIU 10 PONTOS!",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = Color.Black
                                )
                                Text(
                                    text = "Você ganhou 1 corrida gratuita dentro da cidade! Avise seu motorista no próximo embarque para resgatar.",
                                    fontSize = 12.sp,
                                    color = Color(0xFF1E1E1E),
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    } else {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Faltam ${10 - res.currentPoints} corrida(s) para sua próxima corrida gratuita!",
                            color = VipTextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.dismissRegistrationDialog()
                        selectedTab = 1 // Switch to points view
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = VipGold, contentColor = Color.Black),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Ver Meu Cartão VIP", fontWeight = FontWeight.Bold)
                }
            },
            containerColor = VipNavySurface
        )
    }
}

@Composable
private fun CustomerHeader() {
    Card(
        colors = CardDefaults.cardColors(containerColor = VipNavySurface),
        shape = RoundedCornerShape(0.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(VipGoldContainer)
                    .border(1.5.dp, VipGold, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = "Passageiro",
                    tint = VipGold,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "ÁREA DO CLIENTE",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(VipAmber)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "PASSAGEIRO",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.Black
                        )
                    }
                }
                Text(
                    text = "Ganhe 1 ponto por corrida e viaje grátis!",
                    fontSize = 12.sp,
                    color = VipTextSecondary
                )
            }
        }
    }
}

@Composable
internal fun RegisterRideTab(
    state: com.example.ui.viewmodel.CustomerUiState,
    onQrCodeChanged: (String) -> Unit,
    onNameChanged: (String) -> Unit,
    onPhoneChanged: (String) -> Unit,
    onConfirmRide: () -> Unit,
    onOpenScanner: () -> Unit,
    onPasteFromClipboard: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Loyalty Explanatory Banner
        Card(
            colors = CardDefaults.cardColors(containerColor = VipNavyCard),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = VipGold, modifier = Modifier.size(28.dp))
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(text = "Como funciona o CLIENTE VIP?", fontWeight = FontWeight.Bold, color = VipGold, fontSize = 13.sp)
                    Text(
                        text = "Peça o QR Code ao motorista, preencha seus dados abaixo e ganhe 1 ponto. A cada 10 pontos você ganha 1 corrida gratuita na cidade!",
                        color = Color.White,
                        fontSize = 11.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // Prominent Camera Scan Button
        Button(
            onClick = onOpenScanner,
            colors = ButtonDefaults.buttonColors(
                containerColor = VipGold,
                contentColor = Color(0xFF111827)
            ),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("open_camera_scanner_button")
        ) {
            Icon(Icons.Default.QrCodeScanner, contentDescription = null, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "ESCANEAR QR CODE COM A CÂMERA",
                fontWeight = FontWeight.ExtraBold,
                fontSize = 14.sp,
                letterSpacing = 0.5.sp
            )
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Divider with label
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            HorizontalDivider(modifier = Modifier.weight(1f), color = VipBorder)
            Text(
                text = " ou insira o código abaixo ",
                fontSize = 11.sp,
                color = VipTextSecondary,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
            HorizontalDivider(modifier = Modifier.weight(1f), color = VipBorder)
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Banner de confirmação se o QR Code já foi escaneado
        if (state.qrCodeInput.isNotBlank() && state.registrationError == null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = VipEmeraldContainer),
                shape = RoundedCornerShape(14.dp),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(VipEmerald)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 14.dp)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = VipEmerald,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "QR CODE VINCULADO",
                            fontWeight = FontWeight.ExtraBold,
                            color = VipEmerald,
                            fontSize = 12.sp
                        )
                        Text(
                            text = state.qrCodeInput,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 16.sp,
                            letterSpacing = 1.sp
                        )
                        val driverLabel = state.scannedQrCode?.driverName?.takeIf { it.isNotBlank() }
                        Text(
                            text = if (driverLabel != null) {
                                "Motorista: $driverLabel • Preencha Nome e Telefone e confirme abaixo!"
                            } else {
                                "Preencha seu Nome e Telefone abaixo e toque em CONFIRMAR CORRIDA para pontuar!"
                            },
                            color = VipTextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }

        // Form Inputs
        // 1. QR Code Input
        OutlinedTextField(
            value = state.qrCodeInput,
            onValueChange = onQrCodeChanged,
            label = { Text("Código do QR Code") },
            placeholder = { Text("Ex: VIP-1234-5678", color = VipTextSecondary) },
            leadingIcon = { Icon(Icons.Default.QrCode, contentDescription = null, tint = VipGold) },
            trailingIcon = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (state.qrCodeInput.isNotEmpty()) {
                        IconButton(onClick = { onQrCodeChanged("") }) {
                            Icon(Icons.Default.Close, contentDescription = "Limpar código", tint = VipTextSecondary)
                        }
                    }
                    IconButton(
                        onClick = onOpenScanner,
                        modifier = Modifier.testTag("scan_qr_icon_button")
                    ) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = "Escanear com a câmera", tint = VipGold)
                    }
                    IconButton(onClick = onPasteFromClipboard) {
                        Icon(Icons.Default.ContentPaste, contentDescription = "Colar da área de transferência", tint = VipGold)
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = VipNavyCard,
                unfocusedContainerColor = VipNavyCard,
                focusedBorderColor = VipGold,
                unfocusedBorderColor = VipBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("qr_code_input")
        )

        Spacer(modifier = Modifier.height(14.dp))

        // 2. Customer Name Input
        OutlinedTextField(
            value = state.nameInput,
            onValueChange = onNameChanged,
            label = { Text("Seu Nome") },
            placeholder = { Text("Nome completo", color = VipTextSecondary) },
            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = VipGold) },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = VipNavyCard,
                unfocusedContainerColor = VipNavyCard,
                focusedBorderColor = VipGold,
                unfocusedBorderColor = VipBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("client_name_input")
        )

        Spacer(modifier = Modifier.height(14.dp))

        // 3. Customer Phone Input
        OutlinedTextField(
            value = state.phoneInput,
            onValueChange = onPhoneChanged,
            label = { Text("Seu Telefone (com DDD)") },
            placeholder = { Text("Ex: 11987654321", color = VipTextSecondary) },
            leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, tint = VipGold) },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = VipNavyCard,
                unfocusedContainerColor = VipNavyCard,
                focusedBorderColor = VipGold,
                unfocusedBorderColor = VipBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("client_phone_input")
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Se o seu telefone já estiver cadastrado, seus pontos serão somados automaticamente!",
            fontSize = 11.sp,
            color = VipTextSecondary,
            textAlign = TextAlign.Start,
            modifier = Modifier.fillMaxWidth()
        )

        // Error message if any
        state.registrationError?.let { err ->
            Spacer(modifier = Modifier.height(14.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xF02A1215)),
                shape = RoundedCornerShape(12.dp),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.error)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("ride_registration_error_banner")
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = err,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Large Action Button: CONFIRMAR CORRIDA (+1 PONTO)
        Button(
            onClick = onConfirmRide,
            enabled = !state.isRegistering,
            colors = ButtonDefaults.buttonColors(
                containerColor = VipGold,
                contentColor = Color(0xFF111827)
            ),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .testTag("confirm_ride_button")
        ) {
            if (state.isRegistering) {
                CircularProgressIndicator(modifier = Modifier.size(26.dp), color = Color(0xFF111827))
                Spacer(modifier = Modifier.width(10.dp))
                Text("Confirmando Corrida...", fontSize = 17.sp, fontWeight = FontWeight.Bold)
            } else {
                Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(26.dp))
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "CONFIRMAR CORRIDA (+1 PONTO)",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.5.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(28.dp))
    }
}

@Composable
private fun ConsultPointsTab(
    state: com.example.ui.viewmodel.CustomerUiState,
    onPhoneChanged: (String) -> Unit,
    onSearch: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Consultar Saldo de Pontos",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "Digite seu número de telefone para ver seu Cartão VIP",
            fontSize = 12.sp,
            color = VipTextSecondary
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Search Input
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = state.consultPhoneInput,
                onValueChange = onPhoneChanged,
                placeholder = { Text("Telefone com DDD...", color = VipTextSecondary) },
                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, tint = VipGold) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = VipNavyCard,
                    unfocusedContainerColor = VipNavyCard,
                    focusedBorderColor = VipGold,
                    unfocusedBorderColor = VipBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .weight(1f)
                    .testTag("consult_phone_input")
            )

            Spacer(modifier = Modifier.width(10.dp))

            Button(
                onClick = onSearch,
                enabled = !state.isConsulting && state.consultPhoneInput.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = VipGold, contentColor = Color.Black),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .height(56.dp)
                    .testTag("consult_search_button")
            ) {
                if (state.isConsulting) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black)
                } else {
                    Icon(Icons.Default.Search, contentDescription = "Buscar")
                }
            }
        }

        state.consultError?.let { err ->
            Spacer(modifier = Modifier.height(10.dp))
            Text(text = err, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        }

        state.consultMessage?.let { msg ->
            Spacer(modifier = Modifier.height(14.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text = msg, color = VipTextSecondary, fontSize = 13.sp, modifier = Modifier.padding(16.dp), textAlign = TextAlign.Center)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Virtual VIP Loyalty Card
        state.consultedClient?.let { client ->
            VirtualVipCard(client = client)
        }

        Spacer(modifier = Modifier.height(28.dp))
    }
}

@Composable
private fun VirtualVipCard(client: Client) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 2.dp,
                brush = Brush.linearGradient(listOf(VipGold, VipAmber, VipGoldDark)),
                shape = RoundedCornerShape(22.dp)
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF1E293B),
                            Color(0xFF0F172A),
                            Color(0xFF070B14)
                        )
                    )
                )
                .padding(22.dp)
        ) {
            Column {
                // Card Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(VipGoldContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = VipGold, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "CLIENTE VIP",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                            color = VipGold,
                            letterSpacing = 2.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(VipGold)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "FIDELIDADE",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.Black
                        )
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Client Identity
                Text(
                    text = client.name.uppercase(),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Tel: ${com.example.util.FormatUtils.formatPhone(client.phone)}",
                    fontSize = 13.sp,
                    color = VipTextSecondary
                )
                if (client.updatedAt != null || client.rewardsRedeemed > 0) {
                    Text(
                        text = buildString {
                            if (client.updatedAt != null) {
                                append("Última corrida: ${com.example.util.FormatUtils.formatTimestamp(client.updatedAt)}")
                            }
                            if (client.rewardsRedeemed > 0) {
                                if (isNotEmpty()) append(" • ")
                                append("${client.rewardsRedeemed} resgatada(s)")
                            }
                        },
                        fontSize = 11.sp,
                        color = VipTextSecondary.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Points & Progress
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    Column {
                        Text(text = "PONTOS ACUMULADOS", fontSize = 11.sp, color = VipTextSecondary)
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(
                                text = "${client.points}",
                                fontSize = 32.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = VipGold
                            )
                            Text(
                                text = "/10",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = VipTextSecondary,
                                modifier = Modifier.padding(bottom = 4.dp, start = 2.dp)
                            )
                        }
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(text = "TOTAL CORRIDAS", fontSize = 11.sp, color = VipTextSecondary)
                        Text(
                            text = "${client.totalRides}",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Star Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    for (i in 1..10) {
                        val filled = i <= client.points
                        Box(
                            modifier = Modifier.weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (filled) Icons.Filled.Star else Icons.Outlined.Star,
                                contentDescription = null,
                                tint = if (filled) VipGold else VipBorder,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Linear Progress
                LinearProgressIndicator(
                    progress = { (client.points.toFloat() / 10f).coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = VipGold,
                    trackColor = VipNavySurfaceVariant
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Reward Highlight
                if (client.rewardsAvailable > 0) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = VipEmeraldContainer),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = VipEmerald)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Você tem ${client.rewardsAvailable} corrida(s) gratuita(s) liberada(s)! Informe seu motorista para resgatar.",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                } else {
                    Text(
                        text = "Faltam ${10 - client.points} corrida(s) para você ganhar 1 corrida gratuita na cidade!",
                        fontSize = 12.sp,
                        color = VipGoldLight,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}
