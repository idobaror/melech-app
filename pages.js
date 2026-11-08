// ===== דפים (חלק 1): רכיבים משותפים, בית, אירועים, פרטי אירוע, יומן, הגדרות =====
// כל קטע מוצג לפי ההרשאות: can('x') לפעולה, canView('x') לצפייה (כולל "צפייה בכל דבר")

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

function listCard(title, items, emptyText, headExtra, id) {
  return `<section class="card"${id ? ` id="${id}"` : ''}>
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

// ---------- שיבוץ: הודעות וואטסאפ ----------
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
    `לאישור הגעה ולכל הפרטים: ${APP_URL}${eventHref(e)}`
  ].filter(x => x !== null).join('\n');
}

// הודעה אחת לקבוצת הוואטסאפ של הצוות
function crewGroupMessage(e, crew) {
  return [
    `🎤 *${e.displayName || e.name}*`,
    `📅 ${fmtDate(e.date)}${e.startTime ? ' · ' + e.startTime : ''}`,
    e.location ? `📍 ${e.location}` : null,
    '',
    '*הצוות:*',
    ...crew.map(c => `• ${c.name}${c.role ? ' — ' + c.role : ''}`),
    '',
    `לאישור הגעה ולפרטים: ${APP_URL}${eventHref(e)}`
  ].filter(x => x !== null).join('\n');
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (er) {}
    t.remove();
    return ok;
  }
}

function confirmBadge(c) {
  if (c.confirm === 'מאשר') return '<span class="badge ok">✓ מאשר</span>';
  if (c.confirm === 'לא זמין') return '<span class="badge bad">✗ לא זמין</span>';
  return '<span class="badge warn">ממתין לאישור</span>';
}

// ---------- הערות לאירוע ----------
function notesHtml(list, showEvent) {
  if (!list.length) return '<p class="empty">אין הערות עדיין</p>';
  const manage = can('notes_manage');
  return list.map(n => {
    const mine = n.userId === S.user.id;
    const actions = showEvent ? '' : (mine || can('admin')) ? `<div class="fb-actions">
        ${mine ? `<button class="link-btn" data-note-edit="${esc(n.id)}">✏️ ערוך</button>` : ''}
        <button class="link-btn danger-link" data-note-del="${esc(n.id)}">🗑️ מחק</button></div>` : '';
    return `
    <div class="fb ${n.status === 'פתוח' ? 'open' : ''}" data-note="${esc(n.id)}">
      <div class="fb-head"><b>${esc(n.name)}</b> <span class="muted small">${esc(n.created)}</span>
        ${n.status === 'פתוח' ? (manage ? `<button class="btn sm secondary" data-resolve="${esc(n.id)}">✓ טופל</button>` : '<span class="badge warn">פתוח</span>') : '<span class="badge ok">טופל</span>'}
      </div>
      ${showEvent && n.eventName ? `<div class="small muted">${esc(n.eventName)} · ${esc(fmtDate(n.eventDate))}</div>` : ''}
      <div class="fb-text">${esc(n.text)}</div>
      ${actions}
    </div>`;
  }).join('');
}

function bindResolve(el, onDone) {
  $$('[data-resolve]', el).forEach(b => b.addEventListener('click', async ev => {
    ev.preventDefault(); ev.stopPropagation();
    b.disabled = true;
    busy(true, 'מעדכן…');
    try { await api('notes_resolve', { id: b.dataset.resolve }); toast('סומן כטופל ✅', 'ok'); await onDone(); }
    catch (err) { toast(err.message, 'bad'); b.disabled = false; }
    finally { busy(false); }
  }));
}

function notesSection(list) {
  if (!can('notes_write') && !list.length) return '';
  return `<section class="card">
    <h2>💬 הערות לאירוע</h2>
    <p class="small muted" style="margin-top:0">${canView('notes_manage') ? 'כל ההערות מהצוות' : 'ההערות שלך — מגיעות למנהל'}</p>
    <div id="fb-list">${notesHtml(list)}</div>
    ${can('notes_write') ? `<textarea id="fb-text" rows="2" placeholder="משהו חסר, תקלה, הערה לפעם הבאה…"></textarea>
    <button class="btn secondary block" id="fb-add" style="margin-top:10px">שלח הערה</button>` : ''}
  </section>`;
}

function bindNotes(el, e) {
  const redraw = list => { $('#fb-list', el).innerHTML = notesHtml(list); rebind(); };
  const reload = async () => redraw((await api('event_get', { row: e.row, key: e.key })).notes);
  const rebind = () => {
    bindResolve(el, reload);
    $$('[data-note-edit]', el).forEach(b => b.addEventListener('click', () => {
      const box = b.closest('.fb');
      const textEl = $('.fb-text', box);
      const old = textEl.textContent;
      textEl.innerHTML = `<textarea rows="3">${esc(old)}</textarea>
        <div class="btn-row" style="margin-top:6px"><button class="btn sm ghost" data-cancel>ביטול</button><button class="btn sm" data-save>שמור</button></div>`;
      $('.fb-actions', box).hidden = true;
      $('[data-cancel]', textEl).addEventListener('click', () => { textEl.textContent = old; $('.fb-actions', box).hidden = false; });
      $('[data-save]', textEl).addEventListener('click', async () => {
        busy(true, 'שומר…');
        try { redraw(await api('notes_edit', { id: b.dataset.noteEdit, text: $('textarea', textEl).value })); toast('ההערה עודכנה ✅', 'ok'); }
        catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
      });
    }));
    $$('[data-note-del]', el).forEach(b => b.addEventListener('click', async () => {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'בטוח? לחץ שוב'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '🗑️ מחק'; } }, 4000); return; }
      busy(true, 'מוחק…');
      try { redraw(await api('notes_delete', { id: b.dataset.noteDel })); toast('ההערה נמחקה', 'ok'); }
      catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    }));
  };
  rebind();
  const add = $('#fb-add', el);
  if (add) add.addEventListener('click', async () => {
    const text = $('#fb-text', el).value.trim();
    if (!text) return;
    busy(true, 'שולח…');
    try {
      redraw(await api('notes_add', { row: e.row, key: e.key, text }));
      $('#fb-text', el).value = '';
      toast('ההערה נשלחה ✅', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });
}

// ---------- בקשות — רכיבים משותפים ----------
function reqStatusBadge(q) {
  const cls = { 'ממתין': 'warn', 'אושר': 'ok', 'נענה': 'ok', 'לא אושר': 'bad', 'בוטל': '' }[q.status] || '';
  return `<span class="badge ${cls}">${esc(q.status)}</span>`;
}

function waitingFor(ts) {
  const h = Math.floor((Date.now() - ts) / 3600000);
  if (h < 1) return 'עכשיו';
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

function reqItem(q) {
  const who = q.toMe ? `מאת ${q.fromName}` : `אל ${q.toName}`;
  return `<a class="item req-item ${q.urgent && q.status === 'ממתין' ? 'urgent' : ''}" href="#/request/${encodeURIComponent(q.id)}">
    <div class="req-ico">${q.type === 'approval' ? '✅' : '❓'}</div>
    <div class="grow">
      <div class="title">${q.urgent && q.status === 'ממתין' ? '🔴 ' : ''}${esc(q.subject)}</div>
      <div class="sub">${esc(who)} · ${esc(waitingFor(q.createdTs))}${q.eventName ? ' · 🎤 ' + esc(q.eventName) : ''}${q.due && q.status === 'ממתין' ? ' · עד ' + esc(fmtDate(q.due)) : ''}</div>
    </div>
    ${reqStatusBadge(q)}
    <span class="chev">‹</span>
  </a>`;
}

function requestsSection(d, e) {
  const list = d.requests || [];
  if (!list.length && !can('requests')) return '';
  return `<section class="card">
    <div class="card-head"><h2>📨 שאלות ובקשות אישור</h2>
      ${can('requests') ? `<a class="btn sm secondary" href="#/request-new?row=${e.row}&k=${encodeURIComponent(e.key)}">+ חדשה</a>` : ''}</div>
    ${list.length ? `<div class="list">${list.map(reqItem).join('')}</div>` : '<p class="empty">אין בקשות על האירוע הזה</p>'}
  </section>`;
}

// ---------- אישור הגעה של איש הצוות ----------
function myConfirmSection(d) {
  if (!d.myRole && d.myConfirm === '') return '';
  if (!d.crew.some(c => c.userId === S.user.id)) return '';
  const st = d.myConfirm;
  const title = st === 'מאשר' ? '✓ אישרת הגעה' : st === 'לא זמין' ? '✗ הודעת שאתה לא זמין' : '👋 שובצת לאירוע הזה — מגיע?';
  return `<section class="card confirm-card ${st === 'ממתין' ? 'pending' : ''}" id="my-confirm">
    <h2>${title}</h2>
    ${d.myRole ? `<p class="small" style="margin-top:0">התפקיד שלך: <span class="badge brand">${esc(d.myRole)}</span></p>` : ''}
    ${d.myNote ? `<div class="note-box" style="margin-bottom:10px">📝 ${esc(d.myNote)}</div>` : ''}
    <div class="btn-row" style="margin-top:6px">
      <button class="btn ${st === 'מאשר' ? '' : 'secondary'}" data-confirm="yes">✓ מאשר הגעה</button>
      <button class="btn ${st === 'לא זמין' ? 'danger' : 'ghost'}" data-confirm="no">✗ לא זמין</button>
    </div>
    <div id="no-reason" hidden>
      <label>סיבה (תגיע למי ששיבץ)</label><input id="no-reason-text" placeholder="למשל: חתונה משפחתית">
      <button class="btn danger block" id="no-send" style="margin-top:8px">שלח "לא זמין"</button>
    </div>
  </section>`;
}

function bindMyConfirm(el, e) {
  const box = $('#my-confirm', el);
  if (!box) return;
  const send = async (status, reason) => {
    busy(true, 'שולח…');
    try {
      await api('assign_confirm', { row: e.row, key: e.key, status, reason });
      toast(status === 'yes' ? 'אישרת הגעה ✅' : 'עדכנו שאתה לא זמין', 'ok');
      route();
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  };
  $('[data-confirm="yes"]', box).addEventListener('click', () => send('yes'));
  $('[data-confirm="no"]', box).addEventListener('click', () => { $('#no-reason', box).hidden = false; $('#no-reason-text', box).focus(); });
  $('#no-send', box).addEventListener('click', () => send('no', $('#no-reason-text', box).value.trim()));
}

// ---------- יומן שינויים ----------
function historySection(d) {
  if (!d.history) return '';
  return `<section class="card">
    <details>
      <summary><b>🕘 יומן שינויים</b> <span class="muted small">(${d.history.length})</span></summary>
      ${d.history.length ? d.history.map(h => `
        <div class="hist"><div class="small muted">${esc(h.ts)} · ${esc(h.by)}</div>
        <div><b>${esc(h.action)}</b>${h.details ? ' — ' + esc(h.details) : ''}</div></div>`).join('') : '<p class="empty">אין שינויים עדיין</p>'}
    </details>
  </section>`;
}

// =====================================================
// בית
// =====================================================
PAGES.home = {
  perm: null, title: 'בית',
  async render(el, r, alive) {
    const d = await api('home');
    if (!alive()) return;
    const c = d.counts;
    let h = `<p class="muted" style="margin:0 0 12px">שלום ${esc(S.user.name)} 👋</p>`;

    // בקשות שמחכות לי — הכי למעלה
    if (d.requestsToMe.length) {
      h += `<section class="card attention"><div class="card-head"><h2>📨 ממתין לתשובתך (${d.requestsToMe.length})</h2></div>
        <div class="list">${d.requestsToMe.map(reqItem).join('')}</div></section>`;
    }

    const kpis = [];
    if ('upcoming' in c) kpis.push(`<a class="kpi" href="#/events?f=upcoming"><b>${c.upcoming}</b><span>אירועים קרובים</span></a>`,
      `<a class="kpi ${c.noCrew ? 'alert' : ''}" href="#/events?f=nocrew"><b>${c.noCrew}</b><span>בלי צוות</span></a>`);
    if (c.declined) kpis.push(`<a class="kpi alert" href="#declined-card" data-scroll="declined-card"><b>${c.declined}</b><span>לא זמינים — להחליף</span></a>`);
    if ('waitingForQuote' in c) kpis.push(`<a class="kpi ${c.waitingForQuote ? 'alert' : ''}" href="${canView('events_all') ? '#/events?f=waiting' : '#/quote'}"><b>${c.waitingForQuote}</b><span>ממתינים להצעה</span></a>`);
    if ('unpaid' in c) kpis.push(`<a class="kpi ${c.unpaid ? 'alert' : ''}" href="${canView('events_all') ? '#/events?f=unpaid' : '#/home'}"><b>${c.unpaid}</b><span>לגבייה</span></a>`);
    if ('openNotes' in c) kpis.push(`<a class="kpi ${c.openNotes ? 'alert' : ''}" href="#notes-card" data-scroll="notes-card"><b>${c.openNotes}</b><span>הערות פתוחות</span></a>`);
    if (kpis.length) h += `<div class="kpis">${kpis.join('')}</div>`;

    const actions = [];
    if (can('event_create')) actions.push('<a class="btn" href="#/new">+ פנייה חדשה</a>');
    if (can('requests')) actions.push('<a class="btn secondary" href="#/request-new">📨 שאלה / בקשת אישור</a>');
    if (actions.length) h += `<div class="btn-row" style="margin:0 0 14px">${actions.join('')}</div>`;

    // אירועים שלי — עם בקשת אישור הגעה
    const mine = d.myEvents.map(e => eventItem(e, esc([e.startTime, e.location].filter(Boolean).join(' · ')),
      (e.confirm === 'ממתין' ? '<span class="badge warn">לאשר הגעה</span>' : e.confirm === 'לא זמין' ? '<span class="badge bad">לא זמין</span>' : '') +
      (e.myRole ? ` <span class="badge brand">${esc(e.myRole)}</span>` : '')));
    if (mine.length || !kpis.length) {
      h += listCard(`🎤 האירועים שלי${c.toConfirm ? ` <span class="badge warn">${c.toConfirm} לאשר</span>` : ''}`, mine, 'אין לך אירועים קרובים');
    }

    if (d.declined && d.declined.length) {
      h += listCard('⚠️ הודיעו שהם לא זמינים', d.declined.map(e =>
        eventItem(e, `<b>${esc(e.who)}</b>${e.role ? ' (' + esc(e.role) + ')' : ''}${e.reason ? ' — ' + esc(e.reason) : ''}`, '<span class="badge bad">להחליף</span>')), '', '', 'declined-card');
    }

    if (d.openNotes && d.openNotes.length) {
      h += `<section class="card" id="notes-card"><h2>💬 הערות מהשטח</h2>${notesHtml(d.openNotes, true)}</section>`;
    }

    if (d.requestsMine && d.requestsMine.length) {
      h += listCard('📤 בקשות ששלחתי', d.requestsMine.map(reqItem), '', '<a class="small" href="#/requests?box=out">הכול</a>');
    }

    if (d.waitingForQuote) {
      h += listCard('⏳ ממתינים להצעת מחיר', d.waitingForQuote.map(e => can('quotes')
        ? eventItem(e, null, '<span class="badge brand">📄 להצעה</span>', `#/quote?row=${e.row}&k=${encodeURIComponent(e.key)}`)
        : eventItem(e)), 'אין פניות שממתינות להצעה 🎉');
    }
    if (d.upcoming) {
      h += listCard('📅 אירועים קרובים', d.upcoming.map(e =>
        eventItem(e, null, e.hasCrew ? '' : '<span class="badge warn">ללא צוות</span>')),
        'אין אירועים קרובים', '<a class="small" href="#/events?f=upcoming">הכול</a>');
    }
    if (d.unpaid && d.unpaid.length) {
      h += listCard('💰 לגבייה — קרו ולא שולמו', d.unpaid.map(e => eventItem(e, esc(e.officeStatus || 'לא עודכן'), '<span class="badge bad">לגבות</span>')), '');
    }
    if (d.newRequests && d.newRequests.length) {
      h += listCard('🆕 פניות מהשבוע האחרון', d.newRequests.map(e => eventItem(e, null, statusBadge(e.status))), '');
    }
    if (d.followUps && d.followUps.length) {
      h += `<section class="card"><h2>📝 פולואפ מכירות</h2>${d.followUps.map(e => `
        <a class="item" href="${eventHref(e)}" style="align-items:flex-start">
          ${dateBox(e.date)}
          <div class="grow"><div class="title">${esc(e.name)} ${statusBadge(e.status)}</div>
          <div class="note-box" style="margin-top:6px;max-height:90px">${esc(e.followUp)}</div></div>
        </a>`).join('')}</section>`;
    }
    if (!kpis.length) h += `<a class="btn ghost block" href="#/calendar">📅 ליומן שלי</a>`;
    if (canView('summary')) h += `<a class="btn ghost block" href="#/summary" style="margin-top:10px">📊 סיכום שבועי</a>`;

    el.innerHTML = h;
    bindResolve(el, route);
    // קישורי גלילה בתוך הדף (לא משנים את הכתובת)
    $$('[data-scroll]', el).forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      const t = document.getElementById(a.dataset.scroll);
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    }));
  }
};

// =====================================================
// רשימת אירועים
// =====================================================
PAGES.events = {
  perm: 'view:events_all', title: 'אירועים',
  async render(el, r, alive) {
    const events = await api('events_list');
    if (!alive()) return;
    S.cache.events = { v: events, t: Date.now() };

    const filters = [['upcoming', 'קרובים'], ['nocrew', 'בלי צוות']];
    if (canView('sales')) filters.push(['waiting', 'ממתינים להצעה']);
    if (canView('billing')) filters.push(['unpaid', 'לגבייה']);
    filters.push(['past', 'עבר'], ['all', 'הכול']);
    let f = r.q.get('f') || 'upcoming';
    if (!filters.some(x => x[0] === f)) f = 'upcoming';
    let q = '';

    el.innerHTML = `
      ${can('event_create') ? '<a class="btn block" href="#/new" style="margin-bottom:12px">+ פנייה חדשה</a>' : ''}
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
  perm: 'event_create', title: 'פנייה חדשה', navAs: 'events',
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
          <label>הערה כללית</label><input name="notes">
          ${can('sales') ? '<label>הערת פולואפ ראשונה</label><textarea name="followUp" rows="2" placeholder="מאיפה הגיע, מה ביקש…"></textarea>' : ''}
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
  perm: null, title: 'פרטי אירוע', navAs: 'events',
  async render(el, r, alive) {
    const row = r.arg, key = r.q.get('k') || '';
    const d = await api('event_get', { row, key });
    if (!alive()) return;
    // אין עריכה ואין שיבוץ → כרטיס לקריאה (גם למי שרואה הכול, כמו הבעלים)
    if (!d.canEdit.length && !d.users && !can('sales')) return renderReadOnlyEvent(el, d);
    const opts = await eventOptions();
    if (!alive()) return;
    renderEditableEvent(el, d, opts);
  }
};

function eventActionsRow(e) {
  return `<div class="btn-row">
    ${e.phone ? `<a class="btn wa sm" href="${waLink(e.phone)}" target="_blank">וואטסאפ</a><a class="btn ghost sm" href="tel:${esc(e.phone)}">📞 חייג</a>` : ''}
    ${e.location ? `<a class="btn ghost sm" href="${wazeLink(e.location)}" target="_blank">🚗 ניווט</a>` : ''}
    ${can('quotes') ? `<a class="btn secondary sm" href="#/quote?row=${e.row}&k=${encodeURIComponent(e.key)}">📄 הצעת מחיר</a>` : ''}
    ${can('protocol') ? `<a class="btn ghost sm" href="#/protocol?row=${e.row}&k=${encodeURIComponent(e.key)}">🔧 הקמה</a>` : ''}
  </div>`;
}

// טופס תיאום ללקוח: הקישור (למי ששולח) + מה שהלקוח כבר מילא (לכל מי שרואה את האירוע)
function clientFormLink(token) { return new URL('client.html?t=' + encodeURIComponent(token), location.href).href; }

function clientFormSection(d, e) {
  const c = d.clientForm;
  if (!c) return '';
  if (c.error) return `<section class="card"><h2>📋 פרטים מהלקוח</h2><p class="small warn-text">${esc(c.error)}</p></section>`;
  const missing = c.fields.filter(f => !f.value);
  const link = c.token ? clientFormLink(c.token) : '';
  const msg = `היי! כדי שנגיע מוכנים ל${e.displayName || e.name}${e.date ? ' ב-' + e.date.split('-').reverse().join('/') : ''}, נשמח שתשלימו כמה פרטים כאן:
${link}
תודה, צוות מלך הקסטות 👑`;
  return `<section class="card"><div class="card-head"><h2>📋 פרטים מהלקוח</h2>
      <span class="badge ${missing.length ? 'warn' : 'ok'}">${c.filled}/${c.total}</span></div>
    <div class="cf-progress" style="margin:0 0 8px"><span style="width:${Math.round(100 * c.filled / c.total)}%"></span></div>
    <div class="cf-list">${c.fields.filter(f => f.value).map(f => `<div class="cf-field locked"><div class="cf-label">${esc(f.label)}</div><div class="cf-value">${/^[\d\s+()-]{9,}$/.test(f.value) ? `<a dir="ltr" href="tel:${esc(f.value.replace(/[^\d+]/g, ''))}">${esc(f.value)}</a>` : esc(f.value)}</div></div>`).join('')}</div>
    ${missing.length ? `<p class="small muted" style="margin:8px 0 0">חסר: ${missing.map(f => esc(f.label)).join(' · ')}</p>` : '<p class="small" style="margin:8px 0 0">✅ הלקוח השלים את כל הפרטים</p>'}
    ${c.token ? `<div class="btn-row">
      ${e.phone ? `<a class="btn wa sm" target="_blank" href="${waLink(e.phone, msg)}">📲 שלח ללקוח בוואטסאפ</a>` : ''}
      <button class="btn ghost sm" data-copy-client>📋 העתק קישור</button>
      <a class="btn ghost sm" target="_blank" href="${esc(link)}">👁️ איך הלקוח רואה</a>
    </div>` : ''}</section>`;
}

function bindClientForm(el, d) {
  const b = $('[data-copy-client]', el);
  if (b) b.addEventListener('click', async () => {
    const link = clientFormLink(d.clientForm.token);
    try { await navigator.clipboard.writeText(link); toast('הקישור הועתק'); } catch (err) { prompt('העתק את הקישור:', link); }
  });
}

function sameDaySection(d, e) {
  if (!d.sameDay || !d.sameDay.length) return '';
  return `<section class="card"><h2>🗓️ עוד באותו יום (${d.sameDay.length})</h2>
    ${d.sameDay.map((o, i) => `<div class="item">
      <div class="grow"><a class="title" href="${eventHref(o)}">${esc(o.name)}</a>
      <div class="sub">${esc([o.startTime, o.location].filter(Boolean).join(' · '))}</div>
      ${o.location && e.location ? `<button class="btn sm ghost" data-travel="${i}" style="margin-top:6px">🚗 זמן נסיעה</button>` : ''}</div>
      ${statusBadge(o.status)}</div>`).join('')}
  </section>`;
}

function bindTravel(el, d, e) {
  $$('[data-travel]', el).forEach(b => b.addEventListener('click', async () => {
    const o = d.sameDay[+b.dataset.travel];
    b.disabled = true; b.textContent = '⏳ מחשב…';
    try {
      const t = await api('travel_time', { origin: e.location, destination: o.location });
      b.textContent = t.error ? '❌ ' + t.error : `🚗 ${t.duration} (${t.distance})`;
    } catch (err) { b.textContent = '❌ שגיאה'; }
  }));
}

function quotesSection(d) {
  if (!d.quotes) return '';
  return `<section class="card"><h2>📄 הצעות שהופקו</h2>${d.quotes.length ? d.quotes.map(q => `
    <div class="crew-row"><div class="grow"><a href="${esc(q.pdfUrl)}" target="_blank">${esc(q.created)}</a>
      <div class="small muted">${esc(q.by)}${q.attached ? ' · צורפו: ' + esc(q.attached) : ''}</div></div>
      ${q.sentWhatsapp ? '<span class="badge ok">וואטסאפ</span>' : ''}${q.sentEmail ? ' <span class="badge ok">מייל</span>' : ''}
    </div>`).join('') : '<p class="empty">עוד לא הופקה הצעה</p>'}</section>`;
}

function crewReadonlyList(d) {
  return d.crew.map(c => `<div class="crew-row"><div class="grow"><b>${esc(c.name)}</b>
    <div class="sub small muted">${esc(c.role || '')}${c.confirm === 'לא זמין' && c.confirmNote ? ' · ' + esc(c.confirmNote) : ''}</div></div>
    ${confirmBadge(c)}</div>`).join('') || '<p class="empty">עוד לא שובץ צוות</p>';
}

function renderReadOnlyEvent(el, d) {
  const e = d.event;
  setTitle(e.displayName || e.name);
  el.innerHTML = `
    ${myConfirmSection(d)}
    <section class="card">
      <div class="card-head"><h2>${esc(e.displayName || e.name)}</h2>${statusBadge(e.status)}</div>
      <dl class="kv">
        <dt>תאריך</dt><dd>${esc(fmtDate(e.date) || e.dateText || '—')}</dd>
        <dt>שעת עלייה</dt><dd>${esc(e.startTime || '—')}</dd>
        <dt>מוצר</dt><dd>${esc(e.eventType || '—')}</dd>
        <dt>מיקום</dt><dd>${esc(e.location || '—')}</dd>
        <dt>הגברה</dt><dd>${esc(e.amplification || '—')}</dd>
        ${e.phone ? `<dt>איש קשר</dt><dd><a href="tel:${esc(e.phone)}">${esc(e.phone)}</a></dd>` : ''}
        ${e.additionalShows ? `<dt>מופעים נוספים</dt><dd>${esc(e.additionalShows)}</dd>` : ''}
        ${'price' in e ? `<dt>מחיר</dt><dd>${esc(e.price || '—')}</dd>` : ''}
        ${'officeStatus' in e ? `<dt>גבייה</dt><dd>${esc(e.officeStatus || '—')}</dd>` : ''}
      </dl>
      ${e.notes ? `<label>הערה כללית</label><div class="note-box">${esc(e.notes)}</div>` : ''}
      ${eventActionsRow(e)}
    </section>
    ${clientFormSection(d, e)}
    <section class="card"><h2>👥 הצוות באירוע</h2>${crewReadonlyList(d)}</section>
    ${requestsSection(d, e)}
    ${e.followUp ? `<section class="card"><h2>📝 פולואפ מכירות</h2><div class="note-box">${esc(e.followUp)}</div></section>` : ''}
    ${sameDaySection(d, e)}
    ${quotesSection(d)}
    ${notesSection(d.notes)}
    ${historySection(d)}`;
  bindMyConfirm(el, e);
  bindTravel(el, d, e);
  bindClientForm(el, d);
  bindNotes(el, e);
}

function renderEditableEvent(el, d, opts) {
  const e = d.event;
  const editable = f => d.canEdit.indexOf(f) >= 0;
  setTitle(e.displayName || e.name);
  let crew = d.crew.map(c => ({ userId: c.userId, name: c.name, role: c.role, note: c.note, confirm: c.confirm, confirmNote: c.confirmNote }));
  const userOf = id => (d.users || []).find(u => u.id === id) || {};
  const availability = u => u.blocked ? `לא זמין: ${u.blocked}` : u.busy ? `משובץ ב: ${u.busy}` : '';

  const field = (label, html) => `<div><label>${label}</label>${html}</div>`;
  const input = (name, val, type = 'text') => `<input name="${name}" type="${type}" value="${esc(val || '')}" ${editable(name) ? '' : 'disabled'}>`;
  const select = (name, list, val, ph) => `<select name="${name}" ${editable(name) ? '' : 'disabled'}>${optionsHtml(list, val, ph)}</select>`;

  el.innerHTML = `
    ${myConfirmSection(d)}
    <section class="card">
      <div class="card-head"><h2>${esc(e.displayName || e.name)}</h2>${statusBadge(e.status)}</div>
      <p class="muted small" style="margin:0">${esc(fmtDate(e.date) || 'אין תאריך')} ${e.startTime ? '· ' + esc(e.startTime) : ''} ${e.location ? '· 📍 ' + esc(e.location) : ''}</p>
      ${eventActionsRow(e)}
    </section>
    ${clientFormSection(d, e)}

    <section class="card">
      <h2>👥 צוות משובץ</h2>
      <div id="crew-list"></div>
      ${d.users ? `
      <div class="grid2">
        <div><label>הוסף איש צוות</label><select id="crew-user"><option value="">— בחר —</option>${d.users.map(u => `<option value="${esc(u.id)}">${esc(u.name)}${availability(u) ? ' ⚠️ ' + esc(availability(u)) : ''}</option>`).join('')}</select></div>
        <div><label>תפקיד באירוע</label><input id="crew-role" list="role-sugg" placeholder="זמר, נגן, הגברה, צלם…"><datalist id="role-sugg">${opts.roleSuggestions.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      </div>
      <p id="crew-warn" class="small warn-text" hidden></p>
      <label>הערה לאיש הצוות</label><input id="crew-note" placeholder="אופציונלי — תוצג לו ותישלח בוואטסאפ">
      <div class="btn-row">
        <button class="btn secondary" id="crew-add">+ הוסף</button>
        <button class="btn" id="crew-save">שמור שיבוץ</button>
      </div>
      <div id="crew-share" hidden>
        <p class="small muted" style="margin:12px 0 4px">📲 לשלוח לכל אחד בנפרד — הכפתורים ליד השמות. או הודעה אחת לקבוצת הצוות:</p>
        <div class="btn-row" style="margin-top:4px">
          <button class="btn ghost sm" id="crew-copy">📋 העתק הודעה לקבוצה</button>
          ${navigator.share ? '<button class="btn ghost sm" id="crew-native">↗️ שתף</button>' : ''}
        </div>
      </div>` : ''}
    </section>

    <section class="card">
      <h2>✏️ פרטי האירוע</h2>
      <form id="ev-form">
        <label>שם אירוע</label>${input('name', e.name)}
        <div class="grid2">
          ${field('סטטוס', select('status', opts.statusOptions, e.status, '— ממתין להצעה —'))}
          ${field('טלפון', input('phone', e.phone, 'tel'))}
          ${field('תאריך', input('date', e.date, 'date'))}
          ${field('שעת עלייה', input('startTime', e.startTime))}
          ${field('מוצר', select('eventType', opts.eventTypeOptions, e.eventType))}
          ${field('הגברה', select('amplification', opts.amplificationOptions, e.amplification))}
        </div>
        <label>מיקום</label>${input('location', e.location)}
        <label>הערה כללית</label>${input('notes', e.notes)}
        ${'officeStatus' in e ? `<label>סטטוס גבייה</label>${input('officeStatus', e.officeStatus)}${editable('officeStatus') ? '<p class="small muted" style="margin:4px 0 0">כשהתשלום התקבל — לכתוב <b>הושלם</b></p>' : ''}` : ''}
        ${e.price ? `<p class="muted small">מחיר אחרון בהצעה: <b>${esc(e.price)}</b></p>` : ''}
        ${d.canEdit.length ? '<button class="btn block" style="margin-top:16px" type="submit">שמור שינויים</button>' : ''}
      </form>
    </section>

    ${requestsSection(d, e)}
    ${sameDaySection(d, e)}
    ${quotesSection(d)}

    ${'followUp' in e ? `<section class="card">
      <h2>📝 פולואפ מכירות</h2>
      <div id="fu-box">${e.followUp ? `<div class="note-box">${esc(e.followUp)}</div>` : '<p class="empty">אין הערות עדיין</p>'}</div>
      ${can('sales') ? `<label>הערה חדשה</label><textarea id="fu-text" rows="2"></textarea>
      <button class="btn secondary block" id="fu-add" style="margin-top:10px">הוסף לפולואפ</button>` : ''}
    </section>` : ''}

    ${notesSection(d.notes)}
    ${historySection(d)}`;

  // ----- צוות -----
  const drawCrew = (justSaved) => {
    $('#crew-list', el).innerHTML = crew.length ? crew.map((c, i) => {
      const phone = userOf(c.userId).phone;
      return `<div class="crew-row"><div class="grow"><b>${esc(c.name)}</b>
        <div class="sub small muted">${esc(c.role || '')}${c.note ? ' · ' + esc(c.note) : ''}${c.confirm === 'לא זמין' && c.confirmNote ? ' · <b>' + esc(c.confirmNote) + '</b>' : ''}</div></div>
        ${c.confirm ? confirmBadge(c) : '<span class="badge">חדש</span>'}
        ${d.users && justSaved && phone ? `<a class="btn sm wa" target="_blank" href="${waLink(phone, crewMessage(e, c))}">📲</a>` : ''}
        ${d.users ? `<button class="btn sm danger" data-rm="${i}" aria-label="הסר">✕</button>` : ''}</div>`;
    }).join('') : '<p class="empty">עוד לא שובץ אף אחד</p>';
    $$('[data-rm]', el).forEach(b => b.addEventListener('click', () => { crew.splice(+b.dataset.rm, 1); drawCrew(false); }));
    if ($('#crew-share', el)) $('#crew-share', el).hidden = !(justSaved && crew.length);
  };
  drawCrew(true);
  if (d.users) {
    $('#crew-user', el).addEventListener('change', ev => {
      const warn = availability(userOf(ev.target.value));
      $('#crew-warn', el).hidden = !warn;
      $('#crew-warn', el).textContent = warn ? '⚠️ ' + warn : '';
    });
    $('#crew-add', el).addEventListener('click', () => {
      const id = $('#crew-user', el).value;
      if (!id) return toast('בחר איש צוות', 'bad');
      if (crew.some(c => c.userId === id)) return toast('כבר משובץ', 'bad');
      const u = userOf(id);
      crew.push({ userId: id, name: u.name, role: $('#crew-role', el).value.trim(), note: $('#crew-note', el).value.trim() });
      $('#crew-user', el).value = ''; $('#crew-role', el).value = ''; $('#crew-note', el).value = '';
      $('#crew-warn', el).hidden = true;
      drawCrew(false);
    });
    $('#crew-save', el).addEventListener('click', async () => {
      busy(true, 'שומר שיבוץ…');
      try {
        crew = await api('assign_set', { row: e.row, key: e.key, crew });
        drawCrew(true);
        toast('השיבוץ נשמר — אפשר לשלוח בוואטסאפ 📲', 'ok');
      } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    });
    $('#crew-copy', el).addEventListener('click', async () => {
      toast(await copyText(crewGroupMessage(e, crew)) ? 'ההודעה הועתקה — הדבק בקבוצת הוואטסאפ 📋' : 'לא הצלחתי להעתיק', 'ok');
    });
    if ($('#crew-native', el)) $('#crew-native', el).addEventListener('click', () => {
      navigator.share({ text: crewGroupMessage(e, crew) }).catch(() => {});
    });
  }

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
      renderEditableEvent(el, nd, opts);
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });

  // ----- פולואפ מכירות -----
  if ($('#fu-add', el)) $('#fu-add', el).addEventListener('click', async () => {
    const comment = $('#fu-text', el).value.trim();
    if (!comment) return;
    busy(true, 'מוסיף…');
    try {
      const res = await api('event_comment', { row: e.row, key: e.key, comment });
      e.followUp = res.followUp;
      $('#fu-box', el).innerHTML = `<div class="note-box">${esc(res.followUp)}</div>`;
      $('#fu-text', el).value = '';
      const box = $('#fu-box .note-box', el); box.scrollTop = box.scrollHeight;
      toast('נוסף לפולואפ ✅', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });

  bindMyConfirm(el, e);
  bindTravel(el, d, e);
  bindClientForm(el, d);
  bindNotes(el, e);
}

// =====================================================
// יומן חודשי + ימים חסומים
// =====================================================
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

PAGES.calendar = {
  perm: null, title: 'יומן',
  async render(el, r, alive) {
    const month = /^\d{4}-\d{2}$/.test(r.q.get('m') || '') ? r.q.get('m') : todayIso().slice(0, 7);
    const d = await api('calendar', { month });
    if (!alive()) return;
    const [y, m] = d.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const shift = n => { const t = new Date(y, m - 1 + n, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
    const byDay = {};
    d.events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
    const blocked = new Set(d.myBlocked || []);
    const iso = day => `${d.month}-${String(day).padStart(2, '0')}`;
    const today = todayIso();
    let selected = r.q.get('d') || (today.startsWith(d.month) ? today : (d.events[0] ? d.events[0].date : iso(1)));
    let blockMode = r.q.get('block') === '1';

    const cellsHtml = () => {
      let cells = '';
      for (let i = 0; i < first.getDay(); i++) cells += '<div class="cal-cell empty"></div>';
      for (let day = 1; day <= days; day++) {
        const ds = iso(day);
        const list = byDay[ds] || [];
        const waiting = list.some(e => !e.status);
        const others = d.blockedByDay && d.blockedByDay[ds] ? d.blockedByDay[ds].length : 0;
        cells += `<button class="cal-cell ${ds === today ? 'today' : ''} ${list.length ? 'has' : ''} ${blocked.has(ds) ? 'blocked' : ''} ${ds < today ? 'past' : ''}" data-day="${ds}">
          <span class="num">${day}</span>
          ${list.length ? `<span class="cal-count ${waiting ? 'waiting' : ''}">${list.length}</span>` : ''}
          ${others ? `<span class="cal-off" title="לא זמינים">🚫${others}</span>` : ''}
        </button>`;
      }
      return cells;
    };

    el.innerHTML = `
      <section class="card cal ${blockMode ? 'block-mode' : ''}">
        <div class="cal-head">
          <a class="icon-btn dark" href="#/calendar?m=${shift(-1)}${blockMode ? '&block=1' : ''}" aria-label="חודש קודם">→</a>
          <h2>${MONTHS[m - 1]} ${y}</h2>
          <a class="icon-btn dark" href="#/calendar?m=${shift(1)}${blockMode ? '&block=1' : ''}" aria-label="חודש הבא">←</a>
        </div>
        <div class="cal-grid" id="cal-grid">${DAYS.map(x => `<div class="cal-dow">${x}</div>`).join('')}${cellsHtml()}</div>
        <p class="small muted" style="margin:10px 0 0">${d.events.length} אירועים החודש${d.all ? '' : ' (שלך)'}${blocked.size ? ` · ${blocked.size} ימים שסימנת כלא זמין` : ''}</p>
        <button class="btn ${blockMode ? '' : 'ghost'} block" id="block-toggle" style="margin-top:10px">${blockMode ? '✓ סיימתי לסמן' : '🚫 סמן ימים שאני לא זמין'}</button>
        ${blockMode ? '<p class="small" style="margin:8px 0 0;color:var(--bad)">לחץ על יום כדי לסמן / לבטל. מי שמשבץ יראה את זה.</p>' : ''}
      </section>
      <div id="cal-day"></div>`;

    const drawDay = () => {
      $$('.cal-cell[data-day]', el).forEach(c => c.classList.toggle('sel', !blockMode && c.dataset.day === selected));
      const list = byDay[selected] || [];
      const off = d.blockedByDay && d.blockedByDay[selected];
      $('#cal-day', el).innerHTML = blockMode ? '' : listCard(`🗓️ ${fmtDate(selected)}`, list.map(e =>
        eventItem(e, esc([e.startTime, e.location].filter(Boolean).join(' · ')),
          e.myRole ? `<span class="badge brand">${esc(e.myRole)}</span>` : statusBadge(e.status))),
        'אין אירועים ביום הזה') +
        (off ? `<section class="card"><h3>🚫 לא זמינים ביום הזה</h3><p class="small" style="margin:0">${off.map(esc).join(' · ')}</p></section>` : '') +
        (blocked.has(selected) ? '<p class="small" style="color:var(--bad)">סימנת שאתה לא זמין ביום הזה</p>' : '');
    };
    const bindCells = () => $$('.cal-cell[data-day]', el).forEach(c => c.addEventListener('click', async () => {
      const ds = c.dataset.day;
      if (blockMode) {
        if (ds < today) return toast('אי אפשר לסמן תאריך שעבר', 'bad');
        c.disabled = true;
        try {
          const res = await api('blocked_toggle', { date: ds });
          res.blocked ? blocked.add(ds) : blocked.delete(ds);
          c.classList.toggle('blocked', res.blocked);
        } catch (err) { toast(err.message, 'bad'); } finally { c.disabled = false; }
        return;
      }
      selected = ds;
      history.replaceState(null, '', `#/calendar?m=${d.month}&d=${selected}`);
      drawDay();
    }));
    $('#block-toggle', el).addEventListener('click', () => {
      location.hash = `#/calendar?m=${d.month}${blockMode ? '' : '&block=1'}`;
    });
    bindCells();
    drawDay();
  }
};

// =====================================================
// הגדרות
// =====================================================
PAGES.settings = {
  perm: null, title: 'הגדרות',
  async render(el, r, alive) {
    const catalog = S.user.catalog || [];
    const permLabel = id => (catalog.find(p => p.id === id) || {}).label || id;
    let h = `
      <section class="card">
        <h2>👤 ${esc(S.user.name)}</h2>
        <div class="perm-tags">${S.user.perms.map(p => `<span class="badge brand">${esc(permLabel(p))}</span>`).join('') || '<span class="muted small">צפייה באירועים שלך</span>'}</div>
        <p class="small muted">📱 להתקנה בטלפון: בתפריט הדפדפן ← "הוסף למסך הבית"</p>
        <a class="btn ghost block" href="#/calendar?block=1">🚫 סימון ימים שאני לא זמין</a>
        <details style="margin-top:12px"><summary class="small" style="cursor:pointer">🔑 החלפת קוד</summary>
          <form id="pin-form" class="grid2">
            <div><label>קוד נוכחי</label><input name="current" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></div>
            <div><label>קוד חדש</label><input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></div>
            <button class="btn secondary" type="submit" style="grid-column:1/-1;margin-top:10px">החלף קוד</button>
          </form>
        </details>
        <button class="btn ghost block" id="logout" style="margin-top:14px">התנתק</button>
      </section>`;

    const bindSelf = () => {
      $('#logout', el).addEventListener('click', logout);
      $('#pin-form', el).addEventListener('submit', async ev => {
        ev.preventDefault();
        busy(true, 'מחליף קוד…');
        try {
          const res = await api('change_pin', { current: ev.target.current.value, pin: ev.target.pin.value });
          S.session = res.session; store('mk_session', S.session);
          ev.target.reset();
          toast('הקוד הוחלף ✅', 'ok');
        } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
      });
    };
    if (!can('admin')) { el.innerHTML = h; bindSelf(); return; }

    let [users, products, checklists] = await Promise.all([api('users_list'), api('products_list'), api('checklists_list')]);
    if (!alive()) return;
    const presets = S.user.presets || {};
    const groups = [...new Set(catalog.map(p => p.group))];

    el.innerHTML = h + `
      <section class="card">
        <div class="card-head"><h2>👥 משתתפים והרשאות</h2><button class="btn sm" id="u-new">+ משתתף</button></div>
        <div id="u-list"></div>
      </section>
      <section class="card" id="u-form-card" hidden>
        <h2 id="u-form-title">משתתף חדש</h2>
        <form id="u-form">
          <input type="hidden" name="id">
          <div class="grid2">
            <div><label>שם (כפי שיופיע במסך הכניסה)</label><input name="name" required></div>
            <div><label>טלפון (לוואטסאפ)</label><input name="phone" type="tel"></div>
          </div>
          <label>קוד כניסה — 4 ספרות</label>
          <input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" autocomplete="off">
          <label class="check"><input type="checkbox" name="active" checked> פעיל</label>

          <h3 style="margin-top:16px">הרשאות</h3>
          <div class="chips" style="margin:6px 0 0">${Object.keys(presets).map(n => `<button type="button" class="chip" data-preset="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          <p class="small muted" style="margin:2px 0 0">תבנית ממלאת את הסימונים — אפשר לשנות אחר כך</p>
          ${groups.map(g => `<div class="perm-group"><h3>${esc(g)}</h3>
            ${catalog.filter(p => p.group === g).map(p => `<label class="perm-item"><input type="checkbox" name="perm" value="${esc(p.id)}"><span>${esc(p.label)}${p.hint ? `<small>${esc(p.hint)}</small>` : ''}</span></label>`).join('')}
          </div>`).join('')}
          <p class="small muted">כל משתתף רואה תמיד את האירועים שהוא משובץ אליהם, ויכול לענות על בקשות שנשלחו אליו.</p>
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

      <section class="card">
        <h2>✅ צ'קליסט הקמה</h2>
        <p class="small muted" style="margin-top:0">הרשימה הכללית משמשת לכל מוצר שאין לו רשימה משלו</p>
        <label>איזו רשימה לערוך?</label>
        <select id="cl-pick"></select>
        <div id="cl-editor"></div>
      </section>`;
    bindSelf();

    // ----- משתתפים -----
    const form = $('#u-form', el);
    const setPerms = list => $$('[name=perm]', form).forEach(c => { c.checked = list.indexOf(c.value) >= 0; });
    const drawUsers = () => {
      $('#u-list', el).innerHTML = users.map((u, i) => `
        <div class="crew-row" style="align-items:flex-start">
          <div class="grow"><b>${esc(u.name)}</b> ${u.active ? '' : '<span class="badge bad">מושבת</span>'}
            <div class="small muted">${u.phone ? esc(u.phone) : 'אין טלפון'}</div>
            <div class="perm-tags">${u.perms.includes('admin') ? '<span class="badge brand">👑 ניהול — הכול</span>' : (u.perms.map(p => `<span class="badge">${esc(permLabel(p))}</span>`).join('') || '<span class="small muted">רק אירועים שהוא משובץ אליהם</span>')}</div>
          </div>
          <button class="btn sm ghost" data-edit="${i}">ערוך</button>
        </div>`).join('') || '<p class="empty">אין משתתפים</p>';
      $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => openForm(users[+b.dataset.edit])));
    };
    const openForm = u => {
      $('#u-form-card', el).hidden = false;
      $('#u-form-title', el).textContent = u ? `עריכת ${u.name}` : 'משתתף חדש';
      form.id.value = u ? u.id : '';
      form.name.value = u ? u.name : '';
      form.phone.value = u ? u.phone : '';
      form.pin.value = '';
      form.pin.required = !u;
      form.pin.placeholder = u ? 'השאר ריק כדי לא לשנות' : '4 ספרות';
      form.active.checked = u ? u.active : true;
      setPerms(u ? u.perms : presets['איש צוות'] || []);
      $('#u-form-card', el).scrollIntoView({ behavior: 'smooth' });
    };
    $$('[data-preset]', el).forEach(b => b.addEventListener('click', () => setPerms(presets[b.dataset.preset])));
    $('#u-new', el).addEventListener('click', () => openForm(null));
    $('#u-cancel', el).addEventListener('click', () => { $('#u-form-card', el).hidden = true; });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      busy(true, 'שומר…');
      try {
        users = await api('user_save', {
          id: form.id.value || undefined, name: form.name.value, phone: form.phone.value, pin: form.pin.value,
          active: form.active.checked, perms: $$('[name=perm]:checked', form).map(c => c.value)
        });
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

    // ----- צ'קליסט הקמה -----
    const pick = $('#cl-pick', el);
    const drawPick = () => {
      const cur = pick.value;
      pick.innerHTML = `<option value="">📋 רשימה כללית</option>` + checklists.products.map(p =>
        `<option value="${esc(p.name)}">${esc(p.name)} — ${p.custom ? 'רשימה משלו' : 'משתמש בכללית'}</option>`).join('');
      pick.value = cur;
    };
    const drawEditor = () => {
      const product = pick.value;
      const prod = checklists.products.find(p => p.name === product);
      let items = (product ? (prod && prod.custom ? prod.items : checklists.general) : checklists.general).map(x => Object.assign({}, x));
      const box = $('#cl-editor', el);
      const render = () => {
        box.innerHTML = `
          ${product && !(prod && prod.custom) ? '<p class="small muted">כרגע משתמש ברשימה הכללית. שינוי ושמירה ייצרו לו רשימה משלו.</p>' : ''}
          <div class="cl-list">${items.map((it, i) => `
            <div class="cl-row">
              <select data-i="${i}" data-f="type"><option value="check" ${it.type === 'check' ? 'selected' : ''}>✅ בדיקה</option><option value="photo" ${it.type === 'photo' ? 'selected' : ''}>📷 תמונה</option></select>
              <input data-i="${i}" data-f="label" value="${esc(it.label)}" placeholder="שם הפריט">
              <input data-i="${i}" data-f="note" value="${esc(it.note || '')}" placeholder="הערה (לא חובה)" class="cl-note">
              <div class="cl-btns">
                <button type="button" class="btn sm ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="למעלה">↑</button>
                <button type="button" class="btn sm ghost" data-down="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="למטה">↓</button>
                <button type="button" class="btn sm danger" data-del="${i}" aria-label="מחק">✕</button>
              </div>
            </div>`).join('')}</div>
          <button type="button" class="btn ghost block" id="cl-add" style="margin-top:8px">+ פריט</button>
          <div class="btn-row">
            ${product && prod && prod.custom ? '<button type="button" class="btn ghost" id="cl-reset">חזור לרשימה הכללית</button>' : ''}
            <button type="button" class="btn" id="cl-save">שמור רשימה</button>
          </div>`;
        $$('[data-f]', box).forEach(inp => inp.addEventListener('input', () => { items[+inp.dataset.i][inp.dataset.f] = inp.value; }));
        $$('[data-up]', box).forEach(b => b.addEventListener('click', () => { const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; render(); }));
        $$('[data-down]', box).forEach(b => b.addEventListener('click', () => { const i = +b.dataset.down; [items[i + 1], items[i]] = [items[i], items[i + 1]]; render(); }));
        $$('[data-del]', box).forEach(b => b.addEventListener('click', () => { items.splice(+b.dataset.del, 1); render(); }));
        $('#cl-add', box).addEventListener('click', () => { items.push({ type: 'check', label: '', note: '' }); render(); $$('[data-f="label"]', box).pop().focus(); });
        const save = async list => {
          busy(true, 'שומר…');
          try {
            checklists = await api('checklist_save', { product, items: list });
            drawPick(); drawEditor();
            toast('הרשימה נשמרה ✅', 'ok');
          } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
        };
        $('#cl-save', box).addEventListener('click', () => save(items.filter(x => x.label.trim())));
        if ($('#cl-reset', box)) $('#cl-reset', box).addEventListener('click', () => save([]));
      };
      render();
    };
    drawPick();
    pick.addEventListener('change', drawEditor);
    drawEditor();
  }
};
