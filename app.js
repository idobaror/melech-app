// ===== ליבת האפליקציה: התחברות, API, ניווט, כלי עזר =====

const CFG = window.APP_CONFIG;
const ROLES = {
  ALL: ['מנהל', 'משרד', 'מפיק', 'איש צוות'],
  OPS: ['מנהל', 'משרד', 'מפיק'],     // כל האירועים
  OFFICE: ['מנהל', 'משרד'],          // מכירות, הצעות, גבייה
  SETUP: ['מנהל', 'מפיק'],           // פרוטוקול הקמה
  ADMIN: ['מנהל']
};
const APP_URL = location.origin + location.pathname;
const S = { session: null, user: null, cache: {} };

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  return `יום ${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}
function dateBox(iso) {
  const d = parseIso(iso);
  if (!d) return '<div class="date-box none"><b>?</b><span>ללא</span></div>';
  return `<div class="date-box"><b>${d.getDate()}/${d.getMonth() + 1}</b><span>${DAYS[d.getDay()]}</span></div>`;
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysFromToday(iso) {
  const d = parseIso(iso);
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function statusBadge(status) {
  if (!status) return '<span class="badge warn">ממתין להצעה</span>';
  const s = status.trim();
  const cls = s === 'נפל' ? 'bad' : (s === 'קרה' || s.includes('סגור')) ? 'ok' : '';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}
function eventHref(e) {
  return `#/event/${e.row}?k=${encodeURIComponent(e.key)}`;
}
function waLink(phone, text) {
  const p = String(phone || '').replace(/\D/g, '').replace(/^0/, '972');
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}
function wazeLink(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

// ---------- טעינה והודעות ----------
let busyCount = 0;
function busy(on, text) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  $('#busy').hidden = busyCount === 0;
  if (text) $('#busy-text').textContent = text;
  else if (on) $('#busy-text').textContent = 'רק רגע, מכין את הקסטות…';
}
let toastTimer;
function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, type === 'bad' ? 6000 : 3000);
}

// ---------- API ----------
async function api(action, payload, extra) {
  const body = Object.assign({ action, session: S.session, payload: payload || {} }, extra || {});
  let res;
  try {
    res = await fetch(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('אין חיבור לשרת. בדוק אינטרנט ונסה שוב.');
  }
  const text = await res.text();
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error('תשובה לא תקינה מהשרת'); }
  if (!j.ok) {
    if (j.code === 'AUTH') { sessionExpired(); }
    const err = new Error(j.error || 'שגיאה לא ידועה');
    err.code = j.code;
    throw err;
  }
  return j.data;
}

// מטמון קצר לנתונים שלא משתנים הרבה (אפשרויות dropdown, משתמשים)
async function cached(key, fn, ttlMs = 10 * 60 * 1000) {
  const c = S.cache[key];
  if (c && Date.now() - c.t < ttlMs) return c.v;
  const v = await fn();
  S.cache[key] = { v, t: Date.now() };
  return v;
}

// ---------- התחברות ----------
function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

function showLogin(errMsg) {
  $('#app').hidden = true;
  $('#login').hidden = false;
  const err = $('#login-error');
  err.hidden = !errMsg;
  err.textContent = errMsg || '';
  if (CFG.DEV_USERS) return showDevLogin();
  initGoogle();
}

// מצב פיתוח מקומי בלבד (devserver): בחירת משתמש דמו במקום Google
function showDevLogin() {
  $('#gsi-btn').innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;width:100%">' +
    '<p class="small muted" style="margin:0">מצב פיתוח — היכנס בתור:</p>' +
    CFG.DEV_USERS.map(u => `<button class="btn ${u.role === 'מנהל' ? '' : 'secondary'}" data-dev="${esc(u.email)}">${esc(u.name)} · ${esc(u.role)}</button>`).join('') +
    '</div>';
  $$('[data-dev]').forEach(b => b.addEventListener('click', () => onCredential({ credential: 'cid:' + b.dataset.dev })));
}

let gsiReady = false;
function initGoogle() {
  if (!window.google || !google.accounts) { setTimeout(initGoogle, 200); return; }
  if (!gsiReady) {
    google.accounts.id.initialize({
      client_id: CFG.CLIENT_ID,
      callback: onCredential,
      auto_select: true,
      use_fedcm_for_prompt: true
    });
    gsiReady = true;
  }
  google.accounts.id.renderButton($('#gsi-btn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'he' });
  google.accounts.id.prompt();
}

async function onCredential(resp) {
  busy(true, 'מתחבר…');
  try {
    const data = await api('login', null, { idToken: resp.credential });
    S.session = data.session;
    S.user = data.user;
    store('mk_session', S.session);
    store('mk_user', S.user);
    startApp();
  } catch (e) {
    showLogin(e.message);
  } finally {
    busy(false);
  }
}

function sessionExpired() {
  S.session = null;
  store('mk_session', null);
  showLogin('פג תוקף ההתחברות — התחבר שוב');
}

async function logout() {
  try { await api('logout'); } catch (e) {}
  S.session = null; S.user = null; S.cache = {};
  store('mk_session', null); store('mk_user', null);
  if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
  showLogin();
}

// ---------- ניווט ----------
// pages.js ממלא את PAGES
const PAGES = {};
const NAV = [
  { path: 'home', title: 'בית', ico: '🏠', roles: ROLES.ALL },
  { path: 'events', title: 'אירועים', ico: '🎤', roles: ROLES.OPS },
  { path: 'calendar', title: 'יומן', ico: '📅', roles: ROLES.ALL },
  { path: 'quote', title: 'הצעות', ico: '📄', roles: ROLES.OFFICE },
  { path: 'protocol', title: 'הקמה', ico: '🔧', roles: ROLES.SETUP },
  { path: 'settings', title: 'הגדרות', ico: '⚙️', roles: ROLES.ALL }
];

function can(roles) { return S.user && roles.indexOf(S.user.role) >= 0; }

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [pathPart, query] = h.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  return { page: parts[0] || 'home', arg: parts[1] ? decodeURIComponent(parts[1]) : '', q: new URLSearchParams(query || '') };
}

let renderSeq = 0;
async function route() {
  if (!S.user) return;
  const r = parseHash();
  const page = PAGES[r.page];
  const view = $('#view');

  if (!page || !can(page.roles)) { location.hash = '#/home'; return; }

  const nav = NAV.find(n => n.path === r.page);
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.path === (page.navAs || r.page)));
  $('#back-btn').hidden = !!nav;
  setTitle(page.title || (nav && nav.title) || 'מלך הקסטות');

  const seq = ++renderSeq;
  view.innerHTML = '<div class="spinner dark"></div>';
  window.scrollTo(0, 0);
  try {
    await page.render(view, r, () => seq === renderSeq);
  } catch (e) {
    if (seq !== renderSeq) return;
    if (e.code === 'AUTH') return;
    view.innerHTML = `<div class="card"><p class="empty">⚠️ ${esc(e.message)}</p><button class="btn block secondary" onclick="route()">נסה שוב</button></div>`;
  }
}

function setTitle(t) { $('#page-title').textContent = t; document.title = t + ' · מלך הקסטות'; }

function buildNav() {
  $('#nav').innerHTML = NAV.filter(n => can(n.roles))
    .map(n => `<a href="#/${n.path}" data-path="${n.path}"><span class="ico">${n.ico}</span>${esc(n.title)}</a>`).join('');
  $('#user-chip').textContent = `${S.user.name} · ${S.user.role}`;
  $('#env-banner').hidden = S.user.env === 'production';
  $('#env-banner').textContent = S.user.env === 'production' ? '' : '🧪 סביבת בדיקה — עותק של הנתונים, שום דבר לא משפיע על הגיליון האמיתי';
}

function startApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  buildNav();
  route();
}

window.addEventListener('hashchange', route);

// PWA — עובד רק ב-https או localhost
if ('serviceWorker' in navigator && !CFG.DEV_USERS) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
document.addEventListener('DOMContentLoaded', async () => {
  $('#back-btn').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#/home'));
  if (!CFG.CLIENT_ID || CFG.CLIENT_ID.startsWith('REPLACE_ME') || !CFG.API_URL || CFG.API_URL.startsWith('REPLACE_ME')) {
    showLogin('חסרים API_URL או CLIENT_ID בקובץ config.js');
    return;
  }
  S.session = load('mk_session');
  S.user = load('mk_user');
  if (!S.session) { showLogin(); return; }
  // מציגים מיד מהזיכרון, ומאמתים מול השרת ברקע
  if (S.user) startApp();
  try {
    const u = await api('me');
    const roleChanged = !S.user || S.user.role !== u.role;
    S.user = u; store('mk_user', u);
    if (roleChanged) startApp(); else buildNav();
  } catch (e) {
    if (e.code !== 'AUTH' && !S.user) showLogin(e.message);
  }
});
