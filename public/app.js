const state = {
  settings: {
    siteName: 'OyunIndirGG.com.tr',
    siteSlogan: "Türkiye'nin En Hızlı Full PC Oyun Arşivi",
    rarPassword: 'www.oyunindirgg.com.tr',
    announcement: ''
  },
  games: [],
  comments: [],
  requests: [],
  brokenReports: [],
  users: [],
  currentUser: null,
  authToken: localStorage.getItem('oyunindir_auth_token') || '',
  activeFilter: 'all',
  searchQuery: '',
  sortBy: 'newest',
  currentView: 'home',
  currentGameId: null
};

const CATEGORIES = [
  'Açık Dünya',
  'Aksiyon',
  'RPG',
  'Simülasyon',
  'Strateji',
  'Yarış',
  'Korku',
  'Spor',
  'Düşük Sistem'
];

/* KOYU KIZIL IŞIKLAR, YOĞUN YILDIZLAR VE KAYAN YILDIZ ARKAPLANI */
function initStarfield() {
  const canvas = document.getElementById('starfieldCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  let mouseX = width * 0.5;
  let mouseY = height * 0.3;
  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // 1. Hareketli Koyu Kızıl Işık Küreleri (Daha koyu ve derin atmosfer)
  const lightOrbs = Array.from({ length: 6 }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 290 + 240,
    vx: (Math.random() - 0.5) * 0.55,
    vy: (Math.random() - 0.5) * 0.55,
    alpha: Math.random() * 0.08 + 0.06,
    phase: i * 1.1
  }));

  // 2. Yoğun Çok Katmanlı Yıldızlar (380 Yıldız)
  const STAR_COUNT = 380;
  const stars = Array.from({ length: STAR_COUNT }, () => {
    const isBrightFlare = Math.random() < 0.11;
    const colorRoll = Math.random();
    let color = '212, 20, 58';
    if (colorRoll > 0.7) color = '255, 195, 205';
    else if (colorRoll > 0.42) color = '185, 22, 55';

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: isBrightFlare ? (Math.random() * 1.7 + 1.6) : (Math.random() * 1.5 + 0.45),
      vx: (Math.random() - 0.5) * 0.32,
      vy: -Math.random() * 0.8 - 0.18,
      alpha: Math.random() * 0.6 + 0.25,
      pulseSpeed: Math.random() * 0.04 + 0.012,
      pulsePhase: Math.random() * Math.PI * 2,
      color,
      isBrightFlare
    };
  });

  // 3. Kayan Kızıl Yıldızlar (Shooting Stars)
  const shootingStars = [];
  function spawnShootingStar() {
    if (shootingStars.length >= 3) return;
    shootingStars.push({
      x: Math.random() * width * 0.9,
      y: Math.random() * height * 0.45,
      len: Math.random() * 105 + 65,
      speed: Math.random() * 8.5 + 7.5,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
      alpha: 0.9
    });
  }

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < lightOrbs.length; i++) {
      const orb = lightOrbs[i];
      orb.x += orb.vx;
      orb.y += orb.vy;
      orb.phase += 0.01;

      if (orb.x < -orb.radius) orb.x = width + orb.radius;
      if (orb.x > width + orb.radius) orb.x = -orb.radius;
      if (orb.y < -orb.radius) orb.y = height + orb.radius;
      if (orb.y > height + orb.radius) orb.y = -orb.radius;

      const currentAlpha = Math.max(0.03, orb.alpha + Math.sin(orb.phase) * 0.03);
      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
      grad.addColorStop(0, `rgba(175, 14, 48, ${currentAlpha})`);
      grad.addColorStop(0.5, `rgba(115, 8, 32, ${currentAlpha * 0.45})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const mouseGrad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 240);
    mouseGrad.addColorStop(0, 'rgba(190, 18, 52, 0.09)');
    mouseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mouseGrad;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 240, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.pulsePhase += s.pulseSpeed;

      if (s.y < -8) {
        s.y = height + 8;
        s.x = Math.random() * width;
      }
      if (s.x < -8) s.x = width + 8;
      if (s.x > width + 8) s.x = -8;

      const currentAlpha = Math.max(0.15, Math.min(0.95, s.alpha + Math.sin(s.pulsePhase) * 0.25));

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.color}, ${currentAlpha})`;
      ctx.fill();

      if (s.isBrightFlare) {
        const glowRadius = s.r * 3.5;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowRadius);
        g.addColorStop(0, `rgba(212, 20, 58, ${currentAlpha * 0.65})`);
        g.addColorStop(1, 'rgba(212, 20, 58, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        const flareLen = s.r * 3;
        ctx.strokeStyle = `rgba(255, 190, 205, ${currentAlpha * 0.55})`;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(s.x - flareLen, s.y);
        ctx.lineTo(s.x + flareLen, s.y);
        ctx.moveTo(s.x, s.y - flareLen);
        ctx.lineTo(s.x, s.y + flareLen);
        ctx.stroke();
      }
    }

    if (Math.random() < 0.022) spawnShootingStar();
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const sh = shootingStars[i];
      sh.x += Math.cos(sh.angle) * sh.speed;
      sh.y += Math.sin(sh.angle) * sh.speed;
      sh.alpha -= 0.018;

      if (sh.alpha <= 0 || sh.x > width + 100 || sh.y > height + 100) {
        shootingStars.splice(i, 1);
        continue;
      }

      const tailX = sh.x - Math.cos(sh.angle) * sh.len;
      const tailY = sh.y - Math.sin(sh.angle) * sh.len;
      const shootGrad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
      shootGrad.addColorStop(0, `rgba(255, 225, 232, ${sh.alpha})`);
      shootGrad.addColorStop(0.3, `rgba(212, 20, 58, ${sh.alpha * 0.8})`);
      shootGrad.addColorStop(1, 'rgba(212, 20, 58, 0)');

      ctx.strokeStyle = shootGrad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/* SOL ALT SPOTIFY TARZI MÜZİK OYNATICI (Maksimum 2 Dakika + Fade-In / Fade-Out Geçişli) */
const MAX_TRACK_SECONDS = 120;
const FADE_IN_SECONDS = 3.5;
const FADE_OUT_SECONDS = 4.5;
const PLAYLIST = [
  {
    title: 'Let It Happen',
    artist: 'Tame Impala',
    src: '/music/let-it-happen.m4a?v=fade2',
    cover: '/music/let-it-happen.jpg'
  },
  {
    title: 'COOKİN 2.0',
    artist: 'heyiury, SWE4ZY INC. & Sin4Hood',
    src: '/music/cookin-2.m4a?v=fade2',
    cover: '/music/cookin-2.jpg'
  },
  {
    title: 'Düşünürüm',
    artist: 'Kalben',
    src: '/music/dusunurum.m4a?v=fade2',
    cover: '/music/dusunurum.jpg'
  }
];

let currentTrackIdx = 0;

function formatSec(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function getEffectiveDuration(audio) {
  if (!audio || !audio.duration || isNaN(audio.duration)) return 0;
  return Math.min(audio.duration, MAX_TRACK_SECONDS);
}

function initMusicPlayer() {
  const playerEl = document.getElementById('spotifyPlayer');
  const audio = document.getElementById('spAudio');
  const coverEl = document.getElementById('spCover');
  const titleEl = document.getElementById('spTitle');
  const artistEl = document.getElementById('spArtist');
  const seekEl = document.getElementById('spSeek');
  const curTimeEl = document.getElementById('spCurTime');
  const durTimeEl = document.getElementById('spDurTime');
  const playBtn = document.getElementById('spPlayBtn');
  const iconPlay = document.getElementById('spIconPlay');
  const iconPause = document.getElementById('spIconPause');
  const prevBtn = document.getElementById('spPrevBtn');
  const nextBtn = document.getElementById('spNextBtn');
  const muteBtn = document.getElementById('spMuteBtn');
  const iconVol = document.getElementById('spIconVol');
  const iconMute = document.getElementById('spIconMute');
  const volSlider = document.getElementById('spVolSlider');
  const minBtn = document.getElementById('spMinBtn');
  const bodyEl = document.getElementById('spBody');
  const tracklistEl = document.getElementById('spTracklist');

  if (!audio || !playerEl) return;

  let userTargetVolume = 0.7;
  let fadeTimer = null;
  audio.volume = userTargetVolume;

  function applyFadeEnvelope() {
    if (audio.muted) return;
    const effDur = getEffectiveDuration(audio);
    const t = audio.currentTime || 0;
    let factor = 1;

    if (t < FADE_IN_SECONDS) {
      factor = Math.max(0.05, t / FADE_IN_SECONDS);
    } else if (effDur > FADE_OUT_SECONDS && t > effDur - FADE_OUT_SECONDS) {
      factor = Math.max(0, (effDur - t) / FADE_OUT_SECONDS);
    }

    audio.volume = Math.max(0, Math.min(1, userTargetVolume * factor));
  }

  function smoothSwitchTrack(nextIdx) {
    if (fadeTimer) clearInterval(fadeTimer);
    if (!audio.paused && audio.volume > 0.05) {
      const startVol = audio.volume;
      let step = 0;
      const totalSteps = 8;
      fadeTimer = setInterval(() => {
        step++;
        audio.volume = Math.max(0, startVol * (1 - step / totalSteps));
        if (step >= totalSteps) {
          clearInterval(fadeTimer);
          fadeTimer = null;
          loadTrack(nextIdx, true);
        }
      }, 30);
    } else {
      loadTrack(nextIdx, true);
    }
  }

  function renderTracklist() {
    tracklistEl.innerHTML = PLAYLIST.map((t, idx) => `
      <div class="sp-track-item ${idx === currentTrackIdx ? 'active' : ''}" data-idx="${idx}">
        <img src="${escapeHtml(t.cover)}" alt="${escapeHtml(t.title)}" />
        <span class="sp-track-name">${idx + 1}. ${escapeHtml(t.title)} — <small style="opacity:0.75;">${escapeHtml(t.artist)}</small></span>
      </div>
    `).join('');

    tracklistEl.querySelectorAll('.sp-track-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = Number(item.dataset.idx);
        smoothSwitchTrack(idx);
      });
    });
  }

  function updatePlayUI(isPlaying) {
    playerEl.classList.toggle('playing', isPlaying);
    iconPlay.classList.toggle('hidden', isPlaying);
    iconPause.classList.toggle('hidden', !isPlaying);
  }

  function loadTrack(idx, autoPlay = false) {
    currentTrackIdx = (idx + PLAYLIST.length) % PLAYLIST.length;
    const t = PLAYLIST[currentTrackIdx];
    audio.src = t.src;
    coverEl.src = t.cover;
    titleEl.textContent = t.title;
    artistEl.textContent = t.artist;
    seekEl.value = 0;
    curTimeEl.textContent = '0:00';
    durTimeEl.textContent = '0:00';
    audio.volume = Math.min(userTargetVolume, 0.08);
    renderTracklist();

    if (autoPlay) {
      audio.play().then(() => updatePlayUI(true)).catch(() => updatePlayUI(false));
    }
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => updatePlayUI(true)).catch(() => {});
    } else {
      audio.pause();
      updatePlayUI(false);
    }
  });

  prevBtn.addEventListener('click', () => smoothSwitchTrack(currentTrackIdx - 1));
  nextBtn.addEventListener('click', () => smoothSwitchTrack(currentTrackIdx + 1));

  audio.addEventListener('loadedmetadata', () => {
    durTimeEl.textContent = formatSec(getEffectiveDuration(audio));
  });

  audio.addEventListener('timeupdate', () => {
    const effDur = getEffectiveDuration(audio);
    if (effDur > 0 && audio.currentTime >= effDur) {
      loadTrack(currentTrackIdx + 1, true);
      return;
    }
    applyFadeEnvelope();
    curTimeEl.textContent = formatSec(audio.currentTime);
    if (effDur > 0) {
      durTimeEl.textContent = formatSec(effDur);
      seekEl.value = Math.min(100, (audio.currentTime / effDur) * 100);
    }
  });

  audio.addEventListener('ended', () => {
    loadTrack(currentTrackIdx + 1, true);
  });

  seekEl.addEventListener('input', () => {
    const effDur = getEffectiveDuration(audio);
    if (effDur > 0) {
      audio.currentTime = (Number(seekEl.value) / 100) * effDur;
      applyFadeEnvelope();
    }
  });

  function updateVolumeIcons() {
    const muted = audio.muted || userTargetVolume === 0;
    iconVol.classList.toggle('hidden', muted);
    iconMute.classList.toggle('hidden', !muted);
  }

  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    updateVolumeIcons();
  });

  volSlider.addEventListener('input', () => {
    userTargetVolume = Number(volSlider.value);
    if (userTargetVolume > 0 && audio.muted) audio.muted = false;
    applyFadeEnvelope();
    updateVolumeIcons();
  });

  minBtn.addEventListener('click', () => {
    const isHidden = bodyEl.classList.toggle('hidden');
    minBtn.textContent = isHidden ? '+' : '−';
  });

  loadTrack(0, true);

  const unlockAudio = () => {
    if (audio.paused && audio.currentTime === 0) {
      audio.play().then(() => updatePlayUI(true)).catch(() => {});
    }
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hasVal(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function renderAvatarHtml(username, avatarUrl, sizeClass = 'avatar-md') {
  const initial = String(username || '?').trim().charAt(0).toUpperCase() || '?';
  if (hasVal(avatarUrl)) {
    return `<span class="avatar-circle ${sizeClass}"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(username)}" /></span>`;
  }
  return `<span class="avatar-circle ${sizeClass}">${escapeHtml(initial)}</span>`;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function isAdmin() {
  return Boolean(state.currentUser && state.currentUser.role === 'admin');
}

function showToast(msg) {
  const wrap = document.getElementById('toastContainer');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.authToken ? { 'x-auth-token': state.authToken } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'İşlem başarısız');
  return data;
}

async function bootstrap() {
  try {
    const data = await api('/api/bootstrap');
    state.settings = data.settings || state.settings;
    state.games = data.games || [];
    state.comments = data.comments || [];
    state.requests = data.requests || [];
    state.brokenReports = data.brokenReports || [];
    state.users = data.users || [];
    state.currentUser = data.currentUser || null;

    applyHeaderUI();
    renderAll();
    handleRoute();
  } catch (err) {
    console.error(err);
  }
}

function applyHeaderUI() {
  const rarPass = state.settings.rarPassword || 'www.oyunindirgg.com.tr';
  const topAnn = document.getElementById('topAnnouncement');
  const topRar = document.getElementById('topRarPass');
  const sideRar = document.getElementById('sidebarRarText');
  const slogan = document.getElementById('siteSloganText');
  const reqBubble = document.getElementById('reqCountBubble');

  if (topAnn) topAnn.textContent = state.settings.announcement || '';
  if (topRar) topRar.textContent = rarPass;
  if (sideRar) sideRar.textContent = rarPass;
  if (slogan) slogan.textContent = state.settings.siteSlogan || '';
  if (reqBubble) reqBubble.textContent = state.requests.filter(r => r.status === 'Bekliyor').length;

  const guestBox = document.getElementById('guestAuthBox');
  const userBox = document.getElementById('userAuthBox');
  const headerAvatarWrap = document.getElementById('headerAvatarWrap');
  const loggedUserName = document.getElementById('loggedUserName');
  const adminManageBtn = document.getElementById('adminManageBtn');

  if (state.currentUser) {
    if (guestBox) guestBox.classList.add('hidden');
    if (userBox) userBox.classList.remove('hidden');
    if (headerAvatarWrap) headerAvatarWrap.innerHTML = renderAvatarHtml(state.currentUser.username, state.currentUser.avatar, 'avatar-sm');
    if (loggedUserName) loggedUserName.innerHTML = `${escapeHtml(state.currentUser.username)} ${isAdmin() ? '<span class="badge-admin">ADMİN</span>' : ''}`;
    if (adminManageBtn) adminManageBtn.classList.toggle('hidden', !isAdmin());
  } else {
    if (guestBox) guestBox.classList.remove('hidden');
    if (userBox) userBox.classList.add('hidden');
    if (adminManageBtn) adminManageBtn.classList.add('hidden');
  }
}

function renderAll() {
  renderShowcase();
  renderGameFeed();
  renderSidebar();
  if (state.currentView === 'detail' && state.currentGameId) {
    renderGameDetail(state.currentGameId);
  }
  if (state.currentView === 'requests') {
    renderRequestsView();
  }
  if (state.currentView === 'profile' && state.currentUser) {
    renderProfileView();
  }
  if (state.currentView === 'admin' && isAdmin()) {
    renderAdminDashboard();
  }
}

/* 1. VİTRİN */
function renderShowcase() {
  const section = document.getElementById('showcaseSection');
  const grid = document.getElementById('showcaseGrid');
  if (!section || !grid) return;
  const featuredGames = state.games.filter(g => g.featured).slice(0, 6);

  if (featuredGames.length === 0 || state.currentView === 'admin' || state.currentView === 'profile') {
    section.classList.add('hidden');
    grid.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  grid.innerHTML = featuredGames.map(g => `
    <article class="showcase-card" onclick="navigateToGame('${escapeHtml(g.id)}')">
      ${hasVal(g.cover)
        ? `<img src="${escapeHtml(g.cover)}" alt="${escapeHtml(g.title)}" loading="lazy" />`
        : `<div class="no-cover-box">${escapeHtml(g.title)}</div>`
      }
      <div class="showcase-overlay">
        ${hasVal(g.size) ? `
          <div class="showcase-top-badges">
            <span class="sc-size">${escapeHtml(g.size)}</span>
          </div>
        ` : ''}
        <div class="showcase-bottom">
          <h3>${escapeHtml(g.title)}</h3>
        </div>
      </div>
    </article>
  `).join('');
}

/* 2. ANA OYUN LİSTESİ */
function getFilteredGames() {
  let list = [...state.games];

  if (state.activeFilter !== 'all') {
    const f = state.activeFilter.toLowerCase();
    list = list.filter(g =>
      (g.category && g.category.toLowerCase() === f) ||
      (g.language && g.language.toLowerCase().includes(f)) ||
      (Array.isArray(g.tags) && g.tags.some(t => t.toLowerCase().includes(f)))
    );
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(g =>
      g.title.toLowerCase().includes(q) ||
      (g.shortDesc && g.shortDesc.toLowerCase().includes(q)) ||
      (g.category && g.category.toLowerCase().includes(q)) ||
      (g.version && g.version.toLowerCase().includes(q))
    );
  }

  if (state.sortBy === 'az') {
    list.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  } else {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return list;
}

function triggerFeedAnimation(el) {
  if (!el) return;
  el.classList.remove('feed-animate');
  void el.offsetWidth;
  el.classList.add('feed-animate');
}

function renderGameFeed() {
  const container = document.getElementById('gameListContainer');
  const heading = document.getElementById('feedHeading');
  const countText = document.getElementById('feedCountText');
  if (!container) return;

  const filtered = getFilteredGames();

  if (heading) {
    if (state.searchQuery) {
      heading.textContent = `"${state.searchQuery}" Arama Sonuçları`;
    } else if (state.activeFilter !== 'all') {
      heading.textContent = `${state.activeFilter} Oyunları`;
    } else {
      heading.textContent = 'Eklenen Oyunlar';
    }
  }

  if (countText) countText.textContent = `${filtered.length} oyun`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="panel-card" style="text-align:center; padding: 36px 20px;">
        <h3>Henüz eklenmiş oyun bulunmuyor</h3>
        ${isAdmin()
          ? `<p style="color:var(--text-muted); margin: 8px 0 16px;">Admin hesabınızla giriş yaptınız. İlk oyununuzu hemen yükleyebilirsiniz.</p>
             <button type="button" class="btn-primary" onclick="openAdminPage('add-game')">+ İlk Oyunu Yükle</button>`
          : `<p style="color:var(--text-muted); margin: 8px 0 16px;">Oyun İstek bölümünden istediğiniz oyunu belirtebilirsiniz.</p>
             <button type="button" class="btn-primary" onclick="openRequestsPage()">Oyun İsteğinde Bulun</button>`
        }
      </div>
    `;
    triggerFeedAnimation(container);
    return;
  }

  container.innerHTML = filtered.map(g => {
    const commentCount = state.comments.filter(c => c.gameId === g.id).length;
    const summaryText = hasVal(g.shortDesc) ? g.shortDesc : (hasVal(g.description) ? g.description : '');
    const hasTopBadges = hasVal(g.category) || hasVal(g.version) || hasVal(g.repack);

    return `
      <article class="game-card">
        <div class="game-card-thumb" onclick="navigateToGame('${escapeHtml(g.id)}')">
          ${hasVal(g.cover)
            ? `<img src="${escapeHtml(g.cover)}" alt="${escapeHtml(g.title)}" loading="lazy" />`
            : `<div class="no-cover-box">${escapeHtml(g.title)}</div>`
          }
          ${hasVal(g.language) ? `<span class="thumb-ribbon">${escapeHtml(g.language)}</span>` : ''}
          ${hasVal(g.size) ? `<span class="thumb-size">${escapeHtml(g.size)}</span>` : ''}
        </div>
        <div class="game-card-body">
          <div>
            ${hasTopBadges ? `
              <div class="gc-top">
                ${hasVal(g.category) ? `<span class="gc-cat-badge">${escapeHtml(g.category)}</span>` : ''}
                ${hasVal(g.version) ? `<span class="gc-version-badge">${escapeHtml(g.version)}</span>` : ''}
                ${hasVal(g.repack) ? `<span class="gc-repack-badge">${escapeHtml(g.repack)}</span>` : ''}
              </div>
            ` : ''}
            <h2 class="gc-title" style="margin-top:${hasTopBadges ? '6px' : '0'};" onclick="navigateToGame('${escapeHtml(g.id)}')">${escapeHtml(g.title)}</h2>
            ${hasVal(summaryText) ? `<p class="gc-desc" style="margin-top:5px;">${escapeHtml(summaryText)}</p>` : ''}
          </div>
          <div class="gc-footer">
            <div class="gc-meta">
              <span>${formatDate(g.createdAt)}</span>
              <span>•</span>
              <span>${commentCount} Yorum</span>
            </div>
            <div class="gc-actions">
              ${isAdmin() ? `<button type="button" class="btn-edit-quick" onclick="startEditGame('${escapeHtml(g.id)}')">Düzenle</button>` : ''}
              <button type="button" class="btn-download-card" onclick="navigateToGame('${escapeHtml(g.id)}')">
                <span>Oyunu İndir</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  triggerFeedAnimation(container);
}

/* 3. SAĞ SIDEBAR */
function renderSidebar() {
  const catList = document.getElementById('sidebarCategories');
  if (catList) {
    const allItem = `
      <li class="category-item ${state.activeFilter === 'all' ? 'active' : ''}" onclick="setCategoryFilter('all')">
        <span>Tüm Oyunlar</span>
        <span class="cat-count">${state.games.length}</span>
      </li>
    `;
    const catItems = CATEGORIES.map(cat => {
      const count = state.games.filter(g =>
        g.category === cat || (Array.isArray(g.tags) && g.tags.includes(cat))
      ).length;
      return `
        <li class="category-item ${state.activeFilter === cat ? 'active' : ''}" onclick="setCategoryFilter('${escapeHtml(cat)}')">
          <span>${escapeHtml(cat)}</span>
          <span class="cat-count">${count}</span>
        </li>
      `;
    }).join('');
    catList.innerHTML = allItem + catItems;
  }

  const rcWrap = document.getElementById('sidebarRecentComments');
  if (!rcWrap) return;
  const recentComments = state.comments.slice(0, 6);
  if (recentComments.length === 0) {
    rcWrap.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted);">Henüz yorum yapılmamış.</p>`;
  } else {
    rcWrap.innerHTML = recentComments.map(c => `
      <div class="rc-item" onclick="navigateToGame('${escapeHtml(c.gameId)}')">
        <div class="rc-head">
          <span class="rc-author">
            ${renderAvatarHtml(c.author, c.authorAvatar, 'avatar-sm')}
            <span>${escapeHtml(c.author)}</span>
            ${c.isAdmin ? '<span class="badge-admin">ADMİN</span>' : ''}
          </span>
          <span style="font-size:0.7rem;color:var(--text-dim);">${formatDate(c.createdAt)}</span>
        </div>
        <span class="rc-game">${escapeHtml(c.gameTitle)}</span>
        <p class="rc-text">${escapeHtml(c.text)}</p>
      </div>
    `).join('');
  }
}

/* 4. OYUN DETAY VE İNDİRME SAYFASI */
function navigateToGame(gameId) {
  window.location.hash = `#/oyun/${encodeURIComponent(gameId)}`;
  openGameDetail(gameId);
}

function openGameDetail(gameId) {
  const game = state.games.find(g => g.id === gameId);
  if (!game) {
    showToast('Oyun bulunamadı.');
    goHomeView();
    return;
  }
  state.currentGameId = gameId;
  switchView('detail');
  renderGameDetail(gameId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSysReqBox(title, reqObj) {
  if (!reqObj) return '';
  const rows = [];
  if (hasVal(reqObj.os)) rows.push(`<li><span>İşletim Sistemi:</span> <strong>${escapeHtml(reqObj.os)}</strong></li>`);
  if (hasVal(reqObj.cpu)) rows.push(`<li><span>İşlemci:</span> <strong>${escapeHtml(reqObj.cpu)}</strong></li>`);
  if (hasVal(reqObj.ram)) rows.push(`<li><span>Bellek:</span> <strong>${escapeHtml(reqObj.ram)}</strong></li>`);
  if (hasVal(reqObj.gpu)) rows.push(`<li><span>Ekran Kartı:</span> <strong>${escapeHtml(reqObj.gpu)}</strong></li>`);
  if (hasVal(reqObj.storage)) rows.push(`<li><span>Depolama:</span> <strong>${escapeHtml(reqObj.storage)}</strong></li>`);

  if (rows.length === 0) return '';
  return `
    <div class="sysreq-box">
      <h4>${escapeHtml(title)}</h4>
      <ul class="sysreq-list">${rows.join('')}</ul>
    </div>
  `;
}

function renderGameDetail(gameId) {
  const g = state.games.find(item => item.id === gameId);
  if (!g) return;

  const gameComments = state.comments.filter(c => c.gameId === g.id);

  const specPills = [];
  if (hasVal(g.size)) specPills.push(`<div class="spec-pill"><small>Boyut</small><strong>${escapeHtml(g.size)}</strong></div>`);
  if (hasVal(g.language)) specPills.push(`<div class="spec-pill"><small>Dil</small><strong>${escapeHtml(g.language)}</strong></div>`);
  if (hasVal(g.repack)) specPills.push(`<div class="spec-pill"><small>Sunum</small><strong>${escapeHtml(g.repack)}</strong></div>`);
  specPills.push(`<div class="spec-pill"><small>Eklenme Tarihi</small><strong>${formatDate(g.createdAt)}</strong></div>`);

  const minBoxHtml = renderSysReqBox('MİNİMUM', g.sysReq?.min);
  const recBoxHtml = renderSysReqBox('ÖNERİLEN', g.sysReq?.rec);
  const hasAnySysReq = Boolean(minBoxHtml || recBoxHtml);

  const validLinks = (g.links || []).filter(l => l && hasVal(l.url));
  const hasTopBadges = hasVal(g.category) || hasVal(g.version);

  const detailContainer = document.getElementById('detailView');
  if (!detailContainer) return;
  detailContainer.innerHTML = `
    <div class="detail-card">
      <div class="detail-breadcrumb">
        <div>
          <a href="#/" onclick="goHomeView(event)" style="color:var(--red);font-weight:700;">OyunIndirGG.com.tr</a>
          ${hasVal(g.category) ? `
            <span> / </span>
            <span style="cursor:pointer;" onclick="setCategoryFilter('${escapeHtml(g.category)}')">${escapeHtml(g.category)}</span>
          ` : ''}
          <span> / </span>
          <strong style="color:#fff;">${escapeHtml(g.title)}</strong>
        </div>
        <div style="display:flex;gap:8px;">
          ${isAdmin() ? `<button type="button" class="btn-edit-quick" onclick="startEditGame('${escapeHtml(g.id)}')">Düzenle</button>` : ''}
          <button type="button" class="btn-secondary btn-sm" onclick="goHomeView()">← Geri Dön</button>
        </div>
      </div>

      <div class="detail-hero">
        <div class="detail-hero-inner" style="${hasVal(g.cover) ? '' : 'grid-template-columns: 1fr;'}">
          ${hasVal(g.cover) ? `<img class="detail-cover" src="${escapeHtml(g.cover)}" alt="${escapeHtml(g.title)}" />` : ''}
          <div class="detail-title-area">
            ${hasTopBadges ? `
              <div class="gc-top">
                ${hasVal(g.category) ? `<span class="gc-cat-badge">${escapeHtml(g.category)}</span>` : ''}
                ${hasVal(g.version) ? `<span class="gc-version-badge">${escapeHtml(g.version)}</span>` : ''}
              </div>
            ` : ''}
            <h1>${escapeHtml(g.title)}</h1>
            <div class="detail-specs-grid">
              ${specPills.join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-body">
        ${hasVal(g.description) ? `
          <section class="detail-section">
            <h3>Oyun Açıklaması</h3>
            <div class="detail-description">${escapeHtml(g.description)}</div>
          </section>
        ` : (hasVal(g.shortDesc) ? `
          <section class="detail-section">
            <h3>Oyun Açıklaması</h3>
            <div class="detail-description">${escapeHtml(g.shortDesc)}</div>
          </section>
        ` : '')}

        ${hasAnySysReq ? `
          <section class="detail-section">
            <h3>Sistem Gereksinimleri</h3>
            <div class="sysreq-grid" style="${minBoxHtml && recBoxHtml ? '' : 'grid-template-columns: 1fr;'}">
              ${minBoxHtml}
              ${recBoxHtml}
            </div>
          </section>
        ` : ''}

        ${Array.isArray(g.screenshots) && g.screenshots.length > 0 ? `
          <section class="detail-section">
            <h3>Ekran Görüntüleri</h3>
            <div class="screenshots-grid">
              ${g.screenshots.map(src => `
                <div class="screenshot-item" onclick="openLightbox('${escapeHtml(src)}')">
                  <img src="${escapeHtml(src)}" alt="${escapeHtml(g.title)}" loading="lazy" />
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${hasVal(g.installNotes) ? `
          <section class="detail-section">
            <h3>Kurulum Bilgisi</h3>
            <div class="install-box">${escapeHtml(g.installNotes)}</div>
          </section>
        ` : ''}

        ${validLinks.length > 0 ? `
          <section class="detail-section">
            <div class="download-hub">
              <div class="download-hub-head">
                <div>
                  <h3 style="border:none;padding:0;margin:0;color:#fff;">İndirme Linkleri</h3>
                  <p style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Aşağıdaki bağlantılardan oyunu indirebilirsiniz.</p>
                </div>
                ${hasVal(state.settings.rarPassword) ? `
                  <button type="button" class="rar-badge" onclick="copyRarPassword()">
                    <span>RAR Şifresi:</span>
                    <strong>${escapeHtml(state.settings.rarPassword)}</strong>
                    <small class="copy-pill">Kopyala</small>
                  </button>
                ` : ''}
              </div>

              <div class="download-links-stack">
                ${validLinks.map(lnk => `
                  <a href="${escapeHtml(lnk.url)}" target="_blank" rel="noopener" class="dl-btn ${escapeHtml(lnk.type || 'other')}">
                    <span>${escapeHtml(hasVal(lnk.label) ? lnk.label : (lnk.provider || 'Oyunu İndir'))}</span>
                    <span style="font-size:0.76rem;">İNDİR →</span>
                  </a>
                `).join('')}
              </div>

              <div class="dl-hub-footer" style="justify-content:flex-end;">
                <button type="button" class="btn-broken" onclick="reportBrokenLink('${escapeHtml(g.id)}', '${escapeHtml(g.title)}')">Kırık Link Bildir</button>
              </div>
            </div>
          </section>
        ` : ''}

        <section class="detail-section">
          <h3>Yorumlar (${gameComments.length})</h3>
          <div class="comments-wrap">
            ${state.currentUser ? `
              <form class="comment-form" onsubmit="submitComment(event, '${escapeHtml(g.id)}')">
                <div class="comment-author-bar">
                  <div class="comment-author-info">
                    ${renderAvatarHtml(state.currentUser.username, state.currentUser.avatar, 'avatar-md')}
                    <div>
                      <strong style="color:#fff;">${escapeHtml(state.currentUser.username)}</strong>
                      ${isAdmin() ? '<span class="badge-admin">ADMİN</span>' : ''}
                      <span style="display:block;font-size:0.75rem;color:var(--text-muted);">olarak yorum yapıyorsunuz</span>
                    </div>
                  </div>
                  <button type="button" class="btn-secondary btn-sm" onclick="openProfilePage()">Profil Fotoğrafı / Ayarlar</button>
                </div>
                <div class="form-group">
                  <textarea id="commentText" rows="3" required placeholder="Oyun veya kurulum hakkında yorumunuzu yazın..."></textarea>
                </div>
                <div>
                  <button type="submit" class="btn-primary">Yorumu Gönder</button>
                </div>
              </form>
            ` : `
              <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;padding:16px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <span style="font-size:0.86rem;color:var(--text-muted);">Bu oyuna yorum yapabilmek için hesabınıza giriş yapın veya ücretsiz kayıt olun.</span>
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn-secondary btn-sm" onclick="openAuthModal('login')">Giriş Yap</button>
                  <button type="button" class="btn-primary btn-sm" onclick="openAuthModal('register')">Kayıt Ol</button>
                </div>
              </div>
            `}

            <div class="comment-list">
              ${gameComments.length === 0 ? `<p style="color:var(--text-muted);text-align:center;padding:12px;">Henüz yorum yapılmamış. İlk yorumu siz yazın.</p>` : ''}
              ${gameComments.map(c => {
                const canDelete = isAdmin() || (state.currentUser && state.currentUser.id === c.userId);
                return `
                  <div class="comment-item ${c.isAdmin ? 'admin-comment' : ''}">
                    <div class="c-header">
                      <div class="c-user">
                        ${renderAvatarHtml(c.author, c.authorAvatar, 'avatar-md')}
                        <div>
                          <span>${escapeHtml(c.author)}</span>
                          ${c.isAdmin ? `<span class="badge-admin" style="margin-left:5px;">ADMİN</span>` : ''}
                        </div>
                      </div>
                      <span class="c-date">${formatDate(c.createdAt)}</span>
                    </div>
                    <div class="c-body">${escapeHtml(c.text)}</div>
                    <div class="c-actions">
                      ${state.currentUser ? `<button type="button" class="c-action-btn" onclick="toggleReplyBox('${escapeHtml(c.id)}')">Yanıtla</button>` : ''}
                      ${canDelete ? `<button type="button" class="c-action-btn" style="color:var(--red);" onclick="deleteComment('${escapeHtml(c.id)}')">Sil</button>` : ''}
                    </div>

                    <div id="replyBox-${escapeHtml(c.id)}" class="hidden" style="margin-top:8px;padding-left:46px;">
                      <div style="display:flex;gap:8px;">
                        <input type="text" id="replyText-${escapeHtml(c.id)}" placeholder="Yanıtınızı yazın..." style="flex:1;background:var(--bg-input);border:1px solid var(--border);color:#fff;padding:7px 10px;border-radius:5px;" />
                        <button type="button" class="btn-primary btn-sm" onclick="submitReply('${escapeHtml(c.id)}')">Gönder</button>
                      </div>
                    </div>

                    ${Array.isArray(c.replies) && c.replies.length > 0 ? `
                      <div class="replies-list">
                        ${c.replies.map(r => `
                          <div class="reply-item">
                            <div class="reply-head">
                              <div class="reply-user">
                                ${renderAvatarHtml(r.author, r.authorAvatar, 'avatar-sm')}
                                <strong>${escapeHtml(r.author)} ${r.isAdmin ? '<span class="badge-admin">ADMİN</span>' : ''}</strong>
                              </div>
                              <span style="font-size:0.7rem;color:var(--text-dim);">${formatDate(r.createdAt)}</span>
                            </div>
                            <p style="color:#f3c6ce;padding-left:32px;">${escapeHtml(r.text)}</p>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

async function reportBrokenLink(gameId, gameTitle) {
  try {
    await api('/api/broken', {
      method: 'POST',
      body: JSON.stringify({ gameId, gameTitle })
    });
    showToast('Kırık link bildirimi iletildi.');
  } catch (err) {
    showToast(err.message);
  }
}

async function submitComment(e, gameId) {
  e.preventDefault();
  const text = document.getElementById('commentText').value;

  try {
    const res = await api('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ gameId, text })
    });
    state.comments = res.comments;
    showToast('Yorumunuz eklendi.');
    renderAll();
  } catch (err) {
    showToast(err.message);
  }
}

function toggleReplyBox(commentId) {
  const box = document.getElementById(`replyBox-${commentId}`);
  if (box) box.classList.toggle('hidden');
}

async function submitReply(commentId) {
  const text = document.getElementById(`replyText-${commentId}`).value;
  if (!text) {
    showToast('Lütfen yanıtınızı yazın.');
    return;
  }
  try {
    const res = await api(`/api/comments/${encodeURIComponent(commentId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    state.comments = res.comments;
    showToast('Yanıt eklendi.');
    renderAll();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteComment(commentId) {
  if (!confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
  try {
    const res = await api(`/api/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE'
    });
    state.comments = res.comments;
    showToast('Yorum silindi.');
    renderAll();
  } catch (err) {
    showToast(err.message);
  }
}

/* 5. OYUN İSTEK BÖLÜMÜ */
function renderRequestsView() {
  const formArea = document.getElementById('requestFormArea');
  if (!formArea) return;
  if (state.currentUser) {
    formArea.innerHTML = `
      <form id="requestGameForm" class="req-form" onsubmit="submitGameRequest(event)">
        <div class="form-row-2">
          <div class="form-group">
            <label>İstediğiniz Oyun Adı *</label>
            <input type="text" id="reqGameName" required placeholder="Örn: Ghost of Tsushima..." />
          </div>
          <div class="form-group">
            <label>Notunuz (İsteğe Bağlı)</label>
            <input type="text" id="reqGameNote" placeholder="Varsa sürüm veya link tercihiniz..." />
          </div>
        </div>
        <div>
          <button type="submit" class="btn-primary">İsteği Gönder</button>
        </div>
      </form>
    `;
  } else {
    formArea.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <span style="font-size:0.86rem;color:var(--text-muted);">Oyun isteğinde bulunmak için lütfen giriş yapın veya kayıt olun.</span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn-secondary btn-sm" onclick="openAuthModal('login')">Giriş Yap</button>
          <button type="button" class="btn-primary btn-sm" onclick="openAuthModal('register')">Kayıt Ol</button>
        </div>
      </div>
    `;
  }

  const wrap = document.getElementById('requestsListContainer');
  if (!wrap) return;
  if (!state.requests.length) {
    wrap.innerHTML = `<p style="color:var(--text-muted);">Henüz oyun isteği yapılmamış.</p>`;
    return;
  }
  wrap.innerHTML = state.requests.map(r => `
    <div class="req-item">
      <div>
        <strong>${escapeHtml(r.gameName)}</strong>
        <span style="font-size:0.76rem;color:var(--text-muted);margin-left:8px;">${escapeHtml(r.user)} • ${formatDate(r.createdAt)}</span>
        ${r.note ? `<p style="font-size:0.8rem;color:#d1d5db;margin-top:3px;">${escapeHtml(r.note)}</p>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="req-status ${r.status === 'Eklendi' ? 'done' : 'pending'}">${escapeHtml(r.status)}</span>
        ${isAdmin() ? `
          <button type="button" class="btn-secondary btn-sm" onclick="updateRequestStatus('${escapeHtml(r.id)}', 'Eklendi')">Eklendi İşaretle</button>
          <button type="button" class="btn-danger btn-sm" onclick="updateRequestStatus('${escapeHtml(r.id)}', 'delete')">Sil</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function submitGameRequest(e) {
  e.preventDefault();
  const gameName = document.getElementById('reqGameName').value;
  const note = document.getElementById('reqGameNote').value;
  try {
    const res = await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ gameName, note })
    });
    state.requests = res.requests;
    applyHeaderUI();
    renderRequestsView();
    showToast('Oyun isteğiniz gönderildi.');
  } catch (err) {
    showToast(err.message);
  }
}

async function updateRequestStatus(id, statusOrDelete) {
  try {
    const payload = statusOrDelete === 'delete' ? { action: 'delete' } : { status: statusOrDelete };
    const res = await api(`/api/requests/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.requests = res.requests;
    applyHeaderUI();
    renderRequestsView();
  } catch (err) {
    showToast(err.message);
  }
}

/* 6. HESAP AYARLARI & PROFİL YÖNETİMİ */
function updateProfileAvatarPreview(username, avatarUrl) {
  const previewEl = document.getElementById('profileAvatarPreview');
  if (!previewEl) return;
  previewEl.innerHTML = renderAvatarHtml(username, avatarUrl, 'avatar-xl');
}

function renderProfileView() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const uInput = document.getElementById('profUsername');
  const eInput = document.getElementById('profEmail');
  const aInput = document.getElementById('profAvatarUrl');
  const cpInput = document.getElementById('profCurrentPass');
  const npInput = document.getElementById('profNewPass');

  if (uInput) uInput.value = u.username || '';
  if (eInput) eInput.value = u.email || '';
  if (aInput) aInput.value = u.avatar || '';
  if (cpInput) cpInput.value = '';
  if (npInput) npInput.value = '';
  updateProfileAvatarPreview(u.username, u.avatar);
}

/* 7. SOL SEKMELİ DETAYLI ADMİN YÖNETİM MERKEZİ */
function addLinkEditorRow(link = { type: 'drive', provider: 'Google Drive', label: 'Google Drive Tek Link İndir', url: '' }) {
  const container = document.getElementById('linksRowsContainer');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'link-edit-row';
  row.innerHTML = `
    <select class="lnk-type">
      <option value="drive" ${link.type === 'drive' ? 'selected' : ''}>Google Drive</option>
      <option value="pixeldrain" ${link.type === 'pixeldrain' ? 'selected' : ''}>Pixeldrain</option>
      <option value="mediafire" ${link.type === 'mediafire' ? 'selected' : ''}>MediaFire</option>
      <option value="torrent" ${link.type === 'torrent' ? 'selected' : ''}>Torrent</option>
      <option value="other" ${link.type === 'other' ? 'selected' : ''}>Diğer Link</option>
    </select>
    <input type="text" class="lnk-label" placeholder="Buton Başlığı (İsteğe Bağlı)" value="${escapeHtml(link.label || '')}" />
    <input type="text" class="lnk-url" placeholder="İndirme Linki (https://...)" value="${escapeHtml(link.url || '')}" />
    <button type="button" class="btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

function resetGameForm() {
  const editId = document.getElementById('editGameId');
  const modeTitle = document.getElementById('formModeTitle');
  const saveBtn = document.getElementById('saveGameBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const form = document.getElementById('adminGameForm');
  const linksWrap = document.getElementById('linksRowsContainer');

  if (editId) editId.value = '';
  if (modeTitle) modeTitle.textContent = 'Yeni Oyun Yükle';
  if (saveBtn) saveBtn.textContent = 'Oyunu Sitede Yayınla';
  if (cancelBtn) cancelBtn.classList.add('hidden');
  if (form) form.reset();
  if (linksWrap) {
    linksWrap.innerHTML = '';
    addLinkEditorRow({ type: 'drive', label: 'Google Drive Tek Link İndir', url: '' });
  }
}

function startEditGame(gameId) {
  const g = state.games.find(x => x.id === gameId);
  if (!g) return;

  openAdminPage('add-game');

  document.getElementById('editGameId').value = g.id;
  document.getElementById('formModeTitle').textContent = `Düzenleniyor: ${g.title}`;
  document.getElementById('saveGameBtn').textContent = 'Değişiklikleri Kaydet';
  document.getElementById('cancelEditBtn').classList.remove('hidden');

  document.getElementById('gTitle').value = g.title || '';
  document.getElementById('gVersion').value = g.version || '';
  document.getElementById('gCategory').value = g.category || '';
  document.getElementById('gSize').value = g.size || '';
  document.getElementById('gLanguage').value = g.language || '';
  document.getElementById('gRepack').value = g.repack || '';
  document.getElementById('gTags').value = Array.isArray(g.tags) ? g.tags.join(', ') : '';
  document.getElementById('gFeatured').checked = Boolean(g.featured);
  document.getElementById('gCover').value = g.cover || '';
  document.getElementById('gScreenshots').value = Array.isArray(g.screenshots) ? g.screenshots.join('\n') : '';
  document.getElementById('gShortDesc').value = g.shortDesc || '';
  document.getElementById('gDescription').value = g.description || '';
  document.getElementById('gInstallNotes').value = g.installNotes || '';

  const min = g.sysReq?.min || {};
  const rec = g.sysReq?.rec || {};
  document.getElementById('minOs').value = min.os || '';
  document.getElementById('minCpu').value = min.cpu || '';
  document.getElementById('minRam').value = min.ram || '';
  document.getElementById('minGpu').value = min.gpu || '';
  document.getElementById('minStorage').value = min.storage || '';

  document.getElementById('recOs').value = rec.os || '';
  document.getElementById('recCpu').value = rec.cpu || '';
  document.getElementById('recRam').value = rec.ram || '';
  document.getElementById('recGpu').value = rec.gpu || '';
  document.getElementById('recStorage').value = rec.storage || '';

  const linksContainer = document.getElementById('linksRowsContainer');
  linksContainer.innerHTML = '';
  if (Array.isArray(g.links) && g.links.length > 0) {
    g.links.forEach(lnk => addLinkEditorRow(lnk));
  } else {
    addLinkEditorRow({ type: 'drive', label: 'Google Drive Tek Link İndir', url: '' });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAdminDashboard() {
  if (state.currentUser) {
    const sbAv = document.getElementById('adminSidebarAvatar');
    const sbName = document.getElementById('adminSidebarName');
    if (sbAv) sbAv.innerHTML = renderAvatarHtml(state.currentUser.username, state.currentUser.avatar, 'avatar-md');
    if (sbName) sbName.textContent = state.currentUser.username;
  }

  const brokenCount = (state.brokenReports || []).length;
  const pendingReqCount = (state.requests || []).filter(r => r.status === 'Bekliyor').length;

  const gCountEl = document.getElementById('anavGamesCount');
  const cCountEl = document.getElementById('anavCommentsCount');
  const uCountEl = document.getElementById('anavUsersCount');
  if (gCountEl) gCountEl.textContent = state.games.length;
  if (cCountEl) cCountEl.textContent = state.comments.length + brokenCount;
  if (uCountEl) uCountEl.textContent = state.users.length;

  const statsGrid = document.getElementById('adminStatsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card">
        <span>Yüklü Oyunlar</span>
        <strong>${state.games.length}</strong>
      </div>
      <div class="stat-card">
        <span>Kayıtlı Üyeler</span>
        <strong>${state.users.length}</strong>
      </div>
      <div class="stat-card">
        <span>Yapılan Yorumlar</span>
        <strong>${state.comments.length}</strong>
      </div>
      <div class="stat-card">
        <span>Bekleyen İstek / Kırık Link</span>
        <strong>${pendingReqCount} / ${brokenCount}</strong>
      </div>
    `;
  }

  const dashRecent = document.getElementById('dashRecentGames');
  if (dashRecent) {
    if (state.games.length === 0) {
      dashRecent.innerHTML = `
        <p style="color:var(--text-muted);font-size:0.84rem;margin-bottom:10px;">Henüz sitede oyun bulunmuyor.</p>
        <button type="button" class="btn-primary btn-sm" onclick="switchAdminTab('add-game')">+ İlk Oyunu Yükle</button>
      `;
    } else {
      dashRecent.innerHTML = state.games.slice(0, 5).map(g => `
        <div class="req-item" style="margin-bottom:8px;">
          <div>
            <strong>${escapeHtml(g.title)}</strong>
            <span style="display:block;font-size:0.74rem;color:var(--text-muted);">${escapeHtml(g.category || 'Kategori Yok')} • ${formatDate(g.createdAt)}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-edit-quick" onclick="startEditGame('${escapeHtml(g.id)}')">Düzenle</button>
            <button type="button" class="btn-secondary btn-sm" onclick="navigateToGame('${escapeHtml(g.id)}')">Aç</button>
          </div>
        </div>
      `).join('');
    }
  }

  const dashAlerts = document.getElementById('dashAlertsBox');
  if (dashAlerts) {
    const alertRows = [];
    if (brokenCount > 0) {
      alertRows.push(`
        <div class="req-item" style="border-color:var(--red);margin-bottom:8px;">
          <div>
            <strong style="color:var(--red);">${brokenCount} Kırık Link Bildirimi Var</strong>
            <p style="font-size:0.76rem;color:var(--text-muted);">Oyuncular indirme linklerinde sorun bildirdi.</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" onclick="switchAdminTab('manage-comments')">İncele</button>
        </div>
      `);
    }
    if (pendingReqCount > 0) {
      alertRows.push(`
        <div class="req-item" style="margin-bottom:8px;">
          <div>
            <strong>${pendingReqCount} Bekleyen Oyun İsteği</strong>
            <p style="font-size:0.76rem;color:var(--text-muted);">Üyelerin istediği oyunları kontrol edebilirsiniz.</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" onclick="openRequestsPage()">İsteklere Git</button>
        </div>
      `);
    }
    if (alertRows.length === 0) {
      dashAlerts.innerHTML = `<p style="color:var(--text-muted);font-size:0.84rem;">Şu anda bekleyen acil bildirim veya kırık link uyarısı bulunmuyor.</p>`;
    } else {
      dashAlerts.innerHTML = alertRows.join('');
    }
  }

  const tableWrap = document.getElementById('adminGamesTableWrap');
  if (tableWrap) {
    if (state.games.length === 0) {
      tableWrap.innerHTML = `<p style="color:var(--text-muted);">Henüz oyun yüklenmemiş.</p>`;
    } else {
      tableWrap.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Oyun Adı</th>
              <th>Kategori</th>
              <th>Boyut</th>
              <th>Yorum</th>
              <th>Vitrin</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${state.games.map(g => {
              const cCount = state.comments.filter(c => c.gameId === g.id).length;
              return `
                <tr>
                  <td><strong>${escapeHtml(g.title)}</strong>${hasVal(g.version) ? `<br><small style="color:var(--text-muted);">${escapeHtml(g.version)}</small>` : ''}</td>
                  <td>${escapeHtml(g.category || '-')}</td>
                  <td>${escapeHtml(g.size || '-')}</td>
                  <td>${cCount} Yorum</td>
                  <td>${g.featured ? '<span class="badge-admin">VİTRİNDE</span>' : 'Hayır'}</td>
                  <td style="display:flex;gap:6px;">
                    <button type="button" class="btn-secondary btn-sm" onclick="navigateToGame('${escapeHtml(g.id)}')">Aç</button>
                    <button type="button" class="btn-edit-quick" onclick="startEditGame('${escapeHtml(g.id)}')">Düzenle</button>
                    <button type="button" class="btn-danger btn-sm" onclick="deleteGameAdmin('${escapeHtml(g.id)}')">Sil</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  }

  const brokenWrap = document.getElementById('adminBrokenList');
  if (brokenWrap) {
    if (!state.brokenReports || state.brokenReports.length === 0) {
      brokenWrap.innerHTML = `<p style="color:var(--text-muted);margin-top:6px;">Kırık link bildirimi yok.</p>`;
    } else {
      brokenWrap.innerHTML = state.brokenReports.map(b => `
        <div class="req-item" style="margin-top:8px;">
          <div>
            <strong>${escapeHtml(b.gameTitle)}</strong>
            <span style="font-size:0.76rem;color:var(--text-muted);margin-left:8px;">${formatDate(b.createdAt)}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn-edit-quick" onclick="startEditGame('${escapeHtml(b.gameId)}')">Linkleri Güncelle</button>
            <button type="button" class="btn-danger btn-sm" onclick="dismissBrokenReport('${escapeHtml(b.id)}')">Kaldır</button>
          </div>
        </div>
      `).join('');
    }
  }

  const adminCommentsWrap = document.getElementById('adminCommentsList');
  if (adminCommentsWrap) {
    if (!state.comments.length) {
      adminCommentsWrap.innerHTML = `<p style="color:var(--text-muted);margin-top:6px;">Henüz sitede yorum yapılmamış.</p>`;
    } else {
      adminCommentsWrap.innerHTML = state.comments.map(c => `
        <div class="req-item" style="margin-top:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${renderAvatarHtml(c.author, c.authorAvatar, 'avatar-md')}
            <div>
              <strong>${escapeHtml(c.author)}</strong> <span style="color:var(--text-muted);font-size:0.78rem;">(${escapeHtml(c.gameTitle)})</span>
              <p style="font-size:0.82rem;color:#d1d5db;margin-top:3px;">${escapeHtml(c.text)}</p>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn-secondary btn-sm" onclick="navigateToGame('${escapeHtml(c.gameId)}')">Oyuna Git</button>
            <button type="button" class="btn-danger btn-sm" onclick="deleteComment('${escapeHtml(c.id)}')">Sil</button>
          </div>
        </div>
      `).join('');
    }
  }

  const usersWrap = document.getElementById('adminUsersTableWrap');
  if (usersWrap) {
    usersWrap.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Üye</th>
            <th>E-posta</th>
            <th>Rol</th>
            <th>Kayıt Tarihi</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${state.users.map(u => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  ${renderAvatarHtml(u.username, u.avatar, 'avatar-sm')}
                  <strong>${escapeHtml(u.username)}</strong>
                </div>
              </td>
              <td>${escapeHtml(u.email || '-')}</td>
              <td>${u.role === 'admin' ? '<span class="badge-admin">ADMİN</span>' : 'Üye'}</td>
              <td>${formatDate(u.createdAt)}</td>
              <td>
                ${u.role !== 'admin'
                  ? `<button type="button" class="btn-danger btn-sm" onclick="deleteUserAdmin('${escapeHtml(u.id)}')">Üyeyi Sil</button>`
                  : `<span style="font-size:0.75rem;color:var(--text-muted);">Korumalı</span>`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const sSlogan = document.getElementById('setSlogan');
  const sRar = document.getElementById('setRarPass');
  const sAnn = document.getElementById('setAnnouncement');
  if (sSlogan) sSlogan.value = state.settings.siteSlogan || '';
  if (sRar) sRar.value = state.settings.rarPassword || 'www.oyunindirgg.com.tr';
  if (sAnn) sAnn.value = state.settings.announcement || '';
}

async function deleteUserAdmin(userId) {
  if (!confirm('Bu kullanıcı hesabını silmek istediğinize emin misiniz?')) return;
  try {
    const res = await api(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    state.users = res.users;
    renderAdminDashboard();
    showToast('Kullanıcı silindi.');
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteGameAdmin(id) {
  if (!confirm('Bu oyunu silmek istediğinize emin misiniz?')) return;
  try {
    const res = await api(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.games = res.games;
    showToast('Oyun silindi.');
    renderAll();
  } catch (err) {
    showToast(err.message);
  }
}

async function dismissBrokenReport(id) {
  try {
    const res = await api(`/api/broken/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.brokenReports = res.brokenReports;
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const isLogin = mode === 'login';
  document.getElementById('tabLoginBtn')?.classList.toggle('active', isLogin);
  document.getElementById('tabRegisterBtn')?.classList.toggle('active', !isLogin);
  document.getElementById('loginForm')?.classList.toggle('hidden', !isLogin);
  document.getElementById('registerForm')?.classList.toggle('hidden', isLogin);
}

function retriggerViewEnter(el) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function switchView(viewName) {
  state.currentView = viewName;
  const views = {
    home: document.getElementById('homeView'),
    detail: document.getElementById('detailView'),
    requests: document.getElementById('requestsView'),
    profile: document.getElementById('profileView'),
    admin: document.getElementById('adminView')
  };

  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    const isTarget = key === viewName;
    el.classList.toggle('hidden', !isTarget);
    if (isTarget) retriggerViewEnter(el);
  });

  const portalGrid = document.getElementById('mainPortalGrid');
  const pubSidebar = document.getElementById('publicSidebar');
  if (portalGrid && pubSidebar) {
    const isFull = viewName === 'admin';
    portalGrid.classList.toggle('full-width', isFull);
    pubSidebar.classList.toggle('hidden', isFull);
  }

  renderShowcase();
}

function switchAdminTab(tabId) {
  document.querySelectorAll('#adminView .admin-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.atab === tabId);
  });
  document.querySelectorAll('.admin-tab-content').forEach(panel => {
    const isTarget = panel.id === `atab-${tabId}`;
    panel.classList.toggle('hidden', !isTarget);
    if (isTarget) retriggerViewEnter(panel);
  });
}

/* DOĞRUDAN SAYFA GEÇİŞ VE ÇIKIŞ FONKSİYONLARI */
function goHomeView(e) {
  if (e && e.preventDefault) e.preventDefault();
  window.location.hash = '#/';
  switchView('home');
  renderGameFeed();
}

function openRequestsPage(e) {
  if (e && e.preventDefault) e.preventDefault();
  window.location.hash = '#/requests';
  switchView('requests');
  renderRequestsView();
}

function openProfilePage(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!state.currentUser) {
    openAuthModal('login');
    return;
  }
  window.location.hash = '#/profil';
  switchView('profile');
  renderProfileView();
}

function openAdminPage(initialTab) {
  if (!isAdmin()) {
    showToast('Bu bölüme sadece Admin hesabı erişebilir.');
    return;
  }
  window.location.hash = '#/admin';
  switchView('admin');
  renderAdminDashboard();
  if (initialTab && typeof initialTab === 'string') {
    switchAdminTab(initialTab);
  }
}

async function doLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  state.authToken = '';
  state.currentUser = null;
  localStorage.removeItem('oyunindir_auth_token');
  applyHeaderUI();
  window.location.hash = '#/';
  switchView('home');
  renderAll();
  showToast('Hesaptan çıkış yapıldı.');
}

function setCategoryFilter(cat) {
  state.activeFilter = cat;
  document.querySelectorAll('.subnav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === cat);
  });
  window.location.hash = '#/';
  switchView('home');
  renderGameFeed();
  renderSidebar();
}

function copyRarPassword() {
  const pass = state.settings.rarPassword || 'www.oyunindirgg.com.tr';
  navigator.clipboard?.writeText(pass);
  showToast(`RAR Şifresi kopyalandı: ${pass}`);
}

function openLightbox(src) {
  const img = document.getElementById('lightboxImg');
  const modal = document.getElementById('lightboxModal');
  if (img) img.src = src;
  if (modal) modal.classList.remove('hidden');
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/oyun/')) {
    const id = decodeURIComponent(hash.replace('#/oyun/', ''));
    openGameDetail(id);
  } else if (hash === '#/requests') {
    switchView('requests');
    renderRequestsView();
  } else if (hash === '#/profil') {
    if (!state.currentUser) {
      openAuthModal('login');
      window.location.hash = '#/';
      return;
    }
    switchView('profile');
    renderProfileView();
  } else if (hash === '#/admin') {
    if (!isAdmin()) {
      window.location.hash = '#/';
      switchView('home');
      return;
    }
    switchView('admin');
    renderAdminDashboard();
  } else {
    switchView('home');
    renderGameFeed();
  }
}

window.addEventListener('hashchange', handleRoute);

function bindOn(id, eventName, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(eventName, handler);
}

document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  initMusicPlayer();
  resetGameForm();
  bootstrap();

  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchInput && clearBtn) {
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      clearBtn.classList.toggle('hidden', !state.searchQuery);
      if (state.currentView !== 'home') goHomeView();
      renderGameFeed();
    });
    clearBtn.addEventListener('click', () => {
      state.searchQuery = '';
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      renderGameFeed();
    });
  }

  bindOn('sortSelect', 'change', e => {
    state.sortBy = e.target.value;
    renderGameFeed();
  });

  bindOn('profAvatarUrl', 'input', e => {
    const uname = document.getElementById('profUsername')?.value || state.currentUser?.username || '?';
    updateProfileAvatarPreview(uname, e.target.value);
  });

  bindOn('profAvatarFile', 'change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api('/api/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: reader.result, kind: 'avatar' })
        });
        const aUrl = document.getElementById('profAvatarUrl');
        if (aUrl) aUrl.value = res.url;
        const uname = document.getElementById('profUsername')?.value || state.currentUser?.username || '?';
        updateProfileAvatarPreview(uname, res.url);
        showToast('Profil fotoğrafı yüklendi.');
      } catch (err) {
        showToast(err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  bindOn('removeAvatarBtn', 'click', () => {
    const aUrl = document.getElementById('profAvatarUrl');
    if (aUrl) aUrl.value = '';
    const uname = document.getElementById('profUsername')?.value || state.currentUser?.username || '?';
    updateProfileAvatarPreview(uname, '');
  });

  bindOn('profileSettingsForm', 'submit', async e => {
    e.preventDefault();
    try {
      const payload = {
        username: document.getElementById('profUsername')?.value || '',
        email: document.getElementById('profEmail')?.value || '',
        avatar: document.getElementById('profAvatarUrl')?.value || '',
        currentPassword: document.getElementById('profCurrentPass')?.value || '',
        newPassword: document.getElementById('profNewPass')?.value || ''
      };
      const res = await api('/api/profile', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.currentUser = res.user;
      state.comments = res.comments || state.comments;
      const cp = document.getElementById('profCurrentPass');
      const np = document.getElementById('profNewPass');
      if (cp) cp.value = '';
      if (np) np.value = '';
      applyHeaderUI();
      renderAll();
      showToast('Hesap ayarlarınız güncellendi!');
    } catch (err) {
      showToast(err.message);
    }
  });

  bindOn('closeAuthModal', 'click', () => {
    document.getElementById('authModal')?.classList.add('hidden');
  });

  bindOn('loginForm', 'submit', async e => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      state.authToken = res.token;
      localStorage.setItem('oyunindir_auth_token', res.token);
      document.getElementById('authModal')?.classList.add('hidden');
      e.target.reset();
      await bootstrap();
      showToast(`Hoş geldin, ${res.user.username}!`);
    } catch (err) {
      showToast(err.message);
    }
  });

  bindOn('registerForm', 'submit', async e => {
    e.preventDefault();
    const username = document.getElementById('regUser').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      state.authToken = res.token;
      localStorage.setItem('oyunindir_auth_token', res.token);
      document.getElementById('authModal')?.classList.add('hidden');
      e.target.reset();
      await bootstrap();
      showToast(`Hesabınız oluşturuldu. Hoş geldin, ${res.user.username}!`);
    } catch (err) {
      showToast(err.message);
    }
  });

  bindOn('addLinkRowBtn', 'click', () => addLinkEditorRow());
  bindOn('cancelEditBtn', 'click', () => resetGameForm());

  bindOn('gCoverFile', 'change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api('/api/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: reader.result })
        });
        document.getElementById('gCover').value = res.url;
        showToast('Kapak resmi yüklendi.');
      } catch (err) {
        showToast(err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  bindOn('adminGameForm', 'submit', async e => {
    e.preventDefault();
    const linkRows = [...document.querySelectorAll('#linksRowsContainer .link-edit-row')];
    const links = linkRows
      .map(r => {
        const type = r.querySelector('.lnk-type').value;
        const label = r.querySelector('.lnk-label').value.trim();
        const url = r.querySelector('.lnk-url').value.trim();
        return { provider: type.toUpperCase(), label, url, type };
      })
      .filter(l => l.url !== '');

    const payload = {
      id: document.getElementById('editGameId').value || undefined,
      title: document.getElementById('gTitle').value,
      version: document.getElementById('gVersion').value,
      category: document.getElementById('gCategory').value,
      size: document.getElementById('gSize').value,
      language: document.getElementById('gLanguage').value,
      repack: document.getElementById('gRepack').value,
      tags: document.getElementById('gTags').value,
      featured: document.getElementById('gFeatured').checked,
      cover: document.getElementById('gCover').value,
      screenshots: document.getElementById('gScreenshots').value.split('\n').map(s => s.trim()).filter(Boolean),
      shortDesc: document.getElementById('gShortDesc').value,
      description: document.getElementById('gDescription').value,
      installNotes: document.getElementById('gInstallNotes').value,
      sysReq: {
        min: {
          os: document.getElementById('minOs').value,
          cpu: document.getElementById('minCpu').value,
          ram: document.getElementById('minRam').value,
          gpu: document.getElementById('minGpu').value,
          storage: document.getElementById('minStorage').value
        },
        rec: {
          os: document.getElementById('recOs').value,
          cpu: document.getElementById('recCpu').value,
          ram: document.getElementById('recRam').value,
          gpu: document.getElementById('recGpu').value,
          storage: document.getElementById('recStorage').value
        }
      },
      links
    };

    try {
      const res = await api('/api/games', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.games = res.games;
      showToast('Oyun kaydedildi.');
      resetGameForm();
      renderAll();
      navigateToGame(res.game.id);
    } catch (err) {
      showToast(err.message);
    }
  });

  bindOn('adminSettingsForm', 'submit', async e => {
    e.preventDefault();
    try {
      const res = await api('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          siteSlogan: document.getElementById('setSlogan')?.value || '',
          rarPassword: document.getElementById('setRarPass')?.value || '',
          announcement: document.getElementById('setAnnouncement')?.value || '',
          newAdminPass: document.getElementById('setNewAdminPass')?.value || ''
        })
      });
      state.settings = res.settings;
      const np = document.getElementById('setNewAdminPass');
      if (np) np.value = '';
      applyHeaderUI();
      showToast('Ayarlar kaydedildi.');
    } catch (err) {
      showToast(err.message);
    }
  });

  bindOn('closeLightboxBtn', 'click', () => {
    document.getElementById('lightboxModal')?.classList.add('hidden');
  });
  bindOn('lightboxModal', 'click', e => {
    if (e.target.id === 'lightboxModal') {
      document.getElementById('lightboxModal')?.classList.add('hidden');
    }
  });
});
