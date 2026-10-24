/* MultiBot · frontend vanilla adaptado al diseño de TomiOka.
 * El portal cataloga bots y ofrece vinculación real con un runtime web autorizado
 * para los manifiestos que lo habilitan. Las sesiones permanecen en el host efímero.
 */
const API = '/api';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeRead = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const formatNumber = (value) => new Intl.NumberFormat('es-UY').format(number(value));
const formatBytes = (value) => {
  const bytes = number(value);
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};
const formatUptime = (ms) => {
  const total = Math.max(0, Math.floor(number(ms) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};
const initials = (value) => String(value || 'MB').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'MB';
const TOKEN_KEY = 'multibot_session';
const FAVORITES_KEY = 'multibot_favorites';
const ENDPOINT_FAVORITES_KEY = 'multibot_endpoint_favorites';
const THEME_KEY = 'multibot_theme';
const PATHS = { landing: '/', home: '/home', register: '/register', bots: '/bots', metrics: '/metrics', store: '/store', endpoints: '/endpoints', favorites: '/favorites', tickets: '/tickets', profile: '/profile', commands: '/cmds' };
const ROUTES = Object.fromEntries(Object.entries(PATHS).map(([key, value]) => [value, key]));
Object.assign(ROUTES, { '/api': 'endpoints', '/api-docs': 'endpoints', '/commands': 'commands', '/guide': 'store', '/support': 'tickets', '/account': 'profile', '/mis-bots': 'bots' });
const navItems = [
  { view: 'home', label: 'Inicio', icon: 'home' },
  { view: 'register', label: 'Crear bot', icon: 'plus' },
  { view: 'bots', label: 'Bots', icon: 'bot' },
  { view: 'metrics', label: 'Métricas', icon: 'chart' },
  { view: 'store', label: 'Termux', icon: 'smartphone' },
  { view: 'menu', label: 'Menú', icon: 'menu' },
];
const desktopItems = [
  { view: 'home', label: 'Inicio', icon: 'home' },
  { view: 'register', label: 'Crear bot', icon: 'plus' },
  { view: 'bots', label: 'Bots', icon: 'bot' },
  { view: 'metrics', label: 'Métricas', icon: 'chart' },
  { view: 'store', label: 'Termux', icon: 'smartphone' },
  { view: 'endpoints', label: 'API', icon: 'code' },
];

function routeFromPath() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return ROUTES[path] || (path.startsWith('/bots/') ? 'bots' : 'landing');
}

const state = {
  view: routeFromPath(),
  theme: safeRead(THEME_KEY, 'dark') === 'light' ? 'light' : 'dark',
  token: safeRead(TOKEN_KEY, ''),
  user: null,
  catalog: [],
  plugins: [],
  endpoints: [],
  system: null,
  health: null,
  runtimeState: null,
  runtimeError: '',
  runtimeErrorCode: '',
  runtimeBusy: false,
  runtimeMethod: 'pairing-code',
  favorites: safeRead(FAVORITES_KEY, []),
  endpointFavorites: safeRead(ENDPOINT_FAVORITES_KEY, []),
  activeBotId: new URLSearchParams(location.search).get('bot') || 'universal-bot',
  pluginQuery: '',
  endpointQuery: '',
  endpointMethod: 'all',
  openCategories: new Set(),
  selectedEndpoint: null,
  endpointCodeTab: 'curl',
  modal: '',
  modalError: '',
  authMode: 'login',
  createBotId: new URLSearchParams(location.search).get('bot') || 'universal-bot',
  loading: true,
};

function brandMarkup() {
  return `<span class="brand-mark" aria-hidden="true"><span class="brand-glyph">✦</span></span><span class="brand-copy"><span class="brand-name">Multi<em>Bot</em></span><span class="brand-tagline">Panel de bots</span></span>`;
}

function pageFooter() {
  return `<footer class="page-footer"><span>© ${new Date().getFullYear()} <strong class="purple">MultiBot Team</strong> · <a href="/LICENSE-TOMIOKA.txt" target="_blank" rel="noreferrer">Diseño adaptado de TomiOka · MIT</a></span><span><a href="https://github.com/lyanvalentinmail-prog/MultiBot" target="_blank" rel="noreferrer">${icon('code')} GitHub</a><a href="https://github.com/lyanvalentinmail-prog/MultiBot/issues" target="_blank" rel="noreferrer">${icon('mail')} Soporte</a></span></footer>`;
}

function liveChip() {
  const ready = Boolean(state.health?.ok);
  return `<span class="live-chip ${ready ? 'is-live' : 'is-off'}" id="live-chip" role="status" aria-live="polite"><span class="dot"></span><span>${ready ? 'Panel disponible' : state.loading ? 'Conectando…' : 'Sin conexión'}</span></span>`;
}
function themeButton() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  return `<button class="icon-button theme-toggle" type="button" data-action="toggle-theme" aria-label="Cambiar a tema ${next === 'dark' ? 'oscuro' : 'claro'}" title="Cambiar a tema ${next === 'dark' ? 'oscuro' : 'claro'}">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>`;
}

function renderHeader() {
  const header = $('#site-header');
  if (!header) return;
  if (state.view === 'landing') {
    header.className = 'site-header landing-header';
    header.innerHTML = `<a class="brand" href="/" data-page="landing" aria-label="MultiBot, inicio">${brandMarkup()}</a>
      <nav class="header-links" aria-label="Secciones de MultiBot"><a class="header-link" href="#how">Cómo funciona</a><a class="header-link" href="#benefits">Beneficios</a><a class="header-link" href="#faq">Preguntas frecuentes</a></nav>
      <div class="header-actions">${liveChip()}${themeButton()}<a class="btn btn-primary btn-small header-panel-link" href="/home" data-page="home">Ir al panel ${icon('arrow-right')}</a>
      <label class="uhamburger mobile-menu-toggle" title="Abrir navegación"><input type="checkbox" id="landing-menu-check" data-action="toggle-landing-menu" aria-label="Abrir navegación" /><span class="toggle"><span class="bars" id="bar1"></span><span class="bars" id="bar2"></span><span class="bars" id="bar3"></span></span></label></div>`;
    return;
  }
  const active = state.view === 'favorites' ? 'bots' : state.view;
  const userName = state.user?.username || state.user?.email || 'Invitado';
  header.className = 'site-header is-app-header';
  header.innerHTML = `<a class="brand" href="/home" data-page="home" aria-label="MultiBot, panel">${brandMarkup()}</a>
    <nav class="desktop-app-nav" aria-label="Panel principal">${desktopItems.map((item) => `<a class="header-link ${active === item.view ? 'is-active' : ''}" href="${PATHS[item.view]}" data-page="${item.view}">${icon(item.icon)}<span>${item.label}</span></a>`).join('')}</nav>
    <div class="header-actions">${liveChip()}${themeButton()}<button class="icon-button" type="button" data-action="open-palette" aria-label="Buscar vistas (Ctrl+K)" title="Buscar (Ctrl+K)">${icon('search')}</button><button class="icon-button" type="button" data-action="refresh-data" aria-label="Actualizar datos">${icon('refresh')}</button>
    <button class="profile-button" type="button" data-action="open-drawer" aria-label="Abrir menú de cuenta"><span class="avatar">${escapeHtml(initials(userName))}</span><span class="profile-name">${escapeHtml(userName)}</span>${icon('chevron')}</button></div>`;
}

function renderBottomNav() {
  const nav = $('#bottom-navigation');
  if (!nav) return;
  const hidden = state.view === 'landing';
  if (nav.hidden !== hidden) nav.hidden = hidden;
  if (hidden) { nav.innerHTML = ''; return; }
  nav.innerHTML = navItems.map((item) => {
    const active = item.view === 'menu' ? false : (item.view === state.view || (state.view === 'favorites' && item.view === 'bots'));
    return `<button class="bottom-nav-item ${active ? 'is-active' : ''}" type="button" ${item.view === 'menu' ? 'data-action="open-drawer"' : `data-page="${item.view}"`} aria-label="${item.label}">${icon(item.icon)}<span>${item.label}</span></button>`;
  }).join('');
}

function renderDrawer() {
  const active = state.view === 'favorites' ? 'bots' : state.view;
  const item = (view, label, description, iconName) => `<button class="drawer-item ${active === view ? 'is-active' : ''}" type="button" data-page="${view}"><span class="drawer-item-icon">${icon(iconName)}</span><span class="drawer-item-copy"><strong>${label}</strong><small>${description}</small></span>${icon('chevron')}</button>`;
  const userLabel = state.user?.username || state.user?.email || 'Portal público';
  $('#menu-drawer').innerHTML = `<div class="drawer-profile"><span class="avatar">${escapeHtml(initials(userLabel))}</span><span class="drawer-profile-copy"><strong>${escapeHtml(userLabel)}</strong><small>${state.user ? 'CUENTA MULTIBOT' : 'VISITA EL CATÁLOGO'}</small></span><button class="icon-button drawer-close" type="button" data-action="close-drawer" aria-label="Cerrar menú">${icon('close')}</button></div>
    <div class="drawer-section"><p class="drawer-section-label">Navegación <span>01 — 06</span></p>${item('home', 'Inicio', 'Resumen del panel', 'home')}${item('register', 'Crear bot', 'Pairing Code o QR', 'plus')}${item('bots', 'Bots', 'Catálogo y runtime', 'bot')}${item('endpoints', 'API', 'Rutas del portal', 'code')}${item('favorites', 'Favoritos', 'Bots guardados', 'star')}${item('metrics', 'Métricas', 'Telemetría web y base', 'chart')}</div>
    <div class="drawer-section"><p class="drawer-section-label">Recursos</p>${item('store', 'Guía Termux', 'Termux o runtime web autorizado', 'smartphone')}${item('commands', 'Plugins', 'Archivos del catálogo', 'spark')}${item('tickets', 'Soporte', 'Documentación y ayuda', 'headset')}</div>
    <div class="drawer-section"><p class="drawer-section-label">Cuenta</p>${item('profile', 'Mi perfil', 'Datos y privacidad', 'users')}</div>
    <div class="drawer-bottom">${state.user ? `<button class="btn btn-outline btn-full" type="button" data-action="logout">${icon('external')} Cerrar sesión</button>` : `<button class="btn btn-primary btn-full" type="button" data-action="open-auth" data-mode="register">${icon('users')} Crear cuenta</button>`}<p>Universal Bot admite Termux y runtime web Free sujeto a permisos y límites.</p></div>`;
}

function openDrawer() {
  renderDrawer();
  $('#drawer-layer').hidden = false;
  document.body.classList.add('modal-open');
}
function closeDrawer() {
  const layer = $('#drawer-layer');
  if (layer) layer.hidden = true;
  document.body.classList.remove('modal-open');
  const toggle = $('#landing-menu-check');
  if (toggle) toggle.checked = false;
}

function routeUrl(view) { return PATHS[view] || PATHS.home; }
function navigate(view, { pathOverride = '', replace = false } = {}) {
  if (view === 'menu') return openDrawer();
  if (!PATHS[view]) view = 'home';
  closeDrawer();
  const url = pathOverride || routeUrl(view);
  state.view = view;
  if (view === 'commands') state.activeBotId = new URLSearchParams(url.split('?')[1] || '').get('bot') || state.activeBotId;
  if (replace) history.replaceState({ view }, '', url);
  else if (location.pathname + location.search !== url) history.pushState({ view }, '', url);
  renderPage({ force: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'metrics') loadSystem({ quiet: true });
  if (view === 'endpoints') loadEndpoints({ quiet: true });
  if (view === 'commands') loadPlugins(state.activeBotId);
}

function focusSnapshot() {
  const el = document.activeElement;
  if (!el || !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('[hidden]')) return null;
  return { id: el.id || '', name: el.getAttribute('name') || '', start: typeof el.selectionStart === 'number' ? el.selectionStart : null, end: typeof el.selectionEnd === 'number' ? el.selectionEnd : null };
}
function restoreFocus(snapshot) {
  if (!snapshot) return;
  let el = snapshot.id ? document.getElementById(snapshot.id) : null;
  if (!el && snapshot.name) el = document.querySelector(`[name="${CSS.escape(snapshot.name)}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (snapshot.start != null && typeof el.setSelectionRange === 'function') { try { el.setSelectionRange(snapshot.start, snapshot.end ?? snapshot.start); } catch {} }
}
function renderPage({ force = false } = {}) {
  const focus = focusSnapshot();
  const scrollY = window.scrollY;
  document.body.classList.toggle('dark-theme', state.theme === 'dark');
  document.body.classList.toggle('light-theme', state.theme === 'light');
  renderHeader();
  renderBottomNav();
  renderDrawer();
  const main = $('#main-content');
  if (main) {
    const pages = { landing: renderLanding, home: renderHome, register: renderCreateBot, bots: renderBots, metrics: renderMetrics, store: renderGuide, endpoints: renderEndpoints, favorites: renderFavorites, tickets: renderSupport, profile: renderProfile, commands: renderPlugins };
    const html = (pages[state.view] || renderLanding)();
    if (force || main.innerHTML !== html) main.innerHTML = html;
    main.dataset.ready = 'true';
    main.classList.toggle('is-create-bot', state.view === 'register');
  }
  if (state.modal) renderModal();
  const themeMeta = $('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = state.theme === 'dark' ? '#09090d' : '#ffffff';
  restoreFocus(focus);
  if (!force && focus) window.scrollTo({ top: scrollY, behavior: 'auto' });
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
}
function pluginCategoryName(category) {
  const names = { anti: 'Protección', group: 'Grupos', rpg: 'RPG', game: 'Juegos', ia: 'Inteligencia artificial', img: 'Imágenes', audio: 'Audio', video: 'Video', download: 'Descargas', sticker: 'Stickers', menu: 'Menú', info: 'Información', owner: 'Propietario', sub: 'Sub-bots', modo: 'Modos', search: 'Búsqueda', economy: 'Economía' };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}
function categoryForEndpoint(endpoint) {
  const path = endpoint.path || '';
  if (path.includes('/auth/')) return 'Autenticación';
  if (path.includes('/instances')) return 'Instancias heredadas';
  if (path.includes('/bots') || path.includes('/plugins')) return 'Catálogo';
  return 'Estado y sistema';
}

function renderLanding() {
  const botCount = state.catalog.length;
  const pluginCount = state.catalog.reduce((total, bot) => total + number(bot.pluginCount), 0);
  const dbProvider = state.system?.database?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local';
  const uptime = state.system?.server?.uptimeMs != null ? formatUptime(state.system.server.uptimeMs) : '—';
  const lead = state.catalog[0];
  const questions = [
    { q: '¿Cómo creo un bot desde la web?', a: 'Abre Crear bot, elige Pairing Code o QR e inicia el runtime. El código real aparece en el mismo panel cuando Baileys lo genera; la cuenta propietaria del panel (la primera cuenta creada) o una cuenta autorizada puede hacerlo.' },
    { q: '¿Necesito ingresar mi número?', a: 'Sí para Pairing Code: escribe el número internacional que recibirá el código. Para QR no hace falta escribirlo; lo escaneas desde Dispositivos vinculados en WhatsApp.' },
    { q: '¿El Pairing Code o QR es real?', a: 'Sí. Lo genera la conexión de Baileys con WhatsApp; el panel no inventa códigos. No compartas tu QR ni tu Pairing Code.' },
    { q: '¿Dónde se guardan mis datos?', a: 'En PostgreSQL de Render si DATABASE_URL está configurada. En desarrollo local se usa JSON dentro de data/. Ten en cuenta que PostgreSQL Free de Render expira a los 30 días.' },
    { q: '¿Quién puede crear el bot en la web?', a: 'La primera cuenta del panel queda como propietaria y puede desplegar el bot sin configuración extra. También puedes autorizar otros emails con WEB_RUNTIME_ADMIN_EMAILS. Render Free puede suspender el servicio; el runtime no garantiza disponibilidad continua.' },
  ];
  return `<div class="page-content landing-page" id="top">
    <section class="landing-hero" aria-labelledby="landing-title"><div class="landing-hero-copy">
      <span class="hero-version"><span class="pulse-dot"></span> MultiBot · catálogo y vinculación</span>
      <h1 class="landing-title" id="landing-title"><span class="title-line">Un hogar para</span><span class="title-line">tus <span class="gradient-text">bots.</span></span></h1>
      <p class="landing-lede">Explora el catálogo, crea un bot compatible e inicia la vinculación desde la web. Pairing Code y QR llegan desde Baileys.</p>
      <div class="landing-actions"><a class="btn btn-primary btn-large" href="/register" data-page="register">Crear bot ${icon('arrow-right')}</a><a class="btn btn-outline btn-large" href="/bots" data-page="bots">Explorar catálogo ${icon('bot')}</a></div>
      <div class="hero-footnote"><span>${icon('folder')} Bots aislados por carpeta</span><span>${icon('database')} ${escapeHtml(dbProvider)}</span><span>${icon('shield')} Sin conexión inventada</span></div>
    </div><div class="hero-showcase" aria-label="Resumen del catálogo"><div class="orbit"><span class="orbit-dot"></span></div>
      <div class="float-chip float-chip-one">${icon('bot')} ${formatNumber(botCount)} bots</div><div class="float-chip float-chip-two">${icon('code')} ${formatNumber(pluginCount)} plugins</div>
      <div class="showcase-window"><div class="showcase-top"><span class="showcase-title">${icon('spark')} MULTIBOT · CATALOG</span><span class="window-dots"><i></i><i></i><i></i></span></div><div class="showcase-body">
        <div class="showcase-bot"><span class="bot-orb">${icon('bot')}</span><span><strong>${escapeHtml(lead?.name || 'Catálogo MultiBot')}</strong><small>${escapeHtml(lead?.webRuntime ? 'Runtime web Free / Termux' : lead?.termuxOnly ? 'Runtime Termux' : lead?.executionMode || 'Bots del repositorio')}</small></span><span class="status-badge status-offline status-tag">${lead?.webRuntime ? 'Web + Termux' : lead?.termuxOnly ? 'Termux' : 'Catálogo'}</span></div>
        <div class="showcase-stats"><div class="showcase-stat"><b>${formatNumber(botCount)}</b><span>Bots publicados</span></div><div class="showcase-stat"><b>${formatNumber(state.catalog.filter((bot) => bot.webRuntime).length)}</b><span>Bots con runtime web</span></div><div class="showcase-stat"><b>${escapeHtml(uptime)}</b><span>Uptime web</span></div></div>
        <div class="showcase-connection">${icon('shield')}<span><b>Runtime web protegido</b> · QR/Pairing Code reales para la cuenta propietaria</span></div>
      </div></div></div></section>
    <div class="landing-proof"><div class="proof-card"><span class="icon-wrap">${icon('bot')}</span><span><strong>${formatNumber(botCount)}</strong><span>Bots del repo</span></span></div><div class="proof-card"><span class="icon-wrap">${icon('code')}</span><span><strong>${formatNumber(pluginCount)}</strong><span>Plugins listados</span></span></div><div class="proof-card"><span class="icon-wrap">${icon('database')}</span><span><strong>${escapeHtml(dbProvider)}</strong><span>Persistencia del panel</span></span></div><div class="proof-card"><span class="icon-wrap">${icon('globe')}</span><span><strong>${state.health?.ok ? 'Disponible' : 'Conectando'}</strong><span>Servicio web</span></span></div></div>
    <section class="section-block" id="how"><div class="section-heading center"><span class="section-kicker">${icon('spark')} Cómo funciona</span><h2 class="section-title">Organiza bots en <span class="gradient-text">tres pasos</span></h2><p class="section-copy">Elige un bot compatible, solicita Pairing Code con tu número internacional o selecciona QR, y recibe la credencial real desde Baileys.</p></div><div class="steps-grid">
      <article class="card card-hover step-card"><span class="step-number">01</span><h3>Explora el catálogo</h3><p>Consulta bots, capacidades y archivos de plugins desde la carpeta <code>bots/</code>.</p></article><article class="card card-hover step-card"><span class="step-number">02</span><h3>Elige cómo vincular</h3><p>Ingresa tu número internacional para Pairing Code o selecciona QR para escanearlo.</p></article><article class="card card-hover step-card"><span class="step-number">03</span><h3>Crea y conecta el bot</h3><p>Inicia el runtime y recibe el QR o Pairing Code real en la web; también puedes usar Termux.</p></article>
    </div></section>
    <section class="section-block" id="benefits"><div class="section-heading center"><span class="section-kicker">${icon('shield')} MultiBot</span><h2 class="section-title">Control claro, <span class="gradient-text">sin mezclar runtimes</span></h2><p class="section-copy">La interfaz usa el diseño TomiOka, mientras los datos y límites corresponden a MultiBot.</p></div><div class="benefits-grid">
      <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('folder')}</span><h3>Carpetas aisladas</h3><p>Cada bot declara los comandos que usa; las implementaciones viven en <code>commands/</code>.</p></article><article class="card card-hover benefit-card"><span class="benefit-icon">${icon('code')}</span><h3>Catálogo real</h3><p>La API descubre bots y plugins del repositorio, sin simular sesiones activas.</p></article><article class="card card-hover benefit-card"><span class="benefit-icon">${icon('smartphone')}</span><h3>Web + Termux</h3><p>Universal Bot puede arrancar desde el panel con la cuenta propietaria o desde Termux.</p></article><article class="card card-hover benefit-card"><span class="benefit-icon">${icon('database')}</span><h3>Vinculación directa</h3><p>El botón Crear bot inicia el proceso real; no guarda una preferencia como sustituto de la conexión.</p></article><article class="card card-hover benefit-card"><span class="benefit-icon">${icon('qr')}</span><h3>QR y Pairing Code</h3><p>El runtime web muestra el QR o Pairing Code real que genera Baileys; no crea códigos de prueba.</p></article><article class="card card-hover benefit-card"><span class="benefit-icon">${icon('lock')}</span><h3>Sesiones privadas</h3><p>Las credenciales del runtime no van a PostgreSQL; permanecen en el filesystem efímero del host.</p></article>
    </div></section>
    <section class="section-block" id="faq"><div class="section-heading center"><span class="section-kicker">${icon('headset')} Preguntas frecuentes</span><h2 class="section-title">Respuestas <span class="gradient-text">claras</span></h2><p class="section-copy">Lo que el panel hace y lo que se ejecuta en tu dispositivo.</p></div><div class="faq-list">${questions.map((item, index) => `<details class="faq-item" ${index === 0 ? 'open' : ''}><summary><span><span class="purple mono">${String(index + 1).padStart(2, '0')}</span>　${escapeHtml(item.q)}</span></summary><div class="faq-answer">${escapeHtml(item.a)}</div></details>`).join('')}</div></section>
    <section class="section-block landing-cta"><span class="section-kicker">${icon('bolt')} Empieza ahora</span><h2>Explora MultiBot</h2><p>Explora el catálogo y ejecuta Universal Bot desde la web con permisos o desde Termux.</p><div class="landing-actions"><a class="btn btn-primary btn-large" href="/bots" data-page="bots">Abrir catálogo ${icon('arrow-right')}</a><a class="btn btn-outline btn-large" href="/register" data-page="register">Crear bot ${icon('plus')}</a></div></section>
    <footer class="site-footer"><a class="site-footer-brand" href="/" data-page="landing">${brandMarkup()}</a><span>© ${new Date().getFullYear()} MultiBot Team · <a href="/LICENSE-TOMIOKA.txt" target="_blank" rel="noreferrer">Diseño adaptado de TomiOka · MIT</a></span><div class="footer-links"><a href="#how">Cómo funciona</a><a href="#faq">Preguntas frecuentes</a></div></footer>
  </div>`;
}

function renderMetricCard({ label, value, note, icon: iconName, indicator = false }) {
  return `<article class="card card-hover metric-card"><span class="metric-label">${icon(iconName)}${escapeHtml(label)}</span>${indicator ? '<i class="metric-indicator"></i>' : ''}<strong class="metric-value">${escapeHtml(String(value))}</strong><span class="metric-note">${escapeHtml(String(note ?? ''))}</span></article>`;
}

function renderHome() {
  const username = state.user?.username || state.user?.email?.split('@')[0] || 'invitado';
  const botCount = state.catalog.length;
  const pluginCount = state.catalog.reduce((sum, bot) => sum + number(bot.pluginCount), 0);
  const webRuntimeCount = state.catalog.filter((bot) => bot.webRuntime).length;
  const db = state.system?.database;
  const metrics = [
    { label: 'Bots en catálogo', value: formatNumber(botCount), note: 'Leídos desde bots/', icon: 'bot', indicator: true },
    { label: 'Bots web compatibles', value: formatNumber(webRuntimeCount), note: 'Runtime autorizado', icon: 'bolt' },
    { label: 'Plugins', value: formatNumber(pluginCount), note: 'Archivos detectados', icon: 'code' },
    { label: 'Base de datos', value: db?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local', note: db?.status === 'connected' ? 'Conexión verificada' : 'Persistencia local', icon: 'database' },
    { label: 'Uptime web', value: formatUptime(state.system?.server?.uptimeMs), note: 'Proceso del panel, no de los bots', icon: 'clock' },
    { label: 'Vinculación', value: 'Baileys', note: 'QR o Pairing Code real', icon: 'qr' },
  ];
  return `<div class="page-content"><section class="welcome-hero"><div class="welcome-emblem" aria-hidden="true">${icon('spark')}</div><div class="welcome-copy"><span class="welcome-overline">WELCOME · MULTIBOT</span><h1>Hola, <span class="gradient-text">${escapeHtml(username)}</span></h1><p>Elige un bot compatible y crea una conexión real de WhatsApp. Para Pairing Code ingresa tu número internacional; para QR, escanéalo desde la app.</p><div class="welcome-actions"><a class="btn btn-primary" href="/register" data-page="register">${icon('plus')} Crear bot</a><a class="btn btn-outline" href="/bots" data-page="bots">${icon('bot')} Explorar bots</a></div></div></section>
    <section class="info-banner"><span class="info-symbol">${icon('shield')}</span><div><span class="info-kicker">VINCULACIÓN REAL · RUNTIME PROTEGIDO</span><h2>Tu bot, conectado desde la web</h2><p>El runtime usa QR o Pairing Code reales de Baileys. Los controles y códigos solo están disponibles para la cuenta propietaria del panel o cuentas autorizadas.</p><div class="info-points"><span>${icon('bolt')} Un proceso a la vez</span><span>${icon('lock')} Controles de la cuenta propietaria</span><span>${icon('qr')} QR/Pairing Code reales</span></div></div><a class="btn btn-primary btn-small" href="/register" data-page="register">Crear bot ${icon('arrow-right')}</a></section>
    <section class="section-block" style="margin-top:34px"><div class="section-heading"><div><span class="section-kicker">${icon('chart')} Resumen</span><h2 class="section-title">MultiBot, de un vistazo</h2><p class="section-copy">Métricas del portal, catálogo y runtime.</p></div><button class="btn btn-outline btn-small" type="button" data-action="refresh-data">${icon('refresh')} Actualizar</button></div><div class="metrics-grid">${metrics.map(renderMetricCard).join('')}</div></section>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bolt')} Accesos rápidos</span><h2 class="section-title">¿Qué quieres hacer?</h2></div></div><div class="shortcut-grid"><a class="card card-hover shortcut-card" href="/register" data-page="register"><span class="shortcut-icon">${icon('bot')}</span><span><strong>Crear bot</strong><small>Elige Pairing Code o QR y vincula WhatsApp</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/bots" data-page="bots"><span class="shortcut-icon">${icon('folder')}</span><span><strong>Ver catálogo</strong><small>Explora bots compatibles y plugins</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/store" data-page="store"><span class="shortcut-icon">${icon('smartphone')}</span><span><strong>Guía Termux</strong><small>Alternativa para vincular en Android</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/endpoints" data-page="endpoints"><span class="shortcut-icon">${icon('code')}</span><span><strong>Documentación API</strong><small>Rutas reales del panel</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div></section>
    ${pageFooter()}</div>`;
}

function renderCatalogBotCard(bot) {
  const runtimeLabel = bot.webRuntime ? 'Web + Termux' : bot.termuxOnly ? 'Solo Termux' : escapeHtml(bot.executionMode || 'Manual');
  const pairingLabel = bot.webRuntime ? 'Vinculación web disponible' : bot.termuxOnly ? 'Vinculación en Termux' : 'Pairing en su entorno';
  const createAction = bot.webRuntime
    ? `<button class="btn btn-primary btn-small" type="button" data-action="create-from-bot" data-id="${escapeHtml(bot.id)}">Crear bot ${icon('arrow-right')}</button>`
    : '';
  return `<article class="card bot-card"><span class="bot-card-icon">${icon('bot')}</span><div class="bot-card-main"><div class="bot-card-title"><h3>${escapeHtml(bot.name)}</h3><span class="status-badge status-offline">${runtimeLabel}</span></div><p>${escapeHtml(bot.description || 'Bot del repositorio MultiBot.')}</p><div class="bot-card-meta"><span>${icon('code')} ${formatNumber(bot.pluginCount)} plugins</span><span>${icon('qr')}${bot.supportsQr ? 'QR real' : 'QR no declarado'}</span><span>${icon('hash')}${bot.supportsPairingCode ? pairingLabel : 'Pairing no declarado'}</span><span>${icon('shield')}${bot.webRuntime ? 'Cuenta propietaria' : 'No ejecutable desde la web'}</span></div></div><div class="bot-card-actions"><button class="favorite-button ${state.favorites.includes(bot.id) ? 'is-favorite' : ''}" type="button" data-action="favorite-bot" data-id="${escapeHtml(bot.id)}" aria-label="${state.favorites.includes(bot.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}" title="Favorito">${icon('star')}</button><button class="btn btn-outline btn-small" type="button" data-action="show-bot" data-id="${escapeHtml(bot.id)}">Detalles ${icon('arrow-right')}</button>${createAction}</div></article>`;
}


function renderBots() {
  const match = location.pathname.match(/^\/bots\/([^/]+)$/);
  if (match) return renderBotDetails(state.catalog.find((bot) => bot.id === decodeURIComponent(match[1])));
  const catalog = state.catalog;
  const plugins = catalog.reduce((sum, bot) => sum + number(bot.pluginCount), 0);
  const webRuntimeCount = catalog.filter((bot) => bot.webRuntime).length;
  const details = `<div class="bots-summary"><article class="card summary-tile"><span>Bots en catálogo</span><strong>${formatNumber(catalog.length)}</strong></article><article class="card summary-tile"><span>Plugins</span><strong>${formatNumber(plugins)}</strong></article><article class="card summary-tile"><span>Runtime web</span><strong>${formatNumber(webRuntimeCount)}</strong></article><article class="card summary-tile"><span>Procesos simultáneos</span><strong>1</strong></article></div>`;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('bot')} Repositorio</span><h1>Bots</h1><p>Selecciona un bot compatible, ingresa tu número para Pairing Code o elige QR para iniciar la vinculación.</p></div><div class="page-heading-actions"><a class="btn btn-primary" href="/register" data-page="register">${icon('plus')} Crear bot</a></div></div>${details}
    <div class="callout">${icon('shield')}<span><strong>Runtime web protegido:</strong> solo la cuenta propietaria del panel (la primera cuenta creada) o las cuentas autorizadas pueden iniciar o detener bots y ver códigos. Se permite un proceso a la vez; Render Free puede suspenderlo y el almacenamiento de credenciales es efímero.</span></div>
    <section class="section-block" style="margin-top:24px"><div class="section-heading"><div><span class="section-kicker">${icon('folder')} Catálogo público</span><h2 class="section-title">Bots disponibles</h2></div></div>${catalog.length ? `<div class="bot-list">${catalog.map(renderCatalogBotCard).join('')}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('bot')}</span><h2>No hay bots publicados</h2><p>Agrega una carpeta válida dentro de <code>bots/</code>.</p></div>`}</section>${pageFooter()}</div>`;
}

function renderRuntimePanel(bot, { createMode = false } = {}) {
  if (!bot.webRuntime) {
    return `<section class="card runtime-card"><div class="runtime-card-heading"><span class="runtime-icon">${icon('smartphone')}</span><div><h2>Runtime web</h2><p>Este bot no declara un punto de entrada web autorizado.</p></div></div><p class="runtime-note">Puedes seguir usando el entorno indicado por el catálogo; no se iniciará ningún proceso desde este panel.</p></section>`;
  }
  if (!state.user) {
    return `<section class="card runtime-card"><div class="runtime-card-heading"><span class="runtime-icon">${icon('bolt')}</span><div><h2>${createMode ? 'Desplegar bot y vincular WhatsApp' : 'Ejecutar en la web'}</h2><p>${escapeHtml(bot.name)} se iniciará como proceso dentro del servicio web ya desplegado.</p></div></div><p class="runtime-note">Crea la cuenta del panel o inicia sesión. La primera cuenta queda como propietaria y podrá desplegar el bot y ver el QR o Pairing Code.</p><button class="btn btn-primary" type="button" data-action="open-auth" data-mode="register">Crear cuenta ${icon('arrow-right')}</button></section>`;
  }

  const runtimes = state.runtimeState?.runtimes || [];
  const runtime = runtimes.find((item) => item.botId === bot.id);
  const activeStates = ['starting', 'running', 'awaiting-pairing', 'stopping'];
  const isActive = activeStates.includes(runtime?.status);
  const otherActive = runtimes.find((item) => item.botId !== bot.id && activeStates.includes(item.status));
  const canManage = Boolean(state.runtimeState?.canManage);
  const statusLabels = { starting: 'Iniciando', running: runtime?.connected ? 'Conectado' : 'Ejecutándose', 'awaiting-pairing': 'Esperando vinculación', stopping: 'Deteniéndose', stopped: 'Detenido', error: 'Error' };
  const statusLabel = runtime ? (statusLabels[runtime.status] || runtime.status) : 'Sin proceso';
  const runtimeError = {
    RUNTIME_FORBIDDEN: 'Solo la cuenta propietaria del panel (la primera cuenta creada) puede desplegar el bot y ver el QR o Pairing Code.',
    RUNTIME_OWNER_REQUIRED: 'Crea o inicia sesión en la primera cuenta del panel para activar el runtime.',
    RUNTIME_DISABLED: 'El runtime web está desactivado en este servicio.',
  }[state.runtimeErrorCode] || state.runtimeError || '';
  const logs = (runtime?.logs || []).slice(-8);
  const controls = canManage ? `<div class="runtime-controls"><label class="field"><span class="field-label">Método de vinculación</span><select class="select-input" id="runtime-method"><option value="qr" ${state.runtimeMethod === 'qr' ? 'selected' : ''}>Código QR real</option><option value="pairing-code" ${state.runtimeMethod === 'pairing-code' ? 'selected' : ''}>Pairing Code real</option></select></label><label class="field runtime-phone-field" id="runtime-phone-field" ${state.runtimeMethod !== 'pairing-code' ? 'hidden' : ''}><span class="field-label">Tu número de WhatsApp</span><input class="text-input" id="runtime-phone" type="tel" inputmode="tel" autocomplete="off" placeholder="59899123456" maxlength="20" required /><span class="field-hint">Escríbelo con el código de país, sin + (ej.: 59899123456). Se usa solo para solicitar el Pairing Code y no se guarda.</span></label><div class="runtime-actions"><button class="btn btn-primary" type="button" data-action="runtime-start" data-id="${escapeHtml(bot.id)}" ${state.runtimeBusy || isActive || otherActive ? 'disabled' : ''}>${icon('bolt')} ${state.runtimeBusy ? (createMode ? 'Desplegando…' : 'Iniciando…') : createMode ? 'Desplegar bot y vincular' : 'Iniciar bot'}</button><button class="btn btn-danger" type="button" data-action="runtime-stop" data-id="${escapeHtml(bot.id)}" ${state.runtimeBusy || !isActive ? 'disabled' : ''}>${icon('close')} Detener</button><button class="btn btn-outline" type="button" data-action="runtime-refresh">${icon('refresh')} Actualizar</button></div>${otherActive ? `<p class="field-hint">Límite Free: ${escapeHtml(otherActive.name)} ya ocupa el único proceso permitido.</p>` : ''}</div>` : '';
  const credential = runtime?.qrDataUrl
    ? `<div class="runtime-credential"><img src="${escapeHtml(runtime.qrDataUrl)}" alt="Código QR de vinculación de WhatsApp" width="280" height="280" /><p>Escanéalo en WhatsApp → Dispositivos vinculados → Vincular dispositivo. El QR se renueva solo si caduca.</p></div>`
    : runtime?.pairingCode
      ? `<div class="runtime-credential runtime-code"><span>Pairing Code de WhatsApp</span><code>${escapeHtml(runtime.pairingCode)}</code><button class="btn btn-outline btn-small" type="button" data-action="copy-runtime-code" data-copy="${escapeHtml(runtime.pairingCode)}">${icon('copy')} Copiar código</button><p>En WhatsApp abre Dispositivos vinculados → Vincular con número de teléfono e ingresa este código con el mismo número que escribiste en el panel. Caduca en ~60 s: si falla, pulsa <strong>Detener</strong> y vuelve a desplegar.</p></div>`
      : '';

  return `<section class="card runtime-card"><div class="runtime-card-heading"><span class="runtime-icon">${icon('bolt')}</span><div><span class="section-kicker">${icon('shield')} Runtime autorizado</span><h2>${createMode ? `Desplegar ${escapeHtml(bot.name)} en la web` : `Ejecutar ${escapeHtml(bot.name)} en la web`}</h2><p>${createMode ? 'Inicia el proceso dentro del servicio web existente; no crea otro servicio de Render. ' : ''}QR y Pairing Code provienen de Baileys; no son códigos de demostración.</p></div><span class="runtime-status runtime-status-${escapeHtml(runtime?.status || 'stopped')}" role="status" aria-live="polite">${escapeHtml(statusLabel)}</span></div>${runtimeError ? `<div class="runtime-error" role="alert">${icon('info')}<span>${escapeHtml(runtimeError)}</span></div>` : ''}${controls}${credential}${runtime?.lastError ? `<p class="runtime-error" role="alert">${icon('info')}<span>${escapeHtml(runtime.lastError)}</span></p>` : ''}${logs.length ? `<details class="runtime-logs"><summary>Registro reciente (${logs.length})</summary><pre>${logs.map((line) => `${escapeHtml(new Date(line.at).toLocaleTimeString('es-UY'))}  ${escapeHtml(line.message)}`).join('\n')}</pre></details>` : ''}<div class="runtime-warning">${icon('database')}<span>Las credenciales se guardan en el filesystem efímero de Render, no en PostgreSQL. Render Free ofrece 512 MB de RAM y 0.1 CPU: IA/OCR y otras tareas pesadas pueden no caber; el servicio puede suspenderse y, al reiniciar/desplegar, el proceso o la sesión pueden detenerse o perderse. No hay garantía 24/7. Límite configurado: un bot a la vez.</span></div>${!state.runtimeState && !runtimeError ? '<p class="runtime-note">Consultando permisos del runtime…</p>' : ''}</section>`;
}

function renderBotDetails(bot) {
  if (!bot) return `<div class="page-content"><div class="empty-state"><span class="empty-state-icon">${icon('help')}</span><h2>Bot no encontrado</h2><a class="btn btn-primary" href="/bots" data-page="bots">Volver al catálogo</a></div></div>`;
  const features = (bot.features || []).map((feature) => `<li>${icon('check')}<span>${escapeHtml(feature)}</span></li>`).join('') || '<li>Consulta el catálogo de archivos de plugins.</li>';
  const pairingLabel = bot.supportsPairingCode ? (bot.webRuntime ? 'Web o Termux' : 'Desde su entorno') : 'No declarado';
  const qrLabel = bot.supportsQr ? (bot.webRuntime ? 'Web o Termux' : 'Desde su entorno') : 'No declarado';
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('bot')} Detalles del catálogo</span><h1>${escapeHtml(bot.name)}</h1><p>${escapeHtml(bot.description)}</p></div><div class="page-heading-actions"><a class="btn btn-outline btn-small" href="/bots" data-page="bots">${icon('arrow-left')} Volver</a>${bot.webRuntime ? `<button class="btn btn-primary btn-small" type="button" data-action="create-from-bot" data-id="${escapeHtml(bot.id)}">Crear bot ${icon('plus')}</button>` : ''}</div></div>
    <div class="profile-grid"><section class="card profile-card"><h2>Ficha del bot</h2><div class="profile-details"><div class="profile-detail"><span>Runtime</span><strong>${bot.webRuntime ? 'Web Free o Termux' : bot.termuxOnly ? 'Termux' : escapeHtml(bot.executionMode)}</strong></div><div class="profile-detail"><span>Versión</span><strong>${escapeHtml(bot.version)}</strong></div><div class="profile-detail"><span>Plugins listados</span><strong>${formatNumber(bot.pluginCount)}</strong></div><div class="profile-detail"><span>Pairing Code</span><strong>${pairingLabel}</strong></div><div class="profile-detail"><span>QR</span><strong>${qrLabel}</strong></div></div></section><section class="card profile-card"><h2>Funciones declaradas</h2><ul class="instruction-list">${features}</ul></section></div>
    ${renderRuntimePanel(bot)}
    <section class="section-block"><div class="section-heading" style="margin-top:20px"><div><span class="section-kicker">${icon('code')} Componentes</span><h2 class="section-title">Plugins de ${escapeHtml(bot.name)}</h2></div><a class="btn btn-outline btn-small" href="/cmds?bot=${encodeURIComponent(bot.id)}" data-page="commands">Ver catálogo ${icon('arrow-right')}</a></div>${pageFooter()}</section></div>`;
}

function renderCreateBot() {
  const webBots = state.catalog.filter((bot) => bot.webRuntime);
  const bot = webBots.find((entry) => entry.id === state.createBotId) || webBots[0];
  if (!bot) {
    return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('bot')} Nuevo bot</span><h1>Crear bot</h1><p>Ningún bot del catálogo tiene activado el runtime web.</p></div></div><div class="empty-state"><span class="empty-state-icon">${icon('bot')}</span><h2>Runtime web no disponible</h2><p>Abre los detalles del bot para consultar su entorno compatible.</p><a class="btn btn-primary" href="/bots" data-page="bots">Ver bots ${icon('arrow-right')}</a></div>${pageFooter()}</div>`;
  }
  state.createBotId = bot.id;
  const selector = webBots.length > 1
    ? `<label class="field create-bot-selector"><span class="field-label">Bot</span><select class="select-input" id="create-bot-select">${webBots.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === bot.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label>`
    : '';
  return `<div class="page-content create-bot-page"><div class="page-heading"><div><span class="section-kicker">${icon('bolt')} Desplegar desde la web</span><h1>Crear bot</h1><p>Elige cómo vincular WhatsApp. Pairing Code requiere tu número internacional; con QR basta escanearlo desde WhatsApp.</p></div><div class="page-heading-actions"><a class="btn btn-outline btn-small" href="/bots" data-page="bots">${icon('arrow-left')} Ver catálogo</a></div></div>
    ${selector ? `<section class="card create-bot-selector-card">${selector}</section>` : ''}
    ${renderRuntimePanel(bot, { createMode: true })}
    <div class="callout">${icon('info')}<span>Al desplegar el bot, el panel inicia su proceso en el servicio web actual y muestra aquí el Pairing Code o QR real que genere Baileys. El número solo se envía para solicitar Pairing Code; no se guarda en tu cuenta.</span></div>${pageFooter()}</div>`;
}

function renderGuide() {
  const install = `pkg update -y && pkg install git nodejs-lts ffmpeg imagemagick python -y\ngit clone https://github.com/lyanvalentinmail-prog/MultiBot.git\ncd MultiBot/bots/universal-bot\nnpm install\ncp config.example.js config.js\nnano config.js\nnpm start`;
  return `<div class="page-content"><section class="store-hero"><span class="section-kicker">${icon('smartphone')} Instalación</span><h1>Universal Bot en <span class="gradient-text">Termux</span></h1><p>El bot funciona en Termux y ofrece un runtime web autorizado. El panel permite ver QR/Pairing Code reales; Render Free puede suspender el proceso y su almacenamiento es efímero.</p></section>
    <section class="section-block"><div class="premium-panel"><div class="premium-content"><div class="premium-heading"><span class="plan-icon">${icon('smartphone')}</span><span><h3>Instala el bot en Android</h3><small class="premium-label">Comandos para ejecutar dentro de Termux</small></span></div><p>Esta guía conserva el flujo Termux. Para vincular desde la web, abre Crear bot; los controles aparecen para la cuenta propietaria del panel.</p><div class="code-window"><div class="code-window-top"><span><i class="traffic-lights"><i></i><i></i><i></i></i> termux.sh</span><button class="btn btn-outline btn-small" type="button" data-action="copy" data-copy="${escapeHtml(install)}">${icon('copy')} Copiar</button></div><pre><code>${escapeHtml(install)}</code></pre></div><div class="token-links"><a class="token-link" href="https://github.com/lyanvalentinmail-prog/MultiBot/blob/main/docs/guides/TERMUX_GUIDE.md" target="_blank" rel="noreferrer">${icon('external')} Guía completa</a><a class="token-link" href="https://github.com/lyanvalentinmail-prog/MultiBot/tree/main/bots/universal-bot" target="_blank" rel="noreferrer">${icon('code')} Código del bot</a></div></div><div class="premium-includes"><h4>Vinculación — Web / Termux</h4><div class="official-methods"><div class="official-method"><span>${icon('hash')} Pairing Code</span><span>Baileys real, en web o Termux</span></div><div class="official-method"><span>${icon('qr')} Código QR</span><span>Baileys real, en web o Termux</span></div></div><div class="premium-note" style="margin-top:14px"><p>QR, Pairing Code y credenciales son sensibles: solo la cuenta propietaria debe verlos. En Render Free las credenciales pueden perderse al suspenderse o reiniciarse el servicio.</p></div></div></div></section>
    <section class="section-block"><div class="callout">${icon('database')}<span><strong>Persistencia y límite Free:</strong> el panel usa PostgreSQL cuando <code>DATABASE_URL</code> está configurada. La base PostgreSQL Free de Render expira a los 30 días; planifica una exportación o migración antes del vencimiento. No es almacenamiento permanente.</span></div></section>${pageFooter()}</div>`;
}

function renderMetrics() {
  const sys = state.system;
  const server = sys?.server;
  const db = sys?.database;
  const mem = server?.memory;
  const cpu = server?.cpu;
  const pluginCount = state.catalog.reduce((sum, bot) => sum + number(bot.pluginCount), 0);
  const metrics = [
    { label: 'Uptime del panel', value: server ? formatUptime(server.uptimeMs) : '—', note: 'Proceso Node web', icon: 'clock' },
    { label: 'CPU del host', value: `${number(cpu?.usageEstimate)}%`, note: `${number(cpu?.cores)} cores · carga ${number(cpu?.loadAverage)}`, icon: 'cpu', progress: number(cpu?.usageEstimate) },
    { label: 'Memoria del host', value: `${number(mem?.usagePercent)}%`, note: `${formatBytes(mem?.usedBytes)} / ${formatBytes(mem?.totalBytes)}`, icon: 'server', progress: number(mem?.usagePercent), green: true },
    { label: 'Persistencia', value: db?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local', note: db?.status === 'connected' ? 'Conexión verificada' : 'Fallback local', icon: 'database' },
    { label: 'Cuentas', value: formatNumber(db?.users || 0), note: 'Usuarios del panel', icon: 'users' },
    { label: 'Runtime web', value: formatNumber(state.catalog.filter((bot) => bot.webRuntime).length), note: 'Bots compatibles', icon: 'bolt' },
    { label: 'Bots', value: formatNumber(state.catalog.length), note: 'Detectados en bots/', icon: 'bot' },
    { label: 'Plugins', value: formatNumber(pluginCount), note: 'Archivos listados', icon: 'code' },
  ];
  state.metricsExport = metrics.map((item) => ({ ...item, value: String(item.value), note: String(item.note) }));
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('chart')} Monitor del sistema</span><h1>Telemetría web</h1><p>Estas métricas describen el panel y su base; el runtime web muestra solo el estado básico del proceso para la cuenta propietaria.</p></div><div class="page-heading-actions"><button class="btn btn-outline btn-small" type="button" data-action="export-metrics">${icon('download')} Exportar CSV</button><button class="btn btn-outline btn-small" type="button" data-action="refresh-data">${icon('refresh')} Actualizar</button></div></div>
    <div class="metrics-grid metrics-grid-large">${metrics.map((metric) => `<article class="card telemetry-card"><span class="metric-label">${icon(metric.icon)}${escapeHtml(metric.label)}</span><strong class="metric-value">${escapeHtml(metric.value)}</strong><span class="metric-note">${escapeHtml(metric.note)}</span>${metric.progress != null ? `<div class="progress-track"><div class="progress-value ${metric.green ? 'green-fill' : ''}" style="width:${Math.max(0, Math.min(100, metric.progress))}%"></div></div>` : ''}</article>`).join('')}</div>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('cpu')} Servicio web</span><h2 class="section-title">Entorno del panel</h2><p class="section-copy">Datos del proceso Node que sirve esta interfaz.</p></div></div><div class="card service-list"><div class="service-row"><span class="service-info"><span class="green">●</span>${escapeHtml(server?.hostname || 'Servidor')}</span><span class="mono">${escapeHtml(server?.platform || '—')}</span><span class="service-meta"><span>${escapeHtml(server?.arch || '')}</span><span>Node ${escapeHtml(server?.node || '—')}</span></span></div><div class="service-row"><span class="service-info"><span class="green">●</span>Persistencia</span><span class="mono">${escapeHtml(db?.path || db?.provider || '—')}</span><span class="service-meta"><span>${escapeHtml(db?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local')}</span><span>${db?.status === 'connected' ? 'Conectada' : 'Disponible'}</span></span></div><div class="service-row"><span class="service-info"><span class="green">●</span>Memoria del proceso</span><span class="mono">${formatBytes(mem?.processBytes || 0)}</span><span class="service-meta"><span>Uso del host: ${number(mem?.usagePercent)}%</span><span>Servicio de panel</span></span></div></div></section>
    <section class="section-block"><div class="callout">${icon('info')}<span>La web no mide mensajes ni grupos. El runtime autorizado informa solo si el proceso está activo y si Baileys reportó conexión; Render Free no garantiza disponibilidad continua.</span></div></section>${pageFooter()}</div>`;
}

function renderPlugins() {
  const bot = state.catalog.find((entry) => entry.id === state.activeBotId) || state.catalog[0];
  const plugins = state.plugins.filter((plugin) => `${plugin.label} ${plugin.category} ${plugin.file}`.toLowerCase().includes(state.pluginQuery.toLowerCase()));
  const groups = [...new Set(plugins.map((plugin) => plugin.category))].sort();
  const count = plugins.length;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('code')} Catálogo del repositorio</span><h1>Plugins</h1><p>Comandos publicados en <code>commands/</code> (los que usa ${escapeHtml(bot?.id || 'universal-bot')}). El nombre del archivo no necesariamente es el comando de WhatsApp.</p></div><div class="page-heading-actions"><select id="plugin-bot" class="select-input select-small" aria-label="Seleccionar bot">${state.catalog.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === bot?.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></div></div>
    <div class="catalog-toolbar"><label class="search-box">${icon('search')}<input id="plugin-search" class="text-input" type="search" value="${escapeHtml(state.pluginQuery)}" placeholder="Buscar plugin… (ej.: anti-link, RPG, sticker)" autocomplete="off" /></label></div>
    <p class="commands-summary"><strong>${formatNumber(count)}</strong> archivos en <strong>${formatNumber(groups.length)}</strong> categorías <span id="command-visible" aria-live="polite"></span></p>
    ${state.loadingPlugins ? `<section class="card loading-panel"><span class="loading-spinner"></span><span>Cargando el catálogo de plugins…</span></section>` : plugins.length ? `<div class="command-grid">${groups.map((group) => `<section class="card command-card"><div class="command-card-head"><h2>${escapeHtml(pluginCategoryName(group))}</h2><span class="command-badge">${plugins.filter((plugin) => plugin.category === group).length}</span></div><div class="command-list">${plugins.filter((plugin) => plugin.category === group).map((plugin) => `<article class="command-item"><div class="command-item-head"><button class="command-pill" type="button" data-action="copy" data-copy="${escapeHtml(plugin.file)}" title="Copiar nombre del archivo">${icon('copy')} <code>${escapeHtml(plugin.file)}</code></button><span class="command-badge">Archivo JS</span></div><p class="command-desc">${escapeHtml(plugin.label)} · ${escapeHtml(pluginCategoryName(group))}</p><p class="command-aliases"><a href="https://github.com/lyanvalentinmail-prog/MultiBot/blob/main/commands/${encodeURIComponent(plugin.path || plugin.file)}" target="_blank" rel="noreferrer">Ver código en GitHub ${icon('external')}</a></p></article>`).join('')}</div></section>`).join('')}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('search')}</span><h2>${state.loadingPlugins ? 'Cargando catálogo' : 'No hay coincidencias'}</h2><p>Prueba otro término o selecciona otro bot del repositorio.</p></div>`}${pageFooter()}</div>`;
}

function renderEndpointRows(items) {
  if (!items.length) return '<div class="endpoint-empty">No se encontraron rutas con estos filtros.</div>';
  return items.map((endpoint) => `<div class="endpoint-row" role="button" tabindex="0" data-action="show-endpoint" data-path="${escapeHtml(endpoint.path)}"><span class="endpoint-row-main"><strong>${escapeHtml(endpoint.path.split('/').filter(Boolean).slice(-1)[0] || 'Inicio')}</strong><code>${escapeHtml(endpoint.path)}</code></span><span class="method-badge">${escapeHtml(endpoint.method)}</span><span class="endpoint-row-side"><span class="tier-badge">${endpoint.auth === true ? 'Auth' : endpoint.auth === 'optional' ? 'Opcional' : 'Público'}</span><button class="favorite-button ${state.endpointFavorites.includes(endpoint.path) ? 'is-favorite' : ''}" type="button" data-action="endpoint-favorite" data-path="${escapeHtml(endpoint.path)}" aria-label="${state.endpointFavorites.includes(endpoint.path) ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${icon('star')}</button></span></div>`).join('');
}

function renderEndpoints() {
  const endpoints = state.endpoints.filter((endpoint) => {
    const query = state.endpointQuery.trim().toLowerCase();
    const matchesQuery = !query || `${endpoint.path} ${endpoint.method} ${endpoint.description}`.toLowerCase().includes(query);
    const matchesMethod = state.endpointMethod === 'all' || String(endpoint.method).toLowerCase() === state.endpointMethod;
    return matchesQuery && matchesMethod;
  });
  const groups = [...new Set(endpoints.map(categoryForEndpoint))];
  const count = state.endpoints.length;
  const categories = groups.map((group) => {
    const items = endpoints.filter((endpoint) => categoryForEndpoint(endpoint) === group);
    const open = state.openCategories.has(group) || state.endpointQuery.length > 0;
    return `<section class="endpoint-category ${open ? 'is-open' : ''}"><div class="endpoint-category-head" role="button" tabindex="0" data-action="toggle-category" data-category="${escapeHtml(group)}"><span class="endpoint-category-title"><span class="endpoint-count">${items.length}</span><strong>${escapeHtml(group)}</strong></span>${icon('chevron')}</div>${open ? `<div class="endpoint-items">${renderEndpointRows(items)}</div>` : ''}</section>`;
  }).join('');
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('code')} Referencia</span><h1>API del panel</h1><p>Rutas HTTP reales de MultiBot. Las rutas autenticadas requieren un token Bearer de la sesión del panel.</p></div><span class="badge">${formatNumber(count)} rutas</span></div>
    <div class="catalog-note card"><span>${icon('shield')}</span><p>La documentación pública no incluye secretos. Los endpoints de runtime y los QR/Pairing Code reales requieren la sesión de la cuenta propietaria del panel.</p><a class="btn btn-outline btn-small" href="/favorites" data-page="favorites">${icon('star')} Favoritos</a></div>
    <div class="catalog-toolbar"><label class="search-box">${icon('search')}<input id="endpoint-search" class="text-input" type="search" value="${escapeHtml(state.endpointQuery)}" placeholder="Buscar ruta… (ej.: bots, runtime, login)" autocomplete="off" /></label><div class="filter-row"><button class="filter-chip ${state.endpointMethod === 'all' ? 'is-active' : ''}" type="button" data-action="endpoint-method" data-method="all">Todos</button>${['get', 'post', 'patch', 'delete'].map((method) => `<button class="filter-chip ${state.endpointMethod === method ? 'is-active' : ''}" type="button" data-action="endpoint-method" data-method="${method}">${method}</button>`).join('')}</div><div class="section-heading"><span class="muted small" aria-live="polite">${formatNumber(endpoints.length)} de ${formatNumber(count)} rutas</span></div><div class="catalog-categories">${categories || '<div class="endpoint-empty card">No hay rutas API disponibles.</div>'}</div></div>${pageFooter()}</div>`;
}

function renderFavorites() {
  const bots = state.catalog.filter((bot) => state.favorites.includes(bot.id));
  const endpoints = state.endpoints.filter((endpoint) => state.endpointFavorites.includes(endpoint.path));
  const empty = !bots.length && !endpoints.length;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('star')} Accesos guardados</span><h1>Favoritos</h1><p>Los favoritos se guardan localmente en este navegador; no alteran los bots ni la API.</p></div><a class="btn btn-outline btn-small" href="/bots" data-page="bots">${icon('arrow-left')} Volver al catálogo</a></div>${empty ? `<div class="empty-state"><span class="empty-state-icon">${icon('star')}</span><h2>No hay favoritos</h2><p>Marca con la estrella un bot o una ruta API para encontrarla aquí.</p><a class="btn btn-primary" href="/bots" data-page="bots">Ver catálogo ${icon('arrow-right')}</a></div>` : ''}${bots.length ? `<section class="section-block" style="margin-top:0"><div class="section-heading"><div><span class="section-kicker">${icon('bot')} Catálogo</span><h2 class="section-title">Bots guardados</h2></div></div><div class="bot-list">${bots.map(renderCatalogBotCard).join('')}</div></section>` : ''}${endpoints.length ? `<section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('code')} API</span><h2 class="section-title">Rutas guardadas</h2></div></div><div class="endpoint-category is-open"><div class="endpoint-items">${renderEndpointRows(endpoints)}</div></div></section>` : ''}${pageFooter()}</div>`;
}

function renderSupport() {
  return `<div class="page-content"><section class="ticket-hero"><div><span class="section-kicker">${icon('headset')} Ayuda</span><h1>Centro de soporte</h1><p>Consulta la guía de instalación o reporta un problema del repositorio. Esta página no crea tickets ficticios.</p></div><a class="btn btn-primary btn-large" href="https://github.com/lyanvalentinmail-prog/MultiBot/issues" target="_blank" rel="noreferrer">${icon('external')} Abrir issue</a></section>
    <div class="ticket-stats"><article class="card ticket-stat"><span class="stat-icon">${icon('bot')}</span><strong>${formatNumber(state.catalog.length)}</strong><span>Bots catálogo</span></article><article class="card ticket-stat"><span class="stat-icon">${icon('code')}</span><strong>${formatNumber(state.catalog.reduce((n, bot) => n + number(bot.pluginCount), 0))}</strong><span>Plugins listados</span></article><article class="card ticket-stat"><span class="stat-icon">${icon('smartphone')}</span><strong>Termux</strong><span>Runtime Web + Termux</span></article><article class="card ticket-stat"><span class="stat-icon">${icon('database')}</span><strong>${state.system?.database?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON'}</strong><span>Persistencia panel</span></article></div>
    <section class="section-block" style="margin-top:0"><div class="section-heading"><div><span class="section-kicker">${icon('help')} Recursos</span><h2 class="section-title">Guías y documentación</h2></div></div><div class="shortcut-grid"><a class="card card-hover shortcut-card" href="/store" data-page="store"><span class="shortcut-icon">${icon('smartphone')}</span><span><strong>Instalar en Termux</strong><small>Pasos y métodos QR/Pairing</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/endpoints" data-page="endpoints"><span class="shortcut-icon">${icon('code')}</span><span><strong>Documentación API</strong><small>Rutas HTTP del panel</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div></section>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('shield')} Reglas del producto</span><h2 class="section-title">Seguridad y ejecución</h2></div></div><div class="card service-list"><div class="service-row"><span class="service-info">Universal Bot</span><span class="mono">Web + Termux</span><span class="service-meta"><span>Runtime web para la cuenta propietaria</span><span>Un proceso simultáneo en el plan Free</span></span></div><div class="service-row"><span class="service-info">Pairing Code y QR</span><span class="mono">Baileys real</span><span class="service-meta"><span>Solo la cuenta propietaria los ve</span><span>Sesión en filesystem efímero, no PostgreSQL</span></span></div></div></section>${pageFooter()}</div>`;
}

function renderProfile() {
  const user = state.user;
  const db = state.system?.database;
  const sys = state.system?.server;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('users')} Cuenta</span><h1>Mi perfil</h1><p>Cuenta del panel. No representa una sesión de WhatsApp.</p></div>${user ? `<button class="btn btn-outline btn-small" type="button" data-action="logout">${icon('external')} Cerrar sesión</button>` : ''}</div>
    <div class="profile-grid"><section class="card profile-card"><h2>Cuenta MultiBot</h2>${user ? `<div class="profile-details"><div class="profile-detail"><span>Usuario</span><strong>${escapeHtml(user.username || '—')}</strong></div><div class="profile-detail"><span>Email</span><strong>${escapeHtml(user.email || '—')}</strong></div><div class="profile-detail"><span>Cuenta creada</span><strong>${escapeHtml(formatDate(user.createdAt))}</strong></div></div><p class="field-hint" style="margin-top:16px">La sesión web solo autoriza el acceso al panel. Para vincular WhatsApp usa Crear bot; la cuenta del panel y el número de WhatsApp son independientes.</p>` : `<div class="fn-login-card"><span class="empty-state-icon">${icon('users')}</span><h2>Sin sesión iniciada</h2><p>Crea una cuenta del panel o inicia sesión para acceder a los controles autorizados.</p><button class="btn btn-primary" type="button" data-action="open-auth" data-mode="register">Crear cuenta</button><button class="btn btn-outline" type="button" data-action="open-auth" data-mode="login">Iniciar sesión</button></div>`}</section>
    <section class="card profile-card"><h2>Plataforma</h2><div class="profile-details"><div class="profile-detail"><span>Producto</span><strong>MultiBot</strong></div><div class="profile-detail"><span>Servidor web</span><strong>${escapeHtml(sys?.hostname || '—')}</strong></div><div class="profile-detail"><span>Entorno</span><strong>${escapeHtml(sys ? `${sys.platform} / ${sys.arch}` : '—')}</strong></div><div class="profile-detail"><span>Base de datos</span><strong>${escapeHtml(db?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local')}</strong></div><div class="profile-detail"><span>Estado</span><strong class="green">${db?.status === 'connected' ? 'Disponible' : 'Local'}</strong></div></div></section>
    <section class="card profile-card"><h2>Privacidad y ejecución</h2><p class="section-copy" style="font-size:13px">Se guarda la cuenta del panel y el token de sesión. El número internacional solo se envía al endpoint protegido para solicitar Pairing Code; no se guarda.</p><p class="section-copy" style="font-size:13px">El QR y Pairing Code se muestran temporalmente desde Baileys. Las credenciales quedan en el filesystem efímero de Render y pueden perderse al reiniciar.</p></section></div>${pageFooter()}</div>`;
}

function renderAuthModal() {
  const isRegister = state.authMode === 'register';
  return `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><div class="modal-brand">${brandMarkup()}</div><span class="section-kicker">${icon('users')} Cuenta MultiBot</span><h2 id="modal-title" style="margin-top:11px">${isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p class="modal-description">Tu cuenta sirve para acceder al panel y sus controles autorizados. No se vincula por sí sola con WhatsApp.</p><div class="modal-tabs"><button type="button" class="${!isRegister ? 'is-active' : ''}" data-action="auth-mode" data-mode="login">Iniciar sesión</button><button type="button" class="${isRegister ? 'is-active' : ''}" data-action="auth-mode" data-mode="register">Crear cuenta</button></div><form class="modal-form" data-form="auth"><label class="field"><span class="field-label">Email</span><input class="text-input" name="email" type="email" required autocomplete="email" placeholder="tu@email.com" /></label>${isRegister ? `<label class="field"><span class="field-label">Nombre de usuario</span><input class="text-input" name="username" type="text" required minlength="3" maxlength="32" autocomplete="username" placeholder="tu_usuario" /></label>` : ''}<label class="field"><span class="field-label">Contraseña</span><input class="text-input" name="password" type="password" required minlength="${isRegister ? 10 : 1}" maxlength="200" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'Mínimo 10 caracteres' : 'Tu contraseña'}" /></label><p class="modal-error" id="auth-error" aria-live="polite">${escapeHtml(state.modalError)}</p><button class="btn btn-primary btn-full" type="submit">${isRegister ? 'Crear cuenta' : 'Iniciar sesión'} ${icon('arrow-right')}</button></form><p class="modal-switch">${isRegister ? 'Después de iniciar sesión, usa Crear bot para vincular WhatsApp.' : '¿No tienes cuenta? Elige «Crear cuenta».'}</p>`;
}

function renderModal() {
  const host = $('#modal-content');
  if (!host || !state.modal) return;
  if (state.modal === 'auth') host.innerHTML = renderAuthModal();
}

function openModal(mode, payload = null) {
  state.modal = mode;
  state.modalError = '';
  if (mode === 'auth') state.authMode = payload === 'register' ? 'register' : 'login';
  renderModal();
  $('#modal-layer').hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => $('#modal-content input')?.focus(), 30);
}
function openAuth(mode = 'login') { openModal('auth', mode); }
function closeModal() {
  const layer = $('#modal-layer');
  if (layer?.contains(document.activeElement)) document.activeElement.blur?.();
  if (layer) layer.hidden = true;
  state.modal = '';
  document.body.classList.remove('modal-open');
}

function showToast(message, type = 'info') {
  const stack = $('#toast-stack');
  if (!stack || !message) return;
  const last = stack.lastElementChild;
  if (last && last.dataset.message === String(message)) { clearTimeout(Number(last.dataset.timer)); last.dataset.timer = String(setTimeout(() => last.remove(), 4200)); return; }
  const node = document.createElement('div');
  node.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  node.dataset.message = String(message); node.textContent = message; stack.append(node);
  while (stack.children.length > 4) stack.firstElementChild.remove();
  node.dataset.timer = String(setTimeout(() => node.remove(), 4200));
}

async function copyText(value, success = 'Copiado al portapapeles') {
  const text = String(value || '');
  try { await navigator.clipboard.writeText(text); showToast(success, 'success'); }
  catch {
    const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
    try { document.execCommand('copy'); showToast(success, 'success'); } catch { showToast('No se pudo copiar automáticamente.', 'error'); }
    input.remove();
  }
}

function openEndpoint(endpoint) {
  state.selectedEndpoint = endpoint;
  state.endpointCodeTab = 'curl';
  renderEndpointModal();
  $('#endpoint-layer').hidden = false;
  document.body.classList.add('modal-open');
}
function closeEndpoint() {
  $('#endpoint-layer').hidden = true;
  state.selectedEndpoint = null;
  if (!state.modal && $('#drawer-layer').hidden) document.body.classList.remove('modal-open');
}
function endpointSnippetBody(endpoint) {
  if (endpoint.path === '/api/auth/register') return { email: 'user@example.com', username: 'usuario', password: 'CAMBIA_ESTA_CLAVE' };
  if (endpoint.path === '/api/auth/login') return { email: 'user@example.com', password: 'TU_CLAVE' };
  if (endpoint.method === 'POST' && endpoint.path === '/api/instances') return { name: 'Mi Universal Bot', botId: 'universal-bot', prefix: '.', pairingMethod: 'pairing-code' };
  if (endpoint.method === 'PATCH' && endpoint.path.includes('/instances/')) return { name: 'Mi Universal Bot', prefix: '.', pairingMethod: 'pairing-code' };
  if (endpoint.method === 'POST' && endpoint.path === '/api/auth/logout') return {};
  return null;
}
function endpointSnippet(endpoint, tab = state.endpointCodeTab) {
  const path = endpoint.path.replace(/:id/g, 'YOUR_ID');
  const url = `${location.origin}${path}`;
  const body = endpointSnippetBody(endpoint);
  const authHeader = endpoint.auth === true ? '"Authorization": "Bearer TU_TOKEN"' : '';
  const headers = [authHeader, body !== null ? '"Content-Type": "application/json"' : ''].filter(Boolean).join(', ');
  if (tab === 'javascript') return `const response = await fetch("${path}", {\n  method: "${endpoint.method}",${headers ? `\n  headers: { ${headers} },` : ''}${body !== null ? `\n  body: JSON.stringify(${JSON.stringify(body, null, 2).replaceAll('\n', '\n  ')})` : ''}\n});\nconst data = await response.json();\nconsole.log(data);`;
  if (tab === 'python') return `import requests\n\nresponse = requests.${endpoint.method.toLowerCase()}(\n    "${url}"${headers ? `,\n    headers={${headers}}` : ''}${body !== null ? `,\n    json=${JSON.stringify(body)}` : ''}\n)\nprint(response.json())`;
  const curlHeaders = `${endpoint.auth === true ? `\\\n  -H "Authorization: Bearer TU_TOKEN"` : ''}${body !== null ? `\\\n  -H "Content-Type: application/json"\\\n  -d '${JSON.stringify(body)}'` : ''}`;
  return `curl -X ${endpoint.method} "${url}"${curlHeaders}`;
}
function renderEndpointModal() {
  const endpoint = state.selectedEndpoint;
  if (!endpoint) return;
  const tab = state.endpointCodeTab;
  const path = endpoint.path.replace(/:([a-zA-Z]+)/g, '{$1}');
  $('#endpoint-modal').innerHTML = `<div class="endpoint-modal-head"><span class="bot-orb">${icon('code')}</span><span><h2 id="endpoint-modal-title">${escapeHtml(endpoint.method)} ${escapeHtml(path)}</h2><p>${escapeHtml(endpoint.description)}</p></span><div class="endpoint-modal-actions"><button class="icon-button" type="button" data-action="copy-endpoint-url" aria-label="Copiar ruta">${icon('copy')}</button><button class="icon-button" type="button" data-action="close-endpoint" aria-label="Cerrar">${icon('close')}</button></div></div><div class="endpoint-modal-body"><section class="endpoint-url-box"><div class="endpoint-url-label"><span>${icon('bolt')} Ruta real del panel</span><span>${endpoint.auth === true ? 'Autenticación requerida' : endpoint.auth === 'optional' ? 'Auth opcional' : 'Pública'}</span></div><div class="endpoint-url-line"><span class="method-badge">${escapeHtml(endpoint.method)}</span><code id="endpoint-url-text">${escapeHtml(path)}</code><button class="icon-button" type="button" data-action="copy-endpoint-url" aria-label="Copiar ruta">${icon('copy')}</button></div></section><div><span class="endpoint-url-label">Ejemplo de solicitud</span><div class="code-tabs">${[['curl', 'cURL'], ['javascript', 'JavaScript'], ['python', 'Python']].map(([key, label]) => `<button class="${tab === key ? 'is-active' : ''}" type="button" data-action="endpoint-code-tab" data-tab="${key}">${label}</button>`).join('')}</div></div><section class="code-window"><div class="code-window-top"><span><i class="traffic-lights"><i></i><i></i><i></i></i> ${tab === 'python' ? 'example.py' : tab === 'curl' ? 'request.sh' : 'example.js'}</span><button class="btn btn-outline btn-small" type="button" data-action="copy-endpoint-code">${icon('copy')} Copiar</button></div><pre><code>${escapeHtml(endpointSnippet(endpoint, tab))}</code></pre></section><div class="callout">${icon('shield')}<span>${endpoint.auth === true ? 'Envía el token de sesión en Authorization: Bearer. No compartas el token.' : 'Esta ruta no requiere sesión.'} El ejemplo solo ejecuta la ruta descrita; los endpoints del runtime requieren la cuenta propietaria del panel.</span></div></div>`;
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  safeWrite(TOKEN_KEY, token);
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (state.token) requestHeaders.Authorization = `Bearer ${state.token}`;
  let response;
  try { response = await fetch(`${API}${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); }
  catch { throw new Error('No se pudo conectar con el panel. Revisa la conexión e inténtalo de nuevo.'); }
  const data = await response.json().catch(() => ({ ok: false, error: `Respuesta inesperada (${response.status}).` }));
  if (!response.ok) { const error = new Error(data.error || `Error HTTP ${response.status}`); error.status = response.status; error.code = data.code; throw error; }
  return data;
}

async function refreshState({ quiet = false } = {}) {
  try {
    const data = await request('/state');
    state.catalog = Array.isArray(data.bots) ? data.bots : [];
    state.user = data.user || null;
    if (state.token && !state.user) { state.token = ''; safeWrite(TOKEN_KEY, ''); }
    if (!state.user) { state.runtimeState = null; state.runtimeError = ''; state.runtimeErrorCode = ''; }
    if (!state.catalog.some((bot) => bot.id === state.activeBotId)) state.activeBotId = state.catalog[0]?.id || 'universal-bot';
    return data;
  } catch (error) { if (!quiet) showToast(error.message, 'error'); throw error; }
}
async function loadSystem({ quiet = true } = {}) { try { state.system = await request('/system'); return state.system; } catch (error) { if (!quiet) showToast(error.message, 'error'); return null; } }
async function loadHealth() { try { state.health = await request('/health'); return state.health; } catch { state.health = { ok: false }; return null; } }
async function loadRuntimeStatus({ quiet = true } = {}) {
  if (!state.user || !state.token) {
    state.runtimeState = null;
    state.runtimeError = '';
    state.runtimeErrorCode = '';
    return null;
  }
  try {
    state.runtimeState = await request('/runtime');
    state.runtimeError = '';
    state.runtimeErrorCode = '';
    return state.runtimeState;
  } catch (error) {
    state.runtimeState = null;
    state.runtimeError = error.message;
    state.runtimeErrorCode = error.code || '';
    if (!quiet && error.status !== 401) showToast(error.message, 'error');
    return null;
  }
}
async function startWebRuntime(botId) {
  if (!state.user) { openAuth('login'); return; }
  const method = $('#runtime-method')?.value === 'pairing-code' ? 'pairing-code' : 'qr';
  const phoneNumber = method === 'pairing-code' ? ($('#runtime-phone')?.value || '') : '';
  const phoneDigits = phoneNumber.replace(/\D/g, '');
  if (method === 'pairing-code' && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
    showToast('Ingresa un teléfono internacional válido para obtener Pairing Code.', 'error');
    return;
  }
  state.runtimeMethod = method;
  state.runtimeBusy = true;
  renderPage();
  try {
    await request(`/bots/${encodeURIComponent(botId)}/runtime/start`, { method: 'POST', body: { method, phoneNumber } });
    showToast('Proceso solicitado. El QR o Pairing Code real aparecerá cuando Baileys lo genere.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    await loadRuntimeStatus({ quiet: true });
    state.runtimeBusy = false;
    renderPage();
  }
}
async function stopWebRuntime(botId) {
  state.runtimeBusy = true;
  renderPage();
  try {
    await request(`/bots/${encodeURIComponent(botId)}/runtime/stop`, { method: 'POST' });
    showToast('Señal de detención enviada al proceso.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    await loadRuntimeStatus({ quiet: true });
    state.runtimeBusy = false;
    renderPage();
  }
}
async function loadEndpoints({ quiet = true } = {}) { try { const data = await request('/endpoints'); state.endpoints = data.endpoints || []; if (!state.openCategories.size) for (const category of [...new Set(state.endpoints.map(categoryForEndpoint))]) state.openCategories.add(category); return state.endpoints; } catch (error) { state.endpoints = []; if (!quiet) showToast(error.message, 'error'); return []; } }
async function loadPlugins(botId = state.activeBotId) { state.loadingPlugins = true; try { const data = await request(`/plugins?botId=${encodeURIComponent(botId)}`); state.plugins = data.plugins || []; state.activeBotId = botId; } catch (error) { state.plugins = []; showToast(error.message, 'error'); } finally { state.loadingPlugins = false; if (state.view === 'commands') renderPage(); } }

async function loadAll({ quiet = false } = {}) {
  await Promise.allSettled([refreshState({ quiet: true }), loadSystem(), loadHealth(), loadEndpoints()]);
  await loadRuntimeStatus({ quiet: true });
  if (state.view === 'commands') await loadPlugins(state.activeBotId);
  renderPage();
  if (!quiet) showToast('Datos del panel actualizados.', 'success');
}

async function submitAuth(form) {
  state.modalError = '';
  const data = new FormData(form);
  const mode = state.authMode;
  const body = { email: String(data.get('email') || '').trim(), password: String(data.get('password') || '') };
  if (mode === 'register') body.username = String(data.get('username') || '').trim();
  const button = $('button[type="submit"]', form);
  if (button) button.disabled = true;
  try {
    const response = await request(`/auth/${mode}`, { method: 'POST', body });
    setAuth(response.token, response.user);
    closeModal();
    await refreshState({ quiet: true });
    await loadRuntimeStatus({ quiet: true });
    renderPage({ force: true });
    showToast(mode === 'register' ? 'Cuenta creada. Inicia sesión para continuar.' : 'Sesión iniciada.', 'success');
  } catch (error) {
    state.modalError = error.message;
    const message = $('#auth-error', form);
    if (message) message.textContent = error.message;
  } finally { if (button) button.disabled = false; }
}



async function logout() {
  try { await request('/auth/logout', { method: 'POST', body: {} }); } catch {}
  state.token = ''; state.user = null; state.runtimeState = null; state.runtimeError = ''; state.runtimeErrorCode = ''; safeWrite(TOKEN_KEY, '');
  closeModal(); closeDrawer(); renderPage({ force: true }); showToast('Sesión cerrada.', 'success');
}


function toggleFavoriteBot(id) {
  state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
  safeWrite(FAVORITES_KEY, state.favorites);
  renderPage();
  showToast(state.favorites.includes(id) ? 'Bot añadido a favoritos.' : 'Bot quitado de favoritos.', 'success');
}
function toggleEndpointFavorite(path) {
  state.endpointFavorites = state.endpointFavorites.includes(path) ? state.endpointFavorites.filter((item) => item !== path) : [...state.endpointFavorites, path];
  safeWrite(ENDPOINT_FAVORITES_KEY, state.endpointFavorites);
  if (state.selectedEndpoint) renderEndpointModal();
  renderPage();
}
function selectBotForCreate(botId = '') {
  const bot = state.catalog.find((item) => item.id === botId && item.webRuntime)
    || state.catalog.find((item) => item.webRuntime);
  state.createBotId = bot?.id || '';
}

function handleClick(event) {
  const page = event.target.closest('[data-page]');
  if (page) {
    const view = page.dataset.page;
    if (!PATHS[view]) return;
    event.preventDefault();
    const href = page.getAttribute('href') || PATHS[view];
    navigate(view, { pathOverride: href });
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'toggle-theme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; safeWrite(THEME_KEY, state.theme); renderPage({ force: true }); }
  else if (action === 'open-drawer') openDrawer();
  else if (action === 'close-drawer') closeDrawer();
  else if (action === 'open-auth') openAuth(target.dataset.mode || 'login');
  else if (action === 'auth-mode') openAuth(target.dataset.mode || 'login');
  else if (action === 'close-modal') closeModal();
  else if (action === 'close-endpoint') closeEndpoint();
  else if (action === 'logout') logout();
  else if (action === 'refresh-data') loadAll();
  else if (action === 'show-bot') navigate('bots', { pathOverride: `/bots/${encodeURIComponent(target.dataset.id)}` });
  else if (action === 'runtime-start') startWebRuntime(target.dataset.id);
  else if (action === 'runtime-stop') stopWebRuntime(target.dataset.id);
  else if (action === 'runtime-refresh') loadRuntimeStatus({ quiet: false }).then(() => renderPage());
  else if (action === 'copy-runtime-code') copyText(target.dataset.copy || '', 'Pairing Code copiado. Úsalo de inmediato y no lo compartas.');
  else if (action === 'create-from-bot') { selectBotForCreate(target.dataset.id); navigate('register'); }
  else if (action === 'favorite-bot') toggleFavoriteBot(target.dataset.id);
  else if (action === 'toggle-category') { const category = target.dataset.category; state.openCategories.has(category) ? state.openCategories.delete(category) : state.openCategories.add(category); renderPage(); }
  else if (action === 'endpoint-method') { state.endpointMethod = target.dataset.method; renderPage(); }
  else if (action === 'show-endpoint') { const endpoint = state.endpoints.find((item) => item.path === target.dataset.path); if (endpoint) openEndpoint(endpoint); }
  else if (action === 'endpoint-code-tab') { state.endpointCodeTab = target.dataset.tab; renderEndpointModal(); }
  else if (action === 'copy-endpoint-url') { const endpoint = state.selectedEndpoint; if (endpoint) copyText(`${location.origin}${endpoint.path}`, 'Ruta copiada.'); }
  else if (action === 'copy-endpoint-code') { if (state.selectedEndpoint) copyText(endpointSnippet(state.selectedEndpoint), 'Ejemplo copiado.'); }
  else if (action === 'endpoint-favorite') toggleEndpointFavorite(target.dataset.path);
  else if (action === 'copy') copyText(target.dataset.copy || '');
  else if (action === 'copy-plugin') copyText(target.dataset.copy || '', 'Nombre del plugin copiado.');
  else if (action === 'open-palette') openPalette();
  else if (action === 'close-palette') closePalette();
  else if (action === 'export-metrics') exportMetricsCsv();
  else if (action === 'notifications') showToast('No hay notificaciones del panel.');
}

function handleInput(event) {
  const input = event.target;
  if (input.id === 'endpoint-search') { state.endpointQuery = input.value; renderPage(); }
  else if (input.id === 'plugin-search') { state.pluginQuery = input.value; renderPage(); }
  else if (input.id === 'command-search') { state.pluginQuery = input.value; renderPage(); }
  else if (input.id === 'palette-input') renderPaletteList(input.value);
}
function handleChange(event) {
  const target = event.target;
  if (target.dataset.action === 'toggle-landing-menu') { target.checked ? openDrawer() : closeDrawer(); }
  else if (target.id === 'create-bot-select') { selectBotForCreate(target.value); renderPage({ force: true }); }
  else if (target.id === 'plugin-bot') { state.activeBotId = target.value; state.pluginQuery = ''; loadPlugins(target.value); }
  else if (target.id === 'runtime-method') {
    state.runtimeMethod = target.value === 'pairing-code' ? 'pairing-code' : 'qr';
    const phoneField = $('#runtime-phone-field');
    if (phoneField) phoneField.hidden = state.runtimeMethod !== 'pairing-code';
  }
}
function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'auth') submitAuth(form);
}
function handleKeydown(event) {
  if (event.key === 'Escape') { closeDrawer(); closeModal(); closeEndpoint(); closePalette(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.endpoint-row[role="button"], .endpoint-category-head[role="button"]')) { event.preventDefault(); event.target.click(); }
}

function paletteItems() {
  const views = [
    ['home', 'Inicio', 'Resumen del panel', 'home'], ['bots', 'Catálogo de bots', 'Bots del repositorio', 'bot'],
    ['register', 'Crear bot', 'Vincula WhatsApp', 'plus'], ['metrics', 'Métricas', 'Panel y base de datos', 'chart'],
    ['commands', 'Plugins', 'Archivos del catálogo', 'code'], ['endpoints', 'Endpoints', 'API del portal', 'globe'],
    ['store', 'Guía Termux', 'Instalación, QR y Pairing Code', 'smartphone'], ['profile', 'Mi perfil', 'Cuenta', 'users']
  ].map(([view, label, hint, iconName]) => ({ label, hint, icon: iconName, run: () => navigate(view) }));
  const bots = state.catalog.map((bot) => ({ label: bot.name, hint: bot.termuxOnly ? 'Solo Termux · abrir detalle' : 'Abrir detalle del catálogo', icon: 'bot', run: () => navigate('bots', { pathOverride: `/bots/${encodeURIComponent(bot.id)}` }) }));
  return [...views, ...bots];
}
let paletteState = { items: [], active: 0 };
function paletteEl() {
  let el = $('#palette-layer');
  if (el) return el;
  el = document.createElement('div'); el.id = 'palette-layer'; el.className = 'palette-layer'; el.hidden = true;
  el.innerHTML = `<button class="palette-backdrop" type="button" data-action="close-palette" aria-label="Cerrar búsqueda"></button><div class="palette-card" role="dialog" aria-modal="true" aria-label="Buscar en MultiBot"><div class="palette-search">${icon('search')}<input id="palette-input" type="text" placeholder="Buscar páginas y bots…" autocomplete="off" /><kbd>esc</kbd></div><div class="palette-list" id="palette-list" role="listbox"></div><p class="palette-foot">↑↓ navegar · ↵ abrir · Ctrl+K alternar</p></div>`;
  document.body.appendChild(el);
  el.querySelector('#palette-input').addEventListener('input', () => renderPaletteList(el.querySelector('#palette-input').value));
  el.querySelector('#palette-input').addEventListener('keydown', paletteKeys);
  el.querySelector('#palette-list').addEventListener('click', (event) => { const button = event.target.closest('[data-palette-index]'); if (button) runPaletteItem(Number(button.dataset.paletteIndex)); });
  return el;
}
function paletteNorm(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function renderPaletteList(query = '') {
  const needle = paletteNorm(query);
  paletteState.items = paletteItems().filter((item) => !needle || paletteNorm(`${item.label} ${item.hint}`).includes(needle));
  paletteState.active = Math.min(paletteState.active, Math.max(0, paletteState.items.length - 1));
  const list = $('#palette-list');
  if (!list) return;
  list.innerHTML = paletteState.items.length ? paletteState.items.map((item, index) => `<button type="button" role="option" aria-selected="${index === paletteState.active}" class="palette-item ${index === paletteState.active ? 'is-active' : ''}" data-palette-index="${index}"><span class="palette-icon">${icon(item.icon)}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.hint)}</small></span></button>`).join('') : '<div class="palette-empty">Sin resultados.</div>';
}
function openPalette() { const el = paletteEl(); el.hidden = false; document.body.classList.add('modal-open'); const input = $('#palette-input'); input.value = ''; paletteState.active = 0; renderPaletteList(''); input.focus(); }
function closePalette() { const el = $('#palette-layer'); if (!el || el.hidden) return; el.hidden = true; if (!state.modal && $('#drawer-layer').hidden && $('#endpoint-layer').hidden) document.body.classList.remove('modal-open'); }
function runPaletteItem(index) { const item = paletteState.items[index]; if (!item) return; closePalette(); item.run(); }
function paletteKeys(event) { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const delta = event.key === 'ArrowDown' ? 1 : -1; const length = paletteState.items.length; if (length) paletteState.active = (paletteState.active + delta + length) % length; renderPaletteList($('#palette-input')?.value || ''); } else if (event.key === 'Enter') { event.preventDefault(); runPaletteItem(paletteState.active); } }

function exportMetricsCsv() {
  const server = state.system?.server; const db = state.system?.database;
  const rows = [['Sección', 'Métrica', 'Valor'], ['Panel', 'Uptime', formatUptime(server?.uptimeMs)], ['Panel', 'CPU estimada', `${number(server?.cpu?.usageEstimate)}%`], ['Panel', 'Memoria', formatBytes(server?.memory?.processBytes)], ['Base', 'Proveedor', db?.provider || 'json'], ['Base', 'Cuentas', String(db?.users || 0)], ['Catálogo', 'Bots', String(state.catalog.length)], ['Catálogo', 'Plugins', String(state.catalog.reduce((sum, bot) => sum + number(bot.pluginCount), 0))]];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `multibot-metricas-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  showToast('Métricas exportadas en CSV.', 'success');
}

function showStartupFailure(error) {
  console.error('No se pudo iniciar el panel MultiBot:', error);
  const main = $('#main-content');
  if (!main || main.dataset.ready === 'true') return;
  main.innerHTML = `<section class="boot-failure" role="alert"><span class="boot-fallback-mark" aria-hidden="true">!</span><div><span class="boot-fallback-kicker">Error de inicio</span><h1>No se pudo cargar el panel</h1><p>Comprueba tu conexión y vuelve a cargar la página. El catálogo no pudo inicializarse.</p><a href="">Recargar la página</a></div></section>`;
}

async function boot() {
  renderPage({ force: true });
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('popstate', () => { state.view = routeFromPath(); renderPage({ force: true }); if (state.view === 'commands') loadPlugins(state.activeBotId); if (state.view === 'endpoints') loadEndpoints(); });
  await Promise.allSettled([refreshState({ quiet: true }), loadSystem(), loadHealth(), loadEndpoints()]);
  await loadRuntimeStatus({ quiet: true });
  state.loading = false;
  renderPage({ force: true });
  if (state.view === 'commands') loadPlugins(state.activeBotId);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(async () => {
    if (document.hidden) return;
    await Promise.allSettled([refreshState({ quiet: true }), loadSystem(), loadHealth()]);
    await loadRuntimeStatus({ quiet: true });
    if (!state.modal && $('#endpoint-layer').hidden && state.view !== 'register') renderPage();
  }, 45000);
  setInterval(async () => {
    if (document.hidden || !state.runtimeState?.canManage) return;
    const active = (state.runtimeState.runtimes || []).some((runtime) => ['starting', 'running', 'awaiting-pairing', 'stopping'].includes(runtime.status));
    if (!active) return;
    await loadRuntimeStatus({ quiet: true });
    if ((state.view === 'bots' && location.pathname.startsWith('/bots/')) || state.view === 'register') renderPage();
  }, 3000);
}

boot().catch(showStartupFailure);
