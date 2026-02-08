// State management
const state = {
    slips: [],
    filteredSlips: [],
    sortedSlips: [],
    paginatedSlips: [],
    loading: true,
    error: null,
    selectedSlip: null,
    removingSlipId: null,
    placedCount: 0,
    ignoredCount: 0,
    currency: 'EUR',
    
    // UI state
    searchTerm: '',
    debouncedSearchTerm: '',
    riskFilter: 'all',
    sortBy: 'confidence',
    page: 1,
    itemsPerPage: 10,
    totalBankroll: '',
    overrideStakes: {},
    
    // Risk configuration
    RISK_CONFIG: {
        LOW: {
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            label: 'Low Risk'
        },
        MEDIUM: {
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            label: 'Medium Risk'
        },
        HIGH: {
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            label: 'High Risk'
        },
        UNKNOWN: {
            color: '#718096',
            bgColor: 'rgba(113, 128, 150, 0.15)',
            borderColor: 'rgba(113, 128, 150, 0.3)',
            label: 'Unknown Risk'
        }
    }
};

// DOM Elements
const elements = {
    // Stats
    placedCount: document.querySelector('.stat-value.success'),
    ignoredCount: document.querySelector('.stat-value.muted'),
    remainingCount: document.querySelector('.stat-value.primary'),
    totalProgress: document.querySelector('.stat-value:not(.primary):not(.success):not(.muted)'),
    progressLabel: document.querySelector('.progress-label span'),
    
    // Risk distribution
    riskLowCount: document.querySelector('.risk-dot-item[data-risk="low"] .risk-count'),
    riskMediumCount: document.querySelector('.risk-dot-item[data-risk="medium"] .risk-count'),
    riskHighCount: document.querySelector('.risk-dot-item[data-risk="high"] .risk-count'),
    
    // Progress bars
    placedProgress: document.querySelector('.placed-progress'),
    ignoredProgress: document.querySelector('.ignored-progress'),
    
    // Filters
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    searchHelper: document.getElementById('search-helper'),
    sortSelect: document.getElementById('sort-select'),
    pageSizeSelect: document.getElementById('page-size-select'),
    riskToggleGroup: document.getElementById('risk-toggle-group'),
    riskCount: document.getElementById('risk-count'),
    bankrollInput: document.getElementById('bankroll-input'),
    bankrollHelper: document.getElementById('bankroll-helper'),
    
    // Buttons
    clearAllFiltersBtn: document.getElementById('clear-all-filters'),
    distributeStakeBtn: document.getElementById('distribute-stake-btn'),
    clearOverridesBtn: document.getElementById('clear-overrides-btn'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),
    
    // States
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    noResultsState: document.getElementById('no-results-state'),
    tableContainer: document.getElementById('table-container'),
    tableBody: document.getElementById('table-body'),
    paginationContainer: document.getElementById('pagination-container'),
    pagination: document.getElementById('pagination'),
    
    // Pagination info
    showingStart: document.getElementById('showing-start'),
    showingEnd: document.getElementById('showing-end'),
    totalFiltered: document.getElementById('total-filtered'),
    filteredInfo: document.getElementById('filtered-info'),
    totalAll: document.getElementById('total-all'),
    
    // Modal
    modal: document.getElementById('modal'),
    modalSlipId: document.getElementById('modal-slip-id'),
    modalRiskChip: document.getElementById('modal-risk-chip'),
    modalConfidenceChip: document.getElementById('modal-confidence-chip'),
    modalLegsCount: document.getElementById('modal-legs-count'),
    modalLegsBody: document.getElementById('modal-legs-body'),
    modalStake: document.getElementById('modal-stake'),
    modalOdds: document.getElementById('modal-odds'),
    modalReturn: document.getElementById('modal-return'),
    modalPlaceBtn: document.getElementById('modal-place-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    closeModalBtn: document.getElementById('close-modal'),
    
    // Tooltip
    tooltip: document.getElementById('tooltip')
};

// Utility Functions
function formatCurrency(value, currency = 'EUR') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function normalizeRisk(risk) {
    if (!risk || risk.trim() === '') return 'UNKNOWN';
    
    const upperRisk = risk.toUpperCase();
    if (upperRisk in state.RISK_CONFIG) {
        return upperRisk;
    }
    
    if (upperRisk.includes('LOW')) return 'LOW';
    if (upperRisk.includes('MEDIUM') || upperRisk.includes('MODERATE')) return 'MEDIUM';
    if (upperRisk.includes('HIGH')) return 'HIGH';
    
    return 'UNKNOWN';
}

function getRiskConfig(risk) {
    const normalized = normalizeRisk(risk);
    return state.RISK_CONFIG[normalized];
}

function normalizeConfidence(slip) {
    const confidence = parseFloat(slip.confidence_score);
    return isNaN(confidence) ? 0 : Math.min(Math.max(confidence, 0), 1);
}

function calculateReturn(slip, stake) {
    const effectiveStake = stake !== undefined ? stake : slip.stake;
    return slip.estimated_return > 0 ? slip.estimated_return : effectiveStake * slip.total_odds;
}

// Data Processing Functions
function filterSlips() {
    if (!Array.isArray(state.slips)) return [];
    
    let result = state.slips;

    // Apply risk filter
    if (state.riskFilter !== 'all') {
        const targetRisk = state.riskFilter.toUpperCase();
        result = result.filter(
            slip => normalizeRisk(slip.risk_category) === targetRisk
        );
    }

    // Apply search filter
    if (state.debouncedSearchTerm.trim()) {
        const term = state.debouncedSearchTerm.toLowerCase();
        result = result.filter(
            slip =>
                slip.slip_id.toLowerCase().includes(term) ||
                slip.legs.some(
                    leg =>
                        leg.home_team.toLowerCase().includes(term) ||
                        leg.away_team.toLowerCase().includes(term)
                )
        );
    }

    return result;
}

function sortSlips() {
    const sorted = [...state.filteredSlips];

    switch (state.sortBy) {
        case 'confidence':
            sorted.sort((a, b) => normalizeConfidence(b) - normalizeConfidence(a));
            break;
        case 'odds':
            sorted.sort((a, b) => b.total_odds - a.total_odds);
            break;
        case 'stake':
            sorted.sort((a, b) => {
                const stakeA = state.overrideStakes[a.slip_id] ?? a.stake;
                const stakeB = state.overrideStakes[b.slip_id] ?? b.stake;
                return stakeB - stakeA;
            });
            break;
        case 'risk':
            const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, UNKNOWN: 3 };
            sorted.sort((a, b) => {
                return riskOrder[normalizeRisk(a.risk_category)] - riskOrder[normalizeRisk(b.risk_category)];
            });
            break;
        case 'return':
            sorted.sort((a, b) => {
                const returnA = calculateReturn(a, state.overrideStakes[a.slip_id]);
                const returnB = calculateReturn(b, state.overrideStakes[b.slip_id]);
                return returnB - returnA;
            });
            break;
        default:
            break;
    }

    return sorted;
}

function paginateSlips() {
    const startIndex = (state.page - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    return state.sortedSlips.slice(startIndex, endIndex);
}

function calculateRiskDistribution() {
    const distribution = { all: state.slips.length };
    state.slips.forEach(slip => {
        const risk = normalizeRisk(slip.risk_category);
        distribution[risk] = (distribution[risk] || 0) + 1;
    });
    return distribution;
}

// API Functions
async function getSlipPlacement(masterSlipId) {
    return await axios.get(
        `https://public-slip-api-1.onrender.com/api/placement-slips/${masterSlipId}`
    );
}

async function fetchSlips() {
    const urlParams = new URLSearchParams(window.location.search);
    const masterSlipId = urlParams.get('masterSlipId');
    
    if (!masterSlipId) {
        throw new Error('No master slip ID provided');
    }

    try {
        setLoading(true);
        setError(null);

        const response = await getSlipPlacement(masterSlipId);

        if (response.data.master_slip_id == null || !response.data.master_slip_id) {
            throw new Error(`Failed to fetch slips: ${response.statusText}`);
        }

        const payload = response.data;

        if (!payload.slips || !Array.isArray(payload.slips)) {
            throw new Error('Invalid payload structure');
        }

        state.slips = payload.slips;
        processAndRender();

    } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        state.slips = [];
        renderError();
    } finally {
        setLoading(false);
    }
}

// State Setters
function setLoading(isLoading) {
    state.loading = isLoading;
    if (isLoading) {
        elements.loadingState.style.display = 'flex';
        elements.errorState.style.display = 'none';
        elements.noResultsState.style.display = 'none';
        elements.tableContainer.style.display = 'none';
        elements.paginationContainer.style.display = 'none';
    } else {
        elements.loadingState.style.display = 'none';
    }
}

function setError(errorMsg) {
    state.error = errorMsg;
}

function setSearchTerm(term) {
    state.searchTerm = term;
    elements.searchInput.value = term;
    elements.clearSearchBtn.style.display = term ? 'block' : 'none';
    
    // Debounce
    clearTimeout(state.debounceTimeout);
    state.debounceTimeout = setTimeout(() => {
        state.debouncedSearchTerm = term;
        state.page = 1;
        processAndRender();
    }, 300);
}

function setRiskFilter(filter) {
    state.riskFilter = filter;
    state.page = 1;
    
    // Update toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        if (btn.dataset.value === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update helper text
    if (filter === 'all') {
        elements.bankrollHelper.textContent = 'Select a specific risk filter first';
    } else {
        const count = state.filteredSlips.length;
        elements.bankrollHelper.textContent = `Will distribute across ${count} slip${count !== 1 ? 's' : ''}`;
    }
    
    processAndRender();
}

function setSortBy(sortBy) {
    state.sortBy = sortBy;
    elements.sortSelect.value = sortBy;
    processAndRender();
}

function setPage(page) {
    state.page = page;
    processAndRender();
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setItemsPerPage(count) {
    state.itemsPerPage = parseInt(count);
    state.page = 1;
    elements.pageSizeSelect.value = count;
    processAndRender();
}

function setTotalBankroll(value) {
    state.totalBankroll = value;
    elements.bankrollInput.value = value;
    
    // Update button state
    const canRedistribute = Number(value) > 0 && state.filteredSlips.length > 0;
    elements.distributeStakeBtn.disabled = !canRedistribute;
}

// Render Functions
function renderStats() {
    const remainingCount = state.slips.length;
    const totalSlips = state.placedCount + state.ignoredCount + remainingCount;
    const processedCount = state.placedCount + state.ignoredCount;
    const placementProgress = totalSlips > 0 ? Math.min((processedCount / totalSlips) * 100, 100) : 0;
    const placedProgress = totalSlips > 0 ? Math.min((state.placedCount / totalSlips) * 100, 100) : 0;
    
    // Update counts
    elements.placedCount.textContent = state.placedCount;
    elements.ignoredCount.textContent = state.ignoredCount;
    elements.remainingCount.textContent = remainingCount;
    elements.totalProgress.textContent = `${Math.round(placementProgress)}%`;
    
    // Update progress bars
    elements.placedProgress.style.width = `${placedProgress}%`;
    elements.ignoredProgress.style.width = `${placementProgress - placedProgress}%`;
    elements.ignoredProgress.style.left = `${placedProgress}%`;
    
    // Update progress label
    elements.progressLabel.textContent = 
        `${state.placedCount} placed • ${state.ignoredCount} ignored • ${remainingCount} remaining`;
    
    // Update risk distribution
    const distribution = calculateRiskDistribution();
    elements.riskLowCount.textContent = distribution.LOW || 0;
    elements.riskMediumCount.textContent = distribution.MEDIUM || 0;
    elements.riskHighCount.textContent = distribution.HIGH || 0;
    
    // Update toggle button counts
    document.querySelector('.risk-total').textContent = state.slips.length;
    document.querySelector('.risk-low-count').textContent = distribution.LOW || 0;
    document.querySelector('.risk-medium-count').textContent = distribution.MEDIUM || 0;
    document.querySelector('.risk-high-count').textContent = distribution.HIGH || 0;
    
    // Update risk count text
    if (state.riskFilter === 'all') {
        elements.riskCount.textContent = `(All risks)`;
    } else {
        const count = distribution[state.riskFilter.toUpperCase()] || 0;
        elements.riskCount.textContent = `(${count} slips)`;
    }
}

function renderTable() {
    elements.tableBody.innerHTML = '';
    
    state.paginatedSlips.forEach((slip, index) => {
        const globalIndex = state.slips.findIndex(s => s.slip_id === slip.slip_id);
        const rank = globalIndex + 1;
        const isRemoving = state.removingSlipId === slip.slip_id;
        
        const confidencePct = Math.round(normalizeConfidence(slip) * 100);
        const riskConfig = getRiskConfig(slip.risk_category);
        
        const displayedStake = state.overrideStakes[slip.slip_id] !== undefined
            ? state.overrideStakes[slip.slip_id]
            : slip.stake;
            
        const displayedEstimatedReturn = state.overrideStakes[slip.slip_id] !== undefined
            ? Number((displayedStake * slip.total_odds).toFixed(2))
            : slip.estimated_return;
        
        // Determine rank color
        let rankClass = 'rank-16-plus';
        if (rank <= 5) rankClass = 'rank-1-5';
        else if (rank <= 15) rankClass = 'rank-6-15';
        
        // Determine confidence color
        let confidenceIconClass = 'confidence-low';
        let confidenceValueClass = 'confidence-low';
        if (confidencePct >= 80) {
            confidenceIconClass = 'confidence-high';
            confidenceValueClass = 'confidence-high';
        } else if (confidencePct >= 60) {
            confidenceIconClass = 'confidence-medium';
            confidenceValueClass = 'confidence-medium';
        }
        
        const row = document.createElement('tr');
        if (isRemoving) {
            row.classList.add('slide-out');
        }
        
        row.innerHTML = `
            <td>
                <div class="rank-cell ${rankClass}">#${rank}</div>
            </td>
            <td>
                <div class="slip-id-cell" data-tooltip="${slip.slip_id}">${slip.slip_id}</div>
            </td>
            <td>
                <span class="chip risk-chip ${slip.risk_category.toLowerCase()}" data-tooltip="${riskConfig.label}">
                    ${slip.risk_category}
                </span>
            </td>
            <td>
                <div class="confidence-cell">
                    <i class="fas fa-chart-line confidence-icon ${confidenceIconClass}"></i>
                    <div class="confidence-value ${confidenceValueClass}" data-tooltip="Confidence score: ${normalizeConfidence(slip).toFixed(2)}">
                        ${confidencePct}%
                    </div>
                </div>
            </td>
            <td>
                <div class="matches-chip" data-tooltip="${slip.legs.length} matches">
                    <i class="fas fa-futbol matches-icon"></i>
                    ${slip.legs.length}
                </div>
            </td>
            <td>
                <div class="stake-cell">${formatCurrency(displayedStake, state.currency)}</div>
                ${state.overrideStakes[slip.slip_id] !== undefined ? 
                    '<div class="override-note">Override applied</div>' : ''}
            </td>
            <td>
                <div class="return-cell">${formatCurrency(displayedEstimatedReturn, state.currency)}</div>
                <div class="odds-note">${slip.total_odds.toFixed(2)}x odds</div>
            </td>
            <td>
                <div class="actions-group">
                    <button class="icon-btn view" data-action="view" data-slip-id="${slip.slip_id}" 
                            ${isRemoving || state.selectedSlip ? 'disabled' : ''}>
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="icon-btn place" data-action="place" data-slip-id="${slip.slip_id}" 
                            ${isRemoving || state.selectedSlip ? 'disabled' : ''}>
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="icon-btn ignore" data-action="ignore" data-slip-id="${slip.slip_id}" 
                            ${isRemoving || state.selectedSlip ? 'disabled' : ''}>
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            </td>
        `;
        
        elements.tableBody.appendChild(row);
    });
}

function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.filteredSlips.length / state.itemsPerPage));
    
    // Update showing info
    const start = (state.page - 1) * state.itemsPerPage + 1;
    const end = Math.min(state.page * state.itemsPerPage, state.filteredSlips.length);
    
    elements.showingStart.textContent = start;
    elements.showingEnd.textContent = end;
    elements.totalFiltered.textContent = state.filteredSlips.length;
    
    if (state.filteredSlips.length !== state.slips.length) {
        elements.filteredInfo.style.display = 'inline';
        elements.totalAll.textContent = state.slips.length;
    } else {
        elements.filteredInfo.style.display = 'none';
    }
    
    // Render pagination buttons
    elements.pagination.innerHTML = '';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = state.page === 1;
    prevBtn.addEventListener('click', () => {
        if (state.page > 1) {
            setPage(state.page - 1);
        }
    });
    elements.pagination.appendChild(prevBtn);
    
    // Page buttons
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === state.page ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => setPage(i));
        elements.pagination.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = state.page === totalPages;
    nextBtn.addEventListener('click', () => {
        if (state.page < totalPages) {
            setPage(state.page + 1);
        }
    });
    elements.pagination.appendChild(nextBtn);
    
    // Show/hide pagination
    elements.paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
}

function renderClearFiltersButton() {
    const isDisabled = !state.searchTerm && state.riskFilter === 'all' && 
                      state.sortBy === 'confidence' && !state.totalBankroll;
    elements.clearAllFiltersBtn.disabled = isDisabled;
    elements.clearFiltersBtn.disabled = isDisabled;
}

function renderOverridesButton() {
    const hasOverrides = Object.keys(state.overrideStakes).length > 0;
    elements.clearOverridesBtn.style.display = hasOverrides ? 'block' : 'none';
}

function renderModal() {
    if (!state.selectedSlip) return;
    
    const slip = state.selectedSlip;
    const riskConfig = getRiskConfig(slip.risk_category);
    const confidencePct = Math.round(normalizeConfidence(slip) * 100);
    
    elements.modalSlipId.textContent = slip.slip_id;
    elements.modalRiskChip.textContent = slip.risk_category;
    elements.modalRiskChip.className = `chip risk-chip ${slip.risk_category.toLowerCase()}`;
    elements.modalConfidenceChip.textContent = `${confidencePct}% Confidence`;
    elements.modalLegsCount.textContent = slip.legs.length;
    
    // Render legs
    elements.modalLegsBody.innerHTML = '';
    slip.legs.forEach((leg, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight: 600;">${leg.home_team} vs ${leg.away_team}</div>
            </td>
            <td>${leg.market}</td>
            <td>
                <span class="selection-chip">${leg.selection}</span>
            </td>
            <td>
                <div style="font-weight: 700;">${leg.odds.toFixed(2)}</div>
            </td>
        `;
        elements.modalLegsBody.appendChild(row);
    });
    
    // Update summary
    const displayedStake = state.overrideStakes[slip.slip_id] ?? slip.stake;
    elements.modalStake.textContent = formatCurrency(displayedStake, state.currency);
    elements.modalOdds.textContent = slip.total_odds.toFixed(2);
    
    const displayedReturn = state.overrideStakes[slip.slip_id]
        ? state.overrideStakes[slip.slip_id] * slip.total_odds
        : slip.estimated_return;
    elements.modalReturn.textContent = formatCurrency(displayedReturn, state.currency);
    
    // Update modal place button
    elements.modalPlaceBtn.dataset.slipId = slip.slip_id;
    
    // Show modal
    elements.modal.style.display = 'flex';
}

function renderError() {
    if (state.error) {
        elements.errorMessage.textContent = state.error;
        elements.errorState.style.display = 'block';
        elements.tableContainer.style.display = 'none';
        elements.paginationContainer.style.display = 'none';
        elements.noResultsState.style.display = 'none';
    }
}

function renderNoResults() {
    if (!state.loading && !state.error && state.filteredSlips.length === 0) {
        elements.noResultsState.style.display = 'block';
        elements.tableContainer.style.display = 'none';
        elements.paginationContainer.style.display = 'none';
    } else {
        elements.noResultsState.style.display = 'none';
    }
}

function processAndRender() {
    // Process data
    state.filteredSlips = filterSlips();
    state.sortedSlips = sortSlips();
    state.paginatedSlips = paginateSlips();
    
    // Render UI
    renderStats();
    
    if (!state.loading && !state.error) {
        if (state.filteredSlips.length > 0) {
            renderTable();
            renderPagination();
            elements.tableContainer.style.display = 'block';
            elements.paginationContainer.style.display = 'flex';
        } else {
            renderNoResults();
        }
    }
    
    renderClearFiltersButton();
    renderOverridesButton();
}

// Event Handlers
function handleDistributeStake() {
    if (state.riskFilter === 'all' || !state.totalBankroll) return;
    
    const bankroll = Number(state.totalBankroll);
    if (isNaN(bankroll) || bankroll <= 0) return;
    
    if (state.filteredSlips.length === 0) return;
    
    const weights = state.filteredSlips.map(s => s.total_odds > 0 ? 1 / s.total_odds : 0);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const useEqual = weightSum === 0;
    
    const allocated = [];
    for (let i = 0; i < state.filteredSlips.length; i++) {
        const w = useEqual ? 1 : weights[i];
        const normalized = useEqual ? 1 / state.filteredSlips.length : w / weightSum;
        const rawStake = bankroll * normalized;
        const rounded = Math.round(rawStake * 100) / 100;
        allocated.push(rounded);
    }
    
    const sumAllocated = allocated.reduce((a, b) => a + b, 0);
    let residual = Math.round((bankroll - sumAllocated) * 100) / 100;
    
    if (Math.abs(residual) >= 0.01) {
        let idxToAdjust = 0;
        if (!useEqual) {
            let maxW = -Infinity;
            for (let i = 0; i < weights.length; i++) {
                if (weights[i] > maxW) {
                    maxW = weights[i];
                    idxToAdjust = i;
                }
            }
        }
        allocated[idxToAdjust] = Math.round((allocated[idxToAdjust] + residual) * 100) / 100;
    }
    
    const newOverrides = { ...state.overrideStakes };
    for (let i = 0; i < state.filteredSlips.length; i++) {
        const slip = state.filteredSlips[i];
        const stakeValue = allocated[i];
        newOverrides[slip.slip_id] = Number((Math.round(stakeValue * 100) / 100).toFixed(2));
    }
    
    state.overrideStakes = newOverrides;
    processAndRender();
}

function handlePlaceSlip(slipId) {
    state.removingSlipId = slipId;
    
    setTimeout(() => {
        state.slips = state.slips.filter(s => s.slip_id !== slipId);
        state.placedCount++;
        
        // Remove from overrides
        const newOverrides = { ...state.overrideStakes };
        delete newOverrides[slipId];
        state.overrideStakes = newOverrides;
        
        state.removingSlipId = null;
        
        if (state.selectedSlip && state.selectedSlip.slip_id === slipId) {
            state.selectedSlip = null;
            elements.modal.style.display = 'none';
        }
        
        processAndRender();
    }, 400);
}

function handleIgnoreSlip(slipId) {
    state.removingSlipId = slipId;
    
    setTimeout(() => {
        state.slips = state.slips.filter(s => s.slip_id !== slipId);
        state.ignoredCount++;
        
        // Remove from overrides
        const newOverrides = { ...state.overrideStakes };
        delete newOverrides[slipId];
        state.overrideStakes = newOverrides;
        
        state.removingSlipId = null;
        
        if (state.selectedSlip && state.selectedSlip.slip_id === slipId) {
            state.selectedSlip = null;
            elements.modal.style.display = 'none';
        }
        
        processAndRender();
    }, 400);
}

function handleClearAllFilters() {
    setSearchTerm('');
    setRiskFilter('all');
    setSortBy('confidence');
    setPage(1);
    setTotalBankroll('');
    state.overrideStakes = {};
    processAndRender();
}

// Tooltip Functions
function showTooltip(text, x, y) {
    elements.tooltip.textContent = text;
    elements.tooltip.style.left = x + 'px';
    elements.tooltip.style.top = y + 'px';
    elements.tooltip.classList.add('show');
}

function hideTooltip() {
    elements.tooltip.classList.remove('show');
}

// Initialize Event Listeners
function initEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        setSearchTerm(value);
    });
    
    elements.clearSearchBtn.addEventListener('click', () => {
        setSearchTerm('');
    });
    
    // Sort and page size
    elements.sortSelect.addEventListener('change', (e) => {
        setSortBy(e.target.value);
    });
    
    elements.pageSizeSelect.addEventListener('change', (e) => {
        setItemsPerPage(e.target.value);
    });
    
    // Risk filter toggle buttons
    elements.riskToggleGroup.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-btn')) {
            const value = e.target.dataset.value;
            setRiskFilter(value);
        }
    });
    
    // Bankroll input
    elements.bankrollInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setTotalBankroll(value);
        }
    });
    
    // Buttons
    elements.distributeStakeBtn.addEventListener('click', handleDistributeStake);
    elements.clearOverridesBtn.addEventListener('click', () => {
        state.overrideStakes = {};
        processAndRender();
    });
    
    elements.clearAllFiltersBtn.addEventListener('click', handleClearAllFilters);
    elements.clearFiltersBtn.addEventListener('click', handleClearAllFilters);
    
    // Table event delegation
    elements.tableBody.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.icon-btn');
        if (!actionBtn) return;
        
        const action = actionBtn.dataset.action;
        const slipId = actionBtn.dataset.slipId;
        
        if (!slipId) return;
        
        const slip = state.slips.find(s => s.slip_id === slipId);
        if (!slip) return;
        
        switch (action) {
            case 'view':
                state.selectedSlip = slip;
                renderModal();
                break;
            case 'place':
                handlePlaceSlip(slipId);
                break;
            case 'ignore':
                handleIgnoreSlip(slipId);
                break;
        }
    });
    
    // Modal
    elements.modalPlaceBtn.addEventListener('click', () => {
        if (state.selectedSlip) {
            handlePlaceSlip(state.selectedSlip.slip_id);
            elements.modal.style.display = 'none';
        }
    });
    
    elements.modalCloseBtn.addEventListener('click', () => {
        elements.modal.style.display = 'none';
    });
    
    elements.closeModalBtn.addEventListener('click', () => {
        elements.modal.style.display = 'none';
    });
    
    // Tooltips
    document.addEventListener('mousemove', (e) => {
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget) {
            const text = tooltipTarget.dataset.tooltip;
            showTooltip(text, e.pageX + 10, e.pageY + 10);
        } else {
            hideTooltip();
        }
    });
    
    // Close modal on overlay click
    elements.modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            elements.modal.style.display = 'none';
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.style.display === 'flex') {
            elements.modal.style.display = 'none';
        }
    });
}

// Initialize Application
async function init() {
    initEventListeners();
    await fetchSlips();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);