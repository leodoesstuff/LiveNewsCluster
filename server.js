require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
const RSSParser = require('rss-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// RSS Parser
const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'LiveNewsCluster/1.0 RSS Reader' },
  customFields: { item: ['media:content', 'media:thumbnail', 'enclosure', 'description'] }
});

// ─── RSS FEEDS ────────────────────────────────────────────────────────────────
const RSS_FEEDS = [
  // World / General
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml',           source: 'BBC News',      category: 'World',         reliability: 9 },
  { url: 'http://feeds.bbci.co.uk/news/rss.xml',                 source: 'BBC News',      category: 'General',       reliability: 9 },
  { url: 'https://feeds.npr.org/1001/rss.xml',                   source: 'NPR',           category: 'General',       reliability: 9 },
  { url: 'https://feeds.npr.org/1004/rss.xml',                   source: 'NPR',           category: 'World',         reliability: 9 },
  { url: 'https://www.theguardian.com/world/rss',                source: 'The Guardian',  category: 'World',         reliability: 8 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NY Times',    category: 'World',         reliability: 9 },
  { url: 'https://feeds.reuters.com/reuters/topNews',            source: 'Reuters',       category: 'General',       reliability: 9 },
  // U.S.
  { url: 'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', source: 'BBC News', category: 'U.S.',          reliability: 9 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',  source: 'NY Times',      category: 'U.S.',          reliability: 9 },
  { url: 'https://feeds.npr.org/1003/rss.xml',                   source: 'NPR',           category: 'U.S.',          reliability: 9 },
  { url: 'https://www.theguardian.com/us-news/rss',              source: 'The Guardian',  category: 'U.S.',          reliability: 8 },
  // Politics
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', source: 'NY Times', category: 'Politics',     reliability: 9 },
  { url: 'https://feeds.npr.org/1014/rss.xml',                   source: 'NPR',           category: 'Politics',      reliability: 9 },
  { url: 'https://www.theguardian.com/politics/rss',             source: 'The Guardian',  category: 'Politics',      reliability: 8 },
  { url: 'http://feeds.bbci.co.uk/news/politics/rss.xml',        source: 'BBC News',      category: 'Politics',      reliability: 9 },
  { url: 'https://feeds.foxnews.com/foxnews/politics',           source: 'Fox News',      category: 'Politics',      reliability: 6 },
  // Tech
  { url: 'https://techcrunch.com/feed/',                         source: 'TechCrunch',    category: 'Tech',          reliability: 8 },
  { url: 'https://www.theverge.com/rss/index.xml',               source: 'The Verge',     category: 'Tech',          reliability: 8 },
  { url: 'https://feeds.arstechnica.com/arstechnica/index',      source: 'Ars Technica',  category: 'Tech',          reliability: 8 },
  { url: 'https://www.wired.com/feed/rss',                       source: 'Wired',         category: 'Tech',          reliability: 8 },
  { url: 'http://feeds.bbci.co.uk/news/technology/rss.xml',      source: 'BBC News',      category: 'Tech',          reliability: 9 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NY Times', category: 'Tech',       reliability: 9 },
  // Business
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', source: 'NY Times', category: 'Business',     reliability: 9 },
  { url: 'http://feeds.bbci.co.uk/news/business/rss.xml',        source: 'BBC News',      category: 'Business',      reliability: 9 },
  { url: 'https://www.theguardian.com/business/rss',             source: 'The Guardian',  category: 'Business',      reliability: 8 },
  { url: 'https://feeds.npr.org/1006/rss.xml',                   source: 'NPR',           category: 'Business',      reliability: 9 },
  // Sports
  { url: 'http://feeds.bbci.co.uk/sport/rss.xml',                source: 'BBC Sport',     category: 'Sports',        reliability: 9 },
  { url: 'https://www.theguardian.com/sport/rss',                source: 'The Guardian',  category: 'Sports',        reliability: 8 },
  { url: 'https://www.espn.com/espn/rss/news',                   source: 'ESPN',          category: 'Sports',        reliability: 8 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml', source: 'NY Times',   category: 'Sports',        reliability: 9 },
  // Science
  { url: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC News', category: 'Science',   reliability: 9 },
  { url: 'https://www.theguardian.com/science/rss',              source: 'The Guardian',  category: 'Science',       reliability: 8 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', source: 'NY Times',  category: 'Science',       reliability: 9 },
  { url: 'https://feeds.npr.org/1007/rss.xml',                   source: 'NPR',           category: 'Science',       reliability: 9 },
  // Entertainment
  { url: 'http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', source: 'BBC News', category: 'Entertainment', reliability: 9 },
  { url: 'https://www.theguardian.com/culture/rss',              source: 'The Guardian',  category: 'Entertainment', reliability: 8 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', source: 'NY Times',     category: 'Entertainment', reliability: 9 },
  // Health
  { url: 'http://feeds.bbci.co.uk/news/health/rss.xml',          source: 'BBC News',      category: 'Health',        reliability: 9 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', source: 'NY Times',   category: 'Health',        reliability: 9 },
  { url: 'https://feeds.npr.org/1128/rss.xml',                   source: 'NPR',           category: 'Health',        reliability: 9 },
];

// ─── IN-MEMORY STORE ─────────────────────────────────────────────────────────
let articlesStore = [];
let clustersStore = [];
let lastUpdated = null;
let isRefreshing = false;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function cleanText(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function extractImage(item) {
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) return item['media:content']['$'].url;
  if (item['media:thumbnail'] && item['media:thumbnail']['$'] && item['media:thumbnail']['$'].url) return item['media:thumbnail']['$'].url;
  if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) return item.enclosure.url;
  const imgMatch = (item.content || item.description || '').match(/<img[^>]+src=["']([^"']+)["']/);
  if (imgMatch) return imgMatch[1];
  return null;
}

function getKeywords(text) {
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','was','are','were','be','been','has','have','had','will','would','could','should','may','might','that','this','these','those','it','its','he','she','they','we','you','i','as','if','when','then','than','so','yet','both','either','neither','not','no','nor','just','also','about','after','before','during','while','since','until','unless','although','because','though','even','only','very','too','more','most','some','any','all','each','every','other','another','such','what','which','who','whom','whose','how','why','where','there','here','up','down','out','off','over','under','again','further','once']);
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
}

function similarity(a, b) {
  const wordsA = new Set(getKeywords(a));
  const wordsB = new Set(getKeywords(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

function isBreaking(pubDate) {
  if (!pubDate) return false;
  const age = Date.now() - new Date(pubDate).getTime();
  return age < 2 * 60 * 60 * 1000; // 2 hours
}

function generateSummary(articles) {
  const titles = articles.slice(0, 5).map(a => a.title);
  const sources = [...new Set(articles.map(a => a.source))];
  const sourceStr = sources.length > 1 ? `Reported by ${sources.slice(0, 3).join(', ')}${sources.length > 3 ? ` and ${sources.length - 3} more` : ''}.` : `Reported by ${sources[0]}.`;
  return `${titles[0]}. ${sourceStr} ${articles.length} article${articles.length > 1 ? 's' : ''} covering this story.`;
}

// ─── FETCH FEEDS ─────────────────────────────────────────────────────────────
async function fetchFeed(feedConfig) {
  try {
    const feed = await parser.parseURL(feedConfig.url);
    const articles = [];
    for (const item of (feed.items || []).slice(0, 20)) {
      const title = cleanText(item.title || '');
      if (!title) continue;
      const url = item.link || item.guid || '';
      if (!url) continue;
      articles.push({
        id: Buffer.from(url).toString('base64').slice(0, 16),
        title,
        url,
        source: feedConfig.source,
        category: feedConfig.category,
        reliability: feedConfig.reliability,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        summary: cleanText(item.contentSnippet || item.description || '').slice(0, 300),
        image: extractImage(item),
        isBreaking: isBreaking(item.pubDate || item.isoDate),
        fetchedAt: new Date().toISOString()
      });
    }
    return articles;
  } catch (err) {
    console.warn(`[FEED ERROR] ${feedConfig.source} (${feedConfig.url}): ${err.message}`);
    return [];
  }
}

async function fetchAllFeeds() {
  console.log('[FETCH] Starting feed refresh...');
  const results = await Promise.allSettled(RSS_FEEDS.map(f => fetchFeed(f)));
  const newArticles = [];
  for (const r of results) {
    if (r.status === 'fulfilled') newArticles.push(...r.value);
  }
  // Deduplicate by URL
  const seen = new Set(articlesStore.map(a => a.url));
  const fresh = newArticles.filter(a => !seen.has(a.url));
  articlesStore = [...fresh, ...articlesStore].slice(0, 2000);
  console.log(`[FETCH] Done. ${fresh.length} new articles. Total: ${articlesStore.length}`);
  return fresh.length;
}

// ─── CLUSTERING ──────────────────────────────────────────────────────────────
function clusterArticles(articles) {
  const clusters = [];
  const assigned = new Set();

  // Sort by date descending
  const sorted = [...articles].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [sorted[i]];
    assigned.add(i);

    for (let j = i + 1; j < sorted.length; j++) {
      if (assigned.has(j)) continue;
      const sim = similarity(sorted[i].title, sorted[j].title);
      if (sim >= 0.2) {
        cluster.push(sorted[j]);
        assigned.add(j);
      }
    }

    const sources = [...new Set(cluster.map(a => a.source))];
    const categories = [...new Set(cluster.map(a => a.category))];
    const hasBreaking = cluster.some(a => a.isBreaking);
    const latestDate = cluster.reduce((max, a) => new Date(a.pubDate) > new Date(max) ? a.pubDate : max, cluster[0].pubDate);
    const image = cluster.find(a => a.image)?.image || null;

    clusters.push({
      id: cluster[0].id + '_cluster',
      headline: cluster[0].title,
      summary: generateSummary(cluster),
      articles: cluster.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)),
      sources,
      categories,
      primaryCategory: categories[0],
      isBreaking: hasBreaking,
      latestDate,
      image,
      articleCount: cluster.length,
      reliability: Math.round(cluster.reduce((s, a) => s + a.reliability, 0) / cluster.length)
    });
  }

  return clusters.sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
}

async function refreshData() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    await fetchAllFeeds();
    clustersStore = clusterArticles(articlesStore);
    lastUpdated = new Date().toISOString();
    console.log(`[CLUSTER] ${clustersStore.length} clusters built.`);
  } finally {
    isRefreshing = false;
  }
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    lastUpdated,
    articleCount: articlesStore.length,
    clusterCount: clustersStore.length,
    sourceCount: RSS_FEEDS.length,
    isRefreshing
  });
});

app.get('/api/clusters', (req, res) => {
  let results = [...clustersStore];
  const { topic, category, source, search, timeRange, limit = 50, offset = 0 } = req.query;

  // Filter by topic (alias for category)
  if (topic && topic !== 'All') {
    results = results.filter(c =>
      c.categories.some(cat => cat.toLowerCase() === topic.toLowerCase()) ||
      c.primaryCategory.toLowerCase() === topic.toLowerCase()
    );
  }

  // Filter by category (same as topic)
  if (category && category !== 'All') {
    results = results.filter(c =>
      c.categories.some(cat => cat.toLowerCase() === category.toLowerCase())
    );
  }

  // Filter by source
  if (source && source !== 'All') {
    results = results.filter(c => c.sources.some(s => s.toLowerCase().includes(source.toLowerCase())));
  }

  // Filter by time range
  if (timeRange && timeRange !== 'all') {
    const now = Date.now();
    const ranges = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };
    const ms = ranges[timeRange];
    if (ms) results = results.filter(c => now - new Date(c.latestDate).getTime() <= ms);
  }

  // Search
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(c =>
      c.headline.toLowerCase().includes(q) ||
      c.summary.toLowerCase().includes(q) ||
      c.articles.some(a => a.title.toLowerCase().includes(q))
    );
  }

  const total = results.length;
  const paginated = results.slice(Number(offset), Number(offset) + Number(limit));

  res.json({ clusters: paginated, total, offset: Number(offset), limit: Number(limit) });
});

app.get('/api/topics', (req, res) => {
  const topicCounts = {};
  for (const cluster of clustersStore) {
    for (const cat of cluster.categories) {
      topicCounts[cat] = (topicCounts[cat] || 0) + cluster.articleCount;
    }
  }
  const topics = Object.entries(topicCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  res.json({ topics });
});

app.get('/api/trending', (req, res) => {
  const trending = clustersStore
    .filter(c => c.sources.length >= 2)
    .sort((a, b) => b.sources.length - a.sources.length || b.articleCount - a.articleCount)
    .slice(0, 10)
    .map(c => ({ headline: c.headline, sourceCount: c.sources.length, articleCount: c.articleCount, categories: c.categories, id: c.id }));
  res.json({ trending });
});

app.get('/api/sources', (req, res) => {
  const sources = [...new Set(RSS_FEEDS.map(f => f.source))].sort();
  res.json({ sources });
});

app.post('/api/refresh', async (req, res) => {
  if (isRefreshing) return res.json({ message: 'Already refreshing', isRefreshing: true });
  refreshData();
  res.json({ message: 'Refresh started', isRefreshing: true });
});

// ─── SERVE FRONTEND ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[SERVER] LiveNewsCluster running at http://localhost:${PORT}`);
  await refreshData();
});

// Auto-refresh every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log('[CRON] Auto-refresh triggered');
  refreshData();
});
