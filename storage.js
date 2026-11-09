// =====================================================================
//  OyunIndir.gg — Kalıcı Veri Katmanı (3 Katmanlı Koruma)
// ---------------------------------------------------------------------
//  Render (free plan) diski geçicidir: her deploy / yeniden başlatmada
//  konteyner sıfırlanır. Oyunların ve verilerin ASLA kaybolmaması için
//  üç katmanlı koruma birlikte çalışır:
//
//   1) Canlı Deploy Devir Teslimi (Handoff)
//      Render yeni sürümü başlatırken eski sürüm hâlâ yayındadır. Yeni
//      sunucu port açmadan önce eski sunucudan (/api/_handoff ve yedek
//      olarak /api/bootstrap) güncel veritabanını çeker ve birleştirir.
//
//   2) Parçalı Bulut Yedekleme (Sharded Cloud Store v3)
//      Eski sistemde tüm veritabanı her işlemde tek büyük dosya olarak
//      gönderildiği için kota sınırına takılıyordu. Artık:
//      - Hafif ana indeks (üyeler, yorumlar, istekler, kırık linkler,
//        ayarlar ve oyun ID listesi) ayrı kanala yazılır.
//      - Her oyun yalnızca eklendiğinde veya güncellendiğinde kendi
//        özel kanalına (oig_g3_<hash>) tek başına yedeklenir.
//
//   3) GitHub Veri Deposu (İsteğe Bağlı Ek Katman)
//      GITHUB_TOKEN + GITHUB_DATA_REPO tanımlıysa her değişiklik ayrıca
//      GitHub deposuna commit edilir.
// =====================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

const COLLECTIONS = ['games', 'users', 'comments', 'requests', 'brokenReports'];
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// Bulut kanalları (v3 parçalı yapı + v2 geri uyumluluk)
const CLOUD_INDEX_TOPIC = process.env.CLOUD_INDEX_TOPIC || 'oig_idx3_8d4f9a2c1e7b';
const CLOUD_GAME_PREFIX = process.env.CLOUD_GAME_PREFIX || 'oig_g3_8d4f_';
const LEGACY_CLOUD_TOPIC = process.env.CLOUD_SYNC_TOPIC || 'oyunindirgg_cloud_store_v2_8d4f9a2c1e7b';

// GitHub (isteğe bağlı)
const GH_API = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
const GH_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GH_REPO = (process.env.GITHUB_DATA_REPO || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
const GH_BRANCH = (process.env.GITHUB_DATA_BRANCH || 'main').trim();
const GITHUB_ENABLED = Boolean(GH_TOKEN && GH_REPO);

// Deploy Handoff (varsayılan anahtar sayesinde ek ayar olmadan da çalışır)
const INSTANCE_ID = crypto.randomBytes(8).toString('hex');
const HANDOFF_SECRET = process.env.HANDOFF_SECRET || process.env.RENDER_SERVICE_ID || 'oyunindirgg-default-handoff-2026';
const HANDOFF_KEY = crypto.createHash('sha256').update('oyunindirgg-handoff:' + HANDOFF_SECRET).digest('hex');
const HANDOFF_URLS = (process.env.HANDOFF_URLS ||
  [process.env.RENDER_EXTERNAL_URL, 'https://oyunindirgg.space', 'https://site-ap0j.onrender.com'].filter(Boolean).join(','))
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);

const status = {
  mode: GITHUB_ENABLED ? 'github+cloud+handoff' : 'cloud+handoff',
  instanceId: INSTANCE_ID,
  restoredFrom: [],
  lastSavedAt: null,
  lastError: null,
  pending: false
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Hangi oyunun buluta hangi içerik özetiyle (hash) yazıldığını takip et
const syncedGameHashes = new Map();

function gameTopicFor(gameId) {
  const h = crypto.createHash('sha1').update(String(gameId)).digest('hex').slice(0, 16);
  return `${CLOUD_GAME_PREFIX}${h}`;
}

function hashObj(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

// ---------------------------------------------------------------------
//  Yardımcılar
// ---------------------------------------------------------------------
function emptyDB() {
  return { settings: {}, users: [], games: [], comments: [], requests: [], brokenReports: [], tombstones: {} };
}

function normalizeDB(data) {
  const db = data && typeof data === 'object' ? data : emptyDB();
  db.settings = db.settings || {};
  COLLECTIONS.forEach(k => { if (!Array.isArray(db[k])) db[k] = []; });
  db.tombstones = db.tombstones && typeof db.tombstones === 'object' ? db.tombstones : {};
  COLLECTIONS.forEach(k => {
    if (!db.tombstones[k] || typeof db.tombstones[k] !== 'object') db.tombstones[k] = {};
  });
  if (Array.isArray(db.deletedGameIds)) {
    const now = Date.now();
    db.deletedGameIds.forEach(id => {
      if (!db.tombstones.games[id]) db.tombstones.games[id] = now;
    });
    delete db.deletedGameIds;
  }
  return db;
}

function itemTime(item) {
  const t = item && (item.updatedAt || item.createdAt);
  const n = typeof t === 'number' ? t : Date.parse(t || '');
  return Number.isFinite(n) ? n : 0;
}

function readLocalDB() {
  try {
    return normalizeDB(JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Veritabanı okuma hatası:', err.message);
    return normalizeDB(emptyDB());
  }
}

function writeLocalFile(db) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_PATH);
}

function stampChanges(prev, next) {
  const now = Date.now();
  COLLECTIONS.forEach(k => {
    const prevMap = new Map((prev[k] || []).filter(x => x && x.id).map(x => [x.id, x]));
    const nextIds = new Set();
    (next[k] || []).forEach(item => {
      if (!item || !item.id) return;
      nextIds.add(item.id);
      const old = prevMap.get(item.id);
      if (!old) {
        item.updatedAt = item.updatedAt || now;
        delete next.tombstones[k][item.id];
      } else {
        const { updatedAt: _a, ...oldRest } = old;
        const { updatedAt: _b, ...newRest } = item;
        if (JSON.stringify(oldRest) !== JSON.stringify(newRest)) item.updatedAt = now;
        else if (old.updatedAt) item.updatedAt = old.updatedAt;
      }
    });
    prevMap.forEach((_, id) => {
      if (!nextIds.has(id)) next.tombstones[k][id] = now;
    });
  });
}

function pruneTombstones(db) {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  COLLECTIONS.forEach(k => {
    Object.keys(db.tombstones[k]).forEach(id => {
      if (db.tombstones[k][id] < cutoff) delete db.tombstones[k][id];
    });
  });
}

function mergeDBs(aRaw, bRaw) {
  const a = normalizeDB(JSON.parse(JSON.stringify(aRaw || emptyDB())));
  const b = normalizeDB(JSON.parse(JSON.stringify(bRaw || emptyDB())));
  const newer = (b._updatedAt || 0) > (a._updatedAt || 0) ? b : a;
  const older = newer === a ? b : a;

  const out = {
    ...older,
    ...newer,
    settings: { ...(older.settings || {}), ...(newer.settings || {}) },
    tombstones: {},
    _updatedAt: Math.max(a._updatedAt || 0, b._updatedAt || 0)
  };

  COLLECTIONS.forEach(k => {
    const tomb = { ...older.tombstones[k] };
    Object.entries(newer.tombstones[k]).forEach(([id, ts]) => { tomb[id] = Math.max(tomb[id] || 0, ts); });

    const map = new Map();
    const order = [];
    const consider = (item, fromNewer) => {
      if (!item || !item.id) return;
      const cur = map.get(item.id);
      if (!cur) {
        map.set(item.id, item);
        order.push(item.id);
        return;
      }
      const ti = itemTime(item), tc = itemTime(cur);
      let winner = ti > tc || (ti === tc && fromNewer) ? item : cur;
      if (k === 'users') {
        const tokens = Array.from(new Set([...(cur.tokens || []), ...(item.tokens || []), cur.token, item.token].filter(Boolean)));
        winner = { ...winner, tokens };
      }
      map.set(item.id, winner);
    };
    newer[k].forEach(x => consider(x, true));
    older[k].forEach(x => consider(x, false));

    const list = order.map(id => map.get(id)).filter(item => !(tomb[item.id] && tomb[item.id] > itemTime(item)));
    list.forEach(item => { if (tomb[item.id]) delete tomb[item.id]; });

    if (k === 'games' || k === 'requests' || k === 'brokenReports') {
      list.sort((x, y) => (Date.parse(y.createdAt || '') || 0) - (Date.parse(x.createdAt || '') || 0));
    } else if (k === 'comments') {
      const src = newer.comments.length >= 2 ? newer.comments : older.comments;
      const desc = src.length >= 2 && (Date.parse(src[0].createdAt || '') || 0) > (Date.parse(src[src.length - 1].createdAt || '') || 0);
      list.sort((x, y) => {
        const d = (Date.parse(x.createdAt || '') || 0) - (Date.parse(y.createdAt || '') || 0);
        return desc ? -d : d;
      });
    }
    out[k] = list;
    out.tombstones[k] = tomb;
  });

  pruneTombstones(out);
  return out;
}

function dbStats(db) {
  return COLLECTIONS.map(k => `${(db[k] || []).length} ${k}`).join(', ');
}

// ---------------------------------------------------------------------
//  Parçalı Bulut Yedekleme (ntfy v3)
// ---------------------------------------------------------------------
async function pushNtfyJson(topic, obj, filename = 'data.json') {
  const jsonStr = JSON.stringify(obj);
  const bytes = Buffer.byteLength(jsonStr, 'utf-8');
  const res = bytes < 3500
    ? await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: jsonStr,
        signal: AbortSignal.timeout(20000)
      })
    : await fetch(`https://ntfy.sh/${topic}`, {
        method: 'PUT',
        headers: { Filename: filename },
        body: jsonStr,
        signal: AbortSignal.timeout(25000)
      });
  if (!res.ok) throw new Error(`ntfy ${topic} HTTP ${res.status}`);
}

async function fetchLatestNtfyJson(topic) {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=all`, {
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const evt = JSON.parse(lines[i]);
        if (evt.event !== 'message') continue;
        if (evt.attachment && evt.attachment.url) {
          const attRes = await fetch(evt.attachment.url, { signal: AbortSignal.timeout(15000) });
          if (attRes.ok) return await attRes.json();
        } else if (evt.message && evt.message.startsWith('{')) {
          return JSON.parse(evt.message);
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function pushCloudSharded(db) {
  // 1) Yalnızca yeni veya değişmiş oyunları kendi özel kanalına yükle
  for (const game of (db.games || [])) {
    if (!game || !game.id) continue;
    const gh = hashObj(game);
    if (syncedGameHashes.get(game.id) === gh) continue;
    await pushNtfyJson(gameTopicFor(game.id), game, `${game.id}.json`);
    syncedGameHashes.set(game.id, gh);
  }

  // 2) Hafif ana indeksi yükle (oyun gövdeleri hariç, sadece gameIds + diğer tablolar)
  const indexPayload = {
    _v: 3,
    _updatedAt: db._updatedAt || Date.now(),
    settings: db.settings || {},
    users: db.users || [],
    comments: db.comments || [],
    requests: db.requests || [],
    brokenReports: db.brokenReports || [],
    tombstones: db.tombstones || {},
    gameIds: (db.games || []).map(g => g.id).filter(Boolean)
  };
  await pushNtfyJson(CLOUD_INDEX_TOPIC, indexPayload, 'index.json');
}

async function loadFromCloudSharded(localGames = []) {
  const localGameMap = new Map((localGames || []).filter(g => g && g.id).map(g => [g.id, g]));
  const indexData = await fetchLatestNtfyJson(CLOUD_INDEX_TOPIC);

  // Eski v2 kanalını da kontrol et (geri uyumluluk)
  const legacyData = await fetchLatestNtfyJson(LEGACY_CLOUD_TOPIC);

  let combined = emptyDB();
  if (legacyData && Array.isArray(legacyData.games)) {
    combined = mergeDBs(combined, legacyData);
  }

  if (indexData && Array.isArray(indexData.gameIds)) {
    const games = [];
    for (const id of indexData.gameIds) {
      const cloudGame = await fetchLatestNtfyJson(gameTopicFor(id));
      if (cloudGame && cloudGame.id) {
        syncedGameHashes.set(cloudGame.id, hashObj(cloudGame));
        games.push(cloudGame);
      } else if (localGameMap.has(id)) {
        games.push(localGameMap.get(id));
      }
    }
    const fromIndex = normalizeDB({
      settings: indexData.settings || {},
      users: indexData.users || [],
      games,
      comments: indexData.comments || [],
      requests: indexData.requests || [],
      brokenReports: indexData.brokenReports || [],
      tombstones: indexData.tombstones || {},
      _updatedAt: indexData._updatedAt || Date.now()
    });
    combined = mergeDBs(combined, fromIndex);
  }

  if ((combined.games && combined.games.length > 0) || (combined.users && combined.users.length > 0)) {
    return combined;
  }
  return null;
}

// ---------------------------------------------------------------------
//  Görsel Dışsallaştırma (yalnızca GitHub depolama açıkken)
// ---------------------------------------------------------------------
const EXT_BY_MIME = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
const MEDIA_NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;
const remoteMedia = new Map();
const pendingMedia = new Map();

function externalizeDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return value;
  const m = value.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return value;
  const ext = EXT_BY_MIME[m[1].toLowerCase()];
  if (!ext) return value;
  const buf = Buffer.from(m[2], 'base64');
  const name = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32) + '.' + ext;
  const localPath = path.join(MEDIA_DIR, name);
  if (!fs.existsSync(localPath)) fs.writeFileSync(localPath, buf);
  const key = 'images/' + name;
  if (!remoteMedia.has(key)) pendingMedia.set(key, buf);
  return '/media/' + name;
}

function externalizeMedia(db) {
  if (!GITHUB_ENABLED) return;
  (db.games || []).forEach(g => {
    g.cover = externalizeDataUrl(g.cover);
    g.banner = externalizeDataUrl(g.banner);
    if (Array.isArray(g.screenshots)) g.screenshots = g.screenshots.map(externalizeDataUrl);
  });
  (db.users || []).forEach(u => { u.avatar = externalizeDataUrl(u.avatar); });
  (db.requests || []).forEach(r => { r.userAvatar = externalizeDataUrl(r.userAvatar); });
  (db.comments || []).forEach(c => { if (c.avatar) c.avatar = externalizeDataUrl(c.avatar); });
}

async function getMediaFile(name) {
  if (!MEDIA_NAME_RE.test(name)) return null;
  const localPath = path.join(MEDIA_DIR, name);
  if (fs.existsSync(localPath)) return localPath;
  if (!GITHUB_ENABLED) return null;
  try {
    const key = 'images/' + name;
    let sha = remoteMedia.get(key);
    if (!sha) {
      await loadRemoteTree();
      sha = remoteMedia.get(key);
    }
    if (!sha) return null;
    const blob = await gh('GET', `/repos/${GH_REPO}/git/blobs/${sha}`);
    if (blob.status !== 200) return null;
    fs.writeFileSync(localPath, Buffer.from(blob.data.content, 'base64'));
    return localPath;
  } catch (err) {
    console.error('Görsel indirme hatası:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------
//  GitHub İstemcisi (İsteğe Bağlı)
// ---------------------------------------------------------------------
async function gh(method, urlPath, body) {
  const res = await fetch(GH_API + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'oyunindirgg-server',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

let head = null;

async function getHead() {
  const ref = await gh('GET', `/repos/${GH_REPO}/git/ref/heads/${encodeURIComponent(GH_BRANCH)}`);
  if (ref.status === 404 || ref.status === 409) return null;
  if (ref.status !== 200) throw new Error(`GitHub ref okunamadı (HTTP ${ref.status})`);
  const commitSha = ref.data.object.sha;
  const commit = await gh('GET', `/repos/${GH_REPO}/git/commits/${commitSha}`);
  if (commit.status !== 200) throw new Error(`GitHub commit okunamadı (HTTP ${commit.status})`);
  return { commitSha, treeSha: commit.data.tree.sha };
}

async function loadRemoteTree() {
  head = await getHead();
  if (!head) return null;
  const tree = await gh('GET', `/repos/${GH_REPO}/git/trees/${head.treeSha}?recursive=1`);
  if (tree.status !== 200) throw new Error(`GitHub dosya listesi okunamadı (HTTP ${tree.status})`);
  let dbSha = null;
  (tree.data.tree || []).forEach(e => {
    if (e.type !== 'blob') return;
    if (e.path === 'db.json') dbSha = e.sha;
    if (e.path.startsWith('images/')) remoteMedia.set(e.path, e.sha);
  });
  return dbSha;
}

async function loadFromGitHub() {
  const dbSha = await loadRemoteTree();
  if (!dbSha) return null;
  const blob = await gh('GET', `/repos/${GH_REPO}/git/blobs/${dbSha}`);
  if (blob.status !== 200) throw new Error(`GitHub db.json okunamadı (HTTP ${blob.status})`);
  return normalizeDB(JSON.parse(Buffer.from(blob.data.content, 'base64').toString('utf-8')));
}

async function initEmptyRepo() {
  const res = await gh('PUT', `/repos/${GH_REPO}/contents/README.md`, {
    message: 'OyunIndir.gg veri deposu oluşturuldu',
    content: Buffer.from('# OyunIndir.gg veri deposu\n').toString('base64'),
    branch: GH_BRANCH
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Boş depo başlatılamadı (HTTP ${res.status})`);
  }
}

async function pushToGitHub() {
  const db = readLocalDB();
  const dbJson = JSON.stringify(db, null, 2);
  const mediaBatch = new Map(pendingMedia);

  for (let attempt = 1; attempt <= 4; attempt++) {
    if (!head) head = await getHead();
    if (!head) {
      await initEmptyRepo();
      head = await getHead();
      if (!head) throw new Error('Depo başlatıldı ama dal bulunamadı');
    }

    const treeEntries = [];
    for (const [key, buf] of mediaBatch) {
      if (remoteMedia.has(key)) continue;
      const blob = await gh('POST', `/repos/${GH_REPO}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
      if (blob.status !== 201) throw new Error(`Görsel yüklenemedi (HTTP ${blob.status})`);
      treeEntries.push({ path: key, mode: '100644', type: 'blob', sha: blob.data.sha });
    }
    const dbBlob = await gh('POST', `/repos/${GH_REPO}/git/blobs`, { content: Buffer.from(dbJson).toString('base64'), encoding: 'base64' });
    if (dbBlob.status !== 201) throw new Error(`db.json yüklenemedi (HTTP ${dbBlob.status})`);
    treeEntries.push({ path: 'db.json', mode: '100644', type: 'blob', sha: dbBlob.data.sha });

    const tree = await gh('POST', `/repos/${GH_REPO}/git/trees`, { base_tree: head.treeSha, tree: treeEntries });
    if (tree.status !== 201) throw new Error(`Tree oluşturulamadı (HTTP ${tree.status})`);
    const commit = await gh('POST', `/repos/${GH_REPO}/git/commits`, {
      message: `Veri güncellemesi (${dbStats(db)})`,
      tree: tree.data.sha,
      parents: [head.commitSha]
    });
    if (commit.status !== 201) throw new Error(`Commit oluşturulamadı (HTTP ${commit.status})`);
    const upd = await gh('PATCH', `/repos/${GH_REPO}/git/refs/heads/${encodeURIComponent(GH_BRANCH)}`, { sha: commit.data.sha, force: false });

    if (upd.status === 200) {
      head = { commitSha: commit.data.sha, treeSha: tree.data.sha };
      treeEntries.forEach(e => { if (e.path.startsWith('images/')) remoteMedia.set(e.path, e.sha); });
      mediaBatch.forEach((_, key) => pendingMedia.delete(key));
      return;
    }
    head = null;
    if (attempt === 4) throw new Error(`Dal güncellenemedi (HTTP ${upd.status})`);
  }
}

// ---------------------------------------------------------------------
//  Asenkron Yedekleme Kuyruğu
// ---------------------------------------------------------------------
let saveTimer = null;
let saveChain = Promise.resolve();
let dirty = false;
let lastSavedSnapshotHash = '';

function computeSnapshotHash(db) {
  const { _updatedAt, ...rest } = db || {};
  return hashObj(rest);
}

function runSave() {
  saveChain = saveChain.then(async () => {
    if (!dirty) return;
    dirty = false;
    try {
      const db = readLocalDB();
      await pushCloudSharded(db);
      if (GITHUB_ENABLED) {
        await pushToGitHub();
      }
      lastSavedSnapshotHash = computeSnapshotHash(db);
      status.lastSavedAt = new Date().toISOString();
      status.lastCheckedAt = status.lastSavedAt;
      status.lastError = null;
      status.pending = dirty;
    } catch (err) {
      status.lastError = err.message;
      console.error('Bulut yedekleme uyarısı:', err.message);
    }
  });
  return saveChain;
}

// Her 10 dakikada bir yapılan değişiklikleri kontrol et ve kaydedilmemiş fark varsa kaydet
async function checkAndSaveChanges() {
  status.lastCheckedAt = new Date().toISOString();
  const db = readLocalDB();
  const currentHash = computeSnapshotHash(db);
  const hasUnsyncedGame = (db.games || []).some(g => g && g.id && syncedGameHashes.get(g.id) !== hashObj(g));
  if (dirty || currentHash !== lastSavedSnapshotHash || hasUnsyncedGame) {
    dirty = true;
    await runSave();
    console.log(`[10dk Otomatik Kayıt] Değişiklik tespit edildi ve kalıcı olarak yedeklendi (${dbStats(db)}).`);
    return { changed: true, savedAt: status.lastSavedAt };
  }
  return { changed: false, checkedAt: status.lastCheckedAt };
}

function scheduleSave(delay = 1500) {
  dirty = true;
  status.pending = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; runSave(); }, delay);
}

async function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await runSave();
}

// ---------------------------------------------------------------------
//  Uygulamanın kullandığı okuma / yazma
// ---------------------------------------------------------------------
function readDB() {
  return readLocalDB();
}

function writeDB(data) {
  const db = normalizeDB(data);
  externalizeMedia(db);
  stampChanges(readLocalDB(), db);
  pruneTombstones(db);
  db._updatedAt = Date.now();
  writeLocalFile(db);
  scheduleSave();
}

// ---------------------------------------------------------------------
//  Deploy Devir Teslimi (Handoff + /api/bootstrap Yedeği)
// ---------------------------------------------------------------------
function handoffAuthorized(req) {
  if (!HANDOFF_KEY) return false;
  const given = String(req.headers['x-handoff-key'] || '');
  if (given.length !== HANDOFF_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(HANDOFF_KEY));
}

function handoffPayload() {
  return { instanceId: INSTANCE_ID, db: readLocalDB() };
}

async function fetchHandoff() {
  for (const base of HANDOFF_URLS) {
    try {
      const res = await fetch(base + '/api/_handoff', {
        headers: { 'x-handoff-key': HANDOFF_KEY },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.db) {
          return { self: data.instanceId === INSTANCE_ID, db: normalizeDB(data.db), source: base + '/api/_handoff' };
        }
      }
    } catch {}

    // Yedek: Eski sürüm sunucuda /api/_handoff henüz yoksa /api/bootstrap'tan oyunları ve yorumları çek
    try {
      const res = await fetch(base + '/api/bootstrap', {
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.games) && data.games.length > 0) {
          return {
            self: false,
            db: normalizeDB({
              settings: data.settings || {},
              games: data.games || [],
              comments: data.comments || [],
              _updatedAt: Date.now()
            }),
            source: base + '/api/bootstrap'
          };
        }
      }
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------
//  Açılışta Veriyi Geri Yükle
// ---------------------------------------------------------------------
async function restoreOnStartup() {
  const seed = readLocalDB();
  let base = seed;
  status.restoredFrom = ['seed'];

  // 1) GitHub backup-db dalındaki 10 dakikalık kalıcı yedeği birleştir
  try {
    const res = await fetch('https://raw.githubusercontent.com/rfssusgg-ship-it/site/refs/heads/backup-db/data/db.json?t=' + Date.now(), {
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const backupBranchDB = normalizeDB(await res.json());
      if ((backupBranchDB.games || []).length > 0) {
        base = mergeDBs(base, backupBranchDB);
        status.restoredFrom.push('github-backup-db');
      }
    }
  } catch {}

  // 2) Parçalı Bulut Yedeklerini birleştir
  try {
    const cloudDB = await loadFromCloudSharded(base.games);
    if (cloudDB) {
      base = mergeDBs(base, cloudDB);
      status.restoredFrom.push('cloud-v3');
    }
  } catch (err) {
    console.error('Bulut verisi okuma uyarısı:', err.message);
  }

  // 2) GitHub Veri Deposu açıksa birleştir
  if (GITHUB_ENABLED) {
    try {
      const remote = await loadFromGitHub();
      if (remote) {
        base = mergeDBs(base, remote);
        status.restoredFrom.push('github');
      }
    } catch (err) {
      status.lastError = err.message;
      console.error('GitHub verisi okunamadı:', err.message);
    }
  }

  // 3) Canlı çalışan önceki sunucudan (Handoff) birleştir
  const handoff = await fetchHandoff();
  if (handoff && !handoff.self) {
    base = mergeDBs(base, handoff.db);
    status.restoredFrom.push('handoff');
    console.log(`Önceki sunucudan veri devralındı (${handoff.source}).`);
  }

  base = normalizeDB(base);
  externalizeMedia(base);
  writeLocalFile(base);
  console.log(`Veritabanı hazır [${status.restoredFrom.join(' + ')}]: ${dbStats(base)}`);

  // Başlangıçtaki birleşmiş durumu buluta da senkronize et
  scheduleSave(1000);
}

function startHandoffCatchUp() {
  let rounds = 0;
  const timer = setInterval(async () => {
    rounds++;
    if (rounds >= 18) clearInterval(timer);
    const handoff = await fetchHandoff();
    if (!handoff) return;
    if (handoff.self) { clearInterval(timer); return; }
    const local = readLocalDB();
    const merged = mergeDBs(local, handoff.db);
    if ((merged.games || []).length > (local.games || []).length || JSON.stringify(merged.games) !== JSON.stringify(local.games)) {
      externalizeMedia(merged);
      writeLocalFile(merged);
      scheduleSave();
      console.log('Eski sunucudaki son değişiklikler devralındı.');
    }
  }, 10000);
}

module.exports = {
  readDB,
  writeDB,
  flush,
  mergeDBs,
  pushCloudSharded,
  checkAndSaveChanges,
  restoreOnStartup,
  startHandoffCatchUp,
  handoffAuthorized,
  handoffPayload,
  getMediaFile,
  status,
  GITHUB_ENABLED
};
