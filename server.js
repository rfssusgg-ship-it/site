const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
const { readDB, writeDB } = storage;

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

const PUBLIC_URLS = [
  'https://oyunindirgg.space/api/ping',
  'https://www.oyunindirgg.space/api/ping',
  'https://site-ap0j.onrender.com/api/ping'
];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Veri okuma/yazma ve kalıcılık storage.js içinde (Canlı Handoff + Parçalı Bulut v3 + GitHub)
function startKeepAliveAndSync() {
  // Her 3.5 dakikada bir dış adreslere ping atarak Render'ın uykuya geçmesini engelle
  setInterval(() => {
    PUBLIC_URLS.forEach(url => {
      https.get(url, res => {
        res.resume();
      }).on('error', () => {});
    });
  }, 3.5 * 60 * 1000);

  // Her 10 dakikada bir sitedeki değişiklikleri kontrol et ve kalıcı olarak yedekle
  setInterval(() => {
    storage.checkAndSaveChanges().catch(() => {});
  }, 10 * 60 * 1000);
}

function slugify(text) {
  const trMap = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
  };
  const replaced = String(text || '').replace(/[çÇğĞıİöÖşŞüÜ]/g, m => trMap[m] || m);
  return replaced
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || ('oyun-' + Date.now());
}

function sendJSON(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error('Dosya boyutu çok büyük'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Geçersiz veri formatı'));
      }
    });
    req.on('error', reject);
  });
}

function getCurrentUser(req, db) {
  const token = req.headers['x-auth-token'] || '';
  if (!token) return null;
  const user = db.users.find(u => u.token === token || (Array.isArray(u.tokens) && u.tokens.includes(token)));
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    avatar: user.avatar || '',
    role: user.role,
    createdAt: user.createdAt
  };
}

function enrichComments(comments, users) {
  const userMap = new Map(users.map(u => [u.id, u]));
  return (comments || []).map(c => {
    const u = userMap.get(c.userId) || users.find(x => x.username.toLowerCase() === String(c.author || '').toLowerCase());
    return {
      ...c,
      author: u ? u.username : c.author,
      authorAvatar: u ? (u.avatar || '') : (c.authorAvatar || ''),
      isAdmin: u ? u.role === 'admin' : Boolean(c.isAdmin),
      replies: (c.replies || []).map(r => {
        const ru = userMap.get(r.userId) || users.find(x => x.username.toLowerCase() === String(r.author || '').toLowerCase());
        return {
          ...r,
          author: ru ? ru.username : r.author,
          authorAvatar: ru ? (ru.avatar || '') : (r.authorAvatar || ''),
          isAdmin: ru ? ru.role === 'admin' : Boolean(r.isAdmin)
        };
      })
    };
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // 0. Keep-Alive Ping Uç Noktası
    if (pathname === '/api/ping' && method === 'GET') {
      return sendJSON(res, 200, { ok: true, time: Date.now(), instanceId: storage.status.instanceId });
    }

    // 0b. Deploy Devir Teslimi (Handoff — yalnızca sunucu anahtarıyla erişilebilir)
    if (pathname === '/api/_handoff' && method === 'GET') {
      if (!storage.handoffAuthorized(req)) {
        return sendJSON(res, 403, { error: 'Yetkisiz' });
      }
      return sendJSON(res, 200, storage.handoffPayload());
    }

    // 0c. Dışsallaştırılmış Görseller (/media/<ad>)
    if (pathname.startsWith('/media/') && method === 'GET') {
      const name = decodeURIComponent(pathname.slice('/media/'.length));
      const mediaFile = await storage.getMediaFile(name);
      if (!mediaFile) return sendJSON(res, 404, { error: 'Görsel bulunamadı' });
      const ext = path.extname(mediaFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      return fs.createReadStream(mediaFile).pipe(res);
    }

    // Google & Arama Motorları İçin Dinamik Site Haritası (Sitemap)
    if (pathname === '/sitemap.xml' && method === 'GET') {
      const db = readDB();
      const domain = 'https://oyunindirgg.space';
      const today = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      xml += `  <url>\n    <loc>${domain}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

      (db.games || []).forEach(g => {
        const mod = g.createdAt ? String(g.createdAt).split('T')[0] : today;
        xml += `  <url>\n    <loc>${domain}/#/oyun/${encodeURIComponent(g.id)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      });

      xml += `</urlset>`;

      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      return res.end(xml);
    }

    // Google Search Console Doğrulama
    if (pathname === '/googleed8f3777dd692581.html' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('google-site-verification: googleed8f3777dd692581.html');
    }

    // 1. Bootstrap (Site açılış verileri)
    if (pathname === '/api/bootstrap' && method === 'GET') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      const isAdmin = currentUser && currentUser.role === 'admin';
      const enrichedComments = enrichComments(db.comments, db.users);

      const safeGames = (db.games || []).map(g => {
        if (isAdmin) {
          return {
            ...g,
            viewCount: Number(g.viewCount) || 0,
            downloadCount: Number(g.downloadCount) || 0
          };
        }
        const clean = { ...g };
        delete clean.viewCount;
        delete clean.downloadCount;
        return clean;
      });

      return sendJSON(res, 200, {
        settings: db.settings,
        games: safeGames,
        comments: enrichedComments,
        requests: isAdmin ? db.requests : [],
        brokenReports: isAdmin ? db.brokenReports : [],
        usersCount: isAdmin ? db.users.length : undefined,
        users: isAdmin
          ? db.users.map(u => ({
              id: u.id,
              username: u.username,
              email: u.email || '',
              avatar: u.avatar || '',
              role: u.role,
              createdAt: u.createdAt
            }))
          : undefined,
        currentUser
      });
    }

    // 2. Kayıt Ol
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const username = String(body.username || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (username.length < 3 || username.length > 24) {
        return sendJSON(res, 400, { error: 'Kullanıcı adı 3 ile 24 karakter arasında olmalıdır.' });
      }
      if (!/^[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ.\-]+$/.test(username)) {
        return sendJSON(res, 400, { error: 'Kullanıcı adında geçersiz karakter var.' });
      }
      if (password.length < 4) {
        return sendJSON(res, 400, { error: 'Şifre en az 4 karakter olmalıdır.' });
      }

      const db = readDB();
      const existsUser = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
      if (existsUser) {
        return sendJSON(res, 400, { error: 'Bu kullanıcı adı zaten alınmış.' });
      }
      if (email && db.users.some(u => u.email && u.email.toLowerCase() === email)) {
        return sendJSON(res, 400, { error: 'Bu e-posta adresi zaten kayıtlı.' });
      }

      // Yeni kayıt olan tüm kullanıcılar istisnasız 'user' rolündedir; sistemde sadece tek admin (swo) bulunabilir
      const token = crypto.randomBytes(24).toString('hex');

      const newUser = {
        id: 'u-' + Date.now(),
        username,
        email,
        avatar: '',
        passwordHash: password,
        role: 'user',
        token,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      writeDB(db);

      return sendJSON(res, 200, {
        ok: true,
        token,
        user: { id: newUser.id, username: newUser.username, email: newUser.email, avatar: newUser.avatar, role: newUser.role }
      });
    }

    // 3. Giriş Yap
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const loginId = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');

      const db = readDB();
      const user = db.users.find(
        u =>
          (u.username.toLowerCase() === loginId || (u.email && u.email.toLowerCase() === loginId)) &&
          u.passwordHash === password
      );

      if (!user) {
        return sendJSON(res, 401, { error: 'Kullanıcı adı veya şifre hatalı!' });
      }

      const token = crypto.randomBytes(24).toString('hex');
      user.token = token;
      user.tokens = Array.from(new Set([...(user.tokens || []), user.token, token].filter(Boolean)));
      writeDB(db);

      return sendJSON(res, 200, {
        ok: true,
        token,
        user: { id: user.id, username: user.username, email: user.email || '', avatar: user.avatar || '', role: user.role }
      });
    }

    // 4. Çıkış Yap
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = req.headers['x-auth-token'] || '';
      if (token) {
        const db = readDB();
        const u = db.users.find(x => x.token === token);
        if (u) {
          delete u.token;
          writeDB(db);
        }
      }
      return sendJSON(res, 200, { ok: true });
    }

    // 5. Hesap Ayarları & Profil Güncelleme
    if (pathname === '/api/profile' && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser) {
        return sendJSON(res, 401, { error: 'Oturum açmanız gerekiyor.' });
      }

      const body = await parseBody(req);
      const userRecord = db.users.find(u => u.id === currentUser.id);
      if (!userRecord) return sendJSON(res, 404, { error: 'Kullanıcı bulunamadı.' });

      if (body.username !== undefined) {
        const newUsername = String(body.username).trim();
        if (newUsername.length < 3 || newUsername.length > 24) {
          return sendJSON(res, 400, { error: 'Kullanıcı adı 3 ile 24 karakter arasında olmalıdır.' });
        }
        const taken = db.users.some(u => u.id !== userRecord.id && u.username.toLowerCase() === newUsername.toLowerCase());
        if (taken) return sendJSON(res, 400, { error: 'Bu kullanıcı adı başka bir üye tarafından kullanılıyor.' });
        userRecord.username = newUsername;
      }

      if (body.email !== undefined) {
        const newEmail = String(body.email).trim().toLowerCase();
        if (newEmail) {
          const emailTaken = db.users.some(u => u.id !== userRecord.id && u.email && u.email.toLowerCase() === newEmail);
          if (emailTaken) return sendJSON(res, 400, { error: 'Bu e-posta adresi zaten kullanımda.' });
        }
        userRecord.email = newEmail;
      }

      if (body.avatar !== undefined) {
        userRecord.avatar = String(body.avatar).trim();
      }

      if (body.newPassword) {
        if (!body.currentPassword || body.currentPassword !== userRecord.passwordHash) {
          return sendJSON(res, 400, { error: 'Mevcut şifrenizi yanlış girdiniz.' });
        }
        if (String(body.newPassword).length < 4) {
          return sendJSON(res, 400, { error: 'Yeni şifre en az 4 karakter olmalıdır.' });
        }
        userRecord.passwordHash = String(body.newPassword);
      }

      writeDB(db);
      return sendJSON(res, 200, {
        ok: true,
        user: {
          id: userRecord.id,
          username: userRecord.username,
          email: userRecord.email || '',
          avatar: userRecord.avatar || '',
          role: userRecord.role,
          createdAt: userRecord.createdAt
        },
        comments: enrichComments(db.comments, db.users)
      });
    }

    // 6. Görsel Yükleme (Kalıcı olması için doğrudan DataURL olarak da saklanır)
    if (pathname === '/api/upload' && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser) {
        return sendJSON(res, 401, { error: 'Resim yüklemek için giriş yapmalısınız.' });
      }
      const body = await parseBody(req);
      if (!body.dataUrl) return sendJSON(res, 400, { error: 'Görsel verisi yok' });
      const match = body.dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!match) return sendJSON(res, 400, { error: 'Geçersiz görsel formatı' });

      // Sunucu yeniden başlasa bile görselin kaybolmaması için doğrudan dataUrl döndürülür
      return sendJSON(res, 200, { ok: true, url: body.dataUrl });
    }

function normalizeSysReqPart(part) {
  if (!part) return { raw: '', lines: [], os: '', cpu: '', ram: '', gpu: '', storage: '' };
  if (typeof part === 'string') {
    part = { raw: part };
  }
  const raw = String(part.raw || '').trim();
  let os = String(part.os || '').trim();
  let cpu = String(part.cpu || '').trim();
  let ram = String(part.ram || '').trim();
  let gpu = String(part.gpu || '').trim();
  let storage = String(part.storage || '').trim();
  let lines = Array.isArray(part.lines) ? part.lines.filter(Boolean) : [];

  if (raw && lines.length === 0) {
    const rawLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    rawLines.forEach(line => {
      const cleanLine = line.replace(/^[\s*•\-–—#]+/, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (!cleanLine) return;
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx > -1) {
        const rawLabel = cleanLine.substring(0, colonIdx).trim().replace(/[\*\:]+$/g, '').trim();
        const rawVal = cleanLine.substring(colonIdx + 1).trim();
        const lowerLabel = rawLabel.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
        if (!os && (lowerLabel.includes('işletim') || lowerLabel.includes('isletim') || lowerLabel === 'os' || lowerLabel.startsWith('os ') || lowerLabel.includes('windows'))) {
          os = rawVal;
        } else if (!cpu && (lowerLabel.includes('işlemci') || lowerLabel.includes('islemci') || lowerLabel.includes('processor') || lowerLabel.includes('cpu'))) {
          cpu = rawVal;
        } else if (!ram && (lowerLabel.includes('bellek') || lowerLabel.includes('ram') || lowerLabel.includes('memory'))) {
          ram = rawVal;
        } else if (!gpu && (lowerLabel.includes('ekran') || lowerLabel.includes('grafik') || lowerLabel.includes('graphics') || lowerLabel.includes('gpu') || lowerLabel.includes('video'))) {
          gpu = rawVal;
        } else if (!storage && (lowerLabel.includes('depolama') || lowerLabel.includes('storage') || lowerLabel.includes('disk') || lowerLabel.includes('hdd') || lowerLabel.includes('ssd') || lowerLabel.includes('alan'))) {
          storage = rawVal;
        }
        lines.push({ label: rawLabel, value: rawVal });
      } else {
        lines.push({ label: '', value: cleanLine });
      }
    });
  }

  return { raw, lines, os, cpu, ram, gpu, storage };
}

    // 7. Oyun Ekle veya Güncelle (Sadece Admin)
    if (pathname === '/api/games' && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') {
        return sendJSON(res, 403, { error: 'Sadece Admin oyun ekleyebilir veya düzenleyebilir.' });
      }
      const body = await parseBody(req);
      if (!body.title) return sendJSON(res, 400, { error: 'Oyun adı zorunludur.' });

      const existingIndex = db.games.findIndex(g => g.id === body.id);

      const gameObj = {
        id: body.id || slugify(body.title),
        title: body.title.trim(),
        version: String(body.version || '').trim(),
        category: String(body.category || '').trim(),
        tags: Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        size: String(body.size || '').trim(),
        language: String(body.language || '').trim(),
        repack: String(body.repack || '').trim(),
        featured: Boolean(body.featured),
        createdAt: existingIndex > -1 ? db.games[existingIndex].createdAt : new Date().toISOString(),
        viewCount: existingIndex > -1 ? (Number(db.games[existingIndex].viewCount) || 0) : 0,
        downloadCount: existingIndex > -1 ? (Number(db.games[existingIndex].downloadCount) || 0) : 0,
        cover: String(body.cover || '').trim(),
        coverPosition: String(body.coverPosition || '50% 50%').trim(),
        coverScale: Number(body.coverScale) || 1,
        coverFit: String(body.coverFit || 'cover').trim(),
        banner: String(body.banner || body.cover || '').trim(),
        youtubeUrl: String(body.youtubeUrl || '').trim(),
        rarPassword: body.rarPassword !== undefined ? String(body.rarPassword).trim() : String(db.settings?.rarPassword || 'www.oyunindirgg.space').trim(),
        downloadNote: String(body.downloadNote || '').trim(),
        screenshots: Array.isArray(body.screenshots) ? body.screenshots.filter(Boolean) : [],
        shortDesc: String(body.shortDesc || '').trim(),
        description: String(body.description || '').trim(),
        installNotes: String(body.installNotes || '').trim(),
        sysReq: {
          min: normalizeSysReqPart(body.sysReq?.min),
          rec: normalizeSysReqPart(body.sysReq?.rec)
        },
        links: Array.isArray(body.links)
          ? body.links.filter(l => l && String(l.url || '').trim() !== '')
          : []
      };

      if (existingIndex > -1) {
        db.games[existingIndex] = gameObj;
      } else {
        if (db.games.some(g => g.id === gameObj.id)) {
          gameObj.id = `${gameObj.id}-${Math.floor(Math.random() * 1000)}`;
        }
        db.games.unshift(gameObj);
      }

      writeDB(db);
      return sendJSON(res, 200, { ok: true, game: gameObj, games: db.games });
    }

    // 8. Oyun Sil (Sadece Admin)
    if (pathname.startsWith('/api/games/') && method === 'DELETE') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') {
        return sendJSON(res, 403, { error: 'Yetkisiz işlem' });
      }
      const id = decodeURIComponent(pathname.split('/')[3]);
      db.games = db.games.filter(g => g.id !== id);
      db.comments = db.comments.filter(c => c.gameId !== id);
      db.deletedGameIds = Array.from(new Set([...(db.deletedGameIds || []), id]));
      writeDB(db);
      return sendJSON(res, 200, { ok: true, games: db.games });
    }

    // 8.1 Oyun Görüntülenme Sayacı (Herkese Açık artırılır, sayaç sadece adminse döner)
    if (pathname.match(/^\/api\/games\/[^/]+\/view$/) && method === 'POST') {
      const parts = pathname.split('/');
      const id = decodeURIComponent(parts[3] || '');
      const db = readDB();
      const game = (db.games || []).find(g => g.id === id);
      if (!game) return sendJSON(res, 404, { error: 'Oyun bulunamadı' });

      game.viewCount = (Number(game.viewCount) || 0) + 1;
      game.updatedAt = new Date().toISOString();
      writeDB(db);

      const currentUser = getCurrentUser(req, db);
      const isAdmin = currentUser && currentUser.role === 'admin';
      return sendJSON(res, 200, {
        ok: true,
        viewCount: isAdmin ? game.viewCount : undefined
      });
    }

    // 8.2 Oyun İndirme Sayacı (Herkese Açık artırılır, sayaç sadece adminse döner)
    if (pathname.match(/^\/api\/games\/[^/]+\/download$/) && method === 'POST') {
      const parts = pathname.split('/');
      const id = decodeURIComponent(parts[3] || '');
      const db = readDB();
      const game = (db.games || []).find(g => g.id === id);
      if (!game) return sendJSON(res, 404, { error: 'Oyun bulunamadı' });

      game.downloadCount = (Number(game.downloadCount) || 0) + 1;
      game.updatedAt = new Date().toISOString();
      writeDB(db);

      const currentUser = getCurrentUser(req, db);
      const isAdmin = currentUser && currentUser.role === 'admin';
      return sendJSON(res, 200, {
        ok: true,
        downloadCount: isAdmin ? game.downloadCount : undefined
      });
    }

    // 9. Yorum Ekle
    if (pathname === '/api/comments' && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser) {
        return sendJSON(res, 401, { error: 'Yorum yapabilmek için lütfen giriş yapın veya hesap oluşturun.' });
      }

      const body = await parseBody(req);
      if (!body.gameId || !body.text || !String(body.text).trim()) {
        return sendJSON(res, 400, { error: 'Yorum alanı boş bırakılamaz.' });
      }

      const game = db.games.find(g => g.id === body.gameId);
      if (!game) return sendJSON(res, 404, { error: 'Oyun bulunamadı.' });

      const newComment = {
        id: 'c-' + Date.now(),
        gameId: game.id,
        gameTitle: game.title,
        userId: currentUser.id,
        author: currentUser.username,
        authorAvatar: currentUser.avatar || '',
        isAdmin: currentUser.role === 'admin',
        text: String(body.text).trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
        replies: []
      };

      db.comments.unshift(newComment);
      writeDB(db);
      return sendJSON(res, 200, { ok: true, comment: newComment, comments: enrichComments(db.comments, db.users) });
    }

    // 10. Yoruma Yanıt Ver
    if (pathname.startsWith('/api/comments/') && pathname.endsWith('/reply') && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser) {
        return sendJSON(res, 401, { error: 'Yanıt yazabilmek için lütfen giriş yapın.' });
      }

      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseBody(req);
      if (!body.text || !String(body.text).trim()) {
        return sendJSON(res, 400, { error: 'Yanıt alanı boş bırakılamaz.' });
      }

      const comment = db.comments.find(c => c.id === id);
      if (!comment) return sendJSON(res, 404, { error: 'Yorum bulunamadı.' });

      comment.replies = comment.replies || [];
      comment.replies.push({
        id: 'r-' + Date.now(),
        userId: currentUser.id,
        author: currentUser.username,
        authorAvatar: currentUser.avatar || '',
        isAdmin: currentUser.role === 'admin',
        text: String(body.text).trim().slice(0, 800),
        createdAt: new Date().toISOString()
      });

      writeDB(db);
      return sendJSON(res, 200, { ok: true, comments: enrichComments(db.comments, db.users) });
    }

    // 11. Yorum Sil
    if (pathname.startsWith('/api/comments/') && method === 'DELETE') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser) return sendJSON(res, 403, { error: 'Yetkisiz işlem' });

      const id = decodeURIComponent(pathname.split('/')[3]);
      const target = db.comments.find(c => c.id === id);
      if (!target) return sendJSON(res, 404, { error: 'Yorum bulunamadı' });

      if (currentUser.role !== 'admin' && target.userId !== currentUser.id) {
        return sendJSON(res, 403, { error: 'Sadece kendi yorumunuzu silebilirsiniz.' });
      }

      db.comments = db.comments.filter(c => c.id !== id);
      writeDB(db);
      return sendJSON(res, 200, { ok: true, comments: enrichComments(db.comments, db.users) });
    }

    // 12. Oyun İstek Gönder / Yönet
    if (pathname === '/api/requests' && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser) {
        return sendJSON(res, 401, { error: 'Oyun isteğinde bulunmak için lütfen giriş yapın.' });
      }
      const body = await parseBody(req);
      if (!body.gameName) {
        return sendJSON(res, 400, { error: 'İstenen oyun adı gerekli.' });
      }
      const reqItem = {
        id: 'req-' + Date.now(),
        user: currentUser.username,
        userAvatar: currentUser.avatar || '',
        gameName: String(body.gameName).trim().slice(0, 80),
        note: String(body.note || '').trim().slice(0, 300),
        status: 'Bekliyor',
        createdAt: new Date().toISOString()
      };
      db.requests.unshift(reqItem);
      writeDB(db);
      return sendJSON(res, 200, { ok: true, requests: currentUser.role === 'admin' ? db.requests : [] });
    }

    if (pathname.startsWith('/api/requests/') && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') {
        return sendJSON(res, 403, { error: 'Yetkisiz işlem' });
      }
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseBody(req);
      if (body.action === 'delete') {
        db.requests = db.requests.filter(r => r.id !== id);
      } else {
        const item = db.requests.find(r => r.id === id);
        if (item) item.status = body.status || 'Eklendi';
      }
      writeDB(db);
      return sendJSON(res, 200, { ok: true, requests: db.requests });
    }

    // 13. Kırık Link Bildirimi
    if (pathname === '/api/broken' && method === 'POST') {
      const body = await parseBody(req);
      const db = readDB();
      const gameId = String(body.gameId || '').trim();
      if (!gameId) return sendJSON(res, 400, { error: 'Geçersiz oyun.' });

      // Bildirimi yapan kişiyi belirle: üye ise kullanıcı ID, değilse IP + tarayıcı kimliği
      const currentUser = getCurrentUser(req, db);
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const clientId = String(body.clientId || '').slice(0, 64);
      const reporterKeys = [];
      if (currentUser) reporterKeys.push('u:' + currentUser.id);
      if (ip) reporterKeys.push('ip:' + ip);
      if (clientId) reporterKeys.push('c:' + clientId);

      const alreadyReported = db.brokenReports.some(b =>
        b.gameId === gameId &&
        Array.isArray(b.reporterKeys) &&
        b.reporterKeys.some(k => reporterKeys.includes(k))
      );
      if (alreadyReported) {
        return sendJSON(res, 409, { error: 'Bu oyun için zaten kırık link bildiriminde bulundunuz.' });
      }

      db.brokenReports.unshift({
        id: 'br-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        gameId,
        gameTitle: body.gameTitle,
        reportedBy: currentUser ? currentUser.username : 'Misafir',
        reporterKeys,
        createdAt: new Date().toISOString()
      });
      writeDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // Tüm kırık link bildirimlerini sil (Admin)
    if (pathname === '/api/broken' && method === 'DELETE') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') return sendJSON(res, 403, { error: 'Yetkisiz işlem' });
      db.brokenReports = [];
      writeDB(db);
      return sendJSON(res, 200, { ok: true, brokenReports: [] });
    }

    if (pathname.startsWith('/api/broken/') && method === 'DELETE') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') return sendJSON(res, 403, { error: 'Yetkisiz işlem' });
      const id = decodeURIComponent(pathname.split('/')[3]);
      db.brokenReports = db.brokenReports.filter(b => b.id !== id);
      writeDB(db);
      return sendJSON(res, 200, { ok: true, brokenReports: db.brokenReports });
    }

    // 14. Admin Üye Silme
    if (pathname.startsWith('/api/users/') && method === 'DELETE') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') return sendJSON(res, 403, { error: 'Yetkisiz işlem' });
      const id = decodeURIComponent(pathname.split('/')[3]);
      if (id === currentUser.id) return sendJSON(res, 400, { error: 'Kendi Admin hesabınızı silemezsiniz.' });
      db.users = db.users.filter(u => u.id !== id);
      writeDB(db);
      return sendJSON(res, 200, {
        ok: true,
        users: db.users.map(u => ({ id: u.id, username: u.username, email: u.email || '', avatar: u.avatar || '', role: u.role, createdAt: u.createdAt }))
      });
    }

    // 15. Site Ayarlarını Güncelle (Sadece Admin)
    if (pathname === '/api/settings' && method === 'POST') {
      const db = readDB();
      const currentUser = getCurrentUser(req, db);
      if (!currentUser || currentUser.role !== 'admin') return sendJSON(res, 403, { error: 'Yetkisiz işlem' });
      const body = await parseBody(req);
      if (body.siteSlogan !== undefined) db.settings.siteSlogan = body.siteSlogan;
      if (body.rarPassword !== undefined) db.settings.rarPassword = body.rarPassword;
      writeDB(db);
      return sendJSON(res, 200, { ok: true, settings: db.settings });
    }

    // Statik Dosya Sunumu (Ses/Video için Range desteği dahil)
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const range = req.headers.range;

      if (range && (ext === '.m4a' || ext === '.mp3')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFile).pipe(res);
    }
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: err.message || 'Sunucu hatası' });
  }
});

// Başlangıçta buluttaki ve önceki sunucudaki veritabanını geri yükle, ardından sunucuyu başlat
storage.restoreOnStartup().finally(() => {
  server.listen(PORT, () => {
    console.log(`OyunIndir.gg sunucusu çalışıyor: http://localhost:${PORT}`);
    startKeepAliveAndSync();
    storage.startHandoffCatchUp();
  });
});

process.on('SIGTERM', () => {
  storage.flush().finally(() => process.exit(0));
});
