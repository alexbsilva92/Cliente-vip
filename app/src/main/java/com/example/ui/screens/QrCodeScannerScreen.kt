package com.example.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.repository.QrCodeVerification
import com.example.ui.theme.VipAmber
import com.example.ui.theme.VipEmerald
import com.example.ui.theme.VipEmeraldContainer
import com.example.ui.theme.VipGold
import com.example.ui.theme.VipGoldContainer
import com.example.ui.theme.VipGoldLight
import com.example.ui.theme.VipNavyBg
import com.example.ui.theme.VipNavyCard
import com.example.ui.theme.VipNavySurface
import com.example.ui.theme.VipNavySurfaceVariant
import com.example.ui.theme.VipTextSecondary
import com.example.ui.viewmodel.CustomerUiState
import com.example.ui.viewmodel.CustomerViewModel
import com.example.util.QrCodeAnalyzer
import kotlinx.coroutines.delay
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private const val TAG = "QrCodeScannerScreen"

@Composable
fun QrCodeScannerScreen(
    viewModel: CustomerViewModel,
    onQrCodeScanned: (String) -> Unit,
    onNavigateBack: () -> Unit,
    onNavigateToPoints: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    // Re-check camera permission whenever returning from Settings
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                hasCameraPermission = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    BackHandler {
        viewModel.resetScannerState()
        onNavigateBack()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (hasCameraPermission) {
            CameraPreviewAndControls(
                state = state,
                onQrCodeScanned = onQrCodeScanned,
                onBack = {
                    viewModel.resetScannerState()
                    onNavigateBack()
                }
            )
        } else {
            CameraPermissionFallback(
                onRequestPermission = {
                    permissionLauncher.launch(Manifest.permission.CAMERA)
                },
                onOpenAppSettings = {
                    val intent = Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", context.packageName, null)
                    )
                    runCatching { context.startActivity(intent) }
                },
                onBack = onNavigateBack
            )
        }

        // Registration Success Dialog
        state.registrationResult?.let { res ->
            AlertDialog(
                onDismissRequest = { viewModel.dismissRegistrationDialog() },
                icon = {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(VipEmeraldContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (res.earnedFreeRide) Icons.Default.EmojiEvents else Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = if (res.earnedFreeRide) VipGold else VipEmerald,
                            modifier = Modifier.size(38.dp)
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
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
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
                                Text(
                                    text = "+1 PONTO VIP ADICIONADO",
                                    color = VipGold,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "Saldo: ${res.currentPoints}/10 pontos",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp
                                )
                            }
                        }

                        if (res.earnedFreeRide) {
                            Spacer(modifier = Modifier.height(14.dp))
                            Card(
                                colors = CardDefaults.cardColors(containerColor = VipGold),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = "🎉 VOCÊ ATINGIU 10 PONTOS!",
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 14.sp,
                                        color = Color.Black
                                    )
                                    Text(
                                        text = "Você tem 1 corrida gratuita na cidade! Avise o motorista no próximo embarque para resgatar.",
                                        fontSize = 12.sp,
                                        color = Color(0xFF1E1E1E),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.dismissRegistrationDialog()
                            onNavigateToPoints()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = VipGold, contentColor = Color.Black),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Ver Meu Cartão VIP", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    Button(
                        onClick = {
                            viewModel.dismissRegistrationDialog()
                            viewModel.resetScannerState()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = VipNavySurface, contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Escanear Outro Código")
                    }
                },
                containerColor = VipNavySurface
            )
        }
    }
}

@Composable
private fun CameraPreviewAndControls(
    state: CustomerUiState,
    onQrCodeScanned: (String) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnQrCodeScanned by androidx.compose.runtime.rememberUpdatedState(onQrCodeScanned)
    val mainExecutor = remember(context) { ContextCompat.getMainExecutor(context) }

    var camera by remember { mutableStateOf<Camera?>(null) }
    var cameraProviderRef by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var previewViewRef by remember { mutableStateOf<PreviewView?>(null) }
    var isTorchOn by remember { mutableStateOf(false) }
    var isZoom2x by remember { mutableStateOf(false) }
    var isScannedTriggered by remember { mutableStateOf(false) }
    var cameraInitError by remember { mutableStateOf<String?>(null) }
    var nonVipWarning by remember { mutableStateOf<String?>(null) }
    var bindTrigger by remember { mutableIntStateOf(0) }

    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val analyzer = remember {
        QrCodeAnalyzer(
            onQrCodeScanned = { scannedCode ->
                val clean = scannedCode.trim().uppercase()
                if (clean.isNotBlank()) {
                    mainExecutor.execute {
                        if (!isScannedTriggered) {
                            isScannedTriggered = true
                            vibrateDevice(context)
                            currentOnQrCodeScanned(clean)
                        }
                    }
                }
            },
            onInvalidQrIgnored = {
                mainExecutor.execute {
                    nonVipWarning = "Este QR Code não é do CLIENTE VIP. Aponte para o código gerado pelo motorista."
                }
            }
        )
    }

    // Clear non-VIP warning automatically after 3 seconds
    LaunchedEffect(nonVipWarning) {
        if (nonVipWarning != null) {
            delay(3000L)
            nonVipWarning = null
        }
    }

    // Auto-focus reticle center periodically while waiting for scan
    LaunchedEffect(camera, previewViewRef, isScannedTriggered) {
        val cam = camera ?: return@LaunchedEffect
        val pv = previewViewRef ?: return@LaunchedEffect
        while (!isScannedTriggered) {
            if (pv.width > 0 && pv.height > 0) {
                val point = pv.meteringPointFactory.createPoint(pv.width / 2f, pv.height / 2.4f)
                val action = FocusMeteringAction.Builder(
                    point,
                    FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
                )
                    .setAutoCancelDuration(2, TimeUnit.SECONDS)
                    .build()
                runCatching { cam.cameraControl.startFocusAndMetering(action) }
            }
            delay(2500L)
        }
    }

    // Bind / rebind CameraX when retry is requested
    LaunchedEffect(previewViewRef, bindTrigger) {
        val previewView = previewViewRef ?: return@LaunchedEffect
        cameraInitError = null
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                cameraProviderRef = cameraProvider
                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }

                val resolutionSelector = ResolutionSelector.Builder()
                    .setResolutionStrategy(
                        ResolutionStrategy(
                            android.util.Size(1280, 720),
                            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
                        )
                    )
                    .build()

                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .setResolutionSelector(resolutionSelector)
                    .build()
                    .also {
                        it.setAnalyzer(cameraExecutor, analyzer)
                    }

                val cameraSelector = if (cameraProvider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) {
                    CameraSelector.DEFAULT_BACK_CAMERA
                } else {
                    CameraSelector.DEFAULT_FRONT_CAMERA
                }

                cameraProvider.unbindAll()
                val boundCamera = cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageAnalysis
                )
                camera = boundCamera
                // Re-apply zoom toggle if selected
                if (isZoom2x) {
                    val zoomState = boundCamera.cameraInfo.zoomState.value
                    val maxZoom = zoomState?.maxZoomRatio ?: 2f
                    val target = 2.0f.coerceAtMost(maxZoom)
                    boundCamera.cameraControl.setZoomRatio(target)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao inicializar câmera CameraX: ${e.message}", e)
                cameraInitError = "Não foi possível iniciar a câmera: ${e.localizedMessage ?: "erro de hardware"}"
            }
        }, mainExecutor)
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { cameraProviderRef?.unbindAll() }
            runCatching { analyzer.close() }
            cameraExecutor.shutdown()
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val density = LocalDensity.current
        val boxWidthPx = with(density) { maxWidth.toPx() }
        val boxHeightPx = with(density) { maxHeight.toPx() }
        val scanBoxSizePx = (minOf(boxWidthPx, boxHeightPx) * 0.72f).coerceIn(
            with(density) { 220.dp.toPx() },
            with(density) { 330.dp.toPx() }
        )
        val left = (boxWidthPx - scanBoxSizePx) / 2f
        val top = (boxHeightPx - scanBoxSizePx) / 2.8f

        // Camera Preview with Tap-to-Focus
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                    previewViewRef = this
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(camera, previewViewRef) {
                    detectTapGestures { offset ->
                        val cam = camera ?: return@detectTapGestures
                        val pv = previewViewRef ?: return@detectTapGestures
                        val pt = pv.meteringPointFactory.createPoint(offset.x, offset.y)
                        val action = FocusMeteringAction.Builder(
                            pt,
                            FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
                        )
                            .setAutoCancelDuration(3, TimeUnit.SECONDS)
                            .build()
                        runCatching { cam.cameraControl.startFocusAndMetering(action) }
                    }
                }
        )

        // Viewfinder reticle
        val infiniteTransition = rememberInfiniteTransition(label = "scan_laser")
        val scanLineProgress by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 1800, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "scan_laser_progress"
        )
        val errorColor = MaterialTheme.colorScheme.error

        Canvas(modifier = Modifier.fillMaxSize()) {
            val scanRect = Rect(
                offset = Offset(left, top),
                size = Size(scanBoxSizePx, scanBoxSizePx)
            )

            // Scrim
            val clipPath = Path().apply {
                addRoundRect(
                    RoundRect(
                        rect = scanRect,
                        cornerRadius = CornerRadius(24.dp.toPx(), 24.dp.toPx())
                    )
                )
            }

            clipPath(clipPath, clipOp = ClipOp.Difference) {
                drawRect(color = Color(0xB3000000))
            }

            // Frame border
            val frameColor = when {
                state.scannedQrCode != null -> VipEmerald
                state.qrVerificationStatus is QrCodeVerification.AlreadyUsed -> errorColor
                state.isVerifyingQrCode -> VipGold
                else -> VipGold.copy(alpha = 0.6f)
            }

            drawRoundRect(
                color = frameColor,
                topLeft = Offset(left, top),
                size = Size(scanBoxSizePx, scanBoxSizePx),
                cornerRadius = CornerRadius(24.dp.toPx(), 24.dp.toPx()),
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx())
            )

            // Corner brackets
            val cornerLength = 32.dp.toPx()
            val strokeW = 4.dp.toPx()

            drawLine(frameColor, Offset(left - 2, top + cornerLength), Offset(left - 2, top), strokeW)
            drawLine(frameColor, Offset(left - 2, top), Offset(left + cornerLength, top), strokeW)

            drawLine(frameColor, Offset(left + scanBoxSizePx + 2 - cornerLength, top), Offset(left + scanBoxSizePx + 2, top), strokeW)
            drawLine(frameColor, Offset(left + scanBoxSizePx + 2, top), Offset(left + scanBoxSizePx + 2, top + cornerLength), strokeW)

            drawLine(frameColor, Offset(left - 2, top + scanBoxSizePx - cornerLength), Offset(left - 2, top + scanBoxSizePx), strokeW)
            drawLine(frameColor, Offset(left - 2, top + scanBoxSizePx), Offset(left + cornerLength, top + scanBoxSizePx), strokeW)

            drawLine(frameColor, Offset(left + scanBoxSizePx + 2 - cornerLength, top + scanBoxSizePx), Offset(left + scanBoxSizePx + 2, top + scanBoxSizePx), strokeW)
            drawLine(frameColor, Offset(left + scanBoxSizePx + 2, top + scanBoxSizePx - cornerLength), Offset(left + scanBoxSizePx + 2, top + scanBoxSizePx), strokeW)

            // Laser line
            val scanLineY = top + (scanBoxSizePx * scanLineProgress)
            drawLine(
                color = if (state.scannedQrCode != null) VipEmerald else VipGoldLight,
                start = Offset(left + 8.dp.toPx(), scanLineY),
                end = Offset(left + scanBoxSizePx - 8.dp.toPx(), scanLineY),
                strokeWidth = 3.dp.toPx()
            )
        }

        // Top Navigation Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(top = 12.dp, start = 16.dp, end = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(Color(0x99000000))
                    .testTag("scanner_back_button")
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar", tint = Color.White)
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xCC0F172A))
                    .border(1.dp, VipGold.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = VipGold, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = "LEITOR VIP", color = VipGold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // 1x / 2x Zoom Toggle
                IconButton(
                    onClick = {
                        val cam = camera ?: return@IconButton
                        val zoomState = cam.cameraInfo.zoomState.value
                        val minZoom = zoomState?.minZoomRatio ?: 1.0f
                        val maxZoom = zoomState?.maxZoomRatio ?: 2.0f
                        val next2x = !isZoom2x
                        isZoom2x = next2x
                        val target = if (next2x) 2.0f.coerceIn(minZoom, maxZoom) else minZoom
                        cam.cameraControl.setZoomRatio(target)
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(if (isZoom2x) VipGold else Color(0x99000000))
                        .testTag("scanner_zoom_button")
                ) {
                    Text(
                        text = if (isZoom2x) "2x" else "1x",
                        color = if (isZoom2x) Color.Black else Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 13.sp
                    )
                }

                // Torch Toggle
                IconButton(
                    onClick = {
                        val cam = camera
                        if (cam != null && cam.cameraInfo.hasFlashUnit()) {
                            isTorchOn = !isTorchOn
                            cam.cameraControl.enableTorch(isTorchOn)
                        }
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(if (isTorchOn) VipGold else Color(0x99000000))
                        .testTag("scanner_torch_button")
                ) {
                    Icon(
                        imageVector = if (isTorchOn) Icons.Default.FlashOn else Icons.Default.FlashOff,
                        contentDescription = "Lanterna",
                        tint = if (isTorchOn) Color.Black else Color.White
                    )
                }
            }
        }

        // Camera Init Error or Non-VIP QR Notice
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 104.dp, start = 20.dp, end = 20.dp)
        ) {
            AnimatedVisibility(visible = cameraInitError != null) {
                cameraInitError?.let { err ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = err,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                            Button(
                                onClick = { bindTrigger += 1 },
                                colors = ButtonDefaults.buttonColors(containerColor = VipGold, contentColor = Color.Black),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Tentar Abrir Câmera Novamente", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            AnimatedVisibility(visible = nonVipWarning != null) {
                nonVipWarning?.let { notice ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = VipNavySurface),
                        border = CardDefaults.outlinedCardBorder().copy(brush = SolidColor(VipAmber)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = VipAmber, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = notice, color = Color.White, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Bottom Instructions & Manual Entry Button
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xCC0F172A)),
            shape = RoundedCornerShape(16.dp),
            border = CardDefaults.outlinedCardBorder().copy(
                brush = SolidColor(VipGold.copy(alpha = 0.4f))
            ),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .widthIn(max = 520.dp)
                .navigationBarsPadding()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .heightIn(max = 220.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Aponte a câmera para o QR Code do motorista",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Toque na tela para focar ou use 2x se estiver longe. Ao ler, o código é preenchido automaticamente.",
                    color = VipTextSecondary,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val cam = camera ?: return@OutlinedButton
                            val pv = previewViewRef ?: return@OutlinedButton
                            if (pv.width > 0 && pv.height > 0) {
                                val pt = pv.meteringPointFactory.createPoint(pv.width / 2f, pv.height / 2.4f)
                                val action = FocusMeteringAction.Builder(
                                    pt,
                                    FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
                                ).build()
                                runCatching { cam.cameraControl.startFocusAndMetering(action) }
                            }
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.height(48.dp)
                    ) {
                        Icon(Icons.Default.CenterFocusStrong, contentDescription = "Focar", tint = VipGold, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Focar", fontSize = 12.sp, color = VipGold, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = onBack,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = VipNavySurface,
                            contentColor = VipGold
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                    ) {
                        Text("Digitar Código", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@Composable
private fun CameraPermissionFallback(
    onRequestPermission: () -> Unit,
    onOpenAppSettings: () -> Unit,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(VipNavyBg)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(VipNavyCard)
                .border(2.dp, VipGold, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.PhotoCamera,
                contentDescription = null,
                tint = VipGold,
                modifier = Modifier.size(42.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Permissão da Câmera",
            color = Color.White,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 20.sp,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = "Para ler o QR Code do motorista e registrar seus pontos VIP, autorize o acesso à câmera.",
            color = VipTextSecondary,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(28.dp))

        Button(
            onClick = onRequestPermission,
            colors = ButtonDefaults.buttonColors(containerColor = VipGold, contentColor = Color.Black),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .testTag("request_camera_permission_button")
        ) {
            Icon(Icons.Default.PhotoCamera, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = "Autorizar Câmera", fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedButton(
            onClick = onOpenAppSettings,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            Icon(Icons.Default.Settings, contentDescription = null, tint = VipGold, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = "Abrir Configurações do App", color = VipGold, fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(10.dp))

        Button(
            onClick = onBack,
            colors = ButtonDefaults.buttonColors(containerColor = VipNavySurface, contentColor = Color.White),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Text(text = "Voltar", fontWeight = FontWeight.Medium)
        }
    }
}

private fun vibrateDevice(context: Context) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator?.vibrate(
                VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE)
            )
        } else {
            @Suppress("DEPRECATION")
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            @Suppress("DEPRECATION")
            vibrator?.vibrate(100)
        }
    } catch (_: Exception) {
        // Optional
    }
}
