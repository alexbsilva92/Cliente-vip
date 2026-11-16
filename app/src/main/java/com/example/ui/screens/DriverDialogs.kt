package com.example.ui.screens

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalView
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.model.Client
import com.example.data.model.QrCode
import com.example.data.model.Ride
import com.example.ui.components.QrCodeView
import com.example.ui.theme.VipAmber
import com.example.ui.theme.VipBorder
import com.example.ui.theme.VipCrimson
import com.example.ui.theme.VipEmerald
import com.example.ui.theme.VipEmeraldContainer
import com.example.ui.theme.VipGold
import com.example.ui.theme.VipGoldContainer
import com.example.ui.theme.VipNavyCard
import com.example.ui.theme.VipNavySurface
import com.example.ui.theme.VipNavySurfaceVariant
import com.example.ui.theme.VipTextSecondary
import com.example.util.FormatUtils
import com.example.util.QrCodeDeepLink
import kotlinx.coroutines.delay
import java.util.Locale

@Composable
internal fun DriverProfileDialog(
    currentName: String,
    currentVehicle: String,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit
) {
    var name by remember { mutableStateOf(currentName) }
    var vehicle by remember { mutableStateOf(currentVehicle) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Identificação do Motorista", color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do Motorista") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = vehicle,
                    onValueChange = { vehicle = it },
                    label = { Text("Veículo e Placa (Ex: Corolla - ABC-1234)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name, vehicle) },
                colors = ButtonDefaults.buttonColors(containerColor = VipGold, contentColor = Color.Black)
            ) {
                Text("Salvar", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = VipTextSecondary)
            }
        },
        containerColor = VipNavySurface
    )
}

@Composable
internal fun ClientDetailDialog(
    client: Client,
    rides: List<Ride>,
    isMutating: Boolean,
    onDismiss: () -> Unit,
    onRequestRedeemReward: (Client) -> Unit,
    onRequestArchive: (Client) -> Unit,
    onRequestRestore: (Client) -> Unit,
    onRequestDelete: (Client) -> Unit
) {
    val context = LocalContext.current
    var visibleRidesLimit by remember(client.id) { mutableIntStateOf(15) }
    val visibleRides = rides.take(visibleRidesLimit)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = client.name, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(text = FormatUtils.formatPhone(client.phone), fontSize = 13.sp, color = VipTextSecondary)
                }
                if (client.isArchived) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(VipNavySurfaceVariant)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "ARQUIVADO",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = VipAmber
                        )
                    }
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                DetailRow("Pontos Atuais:", "${client.points}/10 pts", VipGold, bold = true)
                Spacer(modifier = Modifier.height(6.dp))
                DetailRow("Total de Corridas:", "${client.totalRides}", Color.White, bold = true)
                Spacer(modifier = Modifier.height(6.dp))
                DetailRow("Corridas Grátis Disponíveis:", "${client.rewardsAvailable}", VipEmerald, bold = true)
                Spacer(modifier = Modifier.height(6.dp))
                DetailRow("Recompensas Já Utilizadas:", "${client.rewardsRedeemed}", Color.White, bold = false)
                if (client.updatedAt != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    DetailRow("Última Corrida:", FormatUtils.formatTimestamp(client.updatedAt), VipGold, bold = true)
                }

                Spacer(modifier = Modifier.height(12.dp))

                // WhatsApp Contact Button
                Button(
                    onClick = {
                        val digits = FormatUtils.normalizeBrPhone(client.phone)
                        val message = Uri.encode("Olá ${client.name}, seu motorista VIP aqui!")
                        val url = "https://wa.me/55$digits?text=$message"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        try {
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            Toast.makeText(context, "Não foi possível abrir o WhatsApp", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = VipEmeraldContainer),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Icon(Icons.Default.Phone, contentDescription = null, tint = VipEmerald, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Conversar no WhatsApp", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Rides History List
                Text(
                    text = "Histórico de Corridas (${rides.size}):",
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(6.dp))

                if (rides.isEmpty()) {
                    Text(
                        text = "Nenhuma corrida detalhada registrada ainda.",
                        color = VipTextSecondary,
                        fontSize = 12.sp
                    )
                } else {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        visibleRides.forEach { ride ->
                            key(ride.id) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = FormatUtils.formatTimestamp(ride.timestamp),
                                            fontSize = 11.sp,
                                            color = Color.White
                                        )
                                        Text(
                                            text = "Código: ${ride.qrCodeId}",
                                            fontSize = 10.sp,
                                            color = VipTextSecondary
                                        )
                                    }
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(VipGoldContainer)
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = "+${ride.pointsEarned} pt",
                                            color = VipGold,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (rides.size > visibleRidesLimit) {
                        TextButton(
                            onClick = { visibleRidesLimit += 20 },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Carregar mais (${rides.size - visibleRidesLimit} restantes)",
                                color = VipGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                if (client.rewardsAvailable > 0) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { onRequestRedeemReward(client) },
                        enabled = !isMutating,
                        colors = ButtonDefaults.buttonColors(containerColor = VipEmerald),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("detail_redeem_reward_button")
                    ) {
                        Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Resgatar 1 Corrida Grátis", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = VipBorder)
                Spacer(modifier = Modifier.height(12.dp))

                // Archive or Restore Button
                if (client.isArchived) {
                    OutlinedButton(
                        onClick = { onRequestRestore(client) },
                        enabled = !isMutating,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("detail_restore_client_button")
                    ) {
                        Icon(Icons.Default.Unarchive, contentDescription = null, tint = VipEmerald, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Restaurar para Ativos", color = VipEmerald, fontWeight = FontWeight.Bold)
                    }
                } else {
                    OutlinedButton(
                        onClick = { onRequestArchive(client) },
                        enabled = !isMutating,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("detail_archive_client_button")
                    ) {
                        Icon(Icons.Default.Archive, contentDescription = null, tint = VipAmber, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Arquivar Cliente", color = VipAmber, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Permanent Delete Button (clearly separated destructive action)
                OutlinedButton(
                    onClick = { onRequestDelete(client) },
                    enabled = !isMutating,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("detail_delete_client_button")
                ) {
                    Icon(Icons.Default.DeleteForever, contentDescription = null, tint = VipCrimson, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Excluir Definitivamente", color = VipCrimson, fontWeight = FontWeight.Bold)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar", color = VipGold)
            }
        },
        containerColor = VipNavySurface
    )
}

@Composable
private fun DetailRow(label: String, value: String, valueColor: Color, bold: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, color = VipTextSecondary, fontSize = 13.sp)
        Text(
            text = value,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = valueColor,
            fontSize = 13.sp
        )
    }
}

@Composable
internal fun ConfirmArchiveClientDialog(
    client: Client,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.Archive, contentDescription = null, tint = VipAmber, modifier = Modifier.size(32.dp))
        },
        title = {
            Text("Arquivar cliente?", color = Color.White, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    text = "${client.name} sairá da lista principal de clientes ativos e ficará visível em \"Clientes Arquivados\".\n\nSeus ${client.points} ponto(s), ${client.totalRides} corrida(s) e ${client.rewardsAvailable} recompensa(s) serão preservados e você poderá restaurá-lo quando quiser.",
                    color = VipTextSecondary,
                    fontSize = 13.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = VipAmber, contentColor = Color.Black),
                modifier = Modifier.testTag("confirm_archive_button")
            ) {
                Text("Arquivar", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = VipTextSecondary)
            }
        },
        containerColor = VipNavySurface,
        modifier = Modifier.testTag("confirm_archive_dialog")
    )
}

@Composable
internal fun ConfirmRestoreClientDialog(
    client: Client,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.Unarchive, contentDescription = null, tint = VipEmerald, modifier = Modifier.size(32.dp))
        },
        title = {
            Text("Restaurar cliente?", color = Color.White, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    text = "${client.name} voltará imediatamente para a lista principal de clientes ativos com todos os seus pontos (${client.points}/10) e recompensas preservados.",
                    color = VipTextSecondary,
                    fontSize = 13.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = VipEmerald, contentColor = Color.White),
                modifier = Modifier.testTag("confirm_restore_button")
            ) {
                Text("Restaurar", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = VipTextSecondary)
            }
        },
        containerColor = VipNavySurface,
        modifier = Modifier.testTag("confirm_restore_dialog")
    )
}

@Composable
internal fun ConfirmDeleteClientDialog(
    client: Client,
    linkedRidesCount: Int,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.Warning, contentDescription = null, tint = VipCrimson, modifier = Modifier.size(34.dp))
        },
        title = {
            Text("Excluir definitivamente?", color = VipCrimson, fontWeight = FontWeight.ExtraBold)
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    text = "Esta ação NÃO pode ser desfeita. Serão apagados permanentemente:\n\n" +
                        "• Cadastro de ${client.name} (${FormatUtils.formatPhone(client.phone)})\n" +
                        "• Saldo de ${client.points} ponto(s) e ${client.rewardsAvailable} corrida(s) grátis\n" +
                        "• $linkedRidesCount corrida(s) e registros de recompensa vinculados a este cliente\n\n" +
                        "Os dados e históricos dos demais clientes permanecerão intactos.",
                    color = Color.White,
                    fontSize = 13.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = VipCrimson, contentColor = Color.White),
                modifier = Modifier.testTag("confirm_delete_button")
            ) {
                Text("Excluir Definitivamente", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = VipTextSecondary)
            }
        },
        containerColor = VipNavySurface,
        modifier = Modifier.testTag("confirm_delete_dialog")
    )
}

@Composable
internal fun ConfirmRedeemRewardDialog(
    client: Client,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = VipGold, modifier = Modifier.size(32.dp))
        },
        title = {
            Text("Confirmar resgate?", color = Color.White, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    text = "Confirmar que ${client.name} resgatou 1 corrida gratuita dentro da cidade?\n\n" +
                        "Saldo disponível atual: ${client.rewardsAvailable} corrida(s) grátis. Após confirmar, será descontada 1 recompensa e registrado no histórico.",
                    color = VipTextSecondary,
                    fontSize = 13.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = VipEmerald, contentColor = Color.White),
                modifier = Modifier.testTag("confirm_redeem_button")
            ) {
                Text("Confirmar Resgate", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = VipTextSecondary)
            }
        },
        containerColor = VipNavySurface,
        modifier = Modifier.testTag("confirm_redeem_dialog")
    )
}

@Composable
fun ActiveQrCodeModalDialog(
    qr: QrCode,
    onDismiss: () -> Unit,
    onCopyCode: (String) -> Unit,
    onShareCode: (String) -> Unit,
    onRegenerateNew: (() -> Unit)? = null
) {
    val isUsed = qr.status == "USED"
    var remainingSeconds by remember(qr.codeId, qr.expiresAt, qr.status) {
        mutableIntStateOf(
            qr.expiresAt?.let {
                ((it.toDate().time - System.currentTimeMillis()) / 1000L).toInt().coerceAtLeast(0)
            } ?: (15 * 60)
        )
    }
    LaunchedEffect(qr.codeId, qr.expiresAt, qr.status) {
        while (!isUsed && remainingSeconds > 0) {
            delay(1000L)
            remainingSeconds = qr.expiresAt?.let {
                ((it.toDate().time - System.currentTimeMillis()) / 1000L).toInt().coerceAtLeast(0)
            } ?: (remainingSeconds - 1).coerceAtLeast(0)
        }
    }
    val isExpired = !isUsed && (qr.status == "EXPIRED" || remainingSeconds <= 0)
    val mins = remainingSeconds / 60
    val secs = remainingSeconds % 60
    val formattedRemaining = String.format(Locale.US, "%02d:%02d", mins, secs)
    val qrUrlPayload = remember(qr.codeId) { QrCodeDeepLink.buildQrUrl(qr.codeId) }
    val context = LocalContext.current
    val view = LocalView.current

    // Boost screen brightness & keep screen awake while waiting for passenger camera scan
    DisposableEffect(isUsed, isExpired) {
        val previousKeepScreenOn = view.keepScreenOn
        val window = (context as? Activity)?.window
        val previousBrightness = window?.attributes?.screenBrightness
        if (!isUsed && !isExpired) {
            view.keepScreenOn = true
            if (window != null) {
                val attrs = window.attributes
                attrs.screenBrightness = 0.95f
                window.attributes = attrs
            }
        }
        onDispose {
            view.keepScreenOn = previousKeepScreenOn
            if (window != null && previousBrightness != null) {
                val attrs = window.attributes
                attrs.screenBrightness = previousBrightness
                window.attributes = attrs
            }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xD9000000))
                .systemBarsPadding()
                .padding(vertical = 12.dp)
                .clickable(
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                    indication = null,
                    onClick = onDismiss
                ),
            contentAlignment = Alignment.Center
        ) {
            val adaptiveQrSize = if (maxHeight < 620.dp) 200.dp else 260.dp
            Card(
                colors = CardDefaults.cardColors(containerColor = VipNavyCard),
                shape = RoundedCornerShape(24.dp),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = SolidColor(
                        when {
                            isUsed -> VipEmerald
                            isExpired -> MaterialTheme.colorScheme.error
                            else -> VipGold
                        }
                    )
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 18.dp),
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .widthIn(max = 420.dp)
                    .clickable(
                        interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                        indication = null,
                        onClick = {}
                    )
                    .testTag("active_qr_modal_dialog")
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.QrCode,
                                contentDescription = null,
                                tint = VipGold,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "QR CODE CLIENTE VIP",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }

                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(VipNavySurfaceVariant)
                                .testTag("modal_close_icon_button")
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Fechar Janela",
                                tint = VipTextSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    val badgeBg = when {
                        isUsed -> VipEmeraldContainer
                        isExpired -> Color(0xF02A1215)
                        else -> VipGoldContainer
                    }
                    val dotColor = when {
                        isUsed -> VipEmerald
                        isExpired -> MaterialTheme.colorScheme.error
                        else -> VipAmber
                    }
                    val statusText = when {
                        isUsed -> "UTILIZADO COM SUCESSO"
                        isExpired -> "CÓDIGO EXPIRADO"
                        else -> "AGUARDANDO PASSAGEIRO"
                    }
                    val statusTextColor = when {
                        isUsed -> VipEmerald
                        isExpired -> MaterialTheme.colorScheme.error
                        else -> VipGold
                    }
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(badgeBg)
                            .padding(horizontal = 16.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(dotColor)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = statusText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = statusTextColor
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // QR Code grande com HTTPS URL universal + contraste máximo
                    QrCodeView(
                        content = qrUrlPayload,
                        size = adaptiveQrSize
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(VipNavySurfaceVariant)
                            .clickable { onCopyCode(qr.codeId) }
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = qr.codeId,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = VipGold,
                            letterSpacing = 2.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(
                            Icons.Default.ContentCopy,
                            contentDescription = "Copiar Código",
                            tint = VipTextSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (isUsed) {
                        Text(
                            text = "Confirmado para: ${qr.usedByName ?: "Cliente"} (${FormatUtils.formatPhone(qr.usedByPhone ?: "")})",
                            color = VipEmerald,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                    } else if (isExpired) {
                        Text(
                            text = "Validade de 15 minutos encerrada. Gere um novo QR Code para a corrida.",
                            color = MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    } else {
                        Text(
                            text = "Expira em $formattedRemaining • Uso único para 1 corrida",
                            color = VipTextSecondary,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    }

                    if ((isUsed || isExpired) && onRegenerateNew != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = onRegenerateNew,
                            colors = ButtonDefaults.buttonColors(containerColor = VipEmerald, contentColor = Color.White),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("modal_regenerate_button")
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Gerar Novo QR Code", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { onShareCode(qr.codeId) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = VipGold,
                                contentColor = Color(0xFF111827)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("modal_share_button")
                        ) {
                            Icon(
                                Icons.Default.Share,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Compartilhar",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }

                        Button(
                            onClick = onDismiss,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = VipNavySurfaceVariant,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("modal_close_button")
                        ) {
                            Text(
                                text = "Fechar",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
