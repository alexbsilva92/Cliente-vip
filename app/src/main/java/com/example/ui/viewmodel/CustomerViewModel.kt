package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.Client
import com.example.data.model.QrCode
import com.example.data.repository.ClientVipRepository
import com.example.data.repository.QrCodeVerification
import com.example.data.repository.RideRegistrationResult
import com.example.util.FormatUtils
import com.example.util.QrCodeAnalyzer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CustomerUiState(
    val qrCodeInput: String = "",
    val nameInput: String = "",
    val phoneInput: String = "",
    val isRegistering: Boolean = false,
    val registrationResult: RideRegistrationResult? = null,
    val registrationError: String? = null,
    val consultPhoneInput: String = "",
    val consultedClient: Client? = null,
    val isConsulting: Boolean = false,
    val consultMessage: String? = null,
    val consultError: String? = null,
    // Scanner real-time Firestore verification
    val isVerifyingQrCode: Boolean = false,
    val scannedQrCode: QrCode? = null,
    val qrVerificationStatus: QrCodeVerification? = null,
    val scannerMessage: String? = null,
    val isScannerActive: Boolean = false
)

class CustomerViewModel(
    private val repository: ClientVipRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CustomerUiState())
    val uiState: StateFlow<CustomerUiState> = _uiState.asStateFlow()

    init {
        val (savedName, savedPhone) = repository.getSavedPassengerProfile()
        if (savedName.isNotBlank() || savedPhone.isNotBlank()) {
            _uiState.update {
                it.copy(
                    nameInput = savedName,
                    phoneInput = savedPhone,
                    consultPhoneInput = savedPhone
                )
            }
        }
    }

    fun onQrCodeChanged(code: String) {
        val trimmed = code.trim()
        val candidate = com.example.util.QrCodeAnalyzer.extractVipCode(trimmed)
        val extracted = if (
            trimmed.contains("://") ||
            trimmed.contains("code=", ignoreCase = true) ||
            com.example.util.QrCodeAnalyzer.isValidVipCodeFormat(candidate)
        ) {
            candidate
        } else {
            code.uppercase()
        }
        _uiState.update { it.copy(qrCodeInput = extracted, registrationError = null) }
    }

    fun onQrCodeScannedFromCamera(code: String) {
        val clean = com.example.util.QrCodeAnalyzer.extractVipCode(code)
        _uiState.update {
            it.copy(
                qrCodeInput = clean,
                registrationError = null,
                scannerMessage = "QR Code lido com sucesso!"
            )
        }
        // Silenciosamente verifica se o código já expirou ou foi utilizado para avisar o passageiro na hora
        if (clean.isNotBlank()) {
            viewModelScope.launch {
                repository.checkQrCodeStatus(clean).onSuccess { verification ->
                    if (_uiState.value.qrCodeInput == clean) {
                        when (verification) {
                            is QrCodeVerification.Valid -> {
                                _uiState.update {
                                    it.copy(
                                        scannedQrCode = verification.qrCode,
                                        qrVerificationStatus = verification,
                                        registrationError = null,
                                        scannerMessage = "QR Code válido! Motorista: ${verification.qrCode.driverName}"
                                    )
                                }
                            }
                            is QrCodeVerification.AlreadyUsed -> {
                                _uiState.update {
                                    it.copy(
                                        scannedQrCode = null,
                                        qrVerificationStatus = verification,
                                        registrationError = "Este QR Code já foi utilizado e perdeu a validade (uso único por corrida)."
                                    )
                                }
                            }
                            is QrCodeVerification.Expired -> {
                                _uiState.update {
                                    it.copy(
                                        scannedQrCode = null,
                                        qrVerificationStatus = verification,
                                        registrationError = "Este QR Code expirou (validade máxima de 15 minutos). Solicite um novo código ao motorista."
                                    )
                                }
                            }
                            is QrCodeVerification.NotFound -> {
                                _uiState.update {
                                    it.copy(
                                        scannedQrCode = null,
                                        qrVerificationStatus = verification,
                                        registrationError = "QR Code não encontrado no sistema CLIENTE VIP."
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fun onNameChanged(name: String) {
        _uiState.update { it.copy(nameInput = name, registrationError = null) }
    }

    fun onPhoneChanged(phone: String) {
        val normalized = FormatUtils.normalizeBrPhone(phone)
        _uiState.update { it.copy(phoneInput = phone, registrationError = null) }

        // Reconhece cliente existente automaticamente caso o telefone já esteja cadastrado
        if (FormatUtils.isValidBrPhone(normalized) && _uiState.value.nameInput.isBlank()) {
            viewModelScope.launch {
                repository.getClientByPhone(normalized).onSuccess { client ->
                    if (client != null && _uiState.value.nameInput.isBlank()) {
                        _uiState.update { it.copy(nameInput = client.name) }
                    }
                }
            }
        }
    }

    fun onConsultPhoneChanged(phone: String) {
        _uiState.update { it.copy(consultPhoneInput = phone, consultError = null) }
    }

    /**
     * Called by CameraX scanner to verify single-use validity in Firestore in real time.
     */
    fun verifyScannedQrCode(code: String, onValidDetected: ((QrCode) -> Unit)? = null) {
        val cleanCode = code.trim().uppercase()
        if (cleanCode.isBlank()) return

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isVerifyingQrCode = true,
                    qrCodeInput = cleanCode,
                    qrVerificationStatus = null,
                    scannerMessage = null
                )
            }

            val result = repository.checkQrCodeStatus(cleanCode)
            result.fold(
                onSuccess = { verification ->
                    when (verification) {
                        is QrCodeVerification.Valid -> {
                            _uiState.update {
                                it.copy(
                                    isVerifyingQrCode = false,
                                    scannedQrCode = verification.qrCode,
                                    qrVerificationStatus = verification,
                                    qrCodeInput = cleanCode,
                                    scannerMessage = "QR Code Válido! Motorista: ${verification.qrCode.driverName}"
                                )
                            }
                            onValidDetected?.invoke(verification.qrCode)
                        }
                        is QrCodeVerification.AlreadyUsed -> {
                            _uiState.update {
                                it.copy(
                                    isVerifyingQrCode = false,
                                    scannedQrCode = null,
                                    qrVerificationStatus = verification,
                                    scannerMessage = "Este QR Code já foi utilizado e perdeu a validade (uso único)."
                                )
                            }
                        }
                        is QrCodeVerification.Expired -> {
                            _uiState.update {
                                it.copy(
                                    isVerifyingQrCode = false,
                                    scannedQrCode = null,
                                    qrVerificationStatus = verification,
                                    scannerMessage = "Este QR Code expirou. Peça ao motorista para gerar um novo código."
                                )
                            }
                        }
                        is QrCodeVerification.NotFound -> {
                            _uiState.update {
                                it.copy(
                                    isVerifyingQrCode = false,
                                    scannedQrCode = null,
                                    qrVerificationStatus = verification,
                                    scannerMessage = "QR Code não encontrado no sistema CLIENTE VIP."
                                )
                            }
                        }
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isVerifyingQrCode = false,
                            scannerMessage = "Erro ao verificar QR Code: ${error.localizedMessage}"
                        )
                    }
                }
            )
        }
    }

    fun resetScannerState() {
        _uiState.update {
            it.copy(
                isVerifyingQrCode = false,
                scannedQrCode = null,
                qrVerificationStatus = null,
                scannerMessage = null
            )
        }
    }

    fun confirmRideRegistration() {
        val state = _uiState.value
        if (state.isRegistering) return
        val code = QrCodeAnalyzer.extractVipCode(state.qrCodeInput)
        val name = state.nameInput.trim()
        val normalizedPhone = FormatUtils.normalizeBrPhone(state.phoneInput)

        if (code.isBlank() || !QrCodeAnalyzer.isValidVipCodeFormat(code)) {
            _uiState.update { it.copy(registrationError = "Por favor, informe ou escaneie um QR Code VIP válido (ex: VIP-1234-5678).") }
            return
        }
        if (name.length < 2) {
            _uiState.update { it.copy(registrationError = "Informe seu nome completo.") }
            return
        }
        if (!FormatUtils.isValidBrPhone(state.phoneInput)) {
            _uiState.update { it.copy(registrationError = "Informe um telefone válido com DDD (ex: 11987654321).") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isRegistering = true, registrationError = null) }
            val result = repository.registerRideWithQrCode(code, name, normalizedPhone)
            result.fold(
                onSuccess = { res ->
                    repository.savePassengerProfile(res.clientName, res.clientPhone)
                    val refreshedClient = repository.getClientByPhone(res.clientPhone).getOrNull()
                        ?: Client(
                            id = res.clientPhone,
                            name = res.clientName,
                            phone = res.clientPhone,
                            totalRides = res.totalRides,
                            points = res.currentPoints,
                            rewardsAvailable = res.rewardsAvailable
                        )
                    _uiState.update {
                        it.copy(
                            isRegistering = false,
                            registrationResult = res,
                            consultPhoneInput = res.clientPhone,
                            consultedClient = refreshedClient,
                            qrCodeInput = "", // clear single-use code after successful consumption
                            scannedQrCode = null,
                            qrVerificationStatus = null,
                            scannerMessage = null
                        )
                    }
                },
                onFailure = { error ->
                    val rawMsg = error.cause?.message ?: error.message ?: "Não foi possível registrar a corrida."
                    val wasPreVerifiedValid = _uiState.value.qrVerificationStatus is QrCodeVerification.Valid
                    val friendlyMsg = when {
                        rawMsg.contains("já foi utilizado", ignoreCase = true) ->
                            "Este QR Code já foi utilizado e não é mais válido (uso único por corrida)."
                        rawMsg.contains("expirou", ignoreCase = true) ->
                            "Este QR Code expirou (validade máxima de 15 minutos). Solicite um novo código ao motorista."
                        rawMsg.contains("não encontrado", ignoreCase = true) ->
                            "QR Code não encontrado no sistema. Verifique o código e tente novamente."
                        rawMsg.contains("UNAVAILABLE", ignoreCase = true) ||
                            rawMsg.contains("network", ignoreCase = true) ||
                            rawMsg.contains("Unable to resolve host", ignoreCase = true) ||
                            rawMsg.contains("offline", ignoreCase = true) ->
                            "Sem conexão com a internet no momento. Conecte-se e tente novamente."
                        rawMsg.contains("PERMISSION_DENIED", ignoreCase = true) && wasPreVerifiedValid ->
                            "Não foi possível confirmar com este telefone nesta conta Google. Se este telefone já foi usado anteriormente com outra conta Google, utilize a mesma conta do cadastro."
                        rawMsg.contains("PERMISSION_DENIED", ignoreCase = true) ->
                            "QR Code inválido, expirado ou já utilizado. Solicite um novo QR Code ao motorista."
                        else -> rawMsg.replace("Transaction failed: ", "")
                            .replace("java.lang.IllegalStateException: ", "")
                            .replace("java.lang.IllegalArgumentException: ", "")
                    }
                    _uiState.update {
                        it.copy(
                            isRegistering = false,
                            registrationError = friendlyMsg
                        )
                    }
                }
            )
        }
    }

    fun consultClientPoints(phoneToSearch: String? = null) {
        val phone = FormatUtils.normalizeBrPhone(phoneToSearch ?: _uiState.value.consultPhoneInput)
        if (phone.length < 8) {
            _uiState.update { it.copy(consultError = "Digite um telefone com DDD para consultar (ex: 11987654321).") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isConsulting = true, consultError = null, consultMessage = null) }
            val result = repository.getClientByPhone(phone)
            result.fold(
                onSuccess = { client ->
                    if (client != null) {
                        _uiState.update {
                            it.copy(
                                isConsulting = false,
                                consultedClient = client,
                                nameInput = if (it.nameInput.isBlank()) client.name else it.nameInput,
                                phoneInput = client.phone
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isConsulting = false,
                                consultedClient = null,
                                consultMessage = "Nenhum cadastro encontrado para este número. Registre sua primeira corrida usando um QR Code!"
                            )
                        }
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isConsulting = false,
                            consultError = "Erro ao buscar cliente: ${error.localizedMessage}"
                        )
                    }
                }
            )
        }
    }

    fun dismissRegistrationDialog() {
        _uiState.update { it.copy(registrationResult = null) }
    }
}
