package com.example.util

import android.util.Log
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.LuminanceSource
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.GlobalHistogramBinarizer
import com.google.zxing.common.HybridBinarizer
import java.util.concurrent.atomic.AtomicBoolean

class QrCodeAnalyzer(
    private val onQrCodeScanned: (String) -> Unit,
    private val onInvalidQrIgnored: ((String) -> Unit)?
) : ImageAnalysis.Analyzer {

    constructor(onQrCodeScanned: (String) -> Unit) : this(onQrCodeScanned, null)

    private val isScanning = AtomicBoolean(true)

    private val reader = MultiFormatReader().apply {
        setHints(
            mapOf(
                DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE),
                DecodeHintType.TRY_HARDER to true,
                DecodeHintType.ALSO_INVERTED to true,
                DecodeHintType.CHARACTER_SET to "UTF-8"
            )
        )
    }

    private val mlKitScanner: BarcodeScanner? by lazy {
        runCatching {
            val options = BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
            BarcodeScanning.getClient(options)
        }.onFailure { err ->
            Log.w(TAG, "ML Kit BarcodeScanner indisponível; usando fallback ZXing: ${err.message}")
        }.getOrNull()
    }

    fun pause() {
        isScanning.set(false)
    }

    fun resume() {
        isScanning.set(true)
    }

    fun close() {
        isScanning.set(false)
        runCatching { mlKitScanner?.close() }
    }

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imageProxy: ImageProxy) {
        if (!isScanning.get()) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val width = imageProxy.width
        val height = imageProxy.height
        val yBytes = extractTightYPlane(imageProxy)
        val scanner = mlKitScanner

        if (scanner != null) {
            try {
                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                scanner.process(inputImage)
                    .addOnSuccessListener { barcodes ->
                        if (!isScanning.get()) return@addOnSuccessListener

                        var emitted = false
                        for (barcode in barcodes) {
                            val raw = barcode.rawValue ?: barcode.displayValue
                            if (!raw.isNullOrBlank()) {
                                val cleanCode = extractVipCode(raw)
                                if (isValidVipCodeFormat(cleanCode)) {
                                    if (isScanning.compareAndSet(true, false)) {
                                        onQrCodeScanned(cleanCode)
                                        emitted = true
                                        break
                                    }
                                } else {
                                    onInvalidQrIgnored?.invoke(raw)
                                }
                            }
                        }

                        if (!emitted && isScanning.get() && yBytes != null) {
                            decodeWithZxingYuv(yBytes, width, height)?.let { raw ->
                                handleDecodedText(raw)
                            }
                        }
                    }
                    .addOnFailureListener {
                        if (isScanning.get() && yBytes != null) {
                            decodeWithZxingYuv(yBytes, width, height)?.let { raw ->
                                handleDecodedText(raw)
                            }
                        }
                    }
                    .addOnCompleteListener {
                        imageProxy.close()
                    }
                return
            } catch (_: Exception) {
                // Fall back to synchronous ZXing below and close imageProxy
            }
        }

        try {
            if (isScanning.get() && yBytes != null) {
                decodeWithZxingYuv(yBytes, width, height)?.let { raw ->
                    handleDecodedText(raw)
                }
            }
        } finally {
            imageProxy.close()
        }
    }

    private fun handleDecodedText(decodedText: String) {
        val cleanCode = extractVipCode(decodedText)
        if (isValidVipCodeFormat(cleanCode)) {
            if (isScanning.compareAndSet(true, false)) {
                onQrCodeScanned(cleanCode)
            }
        } else {
            onInvalidQrIgnored?.invoke(decodedText)
        }
    }

    private fun extractTightYPlane(imageProxy: ImageProxy): ByteArray? {
        return try {
            val planes = imageProxy.planes
            if (planes.isEmpty()) return null

            val yPlane = planes[0]
            val yBuffer = yPlane.buffer
            val rowStride = yPlane.rowStride
            val pixelStride = yPlane.pixelStride
            val width = imageProxy.width
            val height = imageProxy.height

            val dup = yBuffer.duplicate()
            dup.rewind()
            val yBytes = ByteArray(width * height)
            if (rowStride == width && pixelStride == 1 && dup.remaining() >= width * height) {
                dup.get(yBytes, 0, width * height)
            } else {
                val rowBuffer = ByteArray(rowStride)
                for (row in 0 until height) {
                    val bytesAvailable = dup.remaining()
                    if (bytesAvailable <= 0) break
                    val toRead = minOf(rowStride, bytesAvailable)
                    dup.get(rowBuffer, 0, toRead)
                    val dstOffset = row * width
                    if (pixelStride == 1) {
                        val copyLen = minOf(width, toRead)
                        System.arraycopy(rowBuffer, 0, yBytes, dstOffset, copyLen)
                    } else {
                        for (col in 0 until width) {
                            val srcIdx = col * pixelStride
                            if (srcIdx < toRead) {
                                yBytes[dstOffset + col] = rowBuffer[srcIdx]
                            }
                        }
                    }
                }
            }
            yBytes
        } catch (_: Exception) {
            null
        }
    }

    internal fun decodeWithZxingYuv(yBytes: ByteArray, width: Int, height: Int): String? {
        if (width <= 0 || height <= 0 || yBytes.size < width * height) return null
        return try {
            val fullSource = PlanarYUVLuminanceSource(
                yBytes,
                width,
                height,
                0,
                0,
                width,
                height,
                false
            )

            // 1. HybridBinarizer on full frame
            tryDecode(fullSource, useHybrid = true)
                // 2. GlobalHistogramBinarizer on full frame (handles phone screen glare/contrast variance)
                ?: tryDecode(fullSource, useHybrid = false)
                // 3. Center 65% reticle crop (removes surrounding cabin background noise)
                ?: run {
                    val cropW = (width * 65) / 100
                    val cropH = (height * 65) / 100
                    val cropLeft = (width - cropW) / 2
                    val cropTop = (height - cropH) / 2
                    if (fullSource.isCropSupported && cropW > 120 && cropH > 120) {
                        val cropped = fullSource.crop(cropLeft, cropTop, cropW, cropH)
                        tryDecode(cropped, useHybrid = true) ?: tryDecode(cropped, useHybrid = false)
                    } else {
                        null
                    }
                }
                // 4. Inverted luminance pass (handles glare / dark-mode reflection inversions)
                ?: tryDecode(fullSource.invert(), useHybrid = true)
        } catch (_: Exception) {
            reader.reset()
            null
        }
    }

    private fun tryDecode(source: LuminanceSource, useHybrid: Boolean): String? {
        return try {
            val binarizer = if (useHybrid) HybridBinarizer(source) else GlobalHistogramBinarizer(source)
            val result = reader.decodeWithState(BinaryBitmap(binarizer))
            result.text?.trim()
        } catch (_: Exception) {
            null
        } finally {
            reader.reset()
        }
    }

    companion object {
        private const val TAG = "QrCodeAnalyzer"
        private val VIP_CODE_REGEX = Regex("VIP-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}", RegexOption.IGNORE_CASE)

        fun isValidVipCodeFormat(text: String): Boolean {
            return VIP_CODE_REGEX.matches(text.trim())
        }

        /**
         * Extracts the alphanumeric code (e.g. VIP-6944-2412) from whatever
         * format was scanned (raw code, clientevip:// deep link, HTTPS URL, or shared text).
         */
        fun extractVipCode(rawText: String): String {
            val decoded = try {
                java.net.URLDecoder.decode(rawText.trim(), "UTF-8")
            } catch (_: Exception) {
                rawText.trim()
            }

            // 1. Look for standard pattern VIP-XXXX-XXXX anywhere in text/URL
            val match = VIP_CODE_REGEX.find(decoded)
            if (match != null) {
                return match.value.uppercase()
            }

            // 2. Look for code= URL query parameter
            if (decoded.contains("code=", ignoreCase = true)) {
                val idx = decoded.indexOf("code=", ignoreCase = true)
                val param = decoded.substring(idx + 5)
                    .substringBefore("&")
                    .substringBefore("#")
                    .trim()
                if (param.isNotBlank()) {
                    return param.uppercase()
                }
            }

            // 3. Look for /r/<CODE> path segment
            if (decoded.contains("/r/", ignoreCase = true)) {
                val idx = decoded.indexOf("/r/", ignoreCase = true)
                val seg = decoded.substring(idx + 3)
                    .substringBefore("?")
                    .substringBefore("#")
                    .substringBefore("/")
                    .trim()
                if (seg.isNotBlank()) {
                    return seg.uppercase()
                }
            }

            // 4. Fallback to clean trimmed string
            return decoded.uppercase()
        }
    }
}
