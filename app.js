// ===== ליבת האפליקציה: כניסה, API, ניווט, כלי עזר =====

const CFG = window.APP_CONFIG;
const S = { session: null, user: null, cache: {} };
const APP_URL = location.origin + location.pathname;

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// הרשאות: "admin" פותח הכול
// 'x' = הרשאת x · 'view:x' = הרשאת x או "צפייה בכל דבר" · פונקציה = תנאי מותאם
// מתגי כתיבה מהשרת (עבודה במקביל לכלים הקיימים). בלי מידע — מניחים דלוק
function writeOn(area) { return !S.user || !S.user.writes || S.user.writes[area] !== false; }
const PARALLEL_NOTE = '🔒 בינתיים עושים את זה בגיליון — עבודה במקביל לכלים הקיימים';

function can(perm) {
  if (!S.user) return false;
  if (!perm) return true;
  if (typeof perm === 'function') return perm();
  if (perm.indexOf('view:') === 0) return can(perm.slice(5)) || can('view_all');
  return S.user.perms.indexOf('admin') >= 0 || S.user.perms.indexOf(perm) >= 0;
}
const canView = perm => can('view:' + perm);

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
  const web = `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  // תמיד וואטסאפ הרגיל (לא Business): באנדרואיד — intent לחבילה com.whatsapp; באייפון — whatsapp://
  const q = [p ? 'phone=' + p : '', text ? 'text=' + encodeURIComponent(text) : ''].filter(Boolean).join('&');
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return `intent://send?${q}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(web)};end`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `whatsapp://send?${q}`;
  return web;
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
// מהירות: מסך שכבר ראית מוצג מיד מהזיכרון, ובמקביל נטען מהשרת — אם השתנה משהו, המסך מתרענן בשקט.
// כל פעולת כתיבה מוחקת את הזיכרון, כך שאחרי שמירה תמיד רואים נתונים טריים.
const READ_ACTIONS = new Set(['me', 'home', 'my_events', 'calendar', 'event_get', 'events_list', 'event_options', 'quote_options',
  'notes_list', 'req_list', 'req_get', 'summary_get', 'protocol_get', 'protocol_list', 'checklist_get', 'checklists_list',
  'products_list', 'users_list']);
const SWR = {};            // מפתח → { v, t }
let rendering = false;     // רק קריאות שנעשות בזמן ציור מסך משתמשות בזיכרון
let viewDirty = false;     // המשתמש התחיל להקליד — לא מרעננים לו את המסך מתחת לידיים

async function api(action, payload, extra) {
  if (!READ_ACTIONS.has(action)) {
    for (const k in SWR) delete SWR[k];
    S.cache.events = null;   // רשימות בחירה (opts) נשארות — משתנות רק בהגדרות, ושם מנקים אותן
    return apiNet(action, payload, extra);
  }
  const key = action + ':' + JSON.stringify(payload || {});
  const hit = SWR[key];
  if (hit && rendering) {
    if (Date.now() - hit.t > 5000) {
      const seq = renderSeq;
      apiNet(action, payload, extra).then(v => {
        const changed = JSON.stringify(v) !== JSON.stringify(hit.v);
        SWR[key] = { v, t: Date.now() };
        if (changed && seq === renderSeq && !viewDirty && !$('#view').contains(document.activeElement)) route(true);
      }).catch(() => {});
    }
    return JSON.parse(JSON.stringify(hit.v));
  }
  const v = await apiNet(action, payload, extra);
  SWR[key] = { v, t: Date.now() };
  return JSON.parse(JSON.stringify(v));
}

async function apiNet(action, payload, extra) {
  const body = Object.assign({ action, session: S.session, payload: payload || {} }, extra || {});
  let res;
  try {
    res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error('אין חיבור לשרת. בדוק אינטרנט ונסה שוב.');
  }
  const text = await res.text();
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error('תשובה לא תקינה מהשרת'); }
  if (!j.ok) {
    if (j.code === 'AUTH') sessionExpired();
    const err = new Error(j.error || 'שגיאה לא ידועה');
    err.code = j.code;
    throw err;
  }
  return j.data;
}

async function cached(key, fn, ttlMs = 10 * 60 * 1000) {
  const c = S.cache[key];
  if (c && Date.now() - c.t < ttlMs) return c.v;
  const v = await fn();
  S.cache[key] = { v, t: Date.now() };
  return v;
}

function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

// ---------- כניסה: בחירת שם → קוד 4 ספרות ----------
let loginUsers = [];

async function showLogin(errMsg) {
  $('#app').hidden = true;
  $('#login').hidden = false;
  setLoginError(errMsg);
  const box = $('#login-body');
  box.innerHTML = '<div class="spinner dark"></div>';
  try {
    loginUsers = await api('users_public');
  } catch (e) {
    box.innerHTML = `<p class="login-error">${esc(e.message)}</p><button class="btn block secondary" onclick="showLogin()">נסה שוב</button>`;
    return;
  }
  const last = load('mk_last_user');
  if (last && loginUsers.some(u => u.id === last)) return showPinPad(loginUsers.find(u => u.id === last));
  showNamePicker();
}

function setLoginError(msg) {
  const err = $('#login-error');
  err.hidden = !msg;
  err.textContent = msg || '';
}

function showNamePicker() {
  const box = $('#login-body');
  if (!loginUsers.length) { box.innerHTML = '<p class="muted">אין עדיין משתמשים. פנה למנהל.</p>'; return; }
  box.innerHTML = `
    <p class="muted small" style="margin:18px 0 10px">מי אתה?</p>
    ${loginUsers.length > 8 ? '<input id="name-filter" type="search" placeholder="🔍 חפש שם" style="margin-bottom:10px">' : ''}
    <div class="name-list">${loginUsers.map(u => `<button class="name-btn" data-uid="${esc(u.id)}"${CFG.DEV_PINS && CFG.DEV_PINS[u.name] ? ` data-pin="${esc(CFG.DEV_PINS[u.name])}"` : ''}>${esc(u.name)}</button>`).join('')}</div>`;
  $$('[data-uid]', box).forEach(b => b.addEventListener('click', () => {
    setLoginError('');
    showPinPad(loginUsers.find(u => u.id === b.dataset.uid));
  }));
  const f = $('#name-filter', box);
  if (f) f.addEventListener('input', () => {
    const q = f.value.trim();
    $$('[data-uid]', box).forEach(b => { b.hidden = q && !b.textContent.includes(q); });
  });
}

function showPinPad(u) {
  const box = $('#login-body');
  let pin = '';
  box.innerHTML = `
    <p style="margin:18px 0 4px;font-weight:700;font-size:18px">${esc(u.name)}</p>
    <button class="link-btn" id="not-me">לא אני</button>
    <div class="pin-dots">${'<span></span>'.repeat(4)}</div>
    <div class="pin-pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-d="${n}">${n}</button>`).join('')}
      <span></span><button data-d="0">0</button><button data-del aria-label="מחק">⌫</button>
    </div>
    ${CFG.DEV_PINS && CFG.DEV_PINS[u.name] ? `<p class="small muted">מצב פיתוח — הקוד: ${CFG.DEV_PINS[u.name]}</p>` : ''}`;
  const dots = () => $$('.pin-dots span', box).forEach((s, i) => s.classList.toggle('on', i < pin.length));
  const submit = async () => {
    busy(true, 'נכנס…');
    try {
      const data = await api('login', null, { userId: u.id, pin });
      S.session = data.session; S.user = data.user;
      store('mk_session', S.session); store('mk_user', S.user); store('mk_last_user', u.id);
      startApp();
    } catch (e) {
      setLoginError(e.message);
      pin = ''; dots();
      $('.pin-dots', box).classList.add('shake');
      setTimeout(() => $('.pin-dots', box) && $('.pin-dots', box).classList.remove('shake'), 400);
    } finally { busy(false); }
  };
  const press = d => {
    if (pin.length >= 4) return;
    pin += d; dots();
    if (pin.length === 4) submit();
  };
  $$('[data-d]', box).forEach(b => b.addEventListener('click', () => press(b.dataset.d)));
  $('[data-del]', box).addEventListener('click', () => { pin = pin.slice(0, -1); dots(); });
  $('#not-me', box).addEventListener('click', () => { store('mk_last_user', null); setLoginError(''); showNamePicker(); });
  // מקלדת פיזית
  document.onkeydown = e => {
    if ($('#login').hidden) return;
    if (/^\d$/.test(e.key)) press(e.key);
    if (e.key === 'Backspace') { pin = pin.slice(0, -1); dots(); }
  };
}

function sessionExpired() {
  S.session = null;
  store('mk_session', null);
  showLogin('פג תוקף הכניסה — הזן קוד שוב');
}

function logout() {
  S.session = null; S.user = null; S.cache = {};
  store('mk_session', null); store('mk_user', null); store('mk_last_user', null);
  showLogin();
}

// ---------- ניווט ----------
const PAGES = {};
const NAV = [
  { path: 'home', title: 'בית', ico: '🏠', perm: null },
  { path: 'events', title: 'אירועים', ico: '🎤', perm: null },   // רשימה + לוח חודשי באותו עמוד
  { path: 'quote', title: 'הצעות', ico: '📄', perm: 'quotes' },
  { path: 'protocol', title: 'הקמה', ico: '🔧', perm: 'view:protocol' },
  { path: 'requests', title: 'בקשות', ico: '📨', perm: () => can('requests') || !!S.user.hasRequests },
  { path: 'settings', title: 'הגדרות', ico: '⚙️', perm: null }
];

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [pathPart, query] = h.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  return { page: parts[0] || 'home', arg: parts[1] ? decodeURIComponent(parts[1]) : '', q: new URLSearchParams(query || '') };
}

let renderSeq = 0;
// silent: ריענון שקט אחרי שהגיעו נתונים חדשים — בלי ספינר ובלי לקפוץ לראש הדף
async function route(silent) {
  if (!S.user) return;
  silent = silent === true;
  const r = parseHash();
  const page = PAGES[r.page];
  const view = $('#view');

  if (!page || !can(page.perm)) { location.hash = '#/home'; return; }

  const nav = NAV.find(n => n.path === r.page);
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.path === (page.navAs || r.page)));
  $('#back-btn').hidden = !!nav || !!page.tab;
  setTitle(page.title || (nav && nav.title) || 'מלך הקסטות');

  const seq = ++renderSeq;
  const scrollY = window.scrollY;
  if (!silent) { view.innerHTML = '<div class="spinner dark"></div>'; window.scrollTo(0, 0); }
  viewDirty = false;
  rendering = true;
  try {
    const p = page.render(view, r, () => seq === renderSeq);
    rendering = false;   // רק הקריאות שהדף שולח מיד (לפני await) נחשבות לציור המסך
    await p;
    if (silent) window.scrollTo(0, scrollY);
  } catch (e) {
    if (seq !== renderSeq || e.code === 'AUTH') return;
    view.innerHTML = `<div class="card"><p class="empty">⚠️ ${esc(e.message)}</p><button class="btn block secondary" onclick="route()">נסה שוב</button></div>`;
  }
}

function setTitle(t) { $('#page-title').textContent = t; document.title = t + ' · מלך הקסטות'; }

function buildNav() {
  $('#nav').innerHTML = NAV.filter(n => can(n.perm))
    .map(n => `<a href="#/${n.path}" data-path="${n.path}"><span class="ico">${n.ico}</span>${esc(n.title)}</a>`).join('');
  $('#user-chip').textContent = S.user.name;
  $('#env-banner').hidden = S.user.env === 'production';
  $('#env-banner').textContent = S.user.env === 'production' ? '' : '🧪 סביבת בדיקה — עותק של הנתונים, שום דבר לא משפיע על הגיליון האמיתי';
}

function startApp() {
  document.onkeydown = null;
  $('#login').hidden = true;
  $('#app').hidden = false;
  buildNav();
  route();
}

window.addEventListener('hashchange', () => route());
// קישורי אפליקציה (וואטסאפ הרגיל) — פותחים במקום, לא בלשונית חדשה שנשארת ריקה
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('a[href^="intent:"], a[href^="whatsapp:"]');
  if (!a) return;
  ev.preventDefault();
  a.dispatchEvent(new CustomEvent('wa-open', { bubbles: true }));
  location.href = a.getAttribute('href');
}, true);
['input', 'change'].forEach(t => document.addEventListener(t, ev => { if (ev.target.closest && ev.target.closest('#view')) viewDirty = true; }, true));

if ('serviceWorker' in navigator && !CFG.DEV_PINS) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#back-btn').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#/home'));
  if (!CFG.API_URL || CFG.API_URL.startsWith('REPLACE_ME')) {
    $('#login').hidden = false;
    setLoginError('חסר API_URL בקובץ config.js');
    return;
  }
  S.session = load('mk_session');
  S.user = load('mk_user');
  if (!S.session || !S.user || !S.user.perms) { showLogin(); return; }
  startApp(); // מציגים מיד, ומרעננים הרשאות מהשרת ברקע
  try {
    const u = await api('me');
    const changed = JSON.stringify(u.perms) !== JSON.stringify(S.user.perms);
    S.user = u; store('mk_user', u);
    if (changed) startApp(); else buildNav();
  } catch (e) { /* AUTH כבר מטופל */ }
});
