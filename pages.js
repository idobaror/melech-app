// ===== הדפים =====

function eventItem(e, sub, extraBadge, href) {
  return `<a class="item" href="${href || eventHref(e)}">
    ${dateBox(e.date)}
    <div class="grow">
      <div class="title">${esc(e.name)}</div>
      <div class="sub">${sub != null ? sub : esc([e.startTime, e.eventType].filter(Boolean).join(' · '))}</div>
    </div>
    ${extraBadge || ''}
    <span class="chev">‹</span>
  </a>`;
}

function listCard(title, items, emptyText, headExtra) {
  return `<section class="card">
    <div class="card-head"><h2>${title}</h2>${headExtra || ''}</div>
    ${items.length ? `<div class="list">${items.join('')}</div>` : `<p class="empty">${emptyText}</p>`}
  </section>`;
}

function optionsHtml(list, current, placeholder = '— בחר —') {
  const opts = (list || []).slice();
  if (current && opts.indexOf(current) < 0) opts.unshift(current);
  return `<option value="">${placeholder}</option>` +
    opts.map(o => `<option value="${esc(o)}" ${o === current ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

const eventOptions = () => cached('opts', () => api('event_options'));

// הודעת וואטסאפ לאיש צוות ששובץ
function crewMessage(e, c) {
  const first = (c.name || '').split(' ')[0];
  return [
    `היי ${first} 👋`,
    `שובצת לאירוע *${e.displayName || e.name}*`,
    `📅 ${fmtDate(e.date)}${e.startTime ? ' · ' + e.startTime : ''}`,
    e.location ? `📍 ${e.location}` : null,
    c.role ? `🎤 תפקיד: ${c.role}` : null,
    c.note ? `📝 ${c.note}` : null,
    '',
    `כל הפרטים באפליקציה: ${APP_URL}${eventHref(e)}`
  ].filter(x => x !== null).join('\n');
}

function feedbackHtml(list, isAdmin) {
  if (!list.length) return '<p class="empty">אין משוב עדיין</p>';
  return list.map(f => `
    <div class="fb ${f.status === 'פתוח' ? 'open' : ''}">
      <div class="fb-head"><b>${esc(f.name)}</b> <span class="muted small">${esc(f.role)} · ${esc(f.created)}</span>
        ${f.status === 'פתוח' ? (isAdmin ? `<button class="btn sm secondary" data-resolve="${esc(f.id)}">✓ טופל</button>` : '<span class="badge warn">ממתין</span>') : '<span class="badge ok">טופל</span>'}
      </div>
      ${f.eventName && isAdmin ? `<div class="small muted">${esc(f.eventName)} · ${esc(fmtDate(f.eventDate))}</div>` : ''}
      <div class="fb-text">${esc(f.text)}</div>
    </div>`).join('');
}

function bindResolve(el, onDone) {
  $$('[data-resolve]', el).forEach(b => b.addEventListener('click', async ev => {
    ev.preventDefault(); ev.stopPropagation();
    b.disabled = true;
    busy(true, 'מעדכן…');
    try { await api('feedback_resolve', { id: b.dataset.resolve }); toast('סומן כטופל ✅', 'ok'); await onDone(); }
    catch (err) { toast(err.message, 'bad'); b.disabled = false; }
    finally { busy(false); }
  }));
}

// =====================================================
// בית
// =====================================================
PAGES.home = {
  roles: ROLES.ALL, title: 'בית',
  async render(el, r, alive) {
    const d = await api('home');
    if (!alive()) return;
    const isOffice = can(ROLES.OFFICE), isAdmin = can(ROLES.ADMIN);
    let h = `<p class="muted" style="margin:0 0 12px">שלום ${esc(S.user.name)} 👋</p>`;

    const mine = (d.myEvents || []).map(e => eventItem(e, esc([e.startTime, e.location].filter(Boolean).join(' · ')), e.myRole ? `<span class="badge brand">${esc(e.myRole)}</span>` : ''));

    if (!d.counts) { // איש צוות
      el.innerHTML = h + listCard('🎤 האירועים שלי', mine, 'אין לך אירועים קרובים') +
        `<a class="btn ghost block" href="#/calendar">📅 ליומן שלי</a>`;
      return;
    }

    const c = d.counts;
    h += `<div class="kpis">
      <a class="kpi" href="#/events?f=upcoming"><b>${c.upcoming}</b><span>אירועים קרובים</span></a>
      <a class="kpi ${c.noCrew ? 'alert' : ''}" href="#/events?f=nocrew"><b>${c.noCrew}</b><span>בלי צוות</span></a>
      ${isOffice ? `<a class="kpi ${c.waitingForQuote ? 'alert' : ''}" href="#/events?f=waiting"><b>${c.waitingForQuote}</b><span>ממתינים להצעה</span></a>
      <a class="kpi ${c.unpaid ? 'alert' : ''}" href="#/events?f=unpaid"><b>${c.unpaid}</b><span>לגבייה</span></a>` : ''}
      ${isAdmin ? `<button class="kpi ${c.openFeedback ? 'alert' : ''}" type="button" onclick="var t=document.getElementById('feedback-card');t&&t.scrollIntoView({behavior:'smooth'})"><b>${c.openFeedback}</b><span>משובים פתוחים</span></button>` : ''}
    </div>`;

    if (isOffice) h += `<a class="btn block" href="#/new" style="margin-bottom:14px">+ פנייה חדשה</a>`;

    if (isAdmin && d.openFeedback.length) {
      h += `<section class="card" id="feedback-card"><h2>💬 משובים מהשטח</h2>${feedbackHtml(d.openFeedback, true)}</section>`;
    }

    if (mine.length) h += listCard('🎤 האירועים שלי', mine, '');

    if (isOffice) {
      h += listCard('⏳ ממתינים להצעת מחיר', d.waitingForQuote.map(e =>
        eventItem(e, null, '<span class="badge brand">📄 להצעה</span>', `#/quote?row=${e.row}&k=${encodeURIComponent(e.key)}`)),
        'אין פניות שממתינות להצעה 🎉');
    }

    h += listCard('📅 אירועים קרובים', d.upcoming.map(e =>
      eventItem(e, null, e.hasCrew ? '' : '<span class="badge warn">ללא צוות</span>')),
      'אין אירועים קרובים', '<a class="small" href="#/events?f=upcoming">הכול</a>');

    if (isOffice) {
      if (d.unpaid.length) {
        h += listCard('💰 לגבייה — קרו ולא שולמו', d.unpaid.map(e =>
          eventItem(e, esc(e.officeStatus || 'לא עודכן'), '<span class="badge bad">לגבות</span>')), '');
      }
      if (d.newRequests.length) {
        h += listCard('🆕 פניות מהשבוע האחרון', d.newRequests.map(e => eventItem(e, null, statusBadge(e.status))), '');
      }
      if (d.followUps.length) {
        h += `<section class="card"><h2>📝 פולואפ</h2>${d.followUps.map(e => `
          <a class="item" href="${eventHref(e)}" style="align-items:flex-start">
            ${dateBox(e.date)}
            <div class="grow"><div class="title">${esc(e.name)} ${statusBadge(e.status)}</div>
            <div class="note-box" style="margin-top:6px;max-height:90px">${esc(e.followUp)}</div></div>
          </a>`).join('')}</section>`;
      }
    }

    if (isAdmin) h += `<a class="btn ghost block" href="#/summary">📊 סיכום שבועי</a>`;

    el.innerHTML = h;
    bindResolve(el, route);
  }
};

// =====================================================
// רשימת אירועים
// =====================================================
PAGES.events = {
  roles: ROLES.OPS, title: 'אירועים',
  async render(el, r, alive) {
    const events = await api('events_list');
    if (!alive()) return;
    S.cache.events = { v: events, t: Date.now() };

    const filters = [['upcoming', 'קרובים'], ['nocrew', 'בלי צוות']];
    if (can(ROLES.OFFICE)) filters.push(['waiting', 'ממתינים להצעה'], ['unpaid', 'לגבייה']);
    filters.push(['past', 'עבר'], ['all', 'הכול']);
    let f = r.q.get('f') || 'upcoming';
    if (!filters.some(x => x[0] === f)) f = 'upcoming';
    let q = '';

    el.innerHTML = `
      ${can(ROLES.OFFICE) ? '<a class="btn block" href="#/new" style="margin-bottom:12px">+ פנייה חדשה</a>' : ''}
      <input id="ev-search" type="search" placeholder="🔍 חיפוש לפי שם, מיקום או סוג" style="margin-bottom:10px">
      <div class="chips">${filters.map(([k, t]) => `<button class="chip" data-f="${k}">${t}</button>`).join('')}</div>
      <section class="card"><div id="ev-list" class="list"></div></section>`;

    const today = todayIso();
    const draw = () => {
      $$('.chip', el).forEach(c => c.classList.toggle('on', c.dataset.f === f));
      const list = events.filter(e => {
        if (q && !(`${e.name} ${e.location} ${e.eventType} ${e.status}`.toLowerCase().includes(q))) return false;
        const active = e.status && e.status !== 'נפל';
        switch (f) {
          case 'upcoming': return active && e.date && e.date >= today;
          case 'nocrew': return active && e.date && e.date >= today && !e.crew;
          case 'waiting': return !e.status;
          case 'unpaid': return e.status === 'קרה' && e.date && e.date <= today;
          case 'past': return e.date && e.date < today;
          default: return true;
        }
      });
      list.sort((a, b) => f === 'past' ? (b.date || '').localeCompare(a.date || '') : (a.date || '9999').localeCompare(b.date || '9999'));
      $('#ev-list', el).innerHTML = list.length
        ? list.slice(0, 200).map(e => eventItem(e, esc([e.eventType, e.location].filter(Boolean).join(' · ')),
            statusBadge(e.status) + (e.crew ? ` <span class="badge">👥 ${e.crew}</span>` : ''))).join('')
        : '<p class="empty">לא נמצאו אירועים</p>';
    };
    $$('.chip', el).forEach(c => c.addEventListener('click', () => { f = c.dataset.f; history.replaceState(null, '', `#/events?f=${f}`); draw(); }));
    $('#ev-search', el).addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }
};

// =====================================================
// פנייה חדשה
// =====================================================
PAGES.new = {
  roles: ROLES.OFFICE, title: 'פנייה חדשה', navAs: 'events',
  async render(el, r, alive) {
    const opts = await eventOptions();
    if (!alive()) return;
    el.innerHTML = `
      <section class="card">
        <form id="new-ev">
          <label style="margin-top:0">שם האירוע / הלקוח *</label><input name="name" required placeholder="למשל: חתונה כהן">
          <div class="grid2">
            <div><label>טלפון</label><input name="phone" type="tel" inputmode="tel"></div>
            <div><label>תאריך</label><input name="date" type="date"></div>
            <div><label>שעת עלייה</label><input name="startTime" placeholder="21:00"></div>
            <div><label>מוצר</label><select name="eventType">${optionsHtml(opts.eventTypeOptions, '')}</select></div>
            <div><label>הגברה</label><select name="amplification">${optionsHtml(opts.amplificationOptions, '')}</select></div>
            <div><label>מיקום</label><input name="location"></div>
          </div>
          <label>הערות</label><input name="notes">
          <label>הערת פולואפ ראשונה</label><textarea name="followUp" rows="2" placeholder="מאיפה הגיע, מה ביקש…"></textarea>
          <button class="btn block" style="margin-top:16px" type="submit">שמור פנייה</button>
        </form>
      </section>`;
    $('#new-ev', el).addEventListener('submit', async ev => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(ev.target).entries());
      busy(true, 'שומר פנייה…');
      try {
        const res = await api('event_create', data);
        S.cache.events = null;
        toast('הפנייה נשמרה ✅', 'ok');
        location.hash = eventHref(res);
      } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    });
  }
};

// =====================================================
// פרטי אירוע
// =====================================================
PAGES.event = {
  roles: ROLES.ALL, title: 'פרטי אירוע', navAs: 'events',
  async render(el, r, alive) {
    const row = r.arg, key = r.q.get('k') || '';
    if (!can(ROLES.OPS)) {
      const d = await api('event_get', { row, key });
      if (!alive()) return;
      return renderCrewEvent(el, d);
    }
    const [d, opts] = await Promise.all([api('event_get', { row, key }), eventOptions()]);
    if (!alive()) return;
    renderOpsEvent(el, d, opts);
  }
};

function feedbackSection(e, list) {
  return `<section class="card">
    <h2>💬 משוב על האירוע</h2>
    <p class="small muted" style="margin-top:0">${can(ROLES.ADMIN) ? 'כל המשובים מהשטח' : 'המשוב מגיע למנהל'}</p>
    <div id="fb-list">${feedbackHtml(list, can(ROLES.ADMIN))}</div>
    <textarea id="fb-text" rows="2" placeholder="איך היה? משהו חסר, תקלה, הערה לפעם הבאה…"></textarea>
    <button class="btn secondary block" id="fb-add" style="margin-top:10px">שלח משוב</button>
  </section>`;
}

function bindFeedback(el, e) {
  const rebind = () => bindResolve(el, async () => {
    const d = await api('event_get', { row: e.row, key: e.key });
    $('#fb-list', el).innerHTML = feedbackHtml(d.feedback, can(ROLES.ADMIN)); rebind();
  });
  rebind();
  $('#fb-add', el).addEventListener('click', async () => {
    const text = $('#fb-text', el).value.trim();
    if (!text) return;
    busy(true, 'שולח משוב…');
    try {
      const list = await api('feedback_add', { row: e.row, key: e.key, text });
      $('#fb-list', el).innerHTML = feedbackHtml(list, can(ROLES.ADMIN));
      $('#fb-text', el).value = '';
      rebind();
      toast('המשוב נשלח ✅', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });
}

function renderCrewEvent(el, d) {
  const e = d.event;
  setTitle(e.name);
  el.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>${esc(e.name)}</h2><span class="badge brand">${esc(d.myRole || '')}</span></div>
      <dl class="kv">
        <dt>תאריך</dt><dd>${esc(fmtDate(e.date) || e.dateText)}</dd>
        <dt>שעת עלייה</dt><dd>${esc(e.startTime || '—')}</dd>
        <dt>מוצר</dt><dd>${esc(e.eventType || '—')}</dd>
        <dt>מיקום</dt><dd>${esc(e.location || '—')}</dd>
        <dt>הגברה</dt><dd>${esc(e.amplification || '—')}</dd>
        ${e.phone ? `<dt>איש קשר</dt><dd><a href="tel:${esc(e.phone)}">${esc(e.phone)}</a></dd>` : ''}
        ${e.additionalShows ? `<dt>מופעים נוספים</dt><dd>${esc(e.additionalShows)}</dd>` : ''}
      </dl>
      ${e.notes ? `<label>הערות לאירוע</label><div class="note-box">${esc(e.notes)}</div>` : ''}
      ${d.myNote ? `<label>הערה אליך</label><div class="note-box">${esc(d.myNote)}</div>` : ''}
      <div class="btn-row">
        ${e.location ? `<a class="btn secondary" href="${wazeLink(e.location)}" target="_blank">🚗 ניווט</a>` : ''}
        ${e.phone ? `<a class="btn wa" href="${waLink(e.phone)}" target="_blank">וואטסאפ</a>` : ''}
      </div>
    </section>
    <section class="card"><h2>👥 הצוות באירוע</h2>
      ${d.crew.map(c => `<div class="crew-row"><div class="grow">${esc(c.name)}</div><span class="badge">${esc(c.role)}</span></div>`).join('')}
    </section>
    ${feedbackSection(e, d.feedback)}`;
  bindFeedback(el, e);
}

function renderOpsEvent(el, d, opts) {
  const e = d.event;
  const isOffice = can(ROLES.OFFICE);
  const editable = f => d.canEdit.indexOf(f) >= 0;
  setTitle(e.displayName || e.name);
  let crew = d.crew.map(c => ({ email: c.email, name: c.name, role: c.role, note: c.note }));
  const phoneOf = email => (d.users.find(u => u.email === email) || {}).phone || '';

  const field = (name, label, html) => `<div><label>${label}</label>${html}</div>`;
  const input = (name, val, type = 'text') => `<input name="${name}" type="${type}" value="${esc(val || '')}" ${editable(name) ? '' : 'disabled'}>`;
  const select = (name, list, val, ph) => `<select name="${name}" ${editable(name) ? '' : 'disabled'}>${optionsHtml(list, val, ph)}</select>`;

  el.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>${esc(e.displayName || e.name)}</h2>${statusBadge(e.status)}</div>
      <p class="muted small" style="margin:0">${esc(fmtDate(e.date) || 'אין תאריך')} ${e.startTime ? '· ' + esc(e.startTime) : ''} ${e.location ? '· 📍 ' + esc(e.location) : ''}</p>
      <div class="btn-row">
        ${e.phone ? `<a class="btn wa sm" href="${waLink(e.phone)}" target="_blank">וואטסאפ</a><a class="btn ghost sm" href="tel:${esc(e.phone)}">📞 חייג</a>` : ''}
        ${e.location ? `<a class="btn ghost sm" href="${wazeLink(e.location)}" target="_blank">🚗 ניווט</a>` : ''}
        ${isOffice ? `<a class="btn secondary sm" href="#/quote?row=${e.row}&k=${encodeURIComponent(e.key)}">📄 הצעת מחיר</a>` : ''}
        ${can(ROLES.SETUP) ? `<a class="btn ghost sm" href="#/protocol?row=${e.row}&k=${encodeURIComponent(e.key)}">🔧 הקמה</a>` : ''}
      </div>
    </section>

    <section class="card">
      <h2>👥 צוות משובץ</h2>
      <div id="crew-list"></div>
      <div class="grid2">
        <div><label>הוסף איש צוות</label><select id="crew-user"><option value="">— בחר —</option>${d.users.map(u => `<option value="${esc(u.email)}">${esc(u.name)}</option>`).join('')}</select></div>
        <div><label>תפקיד באירוע</label><input id="crew-role" list="role-sugg" placeholder="זמר, נגן, הגברה, צלם…"><datalist id="role-sugg">${opts.roleSuggestions.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      </div>
      <label>הערה לאיש הצוות</label><input id="crew-note" placeholder="אופציונלי — תוצג לו ותישלח בוואטסאפ">
      <div class="btn-row">
        <button class="btn secondary" id="crew-add">+ הוסף</button>
        <button class="btn" id="crew-save">שמור שיבוץ</button>
      </div>
    </section>

    <section class="card">
      <h2>✏️ פרטי האירוע</h2>
      <form id="ev-form">
        <label>שם אירוע</label>${input('name', e.name)}
        <div class="grid2">
          ${field('status', 'סטטוס', select('status', opts.statusOptions, e.status, '— ממתין להצעה —'))}
          ${field('phone', 'טלפון', input('phone', e.phone, 'tel'))}
          ${field('date', 'תאריך', input('date', e.date, 'date'))}
          ${field('startTime', 'שעת עלייה', input('startTime', e.startTime))}
          ${field('eventType', 'מוצר', select('eventType', opts.eventTypeOptions, e.eventType))}
          ${field('amplification', 'הגברה', select('amplification', opts.amplificationOptions, e.amplification))}
        </div>
        <label>מיקום</label>${input('location', e.location)}
        <label>הערות</label>${input('notes', e.notes)}
        ${'officeStatus' in e ? `<label>סטטוס גבייה</label>${input('officeStatus', e.officeStatus)}<p class="small muted" style="margin:4px 0 0">כשהתשלום התקבל — לכתוב <b>הושלם</b></p>` : ''}
        ${e.price ? `<p class="muted small">מחיר אחרון בהצעה: <b>${esc(e.price)}</b></p>` : ''}
        <button class="btn block" style="margin-top:16px" type="submit">שמור שינויים</button>
      </form>
    </section>

    ${d.sameDay.length ? `<section class="card"><h2>🗓️ עוד באותו יום (${d.sameDay.length})</h2>
      ${d.sameDay.map((o, i) => `<div class="item">
        <div class="grow"><a class="title" href="${eventHref(o)}">${esc(o.name)}</a>
        <div class="sub">${esc([o.startTime, o.location].filter(Boolean).join(' · '))}</div>
        ${o.location && e.location ? `<button class="btn sm ghost" data-travel="${i}" style="margin-top:6px">🚗 זמן נסיעה</button>` : ''}</div>
        ${statusBadge(o.status)}</div>`).join('')}
    </section>` : ''}

    ${d.quotes ? `<section class="card"><h2>📄 הצעות שהופקו</h2>${d.quotes.length ? d.quotes.map(q => `
      <div class="crew-row"><div class="grow"><a href="${esc(q.pdfUrl)}" target="_blank">${esc(q.created)}</a>
        <div class="small muted">${esc(q.by)}${q.attached ? ' · צורפו: ' + esc(q.attached) : ''}</div></div>
        ${q.sentWhatsapp ? '<span class="badge ok">וואטסאפ</span>' : ''}${q.sentEmail ? ' <span class="badge ok">מייל</span>' : ''}
      </div>`).join('') : '<p class="empty">עוד לא הופקה הצעה</p>'}</section>` : ''}

    ${'followUp' in e ? `<section class="card">
      <h2>📝 פולואפ מכירות</h2>
      <div id="fu-box">${e.followUp ? `<div class="note-box">${esc(e.followUp)}</div>` : '<p class="empty">אין הערות עדיין</p>'}</div>
      <label>הערה חדשה</label><textarea id="fu-text" rows="2"></textarea>
      <button class="btn secondary block" id="fu-add" style="margin-top:10px">הוסף הערה</button>
    </section>` : ''}

    ${feedbackSection(e, d.feedback)}`;

  // ----- צוות -----
  const drawCrew = (justSaved) => {
    $('#crew-list', el).innerHTML = crew.length ? crew.map((c, i) => {
      const phone = phoneOf(c.email);
      return `<div class="crew-row"><div class="grow"><b>${esc(c.name || c.email)}</b>
        <div class="sub small muted">${esc(c.role)}${c.note ? ' · ' + esc(c.note) : ''}</div></div>
        ${justSaved && phone ? `<a class="btn sm wa" target="_blank" href="${waLink(phone, crewMessage(e, c))}">📲 שלח</a>` : ''}
        <button class="btn sm danger" data-rm="${i}">הסר</button></div>`;
    }).join('') : '<p class="empty">עוד לא שובץ אף אחד</p>';
    $$('[data-rm]', el).forEach(b => b.addEventListener('click', () => { crew.splice(+b.dataset.rm, 1); drawCrew(false); }));
  };
  drawCrew(true);
  $('#crew-add', el).addEventListener('click', () => {
    const email = $('#crew-user', el).value;
    if (!email) return toast('בחר איש צוות', 'bad');
    if (crew.some(c => c.email === email)) return toast('כבר משובץ', 'bad');
    const u = d.users.find(x => x.email === email);
    crew.push({ email, name: u.name, role: $('#crew-role', el).value.trim(), note: $('#crew-note', el).value.trim() });
    $('#crew-user', el).value = ''; $('#crew-role', el).value = ''; $('#crew-note', el).value = '';
    drawCrew(false);
  });
  $('#crew-save', el).addEventListener('click', async () => {
    busy(true, 'שומר שיבוץ…');
    try {
      const saved = await api('assign_set', { row: e.row, key: e.key, crew });
      crew = saved.map(c => ({ email: c.email, name: c.name, role: c.role, note: c.note }));
      drawCrew(true);
      toast('השיבוץ נשמר — אפשר לשלוח לכל אחד בוואטסאפ 📲', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });

  // ----- עריכת פרטים -----
  $('#ev-form', el).addEventListener('submit', async ev => {
    ev.preventDefault();
    const fields = {};
    for (const [k, v] of new FormData(ev.target).entries()) {
      if (!editable(k)) continue;
      const orig = e[k] == null ? '' : String(e[k]);
      if (String(v).trim() !== orig) fields[k] = String(v).trim();
    }
    if (!Object.keys(fields).length) return toast('אין שינויים');
    busy(true, 'שומר…');
    try {
      const nd = await api('event_update', { row: e.row, key: e.key, fields });
      toast('נשמר ✅', 'ok');
      S.cache.events = null;
      history.replaceState(null, '', eventHref(nd.event));
      renderOpsEvent(el, nd, opts);
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });

  // ----- זמן נסיעה -----
  $$('[data-travel]', el).forEach(b => b.addEventListener('click', async () => {
    const o = d.sameDay[+b.dataset.travel];
    b.disabled = true; b.textContent = '⏳ מחשב…';
    try {
      const t = await api('travel_time', { origin: e.location, destination: o.location });
      b.textContent = t.error ? '❌ ' + t.error : `🚗 ${t.duration} (${t.distance})`;
    } catch (err) { b.textContent = '❌ שגיאה'; }
  }));

  // ----- פולואפ -----
  if ($('#fu-add', el)) $('#fu-add', el).addEventListener('click', async () => {
    const comment = $('#fu-text', el).value.trim();
    if (!comment) return;
    busy(true, 'מוסיף הערה…');
    try {
      const res = await api('event_comment', { row: e.row, key: e.key, comment });
      e.followUp = res.followUp;
      $('#fu-box', el).innerHTML = `<div class="note-box">${esc(res.followUp)}</div>`;
      $('#fu-text', el).value = '';
      const box = $('#fu-box .note-box', el); box.scrollTop = box.scrollHeight;
      toast('ההערה נוספה ✅', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });

  bindFeedback(el, e);
}

// =====================================================
// יומן חודשי
// =====================================================
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

PAGES.calendar = {
  roles: ROLES.ALL, title: 'יומן',
  async render(el, r, alive) {
    const month = /^\d{4}-\d{2}$/.test(r.q.get('m') || '') ? r.q.get('m') : todayIso().slice(0, 7);
    const d = await api('calendar', { month });
    if (!alive()) return;
    const [y, m] = d.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const shift = (n) => { const t = new Date(y, m - 1 + n, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
    const byDay = {};
    d.events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
    const iso = day => `${d.month}-${String(day).padStart(2, '0')}`;
    const today = todayIso();
    let selected = r.q.get('d') || (today.startsWith(d.month) ? today : (d.events[0] ? d.events[0].date : iso(1)));

    let cells = '';
    for (let i = 0; i < first.getDay(); i++) cells += '<div class="cal-cell empty"></div>';
    for (let day = 1; day <= days; day++) {
      const list = byDay[iso(day)] || [];
      const waiting = list.some(e => !e.status);
      cells += `<button class="cal-cell ${iso(day) === today ? 'today' : ''} ${list.length ? 'has' : ''}" data-day="${iso(day)}">
        <span class="num">${day}</span>
        ${list.length ? `<span class="cal-count ${list.length > 1 ? 'multi' : ''} ${waiting ? 'waiting' : ''}">${list.length}</span>` : ''}
      </button>`;
    }

    el.innerHTML = `
      <section class="card cal">
        <div class="cal-head">
          <a class="icon-btn dark" href="#/calendar?m=${shift(-1)}" aria-label="חודש קודם">→</a>
          <h2>${MONTHS[m - 1]} ${y}</h2>
          <a class="icon-btn dark" href="#/calendar?m=${shift(1)}" aria-label="חודש הבא">←</a>
        </div>
        <div class="cal-grid">${DAYS.map(x => `<div class="cal-dow">${x}</div>`).join('')}${cells}</div>
        <p class="small muted" style="margin:10px 0 0">${d.events.length} אירועים החודש${can(ROLES.OPS) ? '' : ' (שלך)'}</p>
      </section>
      <div id="cal-day"></div>`;

    const drawDay = () => {
      $$('.cal-cell[data-day]', el).forEach(c => c.classList.toggle('sel', c.dataset.day === selected));
      const list = byDay[selected] || [];
      $('#cal-day', el).innerHTML = listCard(`🗓️ ${fmtDate(selected)}`, list.map(e =>
        eventItem(e, esc([e.startTime, e.location].filter(Boolean).join(' · ')),
          e.myRole ? `<span class="badge brand">${esc(e.myRole)}</span>` : statusBadge(e.status))),
        'אין אירועים ביום הזה');
    };
    $$('.cal-cell[data-day]', el).forEach(c => c.addEventListener('click', () => {
      selected = c.dataset.day;
      history.replaceState(null, '', `#/calendar?m=${d.month}&d=${selected}`);
      drawDay();
    }));
    drawDay();
  }
};

// =====================================================
// הצעת מחיר
// =====================================================
PAGES.quote = {
  roles: ROLES.OFFICE, title: 'הצעת מחיר',
  async render(el, r, alive) {
    const [events, opts, qopts] = await Promise.all([
      cached('events', () => api('events_list'), 60 * 1000),
      eventOptions(),
      cached('qopts', () => api('quote_options'))
    ]);
    if (!alive()) return;

    const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999');
    const waiting = events.filter(e => !e.status).sort(byDate);
    const today = todayIso();
    const others = events.filter(e => e.status && e.status !== 'נפל' && (!e.date || e.date >= today)).sort(byDate);
    const preRow = r.q.get('row'), preKey = r.q.get('k');
    const optLabel = e => `${e.name}${e.date ? ' · ' + e.date.split('-').reverse().join('/') : ''}`;

    el.innerHTML = `
      <section class="card">
        <label style="margin-top:0">בחר אירוע</label>
        <select id="q-event">
          <option value="">— בחר אירוע —</option>
          ${waiting.length ? `<optgroup label="⚠️ ממתינים להצעה (${waiting.length})">${waiting.map(e => `<option value="${e.row}|${esc(e.key)}">🔴 ${esc(optLabel(e))}</option>`).join('')}</optgroup>` : ''}
          <optgroup label="אירועים פעילים (${others.length})">${others.map(e => `<option value="${e.row}|${esc(e.key)}">${esc(optLabel(e))}</option>`).join('')}</optgroup>
        </select>
      </section>
      <div id="q-form"></div>`;

    const sel = $('#q-event', el);
    const allOpts = Object.assign({}, opts, qopts);
    sel.addEventListener('change', () => loadQuoteEvent(el, sel.value, allOpts, alive));
    if (preRow) {
      const v = `${preRow}|${preKey}`;
      if (!$$('option', sel).some(o => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">האירוע שנבחר</option>`);
      sel.value = v;
      loadQuoteEvent(el, v, allOpts, alive);
    }
  }
};

async function loadQuoteEvent(el, value, opts, alive) {
  const box = $('#q-form', el);
  if (!value) { box.innerHTML = ''; return; }
  const i = value.indexOf('|');
  const row = value.slice(0, i), key = value.slice(i + 1);
  box.innerHTML = '<div class="spinner dark"></div>';
  const d = await api('event_get', { row, key });
  if (!alive()) return;
  const e = d.event;
  const lastEmail = (d.quotes.find(q => q.emailTo) || {}).emailTo || '';

  box.innerHTML = `
    ${d.sameDay.length ? `<section class="card" style="border-color:var(--warn)"><b>⚠️ יש עוד ${d.sameDay.length} אירועים באותו יום:</b>
      <div class="small">${d.sameDay.map(o => esc(`${o.name} ${o.startTime ? '(' + o.startTime + ')' : ''} ${o.location ? '· ' + o.location : ''}`)).join('<br>')}</div></section>` : ''}
    <section class="card">
      <form id="q">
        <label style="margin-top:0">שם אירוע</label><input name="name" value="${esc(e.name)}">
        <div class="grid2">
          <div><label>סטטוס</label><select name="status">${optionsHtml(opts.statusOptions, e.status)}</select></div>
          <div><label>טלפון</label><input name="phone" value="${esc(e.phone)}"></div>
          <div><label>תאריך</label><input name="eventDate" value="${esc(e.dateText)}" placeholder="dd/mm/yyyy"></div>
          <div><label>שעת עלייה</label><input name="startTime" value="${esc(e.startTime)}"></div>
          <div><label>מוצר</label><select name="eventType" id="q-type">${optionsHtml(opts.eventTypeOptions, e.eventType)}</select></div>
          <div><label>הגברה</label><select name="amplification">${optionsHtml(opts.amplificationOptions, e.amplification)}</select></div>
          <div><label>מחיר (₪)</label><input name="price" inputmode="numeric" placeholder="למשל: 5,000"></div>
          <div><label>משך מופע (דק׳)</label><input name="duration" value="50" inputmode="numeric"></div>
        </div>
        <label>הערות</label><input name="notes" value="${esc(e.notes)}">

        <div id="q-host" hidden>
          <label>✨ מספר אורחים במילים</label><input name="guestCountInWords" placeholder="למשל: שלושה">
          <label>אופציות (זמרים)</label>
          <div class="options-grid">${(opts.hostOptions || []).map(o => `
            <label class="check"><input type="checkbox" name="opt" value="${esc(o.name)}"><span><b>${esc(o.name)}</b> <span class="muted">${esc(o.info)}</span></span></label>`).join('')}</div>
        </div>

        <label class="check"><input type="checkbox" id="q-dist"> 🚗 תוספת מרחק</label>
        <div id="q-dist-box" hidden><input name="distanceExtra" value="2000" inputmode="numeric"></div>

        <label class="check"><input type="checkbox" id="q-eilat"> ✈️ אירוע באילת</label>
        <div id="q-eilat-box" class="grid2" hidden>
          <div><label>כרטיסי טיסה</label><input type="number" name="flightTickets" value="3" min="0"></div>
          <div><label>חדרים רגילים</label><input type="number" name="regularRooms" value="2" min="0"></div>
          <div><label>חדרים משודרגים</label><input type="number" name="upgradedRooms" value="4" min="0"></div>
        </div>

        <div class="btn-row">
          <button class="btn ghost" type="button" id="q-update">🔄 עדכן גיליון בלבד</button>
          <button class="btn" type="submit">📄 הפק הצעה</button>
        </div>
      </form>
    </section>
    <div id="q-result"></div>`;

  const form = $('#q', box);
  const toggle = () => {
    $('#q-host', box).hidden = !$('#q-type', box).value.includes('מארח');
    $('#q-eilat-box', box).hidden = !$('#q-eilat', box).checked;
    $('#q-dist-box', box).hidden = !$('#q-dist', box).checked;
  };
  form.addEventListener('change', toggle);
  toggle();

  const collect = () => {
    const fd = new FormData(form);
    const data = {};
    ['name', 'status', 'phone', 'eventDate', 'startTime', 'eventType', 'amplification', 'price', 'duration', 'notes',
     'guestCountInWords', 'distanceExtra', 'flightTickets', 'regularRooms', 'upgradedRooms'].forEach(k => { data[k] = (fd.get(k) || '').toString().trim(); });
    data.isEilat = $('#q-eilat', box).checked;
    data.hasDistance = $('#q-dist', box).checked;
    data.selectedOptions = $('#q-host', box).hidden ? [] : fd.getAll('opt');
    return data;
  };

  const send = async mode => {
    const data = collect();
    if (mode === 'save' && !data.price) return toast('חסר מחיר', 'bad');
    busy(true, mode === 'save' ? 'מפיק הצעה ומצרף מפרטים… (עד דקה)' : 'מעדכן…');
    try {
      const res = await api('quote_create', { row: e.row, key: e.key, mode, data });
      S.cache.events = null;
      if (res.key) { e.key = res.key; e.row = res.row; }
      e.phone = data.phone || e.phone;
      e.name = data.name || e.name;
      if (res.pdfUrl) showQuoteResult($('#q-result', box), e, res, lastEmail);
      else toast(res.message || 'עודכן ✅', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  };
  form.addEventListener('submit', ev => { ev.preventDefault(); send('save'); });
  $('#q-update', box).addEventListener('click', () => send('update'));
}

function showQuoteResult(box, e, res, lastEmail) {
  const msg = `שלום,\nמצורפת הצעת המחיר עבור ${e.name}:\n${res.pdfUrl}\n\nנשמח לעמוד לרשותך לכל שאלה 🎤\nמלך הקסטות`;
  box.innerHTML = `
    <section class="card" style="border-color:var(--ok)">
      <h2>✅ ההצעה מוכנה</h2>
      ${res.attached.length ? `<p class="small" style="margin-top:0">📎 צורפו ל-PDF: ${res.attached.map(esc).join(', ')}</p>` : '<p class="small muted" style="margin-top:0">לא נמצאו קבצי PDF מקושרים לצירוף</p>'}
      ${res.mergeError ? `<p class="small" style="color:var(--warn)">⚠️ ${esc(res.mergeError)}</p>` : ''}
      <div class="btn-row">
        <a class="btn ghost" href="${esc(res.pdfUrl)}" target="_blank">👁️ צפה ב-PDF</a>
        <a class="btn ghost" href="${esc(res.docUrl)}" target="_blank">✏️ ערוך מסמך</a>
      </div>
      <h3 style="margin-top:18px">שליחה ללקוח</h3>
      <div class="btn-row" style="margin-top:6px">
        ${e.phone ? `<a class="btn wa" id="q-wa" href="${waLink(e.phone, msg)}" target="_blank">📲 וואטסאפ ללקוח</a>` : '<span class="small muted">אין טלפון לקוח</span>'}
        <button class="btn secondary" id="q-mail-open">📧 שליחה במייל</button>
      </div>
      <form id="q-mail" hidden>
        <label>מייל הלקוח</label><input name="to" type="email" required value="${esc(lastEmail)}" placeholder="client@example.com">
        <label>נושא</label><input name="subject" value="${esc('הצעת מחיר — ' + e.name)}">
        <label>הודעה</label><textarea name="body" rows="4">${esc(`שלום,\nמצורפת הצעת המחיר עבור ${e.name}.\nנשמח לעמוד לרשותך לכל שאלה.\n\nבברכה,\nמלך הקסטות`)}</textarea>
        <p class="small muted">ה-PDF יצורף למייל${S.user.env === 'production' ? '' : ' · 🧪 בסביבת בדיקה המייל יגיע אליך ולא ללקוח'}</p>
        <button class="btn block" type="submit">שלח מייל</button>
      </form>
    </section>`;
  box.scrollIntoView({ behavior: 'smooth' });
  if ($('#q-wa', box)) $('#q-wa', box).addEventListener('click', () => {
    api('quote_mark_sent', { pdfId: res.pdfId, channel: 'whatsapp' }).catch(() => {});
  });
  $('#q-mail-open', box).addEventListener('click', () => { $('#q-mail', box).hidden = false; $('#q-mail [name=to]', box).focus(); });
  $('#q-mail', box).addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    busy(true, 'שולח מייל…');
    try {
      const r = await api('quote_send_email', { pdfId: res.pdfId, to: f.to.value, subject: f.subject.value, body: f.body.value });
      toast(`המייל נשלח ✅ (${r.sentTo})`, 'ok');
      f.hidden = true;
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });
}

// =====================================================
// פרוטוקול הקמה
// =====================================================
const PROTOCOL_PHOTOS = [
  ['standPhoto', 'עמדה עומדת', ''],
  ['mixerPhoto', 'חיווט מיקסר', ''],
  ['screensPhoto', 'מסכים', '⚠️ להציג לפני העלייה']
];
const PROTOCOL_CHECKS = [
  ['monitors', 'מוניטורים על הבמה (פלייבק ומיקרופון)'],
  ['water', 'מים לעמדה'],
  ['mics', 'שני מיקרופונים על 275 דיליי, עם סוללות'],
  ['note', 'פתק עם שמות הזוג/החברה על העמדה'],
  ['lighting', 'תאורה על העמדה'],
  ['blackCurtain', 'בד שחור']
];

PAGES.protocol = {
  roles: ROLES.SETUP, title: 'פרוטוקול הקמה',
  async render(el, r, alive) {
    const preRow = r.q.get('row'), preKey = r.q.get('k');
    const [all, past] = await Promise.all([cached('events', () => api('events_list'), 60 * 1000), api('protocol_list')]);
    if (!alive()) return;

    const choices = all.filter(e => e.date && daysFromToday(e.date) >= -1 && daysFromToday(e.date) <= 7 && e.status && e.status !== 'נפל')
      .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
    const todays = choices.find(c => c.date === todayIso());
    const preVal = preRow ? `${preRow}|${preKey}` : (todays ? `${todays.row}|${todays.key}` : '');

    const photos = {};
    const checks = {};
    const total = PROTOCOL_PHOTOS.length + PROTOCOL_CHECKS.length;

    el.innerHTML = `
      <section class="card">
        <label style="margin-top:0">אירוע</label>
        <select id="p-event">
          <option value="">— ללא שיוך לאירוע —</option>
          ${choices.map(e => `<option value="${e.row}|${esc(e.key)}">${esc(e.name)} · ${esc(fmtDate(e.date))}</option>`).join('')}
          ${preRow && !choices.some(c => `${c.row}|${c.key}` === preVal) ? `<option value="${esc(preVal)}">האירוע שנבחר</option>` : ''}
        </select>
        <div class="progress-bar"><div id="p-prog" style="width:0"></div></div>
        <p class="small muted" id="p-prog-text" style="margin:4px 0 0">0 מתוך ${total}</p>
      </section>

      <section class="card"><h2>📷 תמונות</h2>
        ${PROTOCOL_PHOTOS.map(([k, t, n]) => `
          <div class="photo-block">
            <div class="grow"><b>${t}</b>${n ? `<div class="small" style="color:var(--warn)">${n}</div>` : ''}</div>
            <img id="pv-${k}" hidden alt="">
            <button class="btn sm secondary" data-shot="${k}">📷 צלם</button>
            <input type="file" accept="image/*" capture="environment" id="in-${k}">
          </div>`).join('')}
      </section>

      <section class="card"><h2>✅ בדיקות</h2>
        ${PROTOCOL_CHECKS.map(([k, t]) => `<label class="check"><input type="checkbox" data-check="${k}"> ${t}</label>`).join('')}
        <label>הערות / חוסרים</label>
        <textarea id="p-remarks" rows="3" placeholder="אם חסר משהו — פרט כאן…"></textarea>
        <button class="btn block" id="p-submit" style="margin-top:14px">שלח עם חוסרים ⚠️</button>
      </section>

      ${past.length ? listCard('🗂️ פרוטוקולים אחרונים', past.slice(0, 15).map(h => `
        <a class="item" href="#/report/${encodeURIComponent(h.id)}">
          <div class="grow"><div class="title">${esc(h.event || 'ללא אירוע')}</div><div class="sub">${esc(h.ts)} · ${esc(h.byName)}${h.remarks ? ' · ' + esc(h.remarks) : ''}</div></div>
          ${h.missing ? `<span class="badge warn">${h.missing} חוסרים</span>` : '<span class="badge ok">תקין</span>'}
          <span class="chev">‹</span></a>`), '') : ''}`;

    $('#p-event', el).value = preVal;

    const update = () => {
      const done = Object.values(photos).filter(Boolean).length + Object.values(checks).filter(Boolean).length;
      $('#p-prog', el).style.width = (done / total * 100) + '%';
      $('#p-prog-text', el).textContent = `${done} מתוך ${total}`;
      const btn = $('#p-submit', el);
      btn.textContent = done === total ? 'שלח פרוטוקול ✅' : 'שלח עם חוסרים ⚠️';
      btn.style.background = done === total ? '' : 'var(--warn)';
      return done;
    };

    $$('[data-shot]', el).forEach(b => b.addEventListener('click', () => $('#in-' + b.dataset.shot, el).click()));
    PROTOCOL_PHOTOS.forEach(([k]) => {
      $('#in-' + k, el).addEventListener('change', ev => {
        const file = ev.target.files[0];
        if (!file) return;
        resizeImage(file, 1200, b64 => {
          photos[k] = b64;
          const img = $('#pv-' + k, el); img.src = b64; img.hidden = false;
          $(`[data-shot="${k}"]`, el).textContent = '✅ צלם שוב';
          update();
        });
      });
    });
    $$('[data-check]', el).forEach(c => c.addEventListener('change', () => { checks[c.dataset.check] = c.checked; update(); }));
    update();

    $('#p-submit', el).addEventListener('click', async () => {
      const done = update();
      const [row, ...rest] = ($('#p-event', el).value || '').split('|');
      const payload = Object.assign({ row: row || '', key: rest.join('|'), remarks: $('#p-remarks', el).value.trim() }, photos, checks);
      busy(true, 'מעלה תמונות ושומר… (עד 30 שניות)');
      try {
        const res = await api('protocol_submit', payload);
        const short = done < total || payload.remarks;
        const header = short ? 'פרוטוקול הקמה ⚠️ יש חוסרים' : 'פרוטוקול הקמה הושלם ✅';
        const evName = $('#p-event', el).selectedOptions[0].textContent;
        const msg = `${header}\n${row ? evName + '\n' : ''}לצפייה בדוח: ${res.reportUrl}`;
        el.innerHTML = `<section class="card" style="text-align:center">
          <div style="font-size:56px">${short ? '⚠️' : '✅'}</div>
          <h2>${short ? 'הפרוטוקול נשלח עם חוסרים' : 'הפרוטוקול הושלם!'}</h2>
          <p class="muted">${esc(payload.remarks || (short ? 'חלק מהסעיפים לא הושלמו — מצוין בדוח.' : 'כל הסעיפים אומתו והתמונות נשמרו.'))}</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
            ${res.managers.map(m => `<a class="btn wa block" target="_blank" href="${waLink(m.phone, msg)}">שלח ל${esc(m.name)} בוואטסאפ</a>`).join('')}
            ${res.managers.length ? '' : `<a class="btn wa block" target="_blank" href="https://wa.me/?text=${encodeURIComponent(msg)}">שתף בוואטסאפ</a>`}
            <a class="btn secondary block" href="#/report/${encodeURIComponent(res.id)}">צפה בדוח</a>
          </div></section>`;
      } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    });
  }
};

function resizeImage(file, maxSize, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; } else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

PAGES.report = {
  roles: ROLES.SETUP, title: 'דוח הקמה', navAs: 'protocol',
  async render(el, r, alive) {
    const d = await api('protocol_get', { id: r.arg });
    if (!alive()) return;
    const labels = { stand: 'עמדה עומדת', mixer: 'חיווט מיקסר', screens: 'מסכים', monitors: 'מוניטורים', water: 'מים', mics: 'מיקרופונים', note: 'פתק שמות', lighting: 'תאורה', blackCurtain: 'בד שחור' };
    el.innerHTML = `
      <section class="card"><h2>דוח הקמה · ${esc(d.timestamp)}</h2>
        ${d.event ? `<p class="muted" style="margin-top:0">${esc(d.event)}</p>` : ''}
        <dl class="kv">${Object.entries(d.checks).filter(([, v]) => v).map(([k, v]) => `<dt>${labels[k] || k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${d.remarks ? `<label>הערות / חוסרים</label><div class="note-box">${esc(d.remarks)}</div>` : ''}
      </section>
      ${d.photos.length ? `<section class="card"><h2>תמונות</h2><div class="report-photos">
        ${d.photos.map(p => `<figure><img src="${p.url}" alt="${esc(p.name)}"><figcaption>${esc(p.name)}</figcaption></figure>`).join('')}
      </div></section>` : ''}`;
  }
};

// =====================================================
// סיכום שבועי
// =====================================================
PAGES.summary = {
  roles: ROLES.ADMIN, title: 'סיכום שבועי', navAs: 'home',
  async render(el, r, alive) {
    const d = await api('summary_get');
    if (!alive()) return;
    const table = (rows, head) => rows.length
      ? `<div class="table-wrap"><table>${head ? `<tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>` : ''}${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`
      : '<p class="empty">אין נתונים</p>';

    el.innerHTML = `
      <div class="kpis">${d.kpis.map(k => `<div class="kpi"><b>${esc(k.value || '0')}</b><span>${esc(k.label)}</span></div>`).join('')}</div>
      <section class="card"><h2>📆 אירועים לפי חודש ואזור</h2>${table(d.months.rows, d.months.header)}</section>
      <section class="card"><h2>🔧 לא שובץ טכני</h2>${table(d.noTech)}</section>
      <section class="card"><h2>📞 פולואפ</h2>${table(d.followUp)}</section>
      <section class="card"><h2>📂 פתוחים</h2>${table(d.open)}</section>
      <section class="card">
        <p class="small muted" style="margin-top:0">מפיק PDF לתיקיית הדוחות ושולח במייל אל: <b>${esc(d.recipients)}</b></p>
        <button class="btn block" id="s-send">📧 הפק ושלח דוח שבועי</button>
        <div id="s-confirm" hidden>
          <p><b>לשלוח את הדוח עכשיו?</b></p>
          <div class="btn-row"><button class="btn ghost" id="s-no">ביטול</button><button class="btn" id="s-yes">כן, שלח</button></div>
        </div>
        <div id="s-res"></div>
      </section>`;

    $('#s-send', el).addEventListener('click', () => { $('#s-send', el).hidden = true; $('#s-confirm', el).hidden = false; });
    $('#s-no', el).addEventListener('click', () => { $('#s-send', el).hidden = false; $('#s-confirm', el).hidden = true; });
    $('#s-yes', el).addEventListener('click', async () => {
      $('#s-confirm', el).hidden = true;
      busy(true, 'מפיק ושולח…');
      try {
        const res = await api('summary_send');
        $('#s-res', el).innerHTML = `<p class="badge ok">✅ הדוח נשלח</p>${res.url ? ` <a href="${esc(res.url)}" target="_blank">פתח PDF</a>` : ''}`;
      } catch (err) { toast(err.message, 'bad'); $('#s-send', el).hidden = false; } finally { busy(false); }
    });
  }
};

// =====================================================
// הגדרות
// =====================================================
PAGES.settings = {
  roles: ROLES.ALL, title: 'הגדרות',
  async render(el, r, alive) {
    let h = `
      <section class="card">
        <h2>👤 הפרופיל שלי</h2>
        <dl class="kv"><dt>שם</dt><dd>${esc(S.user.name)}</dd><dt>אימייל</dt><dd>${esc(S.user.email)}</dd><dt>תפקיד</dt><dd>${esc(S.user.role)}</dd></dl>
        <p class="small muted">📱 להתקנה בטלפון: בתפריט הדפדפן ← "הוסף למסך הבית"</p>
        <button class="btn ghost block" id="logout" style="margin-top:6px">התנתק</button>
      </section>`;
    if (!can(ROLES.ADMIN)) { el.innerHTML = h; $('#logout', el).addEventListener('click', logout); return; }

    let [users, products] = await Promise.all([api('users_list'), api('products_list')]);
    if (!alive()) return;
    el.innerHTML = h + `
      <a class="btn ghost block" href="#/summary" style="margin-bottom:14px">📊 סיכום שבועי</a>
      <section class="card">
        <div class="card-head"><h2>👥 משתמשים והרשאות</h2><button class="btn sm" id="u-new">+ משתמש</button></div>
        <div id="u-list"></div>
      </section>
      <section class="card" id="u-form-card" hidden>
        <h2 id="u-form-title">משתמש חדש</h2>
        <form id="u-form">
          <label>אימייל (חשבון Google)</label><input name="email" type="email" required>
          <div class="grid2">
            <div><label>שם</label><input name="name" required></div>
            <div><label>תפקיד</label><select name="role">${ROLES.ALL.map(x => `<option>${x}</option>`).join('')}</select></div>
          </div>
          <label>טלפון (לשליחת שיבוצים ופרוטוקולים בוואטסאפ)</label><input name="phone" type="tel">
          <label class="check"><input type="checkbox" name="active" checked> פעיל</label>
          <div class="btn-row"><button class="btn ghost" type="button" id="u-cancel">ביטול</button><button class="btn" type="submit">שמור</button></div>
        </form>
      </section>

      <section class="card">
        <div class="card-head"><h2>📦 מוצרים ותבניות הצעה</h2><button class="btn sm" id="p-new">+ מוצר</button></div>
        <p class="small muted" style="margin-top:0">לכל מוצר — קישור ל-Google Doc שישמש כתבנית להצעת המחיר</p>
        <div id="p-list"></div>
        <form id="p-form" hidden>
          <label>שם המוצר</label><input name="name" required>
          <label>קישור לתבנית (Google Doc)</label><input name="template" placeholder="https://docs.google.com/document/d/…">
          <label class="check"><input type="checkbox" name="active" checked> פעיל</label>
          <input type="hidden" name="originalName">
          <div class="btn-row"><button class="btn ghost" type="button" id="p-cancel">ביטול</button><button class="btn" type="submit">שמור</button></div>
        </form>
      </section>

      <section class="card small">
        <h2>🔐 מה כל תפקיד רואה</h2>
        <div class="table-wrap"><table>
          <tr><th></th><th>מנהל</th><th>משרד</th><th>מפיק</th><th>איש צוות</th></tr>
          <tr><td>כל האירועים, עריכה ושיבוץ</td><td>✅</td><td>✅</td><td>✅</td><td>—</td></tr>
          <tr><td>פניות, הצעות ושליחה ללקוח</td><td>✅</td><td>✅</td><td>—</td><td>—</td></tr>
          <tr><td>מחיר, גבייה, פולואפ מכירות</td><td>✅</td><td>✅</td><td>—</td><td>—</td></tr>
          <tr><td>פרוטוקול הקמה</td><td>✅</td><td>—</td><td>✅</td><td>—</td></tr>
          <tr><td>האירועים שלי + יומן</td><td>✅</td><td>✅</td><td>✅</td><td>✅ שלו</td></tr>
          <tr><td>משוב על אירוע</td><td>רואה הכול</td><td>כותב</td><td>כותב</td><td>כותב</td></tr>
          <tr><td>סיכום, משתמשים, מוצרים</td><td>✅</td><td>—</td><td>—</td><td>—</td></tr>
        </table></div>
      </section>`;
    $('#logout', el).addEventListener('click', logout);

    // ----- משתמשים -----
    const form = $('#u-form', el);
    const drawUsers = () => {
      $('#u-list', el).innerHTML = users.map((u, i) => `
        <div class="crew-row">
          <div class="grow"><b>${esc(u.name || u.email)}</b> ${u.active ? '' : '<span class="badge bad">מושבת</span>'}
          <div class="small muted">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</div></div>
          <span class="badge brand">${esc(u.role)}</span>
          <button class="btn sm ghost" data-edit="${i}">ערוך</button>
        </div>`).join('') || '<p class="empty">אין משתמשים</p>';
      $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => openForm(users[+b.dataset.edit])));
    };
    const openForm = u => {
      $('#u-form-card', el).hidden = false;
      $('#u-form-title', el).textContent = u ? 'עריכת משתמש' : 'משתמש חדש';
      form.email.value = u ? u.email : ''; form.email.readOnly = !!u;
      form.name.value = u ? u.name : ''; form.role.value = u ? u.role : 'איש צוות';
      form.phone.value = u ? u.phone : ''; form.active.checked = u ? u.active : true;
      $('#u-form-card', el).scrollIntoView({ behavior: 'smooth' });
    };
    $('#u-new', el).addEventListener('click', () => openForm(null));
    $('#u-cancel', el).addEventListener('click', () => { $('#u-form-card', el).hidden = true; });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      busy(true, 'שומר…');
      try {
        users = await api('user_save', { email: form.email.value, name: form.name.value, role: form.role.value, phone: form.phone.value, active: form.active.checked });
        S.cache = {};
        $('#u-form-card', el).hidden = true;
        drawUsers();
        toast('נשמר ✅', 'ok');
      } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    });
    drawUsers();

    // ----- מוצרים -----
    const pform = $('#p-form', el);
    const drawProducts = () => {
      $('#p-list', el).innerHTML = products.map((p, i) => `
        <div class="crew-row">
          <div class="grow"><b>${esc(p.name)}</b> ${p.active ? '' : '<span class="badge bad">לא פעיל</span>'}
          <div class="small">${p.template ? `<a href="${esc(p.template)}" target="_blank">📄 תבנית</a>` : '<span class="muted">תבנית ברירת מחדל</span>'}</div></div>
          <button class="btn sm ghost" data-pedit="${i}">ערוך</button>
        </div>`).join('') || '<p class="empty">אין מוצרים</p>';
      $$('[data-pedit]', el).forEach(b => b.addEventListener('click', () => openP(products[+b.dataset.pedit])));
    };
    const openP = p => {
      pform.hidden = false;
      pform.name.value = p ? p.name : ''; pform.template.value = p ? p.template : '';
      pform.active.checked = p ? p.active : true; pform.originalName.value = p ? p.name : '';
      pform.scrollIntoView({ behavior: 'smooth' });
    };
    $('#p-new', el).addEventListener('click', () => openP(null));
    $('#p-cancel', el).addEventListener('click', () => { pform.hidden = true; });
    pform.addEventListener('submit', async ev => {
      ev.preventDefault();
      busy(true, 'שומר…');
      try {
        products = await api('product_save', { name: pform.name.value, template: pform.template.value, active: pform.active.checked, originalName: pform.originalName.value });
        S.cache.opts = null;
        pform.hidden = true;
        drawProducts();
        toast('נשמר ✅', 'ok');
      } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    });
    drawProducts();
  }
};
