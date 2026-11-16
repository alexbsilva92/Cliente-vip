package com.example.ui.viewmodel

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.Client
import com.example.data.model.QrCode
import com.example.data.model.Reward
import com.example.data.model.Ride
import com.example.data.repository.ClientVipRepository
import com.example.util.FormatUtils
import com.example.util.QrCodeDeepLink
import com.example.util.QrCodeGenerator
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.auth
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ClientSortOrder(val label: String) {
    MOST_POINTS("Mais pontos"),
    MOST_RECENT("Mais recentes"),
    OLDEST_INACTIVE("Inativos há mais tempo"),
    NAME_AZ("Nome (A-Z)")
}

data class DriverUiState(
    val driverName: String = "",
    val driverVehicle: String = "",
    val isDriverProfileConfigured: Boolean = false,
    val activeQrCode: QrCode? = null,
    val activeQrBitmap: Bitmap? = null,
    val isGeneratingQr: Boolean = false,
    val showQrModal: Boolean = false,
    val clients: List<Client> = emptyList(),
    val filteredClients: List<Client> = emptyList(),
    val filteredArchivedClients: List<Client> = emptyList(),
    val activeClientsCount: Int = 0,
    val archivedClientsCount: Int = 0,
    val sortOrder: ClientSortOrder = ClientSortOrder.MOST_POINTS,
    val searchQuery: String = "",
    val filterEligibleRewardsOnly: Boolean = false,
    val selectedClient: Client? = null,
    val rides: List<Ride> = emptyList(),
    val rewards: List<Reward> = emptyList(),
    val ridesVisibleCount: Int = 25,
    val rewardsVisibleCount: Int = 20,
    val isRedeeming: Boolean = false,
    val isMutatingClient: Boolean = false,
    val statusNotification: String? = null,
    val errorMessage: String? = null,
    val isLoading: Boolean = false
)

class DriverViewModel(
    private val repository: ClientVipRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DriverUiState())
    val uiState: StateFlow<DriverUiState> = _uiState.asStateFlow()

    private var qrObservationJob: Job? = null

    init {
        val currentUser = Firebase.auth.currentUser
        val (savedName, savedVehicle) = repository.getSavedDriverProfile()
        val initialName = savedName.ifBlank {
            currentUser?.displayName?.ifBlank { "Motorista VIP" } ?: "Motorista VIP"
        }
        _uiState.update {
            it.copy(
                driverName = initialName,
                driverVehicle = savedVehicle,
                isDriverProfileConfigured = savedName.isNotBlank() || savedVehicle.isNotBlank()
            )
        }

        viewModelScope.launch {
            repository.migrateLegacyClientsForDriver()
        }
        loadClients()
        loadRides()
        loadRewards()
    }

    fun updateDriverProfile(name: String, vehicle: String) {
        val cleanName = name.trim().ifBlank { "Motorista VIP" }
        val cleanVehicle = vehicle.trim()
        repository.saveDriverProfile(cleanName, cleanVehicle)
        _uiState.update {
            it.copy(
                driverName = cleanName,
                driverVehicle = cleanVehicle,
                isDriverProfileConfigured = true,
                statusNotification = "Perfil do motorista atualizado!"
            )
        }
    }

    fun generateQrCode() {
        if (_uiState.value.isGeneratingQr) return
        viewModelScope.launch {
            _uiState.update { it.copy(isGeneratingQr = true, errorMessage = null) }
            val driverName = _uiState.value.driverName.ifBlank { "Motorista VIP" }
            val result = repository.generateQrCode(driverName)
            result.fold(
                onSuccess = { qr ->
                    val qrUrl = QrCodeDeepLink.buildQrUrl(qr.codeId)
                    val bitmap = QrCodeGenerator.generateQrBitmap(qrUrl, sizePx = 680)
                    _uiState.update {
                        it.copy(
                            activeQrCode = qr,
                            activeQrBitmap = bitmap,
                            isGeneratingQr = false,
                            showQrModal = true,
                            statusNotification = "Novo QR Code gerado! Aguardando o cliente escanear."
                        )
                    }
                    startObservingQrCode(qr.codeId)
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isGeneratingQr = false,
                            errorMessage = "Erro ao gerar QR Code: ${err.localizedMessage ?: "Tente novamente"}"
                        )
                    }
                }
            )
        }
    }

    fun dismissQrModal() {
        _uiState.update { it.copy(showQrModal = false) }
    }

    fun openQrModal() {
        _uiState.update { it.copy(showQrModal = true) }
    }

    private fun startObservingQrCode(codeId: String) {
        qrObservationJob?.cancel()
        qrObservationJob = viewModelScope.launch {
            repository.observeQrCode(codeId)
                .catch { /* logged in repository */ }
                .collect { qr ->
                    if (qr != null) {
                        _uiState.update { current ->
                            val wasActive = current.activeQrCode?.status == "ACTIVE"
                            val nowUsed = qr.status == "USED"
                            val notif = if (wasActive && nowUsed) {
                                "Corrida confirmada! +1 ponto adicionado para ${qr.usedByName ?: "Cliente"}."
                            } else current.statusNotification

                            current.copy(
                                activeQrCode = qr,
                                statusNotification = notif
                            )
                        }
                    }
                }
        }
    }

    private fun loadClients() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            repository.observeClients()
                .catch { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Erro ao sincronizar clientes: ${error.localizedMessage ?: "Tente novamente"}"
                        )
                    }
                }
                .collect { list ->
                    _uiState.update { current ->
                        val activeList = filterAndSortClients(
                            clients = list,
                            archived = false,
                            query = current.searchQuery,
                            eligibleOnly = current.filterEligibleRewardsOnly,
                            sortOrder = current.sortOrder
                        )
                        val archivedList = filterAndSortClients(
                            clients = list,
                            archived = true,
                            query = current.searchQuery,
                            eligibleOnly = false,
                            sortOrder = current.sortOrder
                        )
                        val syncedSelection = current.selectedClient?.let { sel ->
                            list.firstOrNull { it.id == sel.id }
                        }
                        current.copy(
                            clients = list,
                            filteredClients = activeList,
                            filteredArchivedClients = archivedList,
                            activeClientsCount = list.count { !it.isArchived },
                            archivedClientsCount = list.count { it.isArchived },
                            selectedClient = syncedSelection,
                            isLoading = false
                        )
                    }
                }
        }
    }

    private fun loadRides() {
        viewModelScope.launch {
            repository.observeRides()
                .catch { /* handled in repo */ }
                .collect { rides ->
                    _uiState.update { it.copy(rides = rides) }
                }
        }
    }

    private fun loadRewards() {
        viewModelScope.launch {
            repository.observeRewards()
                .catch { /* handled in repo */ }
                .collect { rewards ->
                    _uiState.update { it.copy(rewards = rewards) }
                }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _uiState.update { current ->
            current.copy(
                searchQuery = query,
                filteredClients = filterAndSortClients(
                    clients = current.clients,
                    archived = false,
                    query = query,
                    eligibleOnly = current.filterEligibleRewardsOnly,
                    sortOrder = current.sortOrder
                ),
                filteredArchivedClients = filterAndSortClients(
                    clients = current.clients,
                    archived = true,
                    query = query,
                    eligibleOnly = false,
                    sortOrder = current.sortOrder
                )
            )
        }
    }

    fun toggleFilterEligibleOnly(enabled: Boolean) {
        _uiState.update { current ->
            current.copy(
                filterEligibleRewardsOnly = enabled,
                filteredClients = filterAndSortClients(
                    clients = current.clients,
                    archived = false,
                    query = current.searchQuery,
                    eligibleOnly = enabled,
                    sortOrder = current.sortOrder
                )
            )
        }
    }

    fun onSortOrderChanged(order: ClientSortOrder) {
        _uiState.update { current ->
            current.copy(
                sortOrder = order,
                filteredClients = filterAndSortClients(
                    clients = current.clients,
                    archived = false,
                    query = current.searchQuery,
                    eligibleOnly = current.filterEligibleRewardsOnly,
                    sortOrder = order
                ),
                filteredArchivedClients = filterAndSortClients(
                    clients = current.clients,
                    archived = true,
                    query = current.searchQuery,
                    eligibleOnly = false,
                    sortOrder = order
                )
            )
        }
    }

    fun selectClient(client: Client?) {
        _uiState.update { it.copy(selectedClient = client) }
    }

    fun loadMoreRides() {
        _uiState.update { it.copy(ridesVisibleCount = it.ridesVisibleCount + 25) }
    }

    fun loadMoreRewards() {
        _uiState.update { it.copy(rewardsVisibleCount = it.rewardsVisibleCount + 20) }
    }

    fun redeemRewardForClient(client: Client) {
        if (_uiState.value.isRedeeming) return
        viewModelScope.launch {
            _uiState.update { it.copy(isRedeeming = true, errorMessage = null) }
            val result = repository.redeemReward(client)
            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isRedeeming = false,
                            statusNotification = "Recompensa resgatada com sucesso para ${client.name}!"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isRedeeming = false,
                            errorMessage = "Não foi possível resgatar: ${error.localizedMessage ?: "Tente novamente"}"
                        )
                    }
                }
            )
        }
    }

    fun archiveClient(client: Client) {
        if (_uiState.value.isMutatingClient) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMutatingClient = true, errorMessage = null) }
            val result = repository.archiveClient(client)
            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isMutatingClient = false,
                            selectedClient = if (it.selectedClient?.id == client.id) null else it.selectedClient,
                            statusNotification = "Cliente ${client.name} arquivado. Pontos e histórico foram preservados."
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isMutatingClient = false,
                            errorMessage = "Erro ao arquivar cliente: ${error.localizedMessage ?: "Tente novamente"}"
                        )
                    }
                }
            )
        }
    }

    fun restoreClient(client: Client) {
        if (_uiState.value.isMutatingClient) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMutatingClient = true, errorMessage = null) }
            val result = repository.restoreClient(client)
            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isMutatingClient = false,
                            selectedClient = if (it.selectedClient?.id == client.id) null else it.selectedClient,
                            statusNotification = "Cliente ${client.name} restaurado para a lista de clientes ativos!"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isMutatingClient = false,
                            errorMessage = "Erro ao restaurar cliente: ${error.localizedMessage ?: "Tente novamente"}"
                        )
                    }
                }
            )
        }
    }

    fun deleteClientPermanently(client: Client) {
        if (_uiState.value.isMutatingClient) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMutatingClient = true, errorMessage = null) }
            val result = repository.deleteClientPermanently(client)
            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isMutatingClient = false,
                            selectedClient = if (it.selectedClient?.id == client.id) null else it.selectedClient,
                            statusNotification = "Cliente ${client.name} e seus registros vinculados foram excluídos definitivamente."
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isMutatingClient = false,
                            errorMessage = "Erro ao excluir cliente: ${error.localizedMessage ?: "Tente novamente"}"
                        )
                    }
                }
            )
        }
    }

    fun clearNotification() {
        _uiState.update { it.copy(statusNotification = null, errorMessage = null) }
    }

    private fun filterAndSortClients(
        clients: List<Client>,
        archived: Boolean,
        query: String,
        eligibleOnly: Boolean,
        sortOrder: ClientSortOrder
    ): List<Client> {
        val q = query.trim().lowercase()
        val qDigits = q.filter { it.isDigit() }
        val qNormalized = FormatUtils.normalizeBrPhone(qDigits)
        val filtered = clients.filter { client ->
            val matchesArchived = client.isArchived == archived
            val clientDigits = client.phone.filter { it.isDigit() }
            val clientNormalized = FormatUtils.normalizeBrPhone(clientDigits)
            val matchesQuery = q.isEmpty() ||
                    client.name.lowercase().contains(q) ||
                    client.phone.contains(q) ||
                    (qDigits.isNotEmpty() && (
                        clientDigits.contains(qDigits) ||
                        clientNormalized.contains(qDigits) ||
                        (qNormalized.isNotEmpty() && clientNormalized.contains(qNormalized))
                    ))
            val matchesEligible = !eligibleOnly || (client.rewardsAvailable > 0 || client.points >= 10)
            matchesArchived && matchesQuery && matchesEligible
        }

        return when (sortOrder) {
            ClientSortOrder.MOST_POINTS -> filtered.sortedWith(
                compareByDescending<Client> { it.rewardsAvailable }
                    .thenByDescending { it.points }
                    .thenByDescending { it.updatedAt ?: Timestamp(0, 0) }
            )
            ClientSortOrder.MOST_RECENT -> filtered.sortedByDescending {
                it.updatedAt ?: it.createdAt ?: Timestamp(0, 0)
            }
            ClientSortOrder.OLDEST_INACTIVE -> filtered.sortedBy {
                it.updatedAt ?: it.createdAt ?: Timestamp(0, 0)
            }
            ClientSortOrder.NAME_AZ -> filtered.sortedBy { it.name.lowercase() }
        }
    }
}
