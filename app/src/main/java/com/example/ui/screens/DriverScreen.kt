package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.Client
import com.example.data.model.Reward
import com.example.data.model.Ride
import com.example.ui.components.QrCodeView
import com.example.ui.theme.VipAmber
import com.example.ui.theme.VipBorder
import com.example.ui.theme.VipCrimson
import com.example.ui.theme.VipEmerald
import com.example.ui.theme.VipEmeraldContainer
import com.example.ui.theme.VipGold
import com.example.ui.theme.VipGoldContainer
import com.example.ui.theme.VipNavyBg
import com.example.ui.theme.VipNavyCard
import com.example.ui.theme.VipNavySurface
import com.example.ui.theme.VipNavySurfaceVariant
import com.example.ui.theme.VipTextSecondary
import com.example.ui.viewmodel.ClientSortOrder
import com.example.ui.viewmodel.DriverUiState
import com.example.ui.viewmodel.DriverViewModel
import com.example.util.FormatUtils
import com.example.util.QrCodeDeepLink

private enum class ClientsSubTab {
    ACTIVE,
    ARCHIVED,
    HISTORY
}

@Composable
fun DriverScreen(
    viewModel: DriverViewModel
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var selectedTab by remember { mutableIntStateOf(0) }
    var showProfileDialog by remember { mutableStateOf(false) }

    // Pending confirmation targets
    var clientToArchive by remember { mutableStateOf<Client?>(null) }
    var clientToRestore by remember { mutableStateOf<Client?>(null) }
    var clientToDelete by remember { mutableStateOf<Client?>(null) }
    var clientToRedeem by remember { mutableStateOf<Client?>(null) }

    fun shareQrCode(code: String) {
        val qrLink = QrCodeDeepLink.buildQrUrl(code)
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(
                Intent.EXTRA_TEXT,
                "Olá! Use seu código VIP nesta corrida: $code\n\nAcesse pelo navegador ou no app CLIENTE VIP:\n$qrLink\n\nSe preferir, copie o código $code e cole na Área do Cliente."
            )
        }
        try {
            context.startActivity(Intent.createChooser(shareIntent, "Enviar Código VIP"))
        } catch (_: Exception) {
            Toast.makeText(context, "Nenhum aplicativo de compartilhamento disponível", Toast.LENGTH_SHORT).show()
        }
    }

    fun copyQrCode(code: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("QR Code VIP", code))
        Toast.makeText(context, "Código copiado: $code", Toast.LENGTH_SHORT).show()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(VipNavyBg)
    ) {
        DriverHeader(
            driverName = state.driverName,
            driverVehicle = state.driverVehicle,
            onEditProfile = { showProfileDialog = true }
        )

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
                        Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Gerar QR",
                            fontSize = 12.sp,
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
                        Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Clientes (${state.activeClientsCount})",
                            fontSize = 12.sp,
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            )
            Tab(
                selected = selectedTab == 2,
                onClick = { selectedTab = 2 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CardGiftcard, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        val eligibleCount = state.clients.count { !it.isArchived && (it.rewardsAvailable > 0 || it.points >= 10) }
                        Text(
                            "Prêmios ($eligibleCount)",
                            fontSize = 12.sp,
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = if (selectedTab == 2) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            )
        }

        // Global Status Notification Banner
        AnimatedVisibility(visible = state.statusNotification != null) {
            state.statusNotification?.let { msg ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = VipEmeraldContainer),
                    shape = RoundedCornerShape(0.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = msg,
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { viewModel.clearNotification() }) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Fechar aviso", tint = VipEmerald)
                        }
                    }
                }
            }
        }

        // Global Error Banner (visible across all tabs)
        AnimatedVisibility(visible = state.errorMessage != null) {
            state.errorMessage?.let { err ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    shape = RoundedCornerShape(0.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = err,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        IconButton(onClick = { viewModel.clearNotification() }) {
                            Icon(Icons.Default.Close, contentDescription = "Fechar erro", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }

        Box(modifier = Modifier.weight(1f)) {
            when (selectedTab) {
                0 -> GenerateQrCodeTab(
                    state = state,
                    onGenerateClicked = { viewModel.generateQrCode() },
                    onCopyCode = ::copyQrCode,
                    onShareCode = ::shareQrCode,
                    onOpenModal = { viewModel.openQrModal() }
                )
                1 -> ClientsPanelTab(
                    state = state,
                    onSearchQueryChanged = viewModel::onSearchQueryChanged,
                    onFilterEligibleToggled = viewModel::toggleFilterEligibleOnly,
                    onSortOrderChanged = viewModel::onSortOrderChanged,
                    onClientSelected = viewModel::selectClient,
                    onRequestArchive = { clientToArchive = it },
                    onRequestRestore = { clientToRestore = it },
                    onRequestDelete = { clientToDelete = it },
                    onLoadMoreRides = viewModel::loadMoreRides
                )
                2 -> RewardsManagementTab(
                    state = state,
                    onRequestRedeem = { clientToRedeem = it },
                    onLoadMoreRewards = viewModel::loadMoreRewards
                )
            }
        }
    }

    if (state.showQrModal && state.activeQrCode != null) {
        ActiveQrCodeModalDialog(
            qr = state.activeQrCode!!,
            onDismiss = { viewModel.dismissQrModal() },
            onCopyCode = ::copyQrCode,
            onShareCode = ::shareQrCode,
            onRegenerateNew = { viewModel.generateQrCode() }
        )
    }

    if (showProfileDialog) {
        DriverProfileDialog(
            currentName = state.driverName,
            currentVehicle = state.driverVehicle,
            onDismiss = { showProfileDialog = false },
            onSave = { name, vehicle ->
                viewModel.updateDriverProfile(name, vehicle)
                showProfileDialog = false
            }
        )
    }

    state.selectedClient?.let { client ->
        val normalizedClientPhone = FormatUtils.normalizeBrPhone(client.phone)
        val clientRides = state.rides.filter {
            FormatUtils.normalizeBrPhone(it.clientPhone) == normalizedClientPhone
        }
        ClientDetailDialog(
            client = client,
            rides = clientRides,
            isMutating = state.isMutatingClient || state.isRedeeming,
            onDismiss = { viewModel.selectClient(null) },
            onRequestRedeemReward = { clientToRedeem = it },
            onRequestArchive = { clientToArchive = it },
            onRequestRestore = { clientToRestore = it },
            onRequestDelete = { clientToDelete = it }
        )
    }

    clientToArchive?.let { client ->
        ConfirmArchiveClientDialog(
            client = client,
            onConfirm = {
                viewModel.archiveClient(client)
                clientToArchive = null
            },
            onDismiss = { clientToArchive = null }
        )
    }

    clientToRestore?.let { client ->
        ConfirmRestoreClientDialog(
            client = client,
            onConfirm = {
                viewModel.restoreClient(client)
                clientToRestore = null
            },
            onDismiss = { clientToRestore = null }
        )
    }

    clientToDelete?.let { client ->
        val normalizedClientPhone = FormatUtils.normalizeBrPhone(client.phone)
        val linkedRidesCount = state.rides.count {
            FormatUtils.normalizeBrPhone(it.clientPhone) == normalizedClientPhone
        }
        ConfirmDeleteClientDialog(
            client = client,
            linkedRidesCount = linkedRidesCount,
            onConfirm = {
                viewModel.deleteClientPermanently(client)
                clientToDelete = null
            },
            onDismiss = { clientToDelete = null }
        )
    }

    clientToRedeem?.let { client ->
        ConfirmRedeemRewardDialog(
            client = client,
            onConfirm = {
                viewModel.redeemRewardForClient(client)
                clientToRedeem = null
            },
            onDismiss = { clientToRedeem = null }
        )
    }
}

@Composable
private fun DriverHeader(
    driverName: String,
    driverVehicle: String,
    onEditProfile: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VipNavySurface),
        shape = RoundedCornerShape(0.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(VipGoldContainer)
                        .border(1.5.dp, VipGold, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.DirectionsCar,
                        contentDescription = "Motorista",
                        tint = VipGold,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = driverName.ifBlank { "Motorista VIP" },
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(VipGold)
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "MOTORISTA",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.Black
                            )
                        }
                    }
                    Text(
                        text = if (driverVehicle.isNotBlank()) driverVehicle else "Toque no lápis para definir seu veículo",
                        fontSize = 12.sp,
                        color = VipTextSecondary
                    )
                }
            }

            IconButton(
                onClick = onEditProfile,
                modifier = Modifier
                    .minimumInteractiveComponentSize()
                    .testTag("edit_driver_profile_button")
            ) {
                Icon(Icons.Default.Edit, contentDescription = "Editar Perfil", tint = VipGold)
            }
        }
    }
}

@Composable
private fun GenerateQrCodeTab(
    state: DriverUiState,
    onGenerateClicked: () -> Unit,
    onCopyCode: (String) -> Unit,
    onShareCode: (String) -> Unit,
    onOpenModal: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Button(
            onClick = onGenerateClicked,
            enabled = !state.isGeneratingQr,
            colors = ButtonDefaults.buttonColors(
                containerColor = VipGold,
                contentColor = Color(0xFF111827)
            ),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .testTag("generate_qr_button")
        ) {
            if (state.isGeneratingQr) {
                CircularProgressIndicator(modifier = Modifier.size(26.dp), color = Color(0xFF111827))
                Spacer(modifier = Modifier.width(10.dp))
                Text("Gerando QR Code...", fontSize = 17.sp, fontWeight = FontWeight.Bold)
            } else {
                Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(28.dp))
                Spacer(modifier = Modifier.width(12.dp))
                Text("GERAR QR CODE", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        if (state.activeQrCode != null) {
            val qr = state.activeQrCode
            val isUsed = qr.status == "USED"
            val qrPayload = remember(qr.codeId) { QrCodeDeepLink.buildQrUrl(qr.codeId) }

            Card(
                colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                shape = RoundedCornerShape(20.dp),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = SolidColor(if (isUsed) VipEmerald else VipGold)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("active_qr_code_card")
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isUsed) VipEmeraldContainer else VipGoldContainer)
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(if (isUsed) VipEmerald else VipAmber)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isUsed) "UTILIZADO COM SUCESSO" else "AGUARDANDO PASSAGEIRO",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isUsed) VipEmerald else VipGold
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    QrCodeView(
                        content = qrPayload,
                        size = 240.dp
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(VipNavySurfaceVariant)
                                .clickable { onCopyCode(qr.codeId) }
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = qr.codeId,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = VipGold,
                                letterSpacing = 2.sp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copiar Código", tint = VipTextSecondary, modifier = Modifier.size(18.dp))
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        IconButton(
                            onClick = { onShareCode(qr.codeId) },
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(VipGoldContainer)
                                .size(48.dp)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = "Compartilhar Código", tint = VipGold, modifier = Modifier.size(20.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    if (isUsed) {
                        Text(
                            text = "Utilizado por: ${qr.usedByName ?: "Cliente"} (${FormatUtils.formatPhone(qr.usedByPhone ?: "")})",
                            color = VipEmerald,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    } else {
                        Text(
                            text = "Válido por 15 minutos apenas para 1 corrida. O passageiro pode escanear com a câmera do celular ou pelo app CLIENTE VIP.",
                            color = VipTextSecondary,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Button(
                        onClick = onOpenModal,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = VipNavySurfaceVariant,
                            contentColor = VipGold
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("open_qr_modal_button")
                    ) {
                        Icon(
                            Icons.Default.Fullscreen,
                            contentDescription = null,
                            tint = VipGold,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "ABRIR EM JANELA MODAL",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            Card(
                colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.QrCode,
                        contentDescription = null,
                        tint = VipGold.copy(alpha = 0.5f),
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Nenhum QR Code ativo no momento",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Pressione o botão acima ao finalizar a corrida para gerar um QR Code de uso único para o passageiro pontuar.",
                        fontSize = 13.sp,
                        color = VipTextSecondary,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(28.dp))
    }
}

@Composable
private fun ClientsPanelTab(
    state: DriverUiState,
    onSearchQueryChanged: (String) -> Unit,
    onFilterEligibleToggled: (Boolean) -> Unit,
    onSortOrderChanged: (ClientSortOrder) -> Unit,
    onClientSelected: (Client) -> Unit,
    onRequestArchive: (Client) -> Unit,
    onRequestRestore: (Client) -> Unit,
    onRequestDelete: (Client) -> Unit,
    onLoadMoreRides: () -> Unit
) {
    var subTab by remember { mutableStateOf(ClientsSubTab.ACTIVE) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        // Sub-tabs: Ativos | Clientes Arquivados | Histórico Completo
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(VipNavySurface)
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            SubTabPill(
                label = "Ativos (${state.activeClientsCount})",
                selected = subTab == ClientsSubTab.ACTIVE,
                onClick = { subTab = ClientsSubTab.ACTIVE },
                modifier = Modifier
                    .weight(1f)
                    .testTag("subtab_active_clients")
            )
            SubTabPill(
                label = "Arquivados (${state.archivedClientsCount})",
                selected = subTab == ClientsSubTab.ARCHIVED,
                onClick = { subTab = ClientsSubTab.ARCHIVED },
                modifier = Modifier
                    .weight(1f)
                    .testTag("subtab_archived_clients")
            )
            SubTabPill(
                label = "Histórico (${state.rides.size})",
                selected = subTab == ClientsSubTab.HISTORY,
                onClick = { subTab = ClientsSubTab.HISTORY },
                modifier = Modifier
                    .weight(1f)
                    .testTag("subtab_rides_history")
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (subTab == ClientsSubTab.HISTORY) {
            RidesHistoryPanel(
                rides = state.rides,
                visibleCount = state.ridesVisibleCount,
                onLoadMore = onLoadMoreRides
            )
            return@Column
        }

        val displayedClients = if (subTab == ClientsSubTab.ACTIVE) {
            state.filteredClients
        } else {
            state.filteredArchivedClients
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item(key = "clients_search_and_filters") {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Search Input (shared between Active and Archived)
                    OutlinedTextField(
                        value = state.searchQuery,
                        onValueChange = onSearchQueryChanged,
                        placeholder = { Text("Buscar por nome ou telefone...", color = VipTextSecondary) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = VipGold) },
                        trailingIcon = {
                            if (state.searchQuery.isNotEmpty()) {
                                IconButton(onClick = { onSearchQueryChanged("") }) {
                                    Icon(Icons.Default.Close, contentDescription = "Limpar busca", tint = VipTextSecondary)
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
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
                            .testTag("search_client_input")
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Sort order chips (helps locate inactive clients easily)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (subTab == ClientsSubTab.ACTIVE) {
                            FilterChip(
                                selected = state.filterEligibleRewardsOnly,
                                onClick = { onFilterEligibleToggled(!state.filterEligibleRewardsOnly) },
                                label = { Text("Com recompensa", fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = VipGoldContainer,
                                    selectedLabelColor = VipGold
                                )
                            )
                        }
                        ClientSortOrder.entries.forEach { order ->
                            FilterChip(
                                selected = state.sortOrder == order,
                                onClick = { onSortOrderChanged(order) },
                                label = { Text(order.label, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = VipNavySurfaceVariant,
                                    selectedLabelColor = VipGold
                                )
                            )
                        }
                    }

                    Text(
                        text = if (subTab == ClientsSubTab.ACTIVE) {
                            "${displayedClients.size} cliente(s) ativo(s)"
                        } else {
                            "${displayedClients.size} cliente(s) arquivado(s) (dados preservados)"
                        },
                        fontSize = 12.sp,
                        color = VipTextSecondary,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }

            if (state.isLoading && state.clients.isEmpty()) {
                item(key = "clients_loading") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = VipGold)
                    }
                }
            } else if (displayedClients.isEmpty()) {
                item(key = "clients_empty") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = when {
                                state.searchQuery.isNotBlank() -> "Nenhum cliente corresponde à busca."
                                subTab == ClientsSubTab.ARCHIVED -> "Nenhum cliente arquivado.\nVocê pode arquivar clientes inativos sem perder seus pontos ou corridas."
                                else -> "Nenhum cliente ativo cadastrado ainda. Compartilhe o primeiro QR Code!"
                            },
                            color = VipTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                items(displayedClients, key = { it.id }) { client ->
                    ClientListItemCard(
                        client = client,
                        isArchivedView = (subTab == ClientsSubTab.ARCHIVED),
                        onClick = { onClientSelected(client) },
                        onArchiveClick = { onRequestArchive(client) },
                        onRestoreClick = { onRequestRestore(client) },
                        onDeleteClick = { onRequestDelete(client) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SubTabPill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) VipGold else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Medium,
            color = if (selected) Color(0xFF111827) else VipTextSecondary,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun RidesHistoryPanel(
    rides: List<Ride>,
    visibleCount: Int,
    onLoadMore: () -> Unit
) {
    if (rides.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.History, contentDescription = null, tint = VipTextSecondary, modifier = Modifier.size(44.dp))
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Nenhuma corrida registrada ainda.",
                    color = VipTextSecondary,
                    textAlign = TextAlign.Center
                )
            }
        }
        return
    }

    val visibleRides = rides.take(visibleCount)
    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = "Exibindo ${visibleRides.size} de ${rides.size} corridas",
            fontSize = 12.sp,
            color = VipTextSecondary,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(visibleRides, key = { it.id }) { ride ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = ride.clientName, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                            Text(
                                text = "${FormatUtils.formatPhone(ride.clientPhone)} • ${ride.qrCodeId}",
                                color = VipTextSecondary,
                                fontSize = 11.sp
                            )
                            Text(
                                text = FormatUtils.formatTimestamp(ride.timestamp),
                                color = VipTextSecondary,
                                fontSize = 11.sp
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(VipGoldContainer)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "+${ride.pointsEarned} pt",
                                color = VipGold,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }

            if (rides.size > visibleRides.size) {
                item {
                    OutlinedButton(
                        onClick = onLoadMore,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .testTag("load_more_rides_button")
                    ) {
                        Text(
                            text = "Carregar mais corridas (+${minOf(25, rides.size - visibleRides.size)})",
                            color = VipGold,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun ClientListItemCard(
    client: Client,
    isArchivedView: Boolean,
    onClick: () -> Unit,
    onArchiveClick: () -> Unit,
    onRestoreClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    val hasReward = client.rewardsAvailable > 0 || client.points >= 10

    Card(
        colors = CardDefaults.cardColors(containerColor = VipNavyCard),
        shape = RoundedCornerShape(14.dp),
        border = if (hasReward && !isArchivedView) {
            CardDefaults.outlinedCardBorder().copy(brush = SolidColor(VipGold))
        } else null,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag("client_card_${client.phone}")
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = client.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color.White
                        )
                        if (client.isArchived) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(VipNavySurfaceVariant)
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "ARQUIVADO",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = VipAmber
                                )
                            }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Phone, contentDescription = null, tint = VipTextSecondary, modifier = Modifier.size(13.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = FormatUtils.formatPhone(client.phone),
                            fontSize = 13.sp,
                            color = VipTextSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (hasReward) VipGoldContainer else VipNavySurfaceVariant)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = if (hasReward) VipGold else VipAmber,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${client.points}/10 pts",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 14.sp,
                            color = if (hasReward) VipGold else Color.White
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

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
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Total de corridas: ${client.totalRides}",
                        fontSize = 12.sp,
                        color = VipTextSecondary
                    )
                    if (client.updatedAt != null) {
                        Text(
                            text = "Última corrida: ${FormatUtils.formatTimestamp(client.updatedAt)}",
                            fontSize = 11.sp,
                            color = VipTextSecondary.copy(alpha = 0.85f)
                        )
                    }
                }

                if (client.rewardsAvailable > 0) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(VipGold)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "${client.rewardsAvailable} GRÁTIS",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.Black
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = VipBorder.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(4.dp))

            // Quick Client Management Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isArchivedView) {
                    OutlinedButton(
                        onClick = onRestoreClick,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .height(40.dp)
                            .testTag("restore_client_button_${client.phone}")
                    ) {
                        Icon(Icons.Default.Unarchive, contentDescription = null, tint = VipEmerald, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Restaurar", color = VipEmerald, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                } else {
                    IconButton(
                        onClick = onArchiveClick,
                        modifier = Modifier
                            .minimumInteractiveComponentSize()
                            .testTag("archive_client_button_${client.phone}")
                    ) {
                        Icon(Icons.Default.Archive, contentDescription = "Arquivar cliente", tint = VipAmber, modifier = Modifier.size(20.dp))
                    }
                }

                IconButton(
                    onClick = onDeleteClick,
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("delete_client_button_${client.phone}")
                ) {
                    Icon(Icons.Default.DeleteForever, contentDescription = "Excluir cliente definitivamente", tint = VipCrimson, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

@Composable
private fun RewardsManagementTab(
    state: DriverUiState,
    onRequestRedeem: (Client) -> Unit,
    onLoadMoreRewards: () -> Unit
) {
    val eligibleClients = state.clients.filter { !it.isArchived && (it.rewardsAvailable > 0 || it.points >= 10) }
    val redeemedRewards = state.rewards.filter { it.status == "REDEEMED" }
    val visibleRewards = redeemedRewards.take(state.rewardsVisibleCount)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = VipGoldContainer),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = VipGold, modifier = Modifier.size(36.dp))
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "Programa Fidelidade 10 Pontos",
                            fontWeight = FontWeight.Bold,
                            color = VipGold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "A cada 10 corridas acumuladas, o cliente ganha 1 corrida gratuita dentro da cidade.",
                            color = Color.White,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        item {
            Text(
                text = "Clientes com Corrida Gratuita Disponível (${eligibleClients.size})",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        if (eligibleClients.isEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Nenhum cliente atingiu 10 pontos ainda.\nAssim que completarem 10 corridas, aparecerão aqui!",
                        color = VipTextSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp)
                    )
                }
            }
        } else {
            items(eligibleClients, key = { it.id }) { client ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                    shape = RoundedCornerShape(14.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = SolidColor(VipGold)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = client.name, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Color.White)
                                Text(text = "Tel: ${FormatUtils.formatPhone(client.phone)}", color = VipTextSecondary, fontSize = 13.sp)
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(VipGold)
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "${client.rewardsAvailable} DISPONÍVEL",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    color = Color.Black
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = { onRequestRedeem(client) },
                            enabled = !state.isRedeeming && client.rewardsAvailable > 0,
                            colors = ButtonDefaults.buttonColors(containerColor = VipEmerald),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("redeem_reward_button_${client.phone}")
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Marcar Corrida Grátis como Resgatada",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }

        // Complete Paginated Rewards Redemption History
        item {
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = VipBorder)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Histórico de Recompensas Resgatadas (${redeemedRewards.size})",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        if (redeemedRewards.isEmpty()) {
            item {
                Text(
                    text = "Nenhum resgate registrado até o momento.",
                    color = VipTextSecondary,
                    fontSize = 13.sp
                )
            }
        } else {
            items(visibleRewards, key = { it.id }) { reward ->
                RewardHistoryRow(reward)
            }
            if (redeemedRewards.size > visibleRewards.size) {
                item {
                    OutlinedButton(
                        onClick = onLoadMoreRewards,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("load_more_rewards_button")
                    ) {
                        Text(
                            text = "Carregar mais resgates (+${minOf(20, redeemedRewards.size - visibleRewards.size)})",
                            color = VipGold,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RewardHistoryRow(reward: Reward) {
    val isRedeemed = reward.status == "REDEEMED"
    Card(
        colors = CardDefaults.cardColors(containerColor = VipNavyCard),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = reward.clientName, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                Text(text = FormatUtils.formatPhone(reward.clientPhone), color = VipTextSecondary, fontSize = 12.sp)
                Text(
                    text = if (isRedeemed) {
                        "Resgatado em: ${FormatUtils.formatTimestamp(reward.redeemedAt ?: reward.createdAt)}"
                    } else {
                        "Liberado em: ${FormatUtils.formatTimestamp(reward.createdAt)}"
                    },
                    color = VipTextSecondary,
                    fontSize = 11.sp
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isRedeemed) VipEmeraldContainer else VipGoldContainer)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = if (isRedeemed) "RESGATADA" else "DISPONÍVEL",
                    color = if (isRedeemed) VipEmerald else VipGold,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp
                )
            }
        }
    }
}
