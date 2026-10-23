/* MultiBot · portal web. Visual language adapted from the TomiOka panel.
 * This portal catalogs bots and stores deployment profiles; Termux-only bots
 * are never started or paired by the web server.
 */
const API = '/api';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeRead = (key, fallback) => { try { const value = localStorage.getItem(key); return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const formatNumber = (value) => new Intl.NumberFormat('es-UY').format(number(value));
const formatBytes = (value) => { const n = number(value); if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`; if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`; if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`; return `${n} B`; };
const formatUptime = (value) => { const sec = Math.max(0, Math.floor(number(value) / 1000)); const d = Math.floor(sec / 86400); const h = Math.floor((sec % 86400) / 3600); const m = Math.floor((sec % 3600) / 60); return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`; };
const PREFIXES = ['.', '!', '/', '#', '-'];
const TOKEN_KEY = 'multibot_session';
const FAVORITES_KEY = 'multibot_favorites';
const PATHS = { landing: '/', home: '/home', bots: '/bots', register: '/register', metrics: '/metrics', plugins: '/cmds', endpoints: '/endpoints', guide: '/store', support: '/tickets', profile: '/profile', favorites: '/favorites' };
const ROUTES = Object.fromEntries(Object.entries(PATHS).map(([key, value]) => [value, key]));
ROUTES['/commands'] = 'plugins'; ROUTES['/guide'] = 'guide'; ROUTES['/support'] = 'support'; ROUTES['/api-docs'] = 'endpoints';

const state = {
  view: routeFromPath(),
  catalog: [],
  instances: [],
  plugins: [],
  endpoints: [],
  system: null,
  health: null,
  user: null,
  token: safeRead(TOKEN_KEY, ''),
  favorites: safeRead(FAVORITES_KEY, []),
  activeBotId: new URLSearchParams(location.search).get('bot') || 'universal-bot',
  pluginFilter: '',
  modal: '',
  authMode: 'login',
  lastError: '',
  busy: false,
  lastRefresh: null
};

const navItems = [
  { view: 'home', label: 'Inicio', icon: 'home' },
  { view: 'bots', label: 'Bots', icon: 'bot' },
  { view: 'register', label: 'Crear perfil', icon: 'plus' },
  { view: 'metrics', label: 'Métricas', icon: 'chart' },
  { view: 'guide', label: 'Termux', icon: 'smartphone' }
];
const drawerItems = [
  ...navItems,
  { view: 'plugins', label: 'Plugins', icon: 'spark' },
  { view: 'endpoints', label: 'API', icon: 'code' },
  { view: 'favorites', label: 'Favoritos', icon: 'star' },
  { view: 'support', label: 'Soporte', icon: 'headset' },
  { view: 'profile', label: 'Cuenta', icon: 'users' }
];

function routeFromPath() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return ROUTES[path] || (path.startsWith('/bots/') ? 'bots' : 'landing');
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API}${path}`, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), cache: 'no-store' });
  } catch {
    throw new Error('No se pudo conectar con el panel. Revisa tu conexión e intenta de nuevo.');
  }
  const data = await response.json().catch(() => ({ ok: false, error: `Respuesta inesperada (${response.status}).` }));
  if (!response.ok) {
    const error = new Error(data.error || `Error HTTP ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function activeBot() { return state.catalog.find((bot) => bot.id === state.activeBotId) || state.catalog[0] || null; }
function pluginCategoryName(category) {
  const names = { anti: 'Protección', group: 'Grupos', rpg: 'RPG', game: 'Juegos', ia: 'IA', img: 'Imágenes', audio: 'Audio', video: 'Video', download: 'Descargas', sticker: 'Stickers', menu: 'Menú', info: 'Información', owner: 'Propietario', sub: 'Sub-bots', modo: 'Modos', search: 'Búsqueda', economy: 'Economía' };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function brandMarkup() {
  return `<span class="brand-mark" aria-hidden="true"><span class="brand-glyph">🤖</span></span><span class="brand-copy"><span class="brand-name">Multi<em>Bot</em></span><span class="brand-tagline">Panel de bots</span></span>`;
}

function pageLink(view, label, iconName, extra = '') {
  return `<a class="header-link ${state.view === view ? 'is-active' : ''} ${extra}" href="${PATHS[view]}" data-page="${view}">${icon(iconName)}<span>${label}</span></a>`;
}

function renderHeader() {
  const header = $('#site-header');
  if (!header) return;
  const loggedIn = Boolean(state.user);
  const name = state.user?.username || state.user?.email || 'Invitado';
  if (state.view === 'landing') {
    header.className = 'site-header landing-header';
    header.innerHTML = `<a class="brand" href="/" data-page="landing" aria-label="MultiBot, inicio">${brandMarkup()}</a>
      <nav class="header-links" aria-label="Navegación"><a class="header-link" href="#how">Cómo funciona</a><a class="header-link" href="#bots">Bots</a><a class="header-link" href="#faq">Preguntas</a></nav>
      <div class="header-actions"><span class="live-chip ${state.health?.ok ? 'is-live' : 'is-off'}" id="live-chip"><span class="dot"></span><span>${state.health?.ok ? 'Panel listo' : 'Conectando…'}</span></span>
      <a class="btn btn-primary btn-small header-panel-link" href="/home" data-page="home">Abrir panel ${icon('arrow-right')}</a>
      ${loggedIn ? `<button class="profile-button" type="button" data-page="profile"><span class="avatar">${escapeHtml(initials(name))}</span><span class="profile-name">${escapeHtml(name)}</span></button>` : `<button class="btn btn-outline btn-small" type="button" data-action="open-auth" data-mode="login">Iniciar sesión</button>`}
      <button class="icon-button mobile-menu-toggle" type="button" data-action="open-drawer" aria-label="Abrir menú">${icon('menu')}</button></div>`;
  } else {
    header.className = 'site-header is-app-header';
    header.innerHTML = `<a class="brand" href="/home" data-page="home" aria-label="MultiBot, panel">${brandMarkup()}</a>
      <nav class="desktop-app-nav" aria-label="Panel">${navItems.slice(0, 4).map((item) => pageLink(item.view, item.label, item.icon)).join('')}</nav>
      <div class="header-actions"><span class="live-chip ${state.health?.ok ? 'is-live' : 'is-off'}" id="live-chip"><span class="dot"></span><span>${state.health?.ok ? 'Panel listo' : 'Desconectado'}</span></span>
      <button class="icon-button" type="button" data-action="refresh" aria-label="Actualizar">${icon('refresh')}</button>
      ${loggedIn ? `<button class="profile-button" type="button" data-page="profile" aria-label="Cuenta de ${escapeHtml(name)}"><span class="avatar">${escapeHtml(initials(name))}</span><span class="profile-name">${escapeHtml(name)}</span>${icon('chevron')}</button>` : `<button class="btn btn-outline btn-small" type="button" data-action="open-auth" data-mode="login">Iniciar sesión</button>`}
      <button class="icon-button mobile-menu-toggle" type="button" data-action="open-drawer" aria-label="Abrir menú">${icon('menu')}</button></div>`;
  }
}

function renderBottomNavigation() {
  const nav = $('#bottom-navigation');
  if (!nav) return;
  if (state.view === 'landing') { nav.hidden = true; nav.innerHTML = ''; return; }
  nav.hidden = false;
  nav.innerHTML = `${[
    ...navItems,
    { view: 'menu', label: 'Menú', icon: 'menu' }
  ].map((item) => item.view === 'menu'
    ? `<button class="bottom-nav-item" type="button" data-action="open-drawer" aria-label="Abrir menú">${icon(item.icon)}<span>${item.label}</span></button>`
    : `<a class="bottom-nav-item ${state.view === item.view || (state.view === 'plugins' && item.view === 'bots') ? 'is-active' : ''}" href="${PATHS[item.view]}" data-page="${item.view}">${icon(item.icon)}<span>${item.label}</span></a>`).join('')}`;
}

function renderDrawer() {
  const drawer = $('#menu-drawer');
  if (!drawer) return;
  const user = state.user;
  drawer.innerHTML = `<div class="drawer-profile"><span class="avatar">${escapeHtml(initials(user?.username || user?.email || 'MB'))}</span><span class="drawer-profile-copy"><strong>${escapeHtml(user?.username || 'MultiBot')}</strong><small>${escapeHtml(user?.email || 'Portal público')}</small></span><button class="icon-button drawer-close" type="button" data-action="close-drawer" aria-label="Cerrar menú">${icon('close')}</button></div>
    <div class="drawer-section"><p class="drawer-section-label">MultiBot <span>01 — ${String(drawerItems.length).padStart(2, '0')}</span></p>${drawerItems.map((item) => `<a class="drawer-item ${state.view === item.view ? 'is-active' : ''}" href="${PATHS[item.view]}" data-page="${item.view}">${icon(item.icon)}<span><strong>${item.label}</strong><small>${drawerHint(item.view)}</small></span></a>`).join('')}</div>
    <div class="drawer-bottom"><button class="btn btn-outline btn-full" type="button" data-action="${user ? 'logout' : 'open-auth'}">${icon(user ? 'external' : 'lock')}${user ? 'Cerrar sesión' : 'Iniciar sesión'}</button><p>MultiBot · Universal Bot se ejecuta en Termux.</p></div>`;
}

function drawerHint(view) {
  return ({ home: 'Resumen del panel', bots: 'Catálogo y perfiles', register: 'Guardar una configuración', metrics: 'Estado del servidor y DB', guide: 'Instalación, QR y pairing', plugins: 'Funciones disponibles', endpoints: 'API del portal', favorites: 'Bots guardados', support: 'Documentación y ayuda', profile: 'Cuenta y sesión' })[view] || '';
}

function footer() {
  return `<footer class="page-footer"><span>© ${new Date().getFullYear()} <strong>MultiBot Team</strong> · Portal de bots</span><span><a href="https://github.com/lyanvalentinmail-prog/MultiBot" target="_blank" rel="noreferrer">GitHub ${icon('external')}</a><a href="/store" data-page="guide">Guía Termux</a></span></footer>`;
}

function pageHeading(kicker, title, description, actions = '') {
  return `<div class="page-heading"><div><span class="section-kicker">${icon('spark')}${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${actions ? `<div class="page-heading-actions">${actions}</div>` : ''}</div>`;
}

function statCard(label, value, note, iconName) {
  return `<article class="card metric-card"><span class="metric-label">${icon(iconName)}${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(String(value))}</strong><span class="metric-note">${escapeHtml(note)}</span></article>`;
}

function renderLanding() {
  const botCount = state.catalog.length;
  const pluginCount = state.catalog.reduce((sum, bot) => sum + bot.pluginCount, 0);
  const dbName = state.system?.database?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local';
  return `<div class="page-content landing-page" id="top">
    <section class="landing-hero" aria-labelledby="landing-title"><div class="landing-hero-copy">
      <span class="hero-version"><span class="pulse-dot"></span> Repositorio MultiBot · ${state.health?.ok ? 'panel disponible' : 'iniciando panel'}</span>
      <h1 class="landing-title" id="landing-title"><span class="title-line">Un hogar para</span><span class="title-line">todos tus <span class="gradient-text">bots.</span></span></h1>
      <p class="landing-lede">Gestiona el catálogo de bots de WhatsApp, guarda perfiles de configuración y consulta guías de despliegue. <strong>Cada bot conserva su propio runtime.</strong></p>
      <div class="landing-actions"><a class="btn btn-primary btn-large" href="/bots" data-page="bots">Explorar bots ${icon('arrow-right')}</a><a class="btn btn-outline btn-large" href="/store" data-page="guide">Instalar en Termux ${icon('smartphone')}</a></div>
      <div class="hero-footnote"><span>${icon('folder')} Bots aislados por carpeta</span><span>${icon('database')} ${escapeHtml(dbName)}</span><span>${icon('shield')} Sin contenido +18</span></div>
    </div><div class="hero-showcase" aria-label="Catálogo MultiBot"><div class="orbit"><span class="orbit-dot"></span></div>
      <div class="float-chip float-chip-one">${icon('bot')} ${botCount} bot${botCount === 1 ? '' : 's'} en catálogo</div><div class="float-chip float-chip-two">${icon('code')} ${formatNumber(pluginCount)} plugins</div>
      <div class="showcase-window"><div class="showcase-top"><span class="showcase-title">${icon('spark')} MULTIBOT · CATALOG</span><span class="window-dots"><i></i><i></i><i></i></span></div><div class="showcase-body">
        ${state.catalog.slice(0, 3).map((bot) => `<div class="showcase-bot"><span class="bot-orb">${icon('bot')}</span><span><strong>${escapeHtml(bot.name)}</strong><small>${escapeHtml(bot.executionMode === 'termux' ? 'Se ejecuta en Termux' : bot.executionMode)}</small></span><span class="status-tag"><i class="pulse-dot"></i>${bot.termuxOnly ? 'Termux' : 'Disponible'}</span></div>`).join('') || `<div class="showcase-bot"><span class="bot-orb">${icon('bot')}</span><span><strong>Cargando catálogo</strong><small>Lee la carpeta bots/</small></span></div>`}
        <div class="showcase-connection">${icon('shield')}<span><b>El panel no inicia Universal Bot</b> · protege el modo Termux-only</span></div>
      </div></div></div></section>
    <div class="landing-proof"><div class="proof-card"><span class="icon-wrap">${icon('bot')}</span><span><strong>${formatNumber(botCount)}</strong><span>Bots publicados</span></span></div><div class="proof-card"><span class="icon-wrap">${icon('code')}</span><span><strong>${formatNumber(pluginCount)}</strong><span>Plugins</span></span></div><div class="proof-card"><span class="icon-wrap">${icon('database')}</span><span><strong>${escapeHtml(dbName)}</strong><span>Persistencia</span></span></div><div class="proof-card"><span class="icon-wrap">${icon('globe')}</span><span><strong>${state.health?.ok ? 'En línea' : 'Conectando'}</strong><span>Panel</span></span></div></div>
    <section class="section-block" id="how"><div class="section-heading center"><span class="section-kicker">${icon('spark')} Cómo funciona</span><h2 class="section-title">Organiza bots en <span class="gradient-text">tres pasos</span></h2><p class="section-copy">El panel descubre los bots del repositorio; cada uno conserva su plataforma y requisitos.</p></div><div class="steps-grid">
      <article class="card card-hover step-card"><span class="step-number">01</span><h3>Elige un bot</h3><p>Consulta sus funciones, modo de ejecución y componentes publicados dentro de <code>bots/</code>.</p></article><article class="card card-hover step-card"><span class="step-number">02</span><h3>Guarda un perfil</h3><p>Registra un nombre, prefijo y método de vinculación preferido en tu cuenta.</p></article><article class="card card-hover step-card"><span class="step-number">03</span><h3>Ejecuta donde corresponde</h3><p>Universal Bot se instala en Termux. Al arrancar, eliges Pairing Code o QR desde la terminal.</p></article>
    </div></section>
    <section class="section-block" id="bots"><div class="section-heading"><div><span class="section-kicker">${icon('bot')} Catálogo</span><h2 class="section-title">Bots de <span class="gradient-text">MultiBot</span></h2></div><a class="btn btn-outline btn-small" href="/bots" data-page="bots">Ver catálogo ${icon('arrow-right')}</a></div><div class="mb-catalog-grid">${state.catalog.slice(0, 4).map(renderCatalogCard).join('') || `<div class="card empty-state"><h2>Sin bots publicados</h2><p>Agrega un bot dentro de <code>bots/</code> y aparecerá aquí.</p></div>`}</div></section>
    <section class="section-block" id="faq"><div class="section-heading center"><span class="section-kicker">${icon('headset')} Transparencia</span><h2 class="section-title">Preguntas <span class="gradient-text">frecuentes</span></h2></div><div class="faq-list">
      <details class="faq-item" open><summary>¿El panel corre los bots de WhatsApp?</summary><div class="faq-answer">No. Este panel gestiona el catálogo y perfiles de configuración. Universal Bot sigue siendo exclusivo de Termux; el panel no guarda credenciales de WhatsApp ni muestra un estado de conexión inventado.</div></details>
      <details class="faq-item"><summary>¿Cómo vinculo WhatsApp?</summary><div class="faq-answer">En Termux ejecuta <code>npm start</code> dentro de <code>bots/universal-bot</code> y elige <code>code</code> para pairing code o <code>qr</code> para mostrar el QR en la terminal.</div></details>
      <details class="faq-item"><summary>¿Dónde quedan mis configuraciones?</summary><div class="faq-answer">En PostgreSQL al desplegar con el Blueprint de Render, o en <code>data/multibot-local.json</code> cuando ejecutas el panel localmente sin DATABASE_URL.</div></details>
    </div></section>
    <section class="section-block landing-cta"><span class="section-kicker">${icon('bolt')} Empieza ahora</span><h2 style="margin-top:12px">Explora el catálogo</h2><p>Descubre los componentes del Universal Bot y sigue la guía de instalación en Termux.</p><div class="landing-actions"><a class="btn btn-primary btn-large" href="/bots" data-page="bots">Abrir catálogo ${icon('arrow-right')}</a><a class="btn btn-outline btn-large" href="/cmds" data-page="plugins">Ver plugins ${icon('code')}</a></div></section>
    ${footer()}</div>`;
}

function renderCatalogCard(bot) {
  const favorite = state.favorites.includes(bot.id);
  return `<article class="card mb-bot-card"><div class="mb-bot-heading"><span class="mb-bot-symbol">${icon('bot')}</span><span class="mb-bot-state ${bot.termuxOnly ? 'is-termux' : ''}">${bot.termuxOnly ? 'Solo Termux' : escapeHtml(bot.executionMode)}</span></div>
    <h3>${escapeHtml(bot.name)}</h3><p>${escapeHtml(bot.description || 'Bot de WhatsApp del repositorio MultiBot.')}</p>
    <div class="mb-tags"><span>${icon('code')}${formatNumber(bot.pluginCount)} plugins</span><span>${icon('link')}${bot.supportsPairingCode ? 'Pairing' : 'Sin pairing'}</span><span>${icon('qr')}${bot.supportsQr ? 'QR' : 'Sin QR'}</span></div>
    <div class="mb-card-actions"><button class="btn btn-primary btn-small" type="button" data-action="show-bot" data-id="${escapeHtml(bot.id)}">Detalles ${icon('arrow-right')}</button><button class="icon-button ${favorite ? 'is-favorite' : ''}" type="button" data-action="favorite" data-id="${escapeHtml(bot.id)}" aria-label="${favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${icon('star')}</button></div></article>`;
}

function renderHome() {
  const botCount = state.catalog.length;
  const pluginCount = state.catalog.reduce((sum, bot) => sum + bot.pluginCount, 0);
  const db = state.system?.database;
  const actions = `<button class="btn btn-outline btn-small" data-action="refresh" type="button">${icon('refresh')} Actualizar</button><a class="btn btn-primary btn-small" href="/register" data-page="register">${icon('plus')} Crear perfil</a>`;
  return `<div class="page-content">${pageHeading('Panel MultiBot', 'Inicio', 'Resumen real del catálogo, tus perfiles guardados y el estado del servicio.', actions)}
    <section class="welcome-hero"><div class="welcome-copy"><span class="section-kicker">${icon('spark')} Bienvenido${state.user ? `, ${escapeHtml(state.user.username)}` : ''}</span><h2>Gestiona sin mezclar tus bots.</h2><p>Cada bot vive en su propia carpeta y declara dónde se ejecuta. Universal Bot permanece limitado a Termux.</p><div class="welcome-actions"><a class="btn btn-primary" href="/bots" data-page="bots">Explorar bots ${icon('arrow-right')}</a><a class="btn btn-outline" href="/store" data-page="guide">Guía de Termux ${icon('smartphone')}</a></div></div><div class="welcome-emblem">${icon('bot')}</div></section>
    <div class="metrics-grid" style="margin-top:14px">${statCard('Bots disponibles', formatNumber(botCount), 'Leídos desde bots/', 'bot')}${statCard('Plugins publicados', formatNumber(pluginCount), 'Componentes del catálogo', 'code')}${statCard('Mis perfiles', state.user ? formatNumber(state.instances.length) : 'Inicia sesión', state.user ? 'Guardados en la base de datos' : 'Crea una cuenta para guardarlos', 'folder')}${statCard('Base de datos', db?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local', db?.status === 'connected' ? 'Conexión verificada' : 'Almacenamiento local', 'database')}</div>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bot')} Destacados</span><h2 class="section-title">Tu catálogo</h2></div><a class="btn btn-outline btn-small" href="/bots" data-page="bots">Ver todos ${icon('arrow-right')}</a></div><div class="mb-catalog-grid">${state.catalog.slice(0, 3).map(renderCatalogCard).join('')}</div></section>
    ${state.user ? `<section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('folder')} Mis perfiles</span><h2 class="section-title">Configuraciones recientes</h2></div><a class="btn btn-outline btn-small" href="/bots" data-page="bots">Administrar</a></div>${state.instances.length ? `<div class="mb-profile-list">${state.instances.slice(0, 3).map(renderProfileCard).join('')}</div>` : `<div class="card mb-empty"><h3>Aún no guardaste perfiles</h3><p>El perfil almacena preferencias; no inicia el bot en el servidor web.</p><a class="btn btn-primary btn-small" href="/register" data-page="register">Crear perfil ${icon('plus')}</a></div>`}</section>` : `<section class="info-banner">${icon('lock')}<div><h2>Guarda tus perfiles en la base de datos</h2><p>Crea una cuenta para mantener tu configuración sincronizada en Render y en el panel local.</p></div><button class="btn btn-primary btn-small" type="button" data-action="open-auth" data-mode="register">Crear cuenta</button></section>`}
    ${footer()}</div>`;
}

function renderBots() {
  const catalog = state.catalog;
  return `<div class="page-content">${pageHeading('Repositorio', 'Bots', 'Catálogo detectado automáticamente en bots/. Universal Bot se ejecuta exclusivamente desde Termux.', `<a class="btn btn-primary btn-small" href="/register" data-page="register">${icon('plus')} Guardar perfil</a>`)}
    <div class="mb-notice">${icon('shield')}<span><strong>Sin ejecución web:</strong> el panel no inicia sesiones de WhatsApp. Cada bot declara sus requisitos; Universal Bot usa Termux y mantiene Pairing Code y QR en su propio flujo de inicio.</span></div>
    <div class="mb-catalog-grid">${catalog.map(renderCatalogCard).join('') || `<div class="card mb-empty"><h2>No hay bots aún</h2><p>Crea una carpeta nueva desde <code>bots/_template</code>.</p></div>`}</div>
    ${state.user ? `<section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('folder')} Base de datos</span><h2 class="section-title">Mis perfiles</h2></div><a class="btn btn-primary btn-small" href="/register" data-page="register">${icon('plus')} Nuevo perfil</a></div>${state.instances.length ? `<div class="mb-profile-list">${state.instances.map(renderProfileCard).join('')}</div>` : `<div class="card mb-empty"><p>No tienes perfiles guardados. Crea uno para guardar el bot, prefijo y método preferido.</p></div>`}</section>` : `<section class="info-banner">${icon('lock')}<div><h2>Perfiles personales</h2><p>Inicia sesión para guardar configuraciones asociadas a tu cuenta.</p></div><button class="btn btn-primary btn-small" type="button" data-action="open-auth" data-mode="login">Iniciar sesión</button></section>`}
    ${footer()}</div>`;
}

function renderBotDetails(bot) {
  if (!bot) return `<div class="card mb-empty"><h2>Bot no encontrado</h2><a class="btn btn-primary" href="/bots" data-page="bots">Volver al catálogo</a></div>`;
  const features = bot.features?.length ? bot.features.map((feature) => `<li>${icon('check')}${escapeHtml(feature)}</li>`).join('') : '<li>Consulta los plugins disponibles.</li>';
  return `<div class="page-content">${pageHeading('Detalle de bot', bot.name, bot.description, `<a class="btn btn-outline btn-small" href="/bots" data-page="bots">${icon('arrow-left')} Volver</a>`)}
    <div class="mb-detail-grid"><section class="card mb-detail-card"><div class="mb-bot-heading"><span class="mb-bot-symbol">${icon('bot')}</span><span class="mb-bot-state is-termux">${bot.termuxOnly ? 'Solo Termux' : escapeHtml(bot.executionMode)}</span></div><h2>${escapeHtml(bot.name)}</h2><p>${escapeHtml(bot.description)}</p><div class="mb-tags"><span>${formatNumber(bot.pluginCount)} plugins</span><span>v${escapeHtml(bot.version)}</span><span>Sin NSFW/+18</span></div><ul class="mb-feature-list">${features}</ul><div class="mb-actions"><a class="btn btn-primary" href="/store" data-page="guide">Ver instalación ${icon('arrow-right')}</a><a class="btn btn-outline" href="/cmds?bot=${encodeURIComponent(bot.id)}" data-page="plugins" data-bot="${escapeHtml(bot.id)}">Ver plugins ${icon('code')}</a></div></section>
    <aside class="card mb-side-card"><h3>Conexión WhatsApp</h3><p>Pairing code y QR son gestionados por el bot durante su inicio; el panel no genera ni almacena códigos.</p><div class="mb-method"><span>${icon('hash')}</span><div><strong>Pairing Code</strong><small>${bot.supportsPairingCode ? 'Disponible al iniciar en Termux' : 'No declarado por este bot'}</small></div></div><div class="mb-method"><span>${icon('qr')}</span><div><strong>QR</strong><small>${bot.supportsQr ? 'Disponible en la terminal de Termux' : 'No declarado por este bot'}</small></div></div><div class="mb-method"><span>${icon('database')}</span><div><strong>Runtime web</strong><small>${bot.webRuntime ? 'Este bot declara compatibilidad web' : 'No se ejecuta dentro de este panel'}</small></div></div></aside></div>${footer()}</div>`;
}

function renderProfileCard(instance) {
  const bot = state.catalog.find((item) => item.id === instance.botId);
  const method = instance.pairingMethod === 'qr' ? 'QR' : 'Pairing Code';
  return `<article class="card mb-profile-card"><div class="mb-profile-main"><span class="mb-bot-symbol">${icon('bot')}</span><div><div class="mb-profile-title"><h3>${escapeHtml(instance.name)}</h3><span class="mb-bot-state is-termux">Configurado</span></div><p>${escapeHtml(bot?.name || instance.botId)} · Prefijo <code>${escapeHtml(instance.prefix)}</code> · ${method}</p><small>Guardado ${escapeHtml(new Date(instance.createdAt).toLocaleDateString('es-UY'))} · Pendiente de ejecutar en tu entorno</small></div></div><div class="mb-profile-actions"><button class="btn btn-primary btn-small" type="button" data-action="show-deploy" data-id="${escapeHtml(instance.id)}">${icon('smartphone')} Abrir guía</button><button class="btn btn-outline btn-small" type="button" data-action="edit-profile" data-id="${escapeHtml(instance.id)}">Editar</button><button class="icon-button" type="button" data-action="delete-profile" data-id="${escapeHtml(instance.id)}" aria-label="Eliminar perfil">${icon('close')}</button></div></article>`;
}

function renderRegister() {
  if (!state.user) return `<div class="page-content"><div class="wizard-wrap"><section class="wizard-card"><span class="wizard-step-label">CUENTA REQUERIDA</span><h1 class="wizard-title">Guarda una configuración</h1><p class="wizard-description">Inicia sesión o crea una cuenta para guardar tus perfiles en PostgreSQL (Render) o en la base local JSON.</p><div class="wizard-actions"><button class="btn btn-primary" type="button" data-action="open-auth" data-mode="register">${icon('plus')} Crear cuenta</button><button class="btn btn-outline" type="button" data-action="open-auth" data-mode="login">Iniciar sesión</button></div></section>${footer()}</div></div>`;
  const botOptions = state.catalog.map((bot) => `<option value="${escapeHtml(bot.id)}" ${bot.id === state.activeBotId ? 'selected' : ''}>${escapeHtml(bot.name)} · ${bot.termuxOnly ? 'Solo Termux' : escapeHtml(bot.executionMode)}</option>`).join('');
  return `<div class="page-content"><div class="wizard-wrap"><div class="stepper" aria-label="Asistente de perfil"><span class="stepper-track"><span class="stepper-fill" style="width:40%"></span></span><span class="stepper-item is-active">1</span><span class="stepper-item">2</span><span class="stepper-item">3</span></div><section class="wizard-card"><span class="wizard-step-label">NUEVO PERFIL</span><h1 class="wizard-title">Configura tu bot</h1><p class="wizard-description">Guarda preferencias para tu bot. Esto no crea una sesión ni inicia WhatsApp en Render.</p>
    <form class="wizard-form" data-form="create-profile"><label class="field"><span class="field-label">Nombre del perfil</span><input class="text-input" name="name" minlength="2" maxlength="48" required placeholder="Ej.: Bot principal" autocomplete="off" /></label><label class="field"><span class="field-label">Bot</span><select class="select-input" name="botId" required>${botOptions}</select><span class="field-hint">El catálogo se lee desde el directorio <code>bots/</code>.</span></label><div class="field"><span class="field-label">Prefijo de comandos</span><div class="mb-prefixes">${PREFIXES.map((prefix) => `<label class="mb-prefix-option"><input type="radio" name="prefix" value="${prefix}" ${prefix === (activeBot()?.defaultPrefix || '.') ? 'checked' : ''}><span>${escapeHtml(prefix)}</span></label>`).join('')}</div></div><label class="field"><span class="field-label">Método de vinculación preferido</span><select class="select-input" name="pairingMethod"><option value="pairing-code">Pairing Code (código)</option><option value="qr">QR en la terminal</option></select><span class="field-hint">Solo guarda tu preferencia. La vinculación se realiza al arrancar Universal Bot en Termux.</span></label><p class="modal-error" data-form-error role="alert" hidden></p><div class="wizard-actions is-single"><button class="btn btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${icon('check')} Guardar perfil</button></div></form></section><p class="wizard-footer-note">Conectado como ${escapeHtml(state.user.email)} · Los datos se guardan en ${escapeHtml(state.system?.database?.provider === 'postgresql' ? 'PostgreSQL' : 'la base local')}.</p>${footer()}</div></div>`;
}

function renderMetrics() {
  const sys = state.system;
  const db = sys?.database;
  const server = sys?.server;
  const mem = server?.memory;
  const cards = [
    { label: 'Base de datos', value: db?.provider === 'postgresql' ? 'PostgreSQL' : db?.provider === 'json' ? 'JSON local' : 'Cargando', note: db?.status || 'Conectando', icon: 'database' },
    { label: 'Configuraciones', value: formatNumber(db?.configurations || 0), note: 'Perfiles guardados globalmente', icon: 'folder' },
    { label: 'Usuarios', value: formatNumber(db?.users || 0), note: 'Cuentas registradas', icon: 'users' },
    { label: 'Bots', value: formatNumber(sys?.bots?.available || state.catalog.length), note: 'Detectados en bots/', icon: 'bot' },
    { label: 'Plugins', value: formatNumber(sys?.bots?.plugins || state.catalog.reduce((s, b) => s + b.pluginCount, 0)), note: 'Archivos de plugin', icon: 'code' },
    { label: 'Uptime', value: formatUptime(server?.uptimeMs), note: `Node ${server?.node || '—'} · ${server?.platform || '—'}`, icon: 'clock' }
  ];
  return `<div class="page-content">${pageHeading('Observabilidad', 'Métricas', 'Telemetría real del proceso web y estado de la base de datos; no representa el estado de bots ejecutándose en Termux.', `<button class="btn btn-outline btn-small" type="button" data-action="refresh">${icon('refresh')} Actualizar</button>`)}
    <div class="metrics-grid">${cards.map((item) => statCard(item.label, item.value, item.note, item.icon)).join('')}</div>
    <div class="mb-detail-grid" style="margin-top:14px"><section class="card mb-detail-card"><h2>Proceso web</h2><div class="mb-system-list"><div><span>Host</span><strong>${escapeHtml(server?.hostname || '—')}</strong></div><div><span>Plataforma</span><strong>${escapeHtml(server ? `${server.platform} / ${server.arch}` : '—')}</strong></div><div><span>Memoria del proceso</span><strong>${formatBytes(mem?.processBytes || 0)}</strong></div><div><span>Memoria del sistema</span><strong>${formatBytes(mem?.usedBytes || 0)} / ${formatBytes(mem?.totalBytes || 0)}</strong></div><div><span>CPU (estimación de carga)</span><strong>${server?.cpu?.usageEstimate ?? 0}% · ${server?.cpu?.cores ?? '—'} cores</strong></div></div></section><section class="card mb-detail-card"><h2>Persistencia</h2><p>${db?.provider === 'postgresql' ? 'Conectado a PostgreSQL. Cuentas, sesiones de panel y perfiles se guardan en la base de Render.' : 'Modo local: se utiliza data/multibot-local.json. Configura DATABASE_URL para usar PostgreSQL en Render.'}</p><div class="mb-notice">${icon('info')}<span>Las credenciales de sesión de WhatsApp nunca se suben al panel; quedan en Termux, dentro del bot.</span></div></section></div>${footer()}</div>`;
}

function renderPlugins() {
  const bot = activeBot();
  const items = state.plugins.filter((plugin) => `${plugin.label} ${plugin.category} ${plugin.file}`.toLowerCase().includes(state.pluginFilter.toLowerCase()));
  const groups = [...new Set(items.map((item) => item.category))].sort();
  return `<div class="page-content">${pageHeading('Componentes', 'Plugins', `Archivos de plugins de ${bot?.name || 'este bot'}. El nombre del archivo no siempre equivale al comando de WhatsApp.`, `<select class="select-input select-small" data-plugin-bot>${state.catalog.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === bot?.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select>`)}
    <label class="field mb-search"><span class="field-label">Buscar plugin</span><input class="text-input" type="search" data-plugin-search value="${escapeHtml(state.pluginFilter)}" placeholder="Ej.: anti-link, RPG, sticker…" autocomplete="off"></label>
    <p class="field-hint mb-result-count">${formatNumber(items.length)} de ${formatNumber(state.plugins.length)} plugins · ${escapeHtml(bot?.termuxOnly ? 'Se ejecuta en Termux' : 'Revisa los requisitos del bot')}</p>
    ${groups.map((group) => `<section class="section-block mb-plugin-group"><div class="section-heading"><h2 class="section-title">${escapeHtml(pluginCategoryName(group))}</h2><span class="badge">${items.filter((item) => item.category === group).length}</span></div><div class="mb-plugin-grid">${items.filter((item) => item.category === group).map((plugin) => `<article class="card mb-plugin-card"><span>${icon('code')}</span><div><strong>${escapeHtml(plugin.label)}</strong><small>${escapeHtml(plugin.file)}</small></div></article>`).join('')}</div></section>`).join('') || `<div class="card mb-empty"><h2>No hay coincidencias</h2><p>Prueba otro texto o selecciona otro bot.</p></div>`}${footer()}</div>`;
}

function renderEndpoints() {
  const endpoints = state.endpoints.length ? state.endpoints : [];
  return `<div class="page-content">${pageHeading('API', 'Endpoints', 'API HTTP real del panel. Los métodos que escriben requieren una cuenta y un token Bearer.', `<button class="btn btn-outline btn-small" type="button" data-action="refresh-endpoints">${icon('refresh')} Actualizar</button>`)}
    <div class="mb-notice">${icon('shield')}<span>Esta API gestiona el portal MultiBot; no expone comandos de WhatsApp ni arranca el Universal Bot en Render.</span></div>
    <div class="mb-api-list">${endpoints.map((endpoint) => `<article class="card mb-api-card"><div class="mb-api-row"><span class="mb-method ${endpoint.method === 'GET' ? 'is-get' : endpoint.method === 'POST' ? 'is-post' : endpoint.method === 'PATCH' ? 'is-patch' : 'is-delete'}">${escapeHtml(endpoint.method)}</span><code>${escapeHtml(endpoint.path)}</code><span class="badge">${endpoint.auth === true ? 'Auth' : endpoint.auth === 'optional' ? 'Opcional' : 'Público'}</span></div><p>${escapeHtml(endpoint.description)}</p></article>`).join('') || `<div class="card mb-empty">Cargando endpoints…</div>`}</div>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('code')} Ejemplo</span><h2 class="section-title">Autenticación</h2></div></div><div class="card mb-code-card"><p>Después de iniciar sesión, envía el token en el encabezado <code>Authorization</code>:</p><pre><code>Authorization: Bearer &lt;token-de-sesion&gt;</code></pre></div></section>${footer()}</div>`;
}

function renderGuide() {
  const install = `pkg update -y && pkg install git nodejs-lts ffmpeg imagemagick python -y\ngit clone https://github.com/lyanvalentinmail-prog/MultiBot.git\ncd MultiBot/bots/universal-bot\nnpm install\ncp config.example.js config.js\nnano config.js\nnpm start`;
  return `<div class="page-content">${pageHeading('Guía de instalación', 'Universal Bot en Termux', 'El bot solo se ejecuta en Termux. La web te guía y guarda perfiles, pero no inicia el proceso de WhatsApp.', `<a class="btn btn-outline btn-small" href="/bots" data-page="bots">${icon('arrow-left')} Catálogo</a>`)}
    <div class="mb-notice">${icon('shield')}<span><strong>Importante:</strong> no despliegues Universal Bot en Render. El guard de Termux bloquea entornos que no sean Termux; Render hospeda únicamente el panel web y la base de datos.</span></div>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('smartphone')} Paso 1</span><h2 class="section-title">Instalar dependencias y bot</h2></div></div><div class="card mb-code-card"><pre><code>${escapeHtml(install)}</code></pre><button class="btn btn-outline btn-small" type="button" data-action="copy" data-copy="${escapeHtml(install)}">${icon('copy')} Copiar instalación</button></div></section>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('lock')} Paso 2</span><h2 class="section-title">Configura al owner</h2></div></div><div class="card mb-detail-card"><p>Edita <code>config.js</code> y completa tu número y LID del owner. No subas ese archivo a GitHub: se ignora en el repositorio.</p><div class="mb-code-card mb-code-inline"><pre><code>global.owner = [['598XXXXXXXX', 'TuNombre', true]]</code></pre><button class="btn btn-outline btn-small" type="button" data-action="copy" data-copy="global.owner = [['598XXXXXXXX', 'TuNombre', true]]">${icon('copy')} Copiar ejemplo</button></div></div></section>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('link')} Paso 3</span><h2 class="section-title">Vincula WhatsApp</h2></div></div><div class="mb-detail-grid"><article class="card mb-method-card"><span class="mb-method-icon">${icon('hash')}</span><h3>Pairing Code</h3><p>Ejecuta <code>npm start</code>, escribe <code>code</code>, ingresa tu número con código de país y vincula el código en WhatsApp → Dispositivos vinculados.</p><button class="btn btn-outline btn-small" type="button" data-action="copy" data-copy="cd MultiBot/bots/universal-bot && npm start">${icon('copy')} Copiar comando</button></article><article class="card mb-method-card"><span class="mb-method-icon">${icon('qr')}</span><h3>QR</h3><p>Ejecuta <code>npm start</code>, escribe <code>qr</code> y escanea el código que aparece en la terminal con WhatsApp → Dispositivos vinculados.</p><button class="btn btn-outline btn-small" type="button" data-action="copy" data-copy="cd MultiBot/bots/universal-bot && npm start">${icon('copy')} Copiar comando</button></article></div></section>
    <div class="info-banner">${icon('database')}<div><h2>Tu sesión de WhatsApp permanece en Termux</h2><p>No la guardamos en Render. Para mantener el proceso activo en Android, usa <code>termux-wake-lock</code> y un gestor como <code>tmux</code>.</p></div><a class="btn btn-outline btn-small" href="https://github.com/lyanvalentinmail-prog/MultiBot/blob/main/docs/TERMUX_GUIDE.md" target="_blank" rel="noreferrer">Guía completa ${icon('external')}</a></div>${footer()}</div>`;
}

function renderFavorites() {
  const bots = state.catalog.filter((bot) => state.favorites.includes(bot.id));
  return `<div class="page-content">${pageHeading('Tus accesos', 'Favoritos', 'Los favoritos se guardan en este navegador.', `<a class="btn btn-outline btn-small" href="/bots" data-page="bots">Explorar bots</a>`)}<div class="mb-catalog-grid">${bots.map(renderCatalogCard).join('') || `<div class="card mb-empty"><h2>No guardaste favoritos</h2><p>Marca un bot con la estrella para tenerlo aquí.</p><a class="btn btn-primary btn-small" href="/bots" data-page="bots">Ver bots</a></div>`}</div>${footer()}</div>`;
}

function renderSupport() {
  return `<div class="page-content">${pageHeading('Ayuda', 'Soporte MultiBot', 'Guías de instalación, reporte de problemas y contribuciones al repositorio.')}
    <div class="shortcut-grid"><a class="card card-hover shortcut-card" href="https://github.com/lyanvalentinmail-prog/MultiBot/issues" target="_blank" rel="noreferrer"><span class="shortcut-icon">${icon('headset')}</span><span><strong>Reportar un problema</strong><small>Abre un issue en GitHub</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="https://github.com/lyanvalentinmail-prog/MultiBot" target="_blank" rel="noreferrer"><span class="shortcut-icon">${icon('code')}</span><span><strong>Repositorio</strong><small>Código, bots y documentación</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/store" data-page="guide"><span class="shortcut-icon">${icon('smartphone')}</span><span><strong>Guía Termux</strong><small>Instalación, QR y Pairing Code</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div>${footer()}</div>`;
}

function renderProfile() {
  if (!state.user) return `<div class="page-content">${pageHeading('Cuenta', 'Perfil', 'Inicia sesión para ver y administrar tus configuraciones.')}
    <section class="card mb-empty"><span class="empty-state-icon">${icon('users')}</span><h2>Sin sesión iniciada</h2><p>La cuenta permite asociar perfiles de configuración a tu usuario.</p><button class="btn btn-primary" type="button" data-action="open-auth" data-mode="login">${icon('lock')} Iniciar sesión</button></section>${footer()}</div>`;
  return `<div class="page-content">${pageHeading('Cuenta', 'Mi perfil', 'Tu cuenta del panel MultiBot y preferencias guardadas.')}
    <div class="mb-detail-grid"><section class="card mb-detail-card"><h2>Datos de cuenta</h2><div class="mb-system-list"><div><span>Usuario</span><strong>${escapeHtml(state.user.username)}</strong></div><div><span>Email</span><strong>${escapeHtml(state.user.email)}</strong></div><div><span>Perfiles guardados</span><strong>${formatNumber(state.instances.length)}</strong></div><div><span>Almacenamiento</span><strong>${escapeHtml(state.system?.database?.provider === 'postgresql' ? 'PostgreSQL' : 'JSON local')}</strong></div></div><button class="btn btn-outline" type="button" data-action="logout">${icon('external')} Cerrar sesión</button></section><section class="card mb-detail-card"><h2>Privacidad</h2><p>El panel solo guarda tu email, hash de contraseña, sesión del panel y perfiles (nombre, bot, prefijo y método preferido).</p><p>No almacena número de WhatsApp, QR, pairing code ni credenciales de Baileys.</p><a class="btn btn-outline btn-small" href="/endpoints" data-page="endpoints">Consultar API ${icon('arrow-right')}</a></section></div>${footer()}</div>`;
}

function renderPage() {
  renderHeader(); renderBottomNavigation(); renderDrawer();
  const main = $('#main-content');
  if (!main) return;
  main.classList.toggle('is-landing', state.view === 'landing');
  const pages = {
    landing: renderLanding, home: renderHome, bots: () => {
      const match = location.pathname.match(/^\/bots\/([^/]+)$/);
      if (match) return renderBotDetails(state.catalog.find((bot) => bot.id === decodeURIComponent(match[1])));
      return renderBots();
    },
    register: renderRegister, metrics: renderMetrics, plugins: renderPlugins, endpoints: renderEndpoints,
    guide: renderGuide, favorites: renderFavorites, support: renderSupport, profile: renderProfile
  };
  main.innerHTML = (pages[state.view] || renderLanding)();
  if (state.view === 'plugins') {
    const input = $('[data-plugin-search]', main);
    if (input && state.pluginFilter) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
}

function navigate(view, { replace = false, pathOverride = '' } = {}) {
  const target = pathOverride || PATHS[view] || '/';
  if (replace) history.replaceState({}, '', target); else history.pushState({}, '', target);
  state.view = view;
  if (view === 'plugins') loadPlugins(state.activeBotId).catch(() => {});
  if (view === 'metrics') loadSystem().catch(() => {});
  if (view === 'endpoints') loadEndpoints().catch(() => {});
  if (view === 'bots' || view === 'home' || view === 'register') refreshState().catch(() => {});
  closeDrawer();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message, type = 'info') {
  const stack = $('#toast-stack');
  if (!stack) return;
  const node = document.createElement('div');
  node.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  node.setAttribute('role', 'status');
  node.textContent = message;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function openDrawer() { const layer = $('#drawer-layer'); if (layer) layer.hidden = false; document.body.classList.add('modal-open'); }
function closeDrawer() { const layer = $('#drawer-layer'); if (layer) layer.hidden = true; document.body.classList.remove('modal-open'); }
function closeModal() { const layer = $('#modal-layer'); if (layer) layer.hidden = true; state.modal = ''; document.body.classList.remove('modal-open'); }

function showModal(content, title = '') {
  const layer = $('#modal-layer');
  const card = $('#modal-content');
  if (!layer || !card) return;
  card.innerHTML = content;
  card.setAttribute('aria-label', title || 'Ventana MultiBot');
  layer.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => $('[data-form] input:not([type="hidden"]), input:not([type="hidden"]), button, select', card)?.focus(), 20);
}

function openAuth(mode = 'login') {
  state.authMode = mode === 'register' ? 'register' : 'login';
  const register = state.authMode === 'register';
  const content = `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><span class="section-kicker">${icon('lock')} Cuenta MultiBot</span><h2 id="modal-title">${register ? 'Crear cuenta' : 'Iniciar sesión'}</h2><p class="modal-copy">${register ? 'Crea una cuenta para guardar tus perfiles en la base de datos.' : 'Entra a tu cuenta para administrar los perfiles guardados.'}</p><form class="modal-form" data-form="auth" data-mode="${register ? 'register' : 'login'}"><label class="field"><span class="field-label">Email</span><input class="text-input" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="tu@email.com"></label>${register ? `<label class="field"><span class="field-label">Nombre de usuario</span><input class="text-input" name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="tu_usuario"></label>` : ''}<label class="field"><span class="field-label">Contraseña</span><input class="text-input" name="password" type="password" required minlength="${register ? 10 : 1}" maxlength="200" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'Mínimo 10 caracteres' : 'Tu contraseña'}"></label><p class="modal-error" data-form-error role="alert" hidden></p><button class="btn btn-primary btn-full" type="submit">${register ? 'Crear cuenta' : 'Iniciar sesión'} ${icon('arrow-right')}</button></form><p class="modal-switch">${register ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'} <button type="button" class="btn-quiet" data-action="auth-mode" data-mode="${register ? 'login' : 'register'}">${register ? 'Inicia sesión' : 'Crear una cuenta'}</button></p>`;
  state.modal = 'auth';
  showModal(content, register ? 'Crear cuenta' : 'Iniciar sesión');
}

function openBotModal(id) {
  const bot = state.catalog.find((item) => item.id === id);
  if (!bot) return toast('No se encontró ese bot.', 'error');
  const features = bot.features?.length ? `<ul class="mb-feature-list">${bot.features.map((feature) => `<li>${icon('check')}${escapeHtml(feature)}</li>`).join('')}</ul>` : '';
  showModal(`<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><span class="section-kicker">${icon('bot')} ${escapeHtml(bot.executionMode)}</span><h2 id="modal-title">${escapeHtml(bot.name)}</h2><p class="modal-copy">${escapeHtml(bot.description)}</p><div class="mb-tags"><span>${formatNumber(bot.pluginCount)} plugins</span><span>v${escapeHtml(bot.version)}</span><span>Sin NSFW/+18</span></div>${features}<div class="mb-notice">${icon('shield')}<span>${bot.termuxOnly ? 'Este bot solo se ejecuta en Termux. Pairing Code y QR se usan desde su terminal.' : bot.webRuntime ? 'Este bot declara soporte web.' : 'Este portal no ejecuta este bot.'}</span></div><div class="modal-actions"><a class="btn btn-primary" href="/store" data-page="guide">Ver guía ${icon('arrow-right')}</a><a class="btn btn-outline" href="/cmds?bot=${encodeURIComponent(bot.id)}" data-page="plugins" data-bot="${escapeHtml(bot.id)}">Ver plugins</a></div>`, bot.name);
  state.modal = 'bot';
}

function profileById(id) { return state.instances.find((instance) => instance.id === id) || null; }
function setupCommands(botId = 'universal-bot') {
  const dir = `MultiBot/bots/${botId}`;
  return `pkg update -y && pkg install git nodejs-lts ffmpeg imagemagick python -y\ngit clone https://github.com/lyanvalentinmail-prog/MultiBot.git\ncd ${dir}\nnpm install\ncp config.example.js config.js\nnano config.js\nnpm start`;
}
function openDeployModal(id) {
  const profile = profileById(id);
  if (!profile) return toast('No se encontró ese perfil.', 'error');
  const bot = state.catalog.find((item) => item.id === profile.botId);
  const commands = setupCommands(profile.botId);
  const methodHint = profile.pairingMethod === 'qr' ? 'Al iniciar, elige qr y escanea el QR en WhatsApp.' : 'Al iniciar, elige code e introduce tu número para recibir el Pairing Code.';
  showModal(`<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><span class="section-kicker">${icon('smartphone')} Despliegue en Termux</span><h2 id="modal-title">${escapeHtml(profile.name)}</h2><p class="modal-copy">${escapeHtml(bot?.name || profile.botId)} · Prefijo <code>${escapeHtml(profile.prefix)}</code> · Método preferido: ${profile.pairingMethod === 'qr' ? 'QR' : 'Pairing Code'}.</p><div class="mb-notice">${icon('info')}<span>El perfil es solo una guía guardada. La sesión de WhatsApp se crea en tu dispositivo y nunca pasa por la base de datos web.</span></div><div class="card mb-code-card"><pre><code>${escapeHtml(commands)}</code></pre><button class="btn btn-outline btn-small" type="button" data-action="copy" data-copy="${escapeHtml(commands)}">${icon('copy')} Copiar comandos</button></div><p class="field-hint">${escapeHtml(methodHint)}</p><a class="btn btn-outline btn-small" href="/store" data-page="guide">Abrir guía completa ${icon('arrow-right')}</a>`, 'Despliegue en Termux');
  state.modal = 'deploy';
}

function openEditModal(id) {
  const profile = profileById(id);
  if (!profile) return toast('No se encontró ese perfil.', 'error');
  showModal(`<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><span class="section-kicker">${icon('folder')} Editar perfil</span><h2 id="modal-title">${escapeHtml(profile.name)}</h2><form class="modal-form" data-form="edit-profile" data-id="${escapeHtml(profile.id)}"><label class="field"><span class="field-label">Nombre</span><input class="text-input" name="name" required minlength="2" maxlength="48" value="${escapeHtml(profile.name)}"></label><label class="field"><span class="field-label">Prefijo</span><select class="select-input" name="prefix">${PREFIXES.map((prefix) => `<option value="${prefix}" ${prefix === profile.prefix ? 'selected' : ''}>${escapeHtml(prefix)}</option>`).join('')}</select></label><label class="field"><span class="field-label">Método preferido</span><select class="select-input" name="pairingMethod"><option value="pairing-code" ${profile.pairingMethod !== 'qr' ? 'selected' : ''}>Pairing Code</option><option value="qr" ${profile.pairingMethod === 'qr' ? 'selected' : ''}>QR</option></select></label><p class="modal-error" data-form-error role="alert" hidden></p><button class="btn btn-primary btn-full" type="submit">Guardar cambios</button></form>`, 'Editar perfil');
  state.modal = 'edit';
}

async function refreshState() {
  try {
    if (state.token) {
      try { state.user = (await request('/auth/me')).user; }
      catch (error) { if (error.status === 401) { state.token = ''; state.user = null; safeWrite(TOKEN_KEY, ''); } else throw error; }
    }
    const data = await request('/state');
    state.catalog = data.bots || [];
    state.instances = data.instances || [];
    if (data.user) state.user = data.user;
    if (!state.catalog.some((bot) => bot.id === state.activeBotId)) state.activeBotId = state.catalog[0]?.id || 'universal-bot';
    return data;
  } catch (error) {
    state.lastError = error.message;
    throw error;
  }
}

async function loadSystem() {
  try { state.system = await request('/system'); }
  catch (error) { state.lastError = error.message; }
}
async function loadHealth() {
  try { state.health = await request('/health'); }
  catch { state.health = { ok: false }; }
}
async function loadPlugins(botId = state.activeBotId) {
  try {
    state.activeBotId = botId;
    const data = await request(`/plugins?botId=${encodeURIComponent(botId)}`);
    state.plugins = data.plugins || [];
    if (state.view === 'plugins') renderPage();
  } catch (error) { state.plugins = []; toast(error.message, 'error'); }
}
async function loadEndpoints() {
  try { const data = await request('/endpoints'); state.endpoints = data.endpoints || []; if (state.view === 'endpoints') renderPage(); }
  catch (error) { state.endpoints = []; toast(error.message, 'error'); }
}
async function loadAll({ quiet = false } = {}) {
  state.busy = true;
  try {
    await Promise.all([refreshState(), loadSystem(), loadHealth()]);
    state.lastRefresh = Date.now();
    if (state.view === 'plugins') await loadPlugins(state.activeBotId);
    if (state.view === 'endpoints') await loadEndpoints();
    if (!quiet) toast('Panel actualizado.', 'success');
  } catch (error) { if (!quiet) toast(error.message, 'error'); }
  finally { state.busy = false; renderPage(); }
}

async function submitAuth(form) {
  const errorBox = $('[data-form-error]', form);
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
  const fd = new FormData(form);
  const mode = form.dataset.mode;
  const body = { email: String(fd.get('email') || '').trim(), password: String(fd.get('password') || '') };
  if (mode === 'register') body.username = String(fd.get('username') || '').trim();
  const button = $('button[type="submit"]', form);
  if (button) button.disabled = true;
  try {
    const data = await request(`/auth/${mode}`, { method: 'POST', body });
    state.token = data.token;
    state.user = data.user;
    safeWrite(TOKEN_KEY, data.token);
    closeModal();
    await refreshState();
    renderPage();
    toast(mode === 'register' ? 'Cuenta creada. Ya puedes guardar perfiles.' : 'Sesión iniciada.', 'success');
    if (mode === 'register' && state.view === 'register') renderPage();
  } catch (error) {
    if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
    else toast(error.message, 'error');
  } finally { if (button) button.disabled = false; }
}

async function submitCreateProfile(form) {
  if (!state.user) return openAuth('login');
  const errorBox = $('[data-form-error]', form);
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
  const fd = new FormData(form);
  const button = $('button[type="submit"]', form);
  if (button) button.disabled = true;
  try {
    const data = await request('/instances', { method: 'POST', body: {
      name: String(fd.get('name') || '').trim(), botId: String(fd.get('botId') || ''),
      prefix: String(fd.get('prefix') || '.'), pairingMethod: String(fd.get('pairingMethod') || 'pairing-code')
    } });
    state.instances = [data.instance, ...state.instances];
    toast('Perfil guardado en la base de datos.', 'success');
    navigate('bots');
    openDeployModal(data.instance.id);
  } catch (error) {
    if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; } else toast(error.message, 'error');
  } finally { if (button) button.disabled = false; }
}

async function submitEditProfile(form) {
  const errorBox = $('[data-form-error]', form);
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
  const fd = new FormData(form);
  const button = $('button[type="submit"]', form);
  if (button) button.disabled = true;
  try {
    const id = form.dataset.id;
    const data = await request(`/instances/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name: String(fd.get('name') || '').trim(), prefix: String(fd.get('prefix') || '.'), pairingMethod: String(fd.get('pairingMethod') || 'pairing-code') } });
    state.instances = state.instances.map((item) => item.id === id ? data.instance : item);
    closeModal(); renderPage(); toast('Perfil actualizado.', 'success');
  } catch (error) {
    if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; } else toast(error.message, 'error');
  } finally { if (button) button.disabled = false; }
}

async function logout() {
  try { await request('/auth/logout', { method: 'POST', body: {} }); } catch {}
  state.token = ''; state.user = null; state.instances = []; safeWrite(TOKEN_KEY, '');
  closeModal(); closeDrawer(); renderPage(); toast('Sesión cerrada.', 'success');
}

async function deleteProfile(id) {
  const profile = profileById(id);
  if (!profile || !confirm(`¿Eliminar el perfil «${profile.name}»? Esto no borra archivos de tu Termux.`)) return;
  try {
    await request(`/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.instances = state.instances.filter((item) => item.id !== id);
    renderPage(); toast('Perfil eliminado.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado al portapapeles.', 'success'); }
  catch {
    const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
    try { document.execCommand('copy'); toast('Copiado al portapapeles.', 'success'); } catch { toast('No se pudo copiar automáticamente.', 'error'); }
    input.remove();
  }
}

function toggleFavorite(id) {
  state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
  safeWrite(FAVORITES_KEY, state.favorites); renderPage();
  toast(state.favorites.includes(id) ? 'Añadido a favoritos.' : 'Quitado de favoritos.', 'success');
}

function handleClick(event) {
  const pageLink = event.target.closest('[data-page]');
  if (pageLink) {
    const view = pageLink.dataset.page;
    if (!PATHS[view]) return;
    event.preventDefault();
    const botId = pageLink.dataset.bot;
    if (botId) state.activeBotId = botId;
    const href = pageLink.getAttribute('href') || PATHS[view];
    if (state.modal) closeModal();
    navigate(view, { pathOverride: href });
    return;
  }
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const action = actionElement.dataset.action;
  if (action === 'open-auth') openAuth(actionElement.dataset.mode || 'login');
  else if (action === 'close-modal') closeModal();
  else if (action === 'open-drawer') openDrawer();
  else if (action === 'close-drawer') closeDrawer();
  else if (action === 'auth-mode') openAuth(actionElement.dataset.mode || 'login');
  else if (action === 'logout') logout();
  else if (action === 'refresh') loadAll();
  else if (action === 'refresh-endpoints') loadEndpoints();
  else if (action === 'show-bot') openBotModal(actionElement.dataset.id);
  else if (action === 'favorite') toggleFavorite(actionElement.dataset.id);
  else if (action === 'show-deploy') openDeployModal(actionElement.dataset.id);
  else if (action === 'edit-profile') openEditModal(actionElement.dataset.id);
  else if (action === 'delete-profile') deleteProfile(actionElement.dataset.id);
  else if (action === 'copy') copyText(actionElement.dataset.copy || '');
}


function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'auth') submitAuth(form);
  else if (form.dataset.form === 'create-profile') submitCreateProfile(form);
  else if (form.dataset.form === 'edit-profile') submitEditProfile(form);
}

function handleInput(event) {
  const target = event.target;
  if (target.matches('[data-plugin-search]')) {
    state.pluginFilter = target.value;
    const main = $('#main-content');
    const start = target.selectionStart;
    const end = target.selectionEnd;
    renderPage();
    const next = $('[data-plugin-search]', main);
    if (next) { next.focus(); next.setSelectionRange(start, end); }
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.matches('[data-plugin-bot]')) {
    state.pluginFilter = '';
    state.activeBotId = target.value;
    loadPlugins(state.activeBotId);
  }
  if (target.name === 'botId') {
    const bot = state.catalog.find((item) => item.id === target.value);
    const prefix = $(`input[name="prefix"][value="${CSS.escape(bot?.defaultPrefix || '.')}"]`);
    if (prefix) prefix.checked = true;
  }
}

function handlePopState() {
  state.view = routeFromPath();
  if (state.view === 'plugins') { state.activeBotId = new URLSearchParams(location.search).get('bot') || state.activeBotId; loadPlugins(state.activeBotId); }
  if (state.view === 'metrics') loadSystem();
  if (state.view === 'endpoints') loadEndpoints();
  renderPage();
}

async function boot() {
  applyTheme();
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  window.addEventListener('popstate', handlePopState);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeDrawer(); closeModal(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('bots'); }
  });
  await Promise.allSettled([refreshState(), loadSystem(), loadHealth(), loadEndpoints()]);
  if (state.view === 'plugins') await loadPlugins(state.activeBotId);
  renderPage();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(async () => {
    if (document.hidden) return;
    await Promise.allSettled([loadHealth(), loadSystem()]);
    if (state.user) await refreshState().catch(() => {});
    if (state.view !== 'landing' && state.view !== 'register' && !state.modal) renderPage();
  }, 45000);
}

function applyTheme() {
  document.body.classList.add('light-theme');
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#ffffff');
}

boot();
