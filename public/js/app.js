/* ===== LiveNewsCluster — Frontend App ===== */
'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  clusters: [],
  total: 0,
  offset: 0,
  limit: 30,
  filters: {
    topic: 'All',
    source: 'All',
    timeRange: 'all',
    search: ''
  },
  isLoading: false,
  autoRefreshInterval: null,
  searchDebounce: null
};

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const feedLoading   = $('feedLoading');
const feedEmpty     = $('feedEmpty');
const clustersGrid  = $('clustersGrid');
const loadMoreWrap  = $('loadMoreWrap');
const loadMoreBtn   = $('loadMoreBtn');
const refreshBtn    = $('refreshBtn');
const refreshIcon   = $('refreshIcon');
const searchInput   = $('searchInput');
const searchClear   = $('searchClear');
const sourceFilter  = $('sourceFilter');
const timeFilter    = $('timeFilter');
const statusDot     = $('statusDot');
const statusText    = $('statusText');
const lastUpdated   = $('lastUpdated');
const articleCount  = $('articleCount');
const clusterCount  = $('clusterCount');
const sourceCount   = $('sourceCount');
const topicPills    = $('topicPills');
const topicList     = $('topicList');
const trendingList  = $('trendingList');
const activeFilters = $('activeFilters');
const activeFilterTags = $('activeFilterTags');
const clearFiltersBtn  = $('clearFilters');
const modalOverlay  = $('modalOverlay');
const modal         = $('modal');
const modalClose    = $('modalClose');
const modalCategory = $('modalCategory');
const modalBreaking = $('modalBreaking');
const modalHeadline = $('modalHeadline');
const modalSummary  = $('modalSummary');
const modalSources  = $('modalSources');
const modalArticles = $('modalArticles');

// ─── UTILS ────────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function reliabilityDots(score) {
  const filled = Math.round((score / 10) * 5);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="reliability-dot${i < filled ? ' filled' : ''}"></span>`
  ).join('');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function setStatus(type, text) {
  statusDot.className = 'status-dot ' + type;
  statusText.textContent = text;
}

// ─── FETCH HELPERS ────────────────────────────────────────────────────────────
async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── LOAD CLUSTERS ────────────────────────────────────────────────────────────
async function loadClusters(append = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (!append) {
    state.offset = 0;
    feedLoading.style.display = 'flex';
    feedEmpty.style.display = 'none';
    clustersGrid.innerHTML = '';
    loadMoreWrap.style.display = 'none';
  }

  setStatus('loading', 'Fetching...');

  try {
    const params = new URLSearchParams({
      limit: state.limit,
      offset: state.offset
    });
    if (state.filters.topic    !== 'All')  params.set('topic',     state.filters.topic);
    if (state.filters.source   !== 'All')  params.set('source',    state.filters.source);
    if (state.filters.timeRange !== 'all') params.set('timeRange', state.filters.timeRange);
    if (state.filters.search)              params.set('search',    state.filters.search);

    const data = await apiFetch(`/api/clusters?${params}`);
    state.clusters = append ? [...state.clusters, ...data.clusters] : data.clusters;
    state.total = data.total;
    state.offset = state.offset + data.clusters.length;

    renderClusters(data.clusters, append);
    updateActiveFilters();
    setStatus('live', 'Live');
  } catch (err) {
    console.error('[LOAD]', err);
    setStatus('error', 'Error loading');
    if (!append) {
      feedLoading.style.display = 'none';
      feedEmpty.style.display = 'flex';
    }
  } finally {
    state.isLoading = false;
    feedLoading.style.display = 'none';
  }
}

// ─── RENDER CLUSTERS ──────────────────────────────────────────────────────────
function renderClusters(clusters, append = false) {
  if (!append) clustersGrid.innerHTML = '';

  if (clusters.length === 0 && !append) {
    feedEmpty.style.display = 'flex';
    loadMoreWrap.style.display = 'none';
    return;
  }

  feedEmpty.style.display = 'none';

  const fragment = document.createDocumentFragment();
  for (const cluster of clusters) {
    const card = createClusterCard(cluster);
    fragment.appendChild(card);
  }
  clustersGrid.appendChild(fragment);

  // Load more button
  if (state.offset < state.total) {
    loadMoreWrap.style.display = 'flex';
    loadMoreBtn.textContent = `Load More Stories (${state.total - state.offset} remaining)`;
  } else {
    loadMoreWrap.style.display = 'none';
  }
}

function createClusterCard(cluster) {
  const card = document.createElement('div');
  card.className = 'cluster-card' + (cluster.isBreaking ? ' breaking' : '');
  card.dataset.id = cluster.id;

  const imageHtml = cluster.image
    ? `<img class="card-image" src="${escapeHtml(cluster.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    : `<div class="card-image-placeholder">${topicEmoji(cluster.primaryCategory)}</div>`;

  const sourcesHtml = cluster.sources.slice(0, 4).map(s =>
    `<span class="source-chip">${escapeHtml(s)}</span>`
  ).join('') + (cluster.sources.length > 4 ? `<span class="source-chip">+${cluster.sources.length - 4}</span>` : '');

  card.innerHTML = `
    ${imageHtml}
    <div class="card-body">
      <div class="card-meta">
        ${cluster.isBreaking ? '<span class="badge badge-breaking">🔴 BREAKING</span>' : ''}
        <span class="badge badge-category">${escapeHtml(cluster.primaryCategory || 'General')}</span>
        <span class="badge badge-sources">${cluster.sources.length} source${cluster.sources.length !== 1 ? 's' : ''}</span>
      </div>
      <h3 class="card-headline">${escapeHtml(cluster.headline)}</h3>
      <p class="card-summary">${escapeHtml(cluster.summary)}</p>
      <div class="card-sources">${sourcesHtml}</div>
    </div>
    <div class="card-footer">
      <span class="card-time">${timeAgo(cluster.latestDate)}</span>
      <span class="card-reliability">
        <span style="font-size:10px;color:var(--text-muted)">Reliability</span>
        <span class="reliability-bar">${reliabilityDots(cluster.reliability)}</span>
      </span>
      <span class="card-article-count">${cluster.articleCount} art.</span>
    </div>
  `;

  card.addEventListener('click', () => openModal(cluster));
  return card;
}

function topicEmoji(category) {
  const map = {
    'World': '🗺️', 'U.S.': '🇺🇸', 'Politics': '🏛️', 'Tech': '💻',
    'Business': '📈', 'Sports': '⚽', 'Science': '🔬',
    'Entertainment': '🎬', 'Health': '🏥', 'General': '📰'
  };
  return map[category] || '📰';
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(cluster) {
  modalCategory.textContent = cluster.primaryCategory || 'General';
  modalBreaking.style.display = cluster.isBreaking ? 'inline-flex' : 'none';
  modalHeadline.textContent = cluster.headline;
  modalSummary.textContent = cluster.summary;

  modalSources.innerHTML = cluster.sources.map(s =>
    `<span class="source-chip">${escapeHtml(s)}</span>`
  ).join('');

  modalArticles.innerHTML = cluster.articles.map(a => `
    <div class="modal-article-item">
      <div class="modal-article-title">
        <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>
      </div>
      <div class="modal-article-meta">
        <span class="modal-article-source">${escapeHtml(a.source)}</span>
        <span>${timeAgo(a.pubDate)}</span>
        <span>${formatDate(a.pubDate)}</span>
      </div>
    </div>
  `).join('');

  modalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── TOPIC FILTER ─────────────────────────────────────────────────────────────
function setTopicFilter(topic) {
  state.filters.topic = topic;
  state.offset = 0;

  // Update pills
  document.querySelectorAll('#topicPills .pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.topic === topic);
  });

  // Update sidebar
  document.querySelectorAll('#topicList .topic-item').forEach(item => {
    item.classList.toggle('active', item.dataset.topic === topic);
  });

  loadClusters();
}

// Pills click
topicPills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (pill) setTopicFilter(pill.dataset.topic);
});

// Sidebar click
topicList.addEventListener('click', e => {
  const item = e.target.closest('.topic-item');
  if (item) setTopicFilter(item.dataset.topic);
});

// ─── OTHER FILTERS ────────────────────────────────────────────────────────────
sourceFilter.addEventListener('change', () => {
  state.filters.source = sourceFilter.value;
  loadClusters();
});

timeFilter.addEventListener('change', () => {
  state.filters.timeRange = timeFilter.value;
  loadClusters();
});

// ─── SEARCH ───────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  const val = searchInput.value.trim();
  searchClear.style.display = val ? 'block' : 'none';
  clearTimeout(state.searchDebounce);
  state.searchDebounce = setTimeout(() => {
    state.filters.search = val;
    loadClusters();
  }, 400);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  state.filters.search = '';
  loadClusters();
});

// ─── ACTIVE FILTERS DISPLAY ───────────────────────────────────────────────────
function updateActiveFilters() {
  const tags = [];
  if (state.filters.topic !== 'All')     tags.push({ label: `Topic: ${state.filters.topic}`,     key: 'topic' });
  if (state.filters.source !== 'All')    tags.push({ label: `Source: ${state.filters.source}`,   key: 'source' });
  if (state.filters.timeRange !== 'all') tags.push({ label: `Time: ${state.filters.timeRange}`,  key: 'timeRange' });
  if (state.filters.search)              tags.push({ label: `Search: "${state.filters.search}"`, key: 'search' });

  if (tags.length === 0) {
    activeFilters.style.display = 'none';
    return;
  }

  activeFilters.style.display = 'flex';
  activeFilterTags.innerHTML = tags.map(t => `
    <span class="active-filter-tag">
      ${escapeHtml(t.label)}
      <button onclick="removeFilter('${t.key}')" title="Remove">✕</button>
    </span>
  `).join('');
}

window.removeFilter = function(key) {
  const defaults = { topic: 'All', source: 'All', timeRange: 'all', search: '' };
  state.filters[key] = defaults[key];
  if (key === 'topic') {
    setTopicFilter('All');
    return;
  }
  if (key === 'source') sourceFilter.value = 'All';
  if (key === 'timeRange') timeFilter.value = 'all';
  if (key === 'search') { searchInput.value = ''; searchClear.style.display = 'none'; }
  loadClusters();
};

window.clearAllFilters = function() {
  state.filters = { topic: 'All', source: 'All', timeRange: 'all', search: '' };
  searchInput.value = '';
  searchClear.style.display = 'none';
  sourceFilter.value = 'All';
  timeFilter.value = 'all';
  setTopicFilter('All');
};

clearFiltersBtn.addEventListener('click', clearAllFilters);

// ─── REFRESH ──────────────────────────────────────────────────────────────────
async function triggerRefresh() {
  refreshBtn.classList.add('loading');
  refreshIcon.classList.add('spinning');
  setStatus('loading', 'Refreshing...');

  try {
    await fetch('/api/refresh', { method: 'POST' });
    // Poll until refresh is done
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const status = await apiFetch('/api/status');
        if (!status.isRefreshing || attempts > 30) {
          clearInterval(poll);
          await loadClusters();
          await loadStatus();
          await loadTrending();
          await loadTopicCounts();
        }
      } catch (e) { clearInterval(poll); }
    }, 1000);
  } catch (err) {
    console.error('[REFRESH]', err);
    setStatus('error', 'Refresh failed');
  } finally {
    refreshBtn.classList.remove('loading');
    refreshIcon.classList.remove('spinning');
  }
}

refreshBtn.addEventListener('click', triggerRefresh);

// ─── STATUS BAR ───────────────────────────────────────────────────────────────
async function loadStatus() {
  try {
    const data = await apiFetch('/api/status');
    if (data.lastUpdated) {
      lastUpdated.textContent = timeAgo(data.lastUpdated);
    }
    if (articleCount) articleCount.textContent = data.articleCount || '—';
    if (clusterCount) clusterCount.textContent = data.clusterCount || '—';
    if (sourceCount)  sourceCount.textContent  = data.sourceCount  || '—';
    setStatus(data.isRefreshing ? 'loading' : 'live', data.isRefreshing ? 'Refreshing...' : 'Live');
  } catch (e) {
    setStatus('error', 'Offline');
  }
}

// ─── SOURCES DROPDOWN ─────────────────────────────────────────────────────────
async function loadSources() {
  try {
    const data = await apiFetch('/api/sources');
    sourceFilter.innerHTML = '<option value="All">All Sources</option>' +
      data.sources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  } catch (e) { /* ignore */ }
}

// ─── TRENDING ─────────────────────────────────────────────────────────────────
async function loadTrending() {
  try {
    const data = await apiFetch('/api/trending');
    if (!data.trending || data.trending.length === 0) {
      trendingList.innerHTML = '<div class="trending-loading">No trending stories yet.</div>';
      return;
    }
    trendingList.innerHTML = data.trending.map((t, i) => `
      <div class="trending-item" onclick="searchForTrend('${escapeHtml(t.headline.slice(0,40))}')">
        <div class="trending-headline">${i + 1}. ${escapeHtml(t.headline)}</div>
        <div class="trending-meta">
          <span>${t.sourceCount} sources</span>
          <span>${t.articleCount} articles</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    trendingList.innerHTML = '<div class="trending-loading">Could not load trending.</div>';
  }
}

window.searchForTrend = function(query) {
  searchInput.value = query;
  searchClear.style.display = 'block';
  state.filters.search = query;
  loadClusters();
};

// ─── TOPIC COUNTS (SIDEBAR BADGES) ────────────────────────────────────────────
async function loadTopicCounts() {
  try {
    const data = await apiFetch('/api/topics');
    const countMap = {};
    for (const t of data.topics) countMap[t.name] = t.count;

    // Update sidebar badges
    const badgeIds = {
      'All': 'badge-All', 'World': 'badge-World', 'U.S.': 'badge-US',
      'Politics': 'badge-Politics', 'Tech': 'badge-Tech', 'Business': 'badge-Business',
      'Sports': 'badge-Sports', 'Science': 'badge-Science',
      'Entertainment': 'badge-Entertainment', 'Health': 'badge-Health', 'General': 'badge-General'
    };

    let total = 0;
    for (const [topic, badgeId] of Object.entries(badgeIds)) {
      const el = $(badgeId);
      if (!el) continue;
      if (topic === 'All') continue;
      const count = countMap[topic] || 0;
      el.textContent = count > 0 ? count : '';
      total += count;
    }
    const allBadge = $('badge-All');
    if (allBadge) allBadge.textContent = total > 0 ? total : '';
  } catch (e) { /* ignore */ }
}

// ─── LOAD MORE ────────────────────────────────────────────────────────────────
loadMoreBtn.addEventListener('click', () => loadClusters(true));

// ─── AUTO REFRESH ─────────────────────────────────────────────────────────────
function startAutoRefresh() {
  if (state.autoRefreshInterval) clearInterval(state.autoRefreshInterval);
  state.autoRefreshInterval = setInterval(async () => {
    await loadClusters();
    await loadStatus();
    await loadTrending();
    await loadTopicCounts();
  }, 5 * 60 * 1000); // every 5 minutes
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  setStatus('loading', 'Connecting...');
  await Promise.all([
    loadClusters(),
    loadStatus(),
    loadSources(),
    loadTrending(),
    loadTopicCounts()
  ]);
  startAutoRefresh();

  // Update "last updated" every minute
  setInterval(loadStatus, 60000);
}

document.addEventListener('DOMContentLoaded', init);
