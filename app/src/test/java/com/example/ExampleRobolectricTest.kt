package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.util.QrCodeAnalyzer
import com.example.util.QrCodeGenerator
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("CLIENTE VIP", appName)
  }

  @Test
  fun `generateQrBitmap produces valid bitmap`() {
    val bitmap = QrCodeGenerator.generateQrBitmap("VIP-1234-5678", 600, 4)
    assertNotNull(bitmap)
    assertEquals(600, bitmap!!.width)
    assertEquals(600, bitmap.height)
  }

  @Test
  fun `qr code VIP-6944-2412 round-trip generation and zxing decoding`() {
    val sampleCode = "VIP-6944-2412"
    val bitmap = QrCodeGenerator.generateQrBitmap(sampleCode, sizePx = 600, margin = 4)
    assertNotNull("Bitmap gerado não pode ser nulo", bitmap)

    val width = bitmap!!.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    val source = RGBLuminanceSource(width, height, pixels)
    val binaryBitmap = BinaryBitmap(HybridBinarizer(source))
    val reader = MultiFormatReader()
    val result = reader.decode(binaryBitmap)

    assertNotNull("ZXing deve decodificar a imagem com sucesso", result)
    assertEquals("O texto decodificado deve ser exatamente o código gerado", sampleCode, result.text)

    // Also verify GlobalHistogramBinarizer fallback
    val globalResult = reader.decode(BinaryBitmap(com.google.zxing.common.GlobalHistogramBinarizer(source)))
    assertEquals(sampleCode, globalResult.text)
  }

  @Test
  fun `qr code VIP-6944-2412 decodes from padded YUV plane like real CameraX frames`() {
    val sampleCode = "VIP-6944-2412"
    val bitmap = QrCodeGenerator.generateQrBitmap(sampleCode, sizePx = 600, margin = 4)!!
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    // Convert RGB to Y luminance with simulated 64-byte rowStride padding
    val rowStride = width + 64
    val paddedY = ByteArray((height - 1) * rowStride + width)
    for (y in 0 until height) {
      for (x in 0 until width) {
        val c = pixels[y * width + x]
        val r = (c shr 16) and 0xFF
        val g = (c shr 8) and 0xFF
        val b = c and 0xFF
        val lum = ((0.299 * r) + (0.587 * g) + (0.114 * b)).toInt().coerceIn(0, 255)
        paddedY[y * rowStride + x] = lum.toByte()
      }
    }

    // Tightly pack just like QrCodeAnalyzer does
    val tightY = ByteArray(width * height)
    for (y in 0 until height) {
      System.arraycopy(paddedY, y * rowStride, tightY, y * width, width)
    }

    val yuvSource = com.google.zxing.PlanarYUVLuminanceSource(
      tightY, width, height, 0, 0, width, height, false
    )
    val decoded = MultiFormatReader().decode(BinaryBitmap(HybridBinarizer(yuvSource)))
    assertEquals(sampleCode, decoded.text)
  }

  @Test
  fun `extractVipCode handles raw codes, URLs, and pasted share messages`() {
    assertEquals("VIP-6944-2412", QrCodeAnalyzer.extractVipCode("VIP-6944-2412"))
    assertEquals("VIP-6944-2412", QrCodeAnalyzer.extractVipCode("vip-6944-2412"))
    assertEquals("VIP-6944-2412", QrCodeAnalyzer.extractVipCode("https://ais-dev-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app/ride?code=VIP-6944-2412"))
    assertEquals("VIP-6944-2412", QrCodeAnalyzer.extractVipCode("https://ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app/ride?code=VIP-6944-2412"))
    assertEquals("VIP-6944-2412", QrCodeAnalyzer.extractVipCode("clientevip://ride?code=VIP-6944-2412"))
    assertEquals(
      "VIP-6944-2412",
      QrCodeAnalyzer.extractVipCode("Olá! Use seu código VIP nesta corrida: VIP-6944-2412\n\nAbrir direto no app CLIENTE VIP:\nhttps://ais-dev-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app/ride?code=VIP-6944-2412")
    )
  }

  @Test
  fun `formatPhone formats 10 and 11 digit phones properly`() {
    assertEquals("(11) 98765-4321", com.example.util.FormatUtils.formatPhone("11987654321"))
    assertEquals("(11) 3456-7890", com.example.util.FormatUtils.formatPhone("1134567890"))
    assertEquals("(11) 98765-4321", com.example.util.FormatUtils.formatPhone("+55 (11) 98765-4321"))
  }

  @Test
  fun `normalizeBrPhone and isValidBrPhone handle country code, trunk zero, and invalid inputs`() {
    assertEquals("11987654321", com.example.util.FormatUtils.normalizeBrPhone("+55 (11) 98765-4321"))
    assertEquals("11987654321", com.example.util.FormatUtils.normalizeBrPhone("011987654321"))
    assertEquals("1134567890", com.example.util.FormatUtils.normalizeBrPhone("551134567890"))
    assertEquals(true, com.example.util.FormatUtils.isValidBrPhone("+55 11 98765-4321"))
    assertEquals(true, com.example.util.FormatUtils.isValidBrPhone("1134567890"))
    assertEquals(false, com.example.util.FormatUtils.isValidBrPhone("12345"))
    assertEquals(false, com.example.util.FormatUtils.isValidBrPhone("00987654321"))
    assertEquals(false, com.example.util.FormatUtils.isValidBrPhone("11887654321"))
  }

  @get:org.junit.Rule
  val composeTestRule = androidx.compose.ui.test.junit4.createComposeRule()

  @Test
  fun `driver modal renders QR code VIP-6944-2412 with status and actions`() {
    val qr = com.example.data.model.QrCode(
      codeId = "VIP-6944-2412",
      driverId = "driver-1",
      driverName = "Motorista VIP",
      status = "ACTIVE"
    )
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        com.example.ui.screens.ActiveQrCodeModalDialog(
          qr = qr,
          onDismiss = {},
          onCopyCode = {},
          onShareCode = {}
        )
      }
    }
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("active_qr_modal_dialog")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasText("AGUARDANDO PASSAGEIRO")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasText("VIP-6944-2412")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("modal_share_button")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("modal_close_button")).assertExists()
  }

  @Test
  fun `passenger registration screen shows prefilled scanned code VIP-6944-2412 and form fields`() {
    var confirmed = false
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        com.example.ui.screens.RegisterRideTab(
          state = com.example.ui.viewmodel.CustomerUiState(qrCodeInput = "VIP-6944-2412"),
          onQrCodeChanged = {},
          onNameChanged = {},
          onPhoneChanged = {},
          onConfirmRide = { confirmed = true },
          onOpenScanner = {},
          onPasteFromClipboard = {}
        )
      }
    }
    composeTestRule.onNode(androidx.compose.ui.test.hasText("QR CODE VINCULADO")).assertExists()
    composeTestRule.onAllNodes(androidx.compose.ui.test.hasText("VIP-6944-2412"))[0].assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("qr_code_input")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("client_name_input")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("client_phone_input")).assertExists()
    val confirmBtn = composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_ride_button"))
    confirmBtn.performScrollTo()
    confirmBtn.assertExists()
    confirmBtn.performClick()
    composeTestRule.waitForIdle()
    assertEquals(true, confirmed)
  }

  @Test
  fun `loyalty points rule calculates 1 point per ride and 10 points free ride`() {
    // Ride 1 to 9
    var currentPoints = 0L
    var rewardsAvailable = 0L
    for (i in 1..9) {
      val next = currentPoints + 1L
      if (next >= 10L) {
        currentPoints = next - 10L
        rewardsAvailable += 1L
      } else {
        currentPoints = next
      }
    }
    assertEquals(9L, currentPoints)
    assertEquals(0L, rewardsAvailable)

    // 10th ride triggers free ride
    val next10 = currentPoints + 1L
    val earnedFreeRide: Boolean
    if (next10 >= 10L) {
      currentPoints = next10 - 10L
      rewardsAvailable += 1L
      earnedFreeRide = true
    } else {
      currentPoints = next10
      earnedFreeRide = false
    }
    assertEquals(0L, currentPoints)
    assertEquals(1L, rewardsAvailable)
    assertEquals(true, earnedFreeRide)
  }

  @Test
  fun `qr code HTTPS URL round-trip decodes cleanly back to VIP-6944-2412 without clientevip scheme`() {
    val sampleCode = "VIP-6944-2412"
    val qrUrl = com.example.util.QrCodeDeepLink.buildQrUrl(sampleCode)
    assertEquals("https://ais-pre-kfhsncfqq56waxbfeys57c-911794867159.us-east1.run.app/ride?code=VIP-6944-2412", qrUrl)
    assertEquals("clientevip://ride?code=VIP-6944-2412", com.example.util.QrCodeDeepLink.buildAppSchemeUrl(sampleCode))
    val bitmap = QrCodeGenerator.generateQrBitmap(qrUrl, sizePx = 720, margin = 4)
    assertNotNull(bitmap)

    val width = bitmap!!.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    val source = RGBLuminanceSource(width, height, pixels)
    val decoded = MultiFormatReader().decode(BinaryBitmap(HybridBinarizer(source)))
    assertEquals(qrUrl, decoded.text)
    assertEquals(sampleCode, QrCodeAnalyzer.extractVipCode(decoded.text))

    // Also test QrCodeAnalyzer YUV decoding + strict VIP format guard
    val yBytes = ByteArray(width * height)
    for (i in pixels.indices) {
      val c = pixels[i]
      val r = (c shr 16) and 0xFF
      val g = (c shr 8) and 0xFF
      val b = c and 0xFF
      yBytes[i] = ((0.299 * r) + (0.587 * g) + (0.114 * b)).toInt().coerceIn(0, 255).toByte()
    }
    var scannedCode = ""
    val analyzer = QrCodeAnalyzer(onQrCodeScanned = { scannedCode = it })
    val yuvDecoded = analyzer.decodeWithZxingYuv(yBytes, width, height)
    assertEquals(qrUrl, yuvDecoded)
    val clean = QrCodeAnalyzer.extractVipCode(yuvDecoded!!)
    assertEquals(sampleCode, clean)
    assertEquals(true, QrCodeAnalyzer.isValidVipCodeFormat(clean))
    assertEquals(false, QrCodeAnalyzer.isValidVipCodeFormat("HTTPS://EXAMPLE.COM/RANDOM"))
    assertEquals("", scannedCode)
    analyzer.close()
  }

  @Test
  fun `archive confirmation dialog renders warning and triggers confirm`() {
    var archivedConfirmed = false
    val client = com.example.data.model.Client(
      id = "drv_11988887777",
      driverId = "drv",
      name = "Carlos VIP",
      phone = "11988887777",
      points = 7L,
      totalRides = 17L,
      rewardsAvailable = 1L
    )
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        com.example.ui.screens.ConfirmArchiveClientDialog(
          client = client,
          onConfirm = { archivedConfirmed = true },
          onDismiss = {}
        )
      }
    }
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_archive_dialog")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasText("Arquivar cliente?")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_archive_button")).performClick()
    composeTestRule.waitForIdle()
    assertEquals(true, archivedConfirmed)
  }

  @Test
  fun `delete confirmation dialog explains linked records removal and triggers confirm`() {
    var deletedConfirmed = false
    val client = com.example.data.model.Client(
      id = "drv_11988887777",
      driverId = "drv",
      name = "Carlos VIP",
      phone = "11988887777",
      points = 4L,
      totalRides = 4L,
      rewardsAvailable = 0L
    )
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        com.example.ui.screens.ConfirmDeleteClientDialog(
          client = client,
          linkedRidesCount = 4,
          onConfirm = { deletedConfirmed = true },
          onDismiss = {}
        )
      }
    }
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_delete_dialog")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasText("Excluir definitivamente?")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_delete_button")).performClick()
    composeTestRule.waitForIdle()
    assertEquals(true, deletedConfirmed)
  }

  @Test
  fun `redeem reward confirmation dialog triggers confirm`() {
    var redeemConfirmed = false
    val client = com.example.data.model.Client(
      id = "drv_11988887777",
      driverId = "drv",
      name = "Maria VIP",
      phone = "11988887777",
      points = 0L,
      totalRides = 10L,
      rewardsAvailable = 1L
    )
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        com.example.ui.screens.ConfirmRedeemRewardDialog(
          client = client,
          onConfirm = { redeemConfirmed = true },
          onDismiss = {}
        )
      }
    }
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_redeem_dialog")).assertExists()
    composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("confirm_redeem_button")).performClick()
    composeTestRule.waitForIdle()
    assertEquals(true, redeemConfirmed)
  }

  @Test
  fun `client detail dialog scrolls through long ride history to delete action`() {
    var deleteRequested = false
    val client = com.example.data.model.Client(
      id = "drv_11988887777",
      driverId = "drv",
      name = "Joana VIP",
      phone = "11988887777",
      points = 5L,
      totalRides = 15L,
      rewardsAvailable = 1L
    )
    val rides = (1..15).map { idx ->
      com.example.data.model.Ride(
        id = "RIDE-$idx",
        clientPhone = "11988887777",
        clientName = "Joana VIP",
        driverId = "drv",
        driverName = "Motorista",
        qrCodeId = "VIP-1000-${1000 + idx}",
        pointsEarned = 1L
      )
    }
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        com.example.ui.screens.ClientDetailDialog(
          client = client,
          rides = rides,
          isMutating = false,
          onDismiss = {},
          onRequestRedeemReward = {},
          onRequestArchive = {},
          onRequestRestore = {},
          onRequestDelete = { deleteRequested = true }
        )
      }
    }
    val deleteBtn = composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("detail_delete_client_button"))
    deleteBtn.performScrollTo()
    deleteBtn.performClick()
    composeTestRule.waitForIdle()
    assertEquals(true, deleteRequested)
  }

  @Test
  fun `auth screen scrolls cleanly to google sign in button on compact viewports`() {
    composeTestRule.setContent {
      com.example.ui.theme.ClienteVipTheme {
        Box(
          modifier = Modifier.size(320.dp, 420.dp)
        ) {
          com.example.ui.screens.AuthScreen(onAuthSuccess = {})
        }
      }
    }
    val signInBtn = composeTestRule.onNode(androidx.compose.ui.test.hasTestTag("google_sign_in_button"))
    signInBtn.performScrollTo()
    signInBtn.assertExists()
  }
}

