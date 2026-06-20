// App State
let state = {
    items: [],
    filteredItems: [],
    filters: {
        type: 'all',
        search: ''
    },
    selectedItemId: null,
    lastUpdated: 'Never'
};

// UI Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    syncTime: document.getElementById('sync-time'),
    
    // Stats
    countAll: document.getElementById('count-all'),
    countFeature: document.getElementById('count-feature'),
    countIssue: document.getElementById('count-issue'),
    countDeprecated: document.getElementById('count-deprecated'),
    statCards: document.querySelectorAll('.stat-card'),
    
    // Controls
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterPills: document.getElementById('filter-pills'),
    
    // Main Sections
    cardsContainer: document.getElementById('cards-container'),
    resultsCount: document.getElementById('results-count'),
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMsg: document.getElementById('error-msg'),
    emptyState: document.getElementById('empty-state'),
    retryBtn: document.getElementById('retry-btn'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    
    // Composer Section
    composerSection: document.getElementById('composer-section'),
    composerEmpty: document.getElementById('composer-empty'),
    composerActive: document.getElementById('composer-active'),
    composerFooter: document.getElementById('composer-footer'),
    previewTypeBadge: document.getElementById('preview-type-badge'),
    previewDate: document.getElementById('preview-date'),
    previewTextSnippet: document.getElementById('preview-text-snippet'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charProgress: document.getElementById('char-progress'),
    charCount: document.getElementById('char-count'),
    tweetValidationMsg: document.getElementById('tweet-validation-msg'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    sendTweetBtn: document.getElementById('send-tweet-btn'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Progress Ring Configuration
// r = 9, Circumference = 2 * PI * r = 56.548
const CIRCUMFERENCE = 2 * Math.PI * 9;
elements.charProgress.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Events
function setupEventListeners() {
    // Refresh & Retry Events
    elements.refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    elements.retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search Events
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.clearSearch.addEventListener('click', handleClearSearch);
    
    // Type Pill Filters
    elements.filterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        const type = pill.dataset.filter;
        setFilter('type', type);
    });

    // Stat Cards Filter shortcut
    elements.statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.dataset.type;
            
            // Map card types to pill values
            let targetType = 'all';
            if (filterType === 'feature') targetType = 'Feature';
            else if (filterType === 'issue') targetType = 'Issue';
            else if (filterType === 'deprecated') targetType = 'Deprecated';
            
            // Set active class on corresponding pill
            document.querySelectorAll('.pill').forEach(p => {
                if (p.dataset.filter === targetType) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });
            
            // Toggle highlight on stat cards
            elements.statCards.forEach(c => c.classList.remove('active-stat'));
            card.classList.add('active-stat');
            
            setFilter('type', targetType);
        });
    });
    
    // Reset Filters Shortcut
    elements.resetFiltersBtn.addEventListener('click', resetAllFilters);
    
    // Composer Events
    elements.tweetTextarea.addEventListener('input', updateCharCount);
    elements.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    elements.sendTweetBtn.addEventListener('click', openTwitterIntent);
}

// Fetch Release Notes
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading();
    hideError();
    hideEmpty();
    
    // Add rotating class to icon
    if (forceRefresh) {
        elements.refreshIcon.classList.add('rotating');
        elements.refreshBtn.disabled = true;
    }
    
    const endpoint = forceRefresh ? '/api/refresh' : '/api/releases';
    
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (data.status === 'success') {
            state.items = data.items;
            state.lastUpdated = data.last_updated;
            
            elements.syncTime.textContent = state.lastUpdated;
            updateStats();
            applyFilters();
            
            if (forceRefresh) {
                showToast("Release notes feed updated successfully!");
            }
        } else {
            showError(data.message || "An error occurred on the server.");
        }
    } catch (err) {
        showError("Could not connect to the server. Check if the Flask application is running.");
    } finally {
        // Clean up spinner
        elements.refreshIcon.classList.remove('rotating');
        elements.refreshBtn.disabled = false;
        hideLoading();
    }
}

// Show/Hide States
function showLoading() {
    elements.loadingState.style.display = 'flex';
    elements.cardsContainer.style.display = 'none';
}

function hideLoading() {
    elements.loadingState.style.display = 'none';
    elements.cardsContainer.style.display = 'flex';
}

// Show/Hide States
function showError(message) {
    elements.errorMsg.textContent = message;
    elements.errorState.style.display = 'flex';
    elements.cardsContainer.style.display = 'none';
}

function hideError() {
    elements.errorState.style.display = 'none';
}

// Show/Hide States
function showEmpty() {
    elements.emptyState.style.display = 'flex';
    elements.cardsContainer.style.display = 'none';
}

function hideEmpty() {
    elements.emptyState.style.display = 'none';
}

// Update Stats Row
function updateStats() {
    const counts = {
        all: state.items.length,
        feature: state.items.filter(item => item.type === 'Feature').length,
        issue: state.items.filter(item => item.type === 'Issue').length,
        deprecated: state.items.filter(item => item.type === 'Deprecated').length
    };
    
    // Animate counter values
    animateCounter(elements.countAll, counts.all);
    animateCounter(elements.countFeature, counts.feature);
    animateCounter(elements.countIssue, counts.issue);
    animateCounter(elements.countDeprecated, counts.deprecated);
}

function animateCounter(element, target) {
    const duration = 800; // ms
    const startTime = performance.now();
    const startVal = parseInt(element.textContent) || 0;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing out quadratic
        const easeProgress = progress * (2 - progress);
        const currentVal = Math.floor(startVal + (target - startVal) * easeProgress);
        
        element.textContent = currentVal;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }
    requestAnimationFrame(update);
}

// Handle Search Input
function handleSearchInput(e) {
    const value = e.target.value;
    state.filters.search = value.trim().toLowerCase();
    
    if (value.length > 0) {
        elements.clearSearch.style.display = 'flex';
    } else {
        elements.clearSearch.style.display = 'none';
    }
    
    applyFilters();
}

function handleClearSearch() {
    elements.searchInput.value = '';
    state.filters.search = '';
    elements.clearSearch.style.display = 'none';
    applyFilters();
    elements.searchInput.focus();
}

// Set Specific Filter type
function setFilter(key, value) {
    state.filters[key] = value;
    applyFilters();
}

function resetAllFilters() {
    elements.searchInput.value = '';
    state.filters.search = '';
    elements.clearSearch.style.display = 'none';
    
    state.filters.type = 'all';
    document.querySelectorAll('.pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === 'all');
    });
    
    elements.statCards.forEach(c => c.classList.remove('active-stat'));
    
    applyFilters();
}

// Apply Filters & Search
function applyFilters() {
    state.filteredItems = state.items.filter(item => {
        // 1. Filter by Type
        if (state.filters.type !== 'all' && item.type !== state.filters.type) {
            return false;
        }
        
        // 2. Filter by Search keyword (date, type, or description)
        if (state.filters.search) {
            const matchesSearch = 
                item.date.toLowerCase().includes(state.filters.search) ||
                item.type.toLowerCase().includes(state.filters.search) ||
                item.text.toLowerCase().includes(state.filters.search);
                
            if (!matchesSearch) return false;
        }
        
        return true;
    });
    
    elements.resultsCount.textContent = `${state.filteredItems.length} items`;
    
    if (state.filteredItems.length === 0) {
        showEmpty();
    } else {
        hideEmpty();
        renderCards();
    }
}

// Render Cards Grid
function renderCards() {
    elements.cardsContainer.innerHTML = '';
    
    state.filteredItems.forEach(item => {
        const isSelected = item.id === state.selectedItemId;
        
        const card = document.createElement('article');
        card.className = `release-card type-${item.type.toLowerCase()}`;
        if (isSelected) card.classList.add('selected');
        card.dataset.id = item.id;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="type-badge badge-${item.type.toLowerCase()}">${item.type}</span>
                    <span class="card-date">${item.date}</span>
                </div>
                <button class="card-tweet-action" title="Tweet this update">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                </button>
            </div>
            <div class="card-content">
                ${item.html}
            </div>
            <div class="card-footer">
                <a href="${item.link}" target="_blank" class="doc-link" rel="noopener noreferrer">
                    <span>View in Release Notes</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                </a>
                <button class="card-tweet-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet This</span>
                </button>
            </div>
        `;
        
        // Setup Card Interaction
        card.addEventListener('click', (e) => {
            // If the user clicked the doc link, don't trigger the card select
            if (e.target.closest('.doc-link')) return;
            
            selectCard(item);
            
            // If mobile view, slide open composer drawer
            if (window.innerWidth <= 1024) {
                elements.composerSection.classList.add('composer-drawer-open');
                
                // Add click backdrop to close
                createMobileBackdrop();
            }
        });
        
        elements.cardsContainer.appendChild(card);
    });
}

// Select Card for Tweeting
function selectCard(item) {
    state.selectedItemId = item.id;
    
    // Highlight active card in feed list
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === item.id);
    });
    
    // Prepare composer data
    elements.composerEmpty.style.display = 'none';
    elements.composerActive.style.display = 'block';
    elements.composerFooter.style.display = 'flex';
    
    elements.previewTypeBadge.className = `type-badge badge-${item.type.toLowerCase()}`;
    elements.previewTypeBadge.textContent = item.type;
    elements.previewDate.textContent = item.date;
    elements.previewTextSnippet.textContent = item.text;
    
    // Generate pre-filled tweet text
    // Format: "📢 BigQuery Feature (June 15, 2026):\nUse Gemini Cloud Assist to optimize query performance in BigQuery...\nRead more: https://..."
    const prefix = `📢 BigQuery ${item.type} (${item.date}):\n`;
    const suffix = `\n\nRead more: ${item.link} #BigQuery #GoogleCloud`;
    
    // Estimate available length for the text snippet
    // Twitter intent handles full URLs, but we want the tweet text to fit within 280 chars
    // Note: Twitter treats all URLs as 23 characters regardless of actual length!
    const urlLengthForTwitter = 23;
    const tagsLength = 23; // " #BigQuery #GoogleCloud" + spacing
    const fixedLength = prefix.length + "\n\nRead more: ".length + urlLengthForTwitter + tagsLength;
    const availableLength = 280 - fixedLength;
    
    let trimmedText = item.text;
    if (trimmedText.length > availableLength) {
        trimmedText = trimmedText.substring(0, availableLength - 3) + "...";
    }
    
    const draftMessage = `${prefix}${trimmedText}${suffix}`;
    elements.tweetTextarea.value = draftMessage;
    
    updateCharCount();
    
    // Scroll composer into view if on desktop
    if (window.innerWidth > 1024) {
        elements.tweetTextarea.focus();
    }
}

// Create mobile drawer close backdrop
function createMobileBackdrop() {
    let backdrop = document.getElementById('mobile-drawer-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'mobile-drawer-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.right = '0';
        backdrop.style.bottom = '0';
        backdrop.style.background = 'rgba(0, 0, 0, 0.5)';
        backdrop.style.backdropFilter = 'blur(4px)';
        backdrop.style.zIndex = '90';
        document.body.appendChild(backdrop);
        
        backdrop.addEventListener('click', () => {
            elements.composerSection.classList.remove('composer-drawer-open');
            backdrop.remove();
        });
    }
}

// Character Count & Ring Updates
function updateCharCount() {
    const text = elements.tweetTextarea.value;
    
    // Calculate character count based on Twitter guidelines:
    // Any URL is replaced by 23 characters
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    
    let processedText = text;
    urls.forEach(url => {
        processedText = processedText.replace(url, "a".repeat(23));
    });
    
    const count = processedText.length;
    const remaining = 280 - count;
    
    elements.charCount.textContent = remaining;
    
    // Update progress ring
    const percentage = Math.min((count / 280) * 100, 100);
    const offset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
    elements.charProgress.style.strokeDashoffset = offset;
    
    // Set coloring classes on validation
    elements.charProgress.classList.remove('warn', 'error');
    elements.charCount.classList.remove('warn', 'error');
    elements.tweetValidationMsg.className = 'validation-msg';
    elements.tweetValidationMsg.textContent = '';
    elements.sendTweetBtn.disabled = false;
    
    if (remaining < 0) {
        // Exceeded
        elements.charProgress.style.stroke = '#ef4444'; // Red
        elements.charCount.classList.add('error');
        elements.tweetValidationMsg.classList.add('error');
        elements.tweetValidationMsg.textContent = 'Tweet exceeds 280 characters!';
        elements.sendTweetBtn.disabled = true;
    } else if (remaining <= 20) {
        // Warning (under 20 characters left)
        elements.charProgress.style.stroke = '#f59e0b'; // Amber
        elements.charCount.classList.add('warn');
        elements.tweetValidationMsg.classList.add('warn');
        elements.tweetValidationMsg.textContent = `${remaining} characters remaining`;
    } else {
        // Safe
        elements.charProgress.style.stroke = '#1da1f2'; // Twitter Blue
    }
}

// Copy Tweet Text
function copyTweetToClipboard() {
    const tweetText = elements.tweetTextarea.value;
    navigator.clipboard.writeText(tweetText)
        .then(() => {
            showToast("Copied Tweet to clipboard!");
        })
        .catch(() => {
            showToast("Failed to copy text. Please select and copy manually.");
        });
}

// Trigger Twitter intent
function openTwitterIntent() {
    const tweetText = elements.tweetTextarea.value;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Display Toast Alert
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}
