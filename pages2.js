// ===== דפים (חלק 2): הצעות מחיר, פרוטוקול הקמה, סיכום שבועי, שאלות ובקשות אישור =====

// =====================================================
// הצעת מחיר
// =====================================================
PAGES.quote = {
  perm: 'quotes', title: 'הצעת מחיר',
  async render(el, r, alive) {
    const [events, opts, qopts] = await Promise.all([
      canView('events_all') ? cached('events', () => api('events_list'), 60 * 1000) : Promise.resolve([]),
      eventOptions(),
      cached('qopts', () => api('quote_options'))
    ]);
    if (!alive()) return;

    // מועד הפנייה: תאריך+שעה מחותמת הטופס, ואם אין — "תאריך פנייה" מהגיליון. החדשות למעלה.
    const inq = e => (qopts.inquiryTimes || {})[e.key] || e.inquiryDate || '';
    const byInquiry = (a, b) => inq(b).localeCompare(inq(a)) || b.row - a.row;
    const waiting = events.filter(e => !e.status).sort(byInquiry);
    const today = todayIso();
    // אירועים פעילים — לפי תאריך האירוע (הקרוב קודם), בלי תאריך בסוף
    const byEventDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.row - b.row;
    const others = events.filter(e => e.status && e.status !== 'נפל' && (!e.date || e.date >= today)).sort(byEventDate);
    const dateText = e => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(e.date || ''); return m ? `${+m[3]}/${+m[2]}/${m[1].slice(2)}` : 'בלי תאריך'; };
    const otherLabel = e => `${dateText(e)} · ${e.name}${forText(e)}`;
    const preRow = r.q.get('row'), preKey = r.q.get('k');
    const inqText = e => {
      const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/.exec(inq(e));
      return m ? `${+m[3]}/${+m[2]}/${m[1].slice(2)}${m[4] ? ' ' + m[4] : ''}` : '';
    };
    const forText = e => e.proposalFor ? ' · 🎯 ' + e.proposalFor : '';
    const optLabel = e => `${e.name}${inqText(e) ? ' · פנייה ' + inqText(e) : ''}${forText(e)}`;

    el.innerHTML = `
      <section class="card">
        <label style="margin-top:0">בחר אירוע</label>
        <select id="q-event">
          <option value="">— בחר אירוע —</option>
          ${waiting.length ? `<optgroup label="⚠️ ממתינים להצעה (${waiting.length})">${waiting.map(e => `<option value="${e.row}|${esc(e.key)}">🔴 ${esc(optLabel(e))}</option>`).join('')}</optgroup>` : ''}
          ${others.length ? `<optgroup label="אירועים פעילים (${others.length})">${others.map(e => `<option value="${e.row}|${esc(e.key)}">${esc(otherLabel(e))}</option>`).join('')}</optgroup>` : ''}
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
      loadQuoteEvent(el, v, allOpts, alive, r.q.get('doc'));
    }
  }
};

async function loadQuoteEvent(el, value, opts, alive, openDoc) {
  const box = $('#q-form', el);
  if (!value) { box.innerHTML = ''; return; }
  const i = value.indexOf('|');
  const row = value.slice(0, i), key = value.slice(i + 1);
  box.innerHTML = '<div class="spinner dark"></div>';
  const d = await api('event_get', { row, key });
  if (!alive()) return;
  const e = d.event;
  const sameDay = d.sameDay || [];
  const lastEmail = ((d.quotes || []).find(q => q.emailTo) || {}).emailTo || '';

  box.innerHTML = `
    ${sameDay.length ? `<section class="card" id="q-sameday" style="border-color:var(--warn)"><b>⚠️ יש עוד ${sameDay.length} אירועים באותו יום:</b>
      ${sameDay.map((o, i) => sameDayRow(o, i, e)).join('')}</section>`
      : e.date && d.sameDay ? `<section class="card" style="border-color:var(--ok)"><b>✅ התאריך פנוי</b> <span class="small muted">— אין אירועים נוספים ב${esc(fmtDate(e.date))}</span></section>` : ''}
    <div class="quote-layout">${pricePanelHtml(opts.priceTable, e)}<section class="card">
      <form id="q">
        <label style="margin-top:0">שם אירוע</label><input name="name" value="${esc(e.name)}">
        <div class="grid2">
          <div><label>סטטוס</label><select name="status">${optionsHtml(opts.statusOptions, e.status)}</select></div>
          <div><label>טלפון</label><input name="phone" type="tel" dir="ltr" value="${esc(e.phone)}">
            <div class="chips-row" style="margin-top:6px">
              <button class="chip-btn wa" type="button" id="q-phone-wa">💬 וואטסאפ</button>
              <button class="chip-btn" type="button" id="q-phone-copy">📋 העתק מספר</button>
            </div></div>
          <div><label>תאריך</label><input name="eventDate" value="${esc(e.dateText)}" placeholder="dd/mm/yyyy"></div>
          <div><label>שעת עלייה</label><input name="startTime" value="${esc(e.startTime)}"></div>
          <div><label>מוצר</label><select name="eventType" id="q-type">${optionsHtml(opts.eventTypeOptions, e.eventType)}</select></div>
          <div><label>הגברה</label><select name="amplification">${optionsHtml(opts.amplificationOptions, e.amplification)}</select></div>
          <div><label>כמות אורחים</label><input name="guestCountInWords" value="${esc(e.guestCount || '')}" placeholder="למשל: 300"></div>
          <div><label>משך מופע (דק׳)</label><input name="duration" value="50" inputmode="numeric"></div>
        </div>
        <label>מחיר בסיס (₪)</label>
        <div style="display:flex;gap:8px"><input name="price" inputmode="numeric" placeholder="למשל: 25,000" style="flex:1"><button class="btn ghost sm" type="button" id="q-suggest">💡 מחיר מוצע</button></div>
        <p id="q-suggest-why" class="small muted" hidden></p>
        <label>הערה כללית</label><input name="notes" value="${esc(e.notes)}">

        <div id="q-host" hidden>
          <label>אופציות (זמרים)</label>
          <div class="options-grid">${(opts.hostOptions || []).map(o => `
            <label class="check"><input type="checkbox" name="opt" value="${esc(o.name)}"><span><b>${esc(o.name)}</b> <span class="muted">${esc(o.info)}</span></span></label>`).join('')}</div>
        </div>
        <div id="q-singer" hidden>
          <label>🎤 זמר/ת</label><select name="singerName">${optionsHtml((opts.hostOptions || []).map(o => o.name), '', '— בחר זמר/ת —')}</select>
          <label class="check"><input type="checkbox" id="q-lehaka"> בליווי להקה חיה (אחרת: על גבי פלייבק)</label>
        </div>

        <h3 class="small muted" style="margin:16px 0 0">תוספות</h3>
        ${[['dj', '🎧 DJ', 'D.j. - תוספת DJ מטעמינו'], ['vj', '🎥 VJ', 'כולל צוות V.J (צוות צילום מעגל סגור) מטעמינו'], ['mc', '🎙️ מנחה', 'תוספת מנחה מטעמינו']].map(([k, label, text]) => `
        <label class="check"><input type="checkbox" id="q-${k}"> ${label}</label>
        <div id="q-${k}-box" hidden>
          <div class="grid2"><div><label>מחיר</label><input name="${k}Price" value="${(opts.pricing || {})[k] || ''}" inputmode="numeric"></div></div>
          <label>הטקסט בהצעה</label><textarea name="${k}CustomText" rows="2">${esc(text)}</textarea>
        </div>`).join('')}

        <label class="check"><input type="checkbox" id="q-dist"> 🚗 תוספת מרחק</label>
        <div id="q-dist-box" hidden><input name="distanceExtra" value="2000" inputmode="numeric"></div>

        <label class="check"><input type="checkbox" id="q-holiday"> 🕍 חג (×${(opts.pricing || {}).holiday ? opts.pricing.holiday.multiplier : 1.5})</label>
        <label class="check"><input type="checkbox" id="q-holidayEve"> 🕯️ ערב חג (×${(opts.pricing || {}).holidayEve ? opts.pricing.holidayEve.multiplier : 2})</label>

        <label class="check"><input type="checkbox" id="q-eilat"> ✈️ אירוע באילת</label>
        <div id="q-eilat-box" class="grid2" hidden>
          <div><label>כרטיסי טיסה</label><input type="number" name="flightTickets" value="3" min="0"></div>
          <div><label>חדרים רגילים</label><input type="number" name="regularRooms" value="2" min="0"></div>
          <div><label>חדרים משודרגים</label><input type="number" name="upgradedRooms" value="4" min="0"></div>
        </div>
        <label class="check"><input type="checkbox" id="q-abroad"> 🌍 אירוע בחו"ל</label>
        <div id="q-abroad-box" class="grid2" hidden>
          <div><label>כרטיסי טיסה</label><input type="number" name="abroadFlightTickets" value="3" min="0"></div>
          <div><label>חדרים רגילים</label><input type="number" name="abroadRegularRooms" value="2" min="0"></div>
          <div><label>חדרים משודרגים</label><input type="number" name="abroadUpgradedRooms" value="4" min="0"></div>
        </div>
        <p id="q-total" class="small" style="margin:10px 0 0;font-weight:600"></p>

        <h3 class="small muted" style="margin:16px 0 4px">📎 מפרטים לצירוף</h3>
        <div id="q-specs">${(opts.specs || []).map(sp => `
          <label class="check"><input type="checkbox" name="spec" value="${esc(sp.id)}"> <span>${esc(sp.name)} <a href="${esc(sp.url)}" target="_blank" class="small">צפייה</a></span></label>`).join('')}</div>
        <p class="small muted" style="margin:4px 0 0">מסומנים לפי ההגברה וכמות האורחים — אפשר לשנות. נכנסים כקישור במסמך ומצורפים לסוף ה-PDF.</p>

        <button class="btn block" type="submit" style="margin-top:16px">✏️ צור מסמך הצעה לעריכה</button>
        <div class="btn-row">
          <button class="btn secondary" type="button" id="q-now">⚡ הפק PDF מיד, בלי עריכה</button>
          <button class="btn ghost" type="button" id="q-update">🔄 עדכן גיליון בלבד</button>
        </div>
      </form>
    </section></div>
    <div id="q-result"></div>`;

  const form = $('#q', box);
  if ($('#q-sameday', box)) bindSameDay($('#q-sameday', box), d, e);
  // טלפון הלקוח: וואטסאפ / העתקה — לפי מה שכתוב בשדה כרגע (כמו בכלי הישן)
  const phoneNow = () => form.elements.phone.value.trim();
  $('#q-phone-wa', box).addEventListener('click', () => {
    if (!phoneNow()) return toast('אין מספר טלפון', 'bad');
    location.href = waLink(phoneNow());
  });
  $('#q-phone-copy', box).addEventListener('click', async () => {
    if (!phoneNow()) return toast('אין מספר טלפון', 'bad');
    toast(await copyText(phoneNow()) ? 'המספר הועתק 📋' : 'לא הצלחתי להעתיק', 'ok');
  });
  const P = opts.pricing || {};
  const on = id => $('#q-' + id, box).checked;
  const num = v => parseFloat(String(v || '').replace(/,/g, '').replace(/[^\d.]/g, ''));
  const guests = () => parseInt(String(form.elements.guestCountInWords.value).replace(/[^0-9]/g, ''), 10);

  // מפרטים: מסומנים לפי הכלל של הכלי הישן, עד שמשנים ידנית
  let specsTouched = false;
  const autoSpecs = () => {
    if (specsTouched) return;
    const n = guests();
    const want = [form.elements.amplification.value === 'באחריות הלקוח - לאשר מפרט' ? 'amp' : '',
      !isNaN(n) && n > 1500 ? 'light_l' : !isNaN(n) && n > 500 ? 'light_m' : 'light_s'];
    $$('[name=spec]', box).forEach(c => { c.checked = want.indexOf(c.value) >= 0; });
  };
  $('#q-specs', box).addEventListener('change', () => { specsTouched = true; });

  const total = () => {
    const base = num(form.elements.price.value);
    if (isNaN(base)) return $('#q-total', box).textContent = '';
    let t = base;
    ['dj', 'vj', 'mc'].forEach(k => { if (on(k)) { const p = num(form.elements[k + 'Price'].value); if (!isNaN(p)) t += p; } });
    if (on('dist')) { const x = num(form.elements.distanceExtra.value); if (!isNaN(x)) t += x; }
    $('#q-total', box).textContent = t !== base ? `💰 סה"כ כולל הכל: ₪${t.toLocaleString('he-IL')}` : '';
  };

  const toggle = () => {
    const type = $('#q-type', box).value;
    $('#q-host', box).hidden = !type.includes('מארח');
    $('#q-singer', box).hidden = !type.includes('מופע זמר');
    ['eilat', 'abroad', 'dist', 'dj', 'vj', 'mc'].forEach(k => { $(`#q-${k}-box`, box).hidden = !on(k); });
    if (on('holiday') && on('holidayEve')) $('#q-holiday', box).checked = false;
    autoSpecs();
    total();
  };
  form.addEventListener('change', toggle);
  form.addEventListener('input', ev => { if (/price|Price|distanceExtra|guestCount/.test(ev.target.name || '')) { autoSpecs(); total(); } });
  toggle();

  // מחיר מוצע — אותו חישוב כמו בכלי הישן (מחירון ב-PRICING)
  $('#q-suggest', box).addEventListener('click', () => {
    const type = $('#q-type', box).value, n = guests();
    let base, label;
    if (type.includes('פרטי')) { base = P.private; label = 'אירוע פרטי'; }
    else if (/עסקי|חברה|ארגון/.test(type)) {
      if (isNaN(n) || n <= 0) return toast('לאירוע עסקי צריך כמות אורחים', 'bad');
      [base, label] = n < 150 ? [P.corporate.under150, 'עסקי עד 150'] : n <= 500 ? [P.corporate.from150, 'עסקי 150–500']
        : n <= 1000 ? [P.corporate.from501, 'עסקי 501–1000'] : [P.corporate.over1000, 'עסקי מעל 1000'];
    } else return toast('אין מחירון למוצר הזה — הזן ידנית (מוגדר ל"פרטי" ו"עסקי")', 'bad');
    let adj = base; const steps = [`${label}: ₪${base.toLocaleString('he-IL')}`];
    if (on('eilat')) { adj = Math.round(adj * P.eilat.multiplier) + P.eilat.extra; steps.push(`אילת ×${P.eilat.multiplier} +₪${P.eilat.extra.toLocaleString('he-IL')}`); }
    else if (on('abroad')) { adj = Math.round(adj * P.abroad.multiplier); steps.push(`חו"ל ×${P.abroad.multiplier}`); }
    if (on('holidayEve')) { adj = Math.round(adj * P.holidayEve.multiplier); steps.push(`ערב חג ×${P.holidayEve.multiplier}`); }
    else if (on('holiday')) { adj = Math.round(adj * P.holiday.multiplier); steps.push(`חג ×${P.holiday.multiplier}`); }
    form.elements.price.value = adj;
    $('#q-suggest-why', box).hidden = false;
    $('#q-suggest-why', box).textContent = `💡 ${steps.join(' → ')} = ₪${adj.toLocaleString('he-IL')} (אפשר לשנות)`;
    total();
  });

  const collect = () => {
    const fd = new FormData(form);
    const data = {};
    ['name', 'status', 'phone', 'eventDate', 'startTime', 'eventType', 'amplification', 'price', 'duration', 'notes',
     'guestCountInWords', 'distanceExtra', 'flightTickets', 'regularRooms', 'upgradedRooms',
     'abroadFlightTickets', 'abroadRegularRooms', 'abroadUpgradedRooms', 'singerName',
     'djPrice', 'djCustomText', 'vjPrice', 'vjCustomText', 'mcPrice', 'mcCustomText'].forEach(k => { data[k] = (fd.get(k) || '').toString().trim(); });
    data.isEilat = on('eilat');
    data.isAbroad = on('abroad');
    data.hasDistance = on('dist');
    data.hasDj = on('dj'); data.hasVj = on('vj'); data.hasMc = on('mc');
    data.isHoliday = on('holiday'); data.isHolidayEve = on('holidayEve');
    data.hasLehaka = on('lehaka');
    data.selectedOptions = $('#q-host', box).hidden ? [] : fd.getAll('opt');
    data.specs = fd.getAll('spec');
    return data;
  };

  bindPricePanel(box, form, e, opts.priceTable);

  const send = async (mode, exportNow) => {
    const data = collect();
    if (mode === 'save' && !data.price) return toast('חסר מחיר', 'bad');
    busy(true, mode !== 'save' ? 'מעדכן…' : exportNow ? 'מפיק הצעה ומצרף מפרטים… (עד דקה)' : 'יוצר מסמך…');
    try {
      const res = await api('quote_create', { row: e.row, key: e.key, mode, data, exportNow: !!exportNow });
      S.cache.events = null;
      if (res.key) { e.key = res.key; e.row = res.row; }
      e.phone = data.phone || e.phone;
      e.name = data.name || e.name;
      if (res.pdfUrl) await showQuoteResult($('#q-result', box), e, res, lastEmail);
      else if (res.draft) showQuoteDraft($('#q-result', box), e, res, lastEmail);
      else toast(res.message || 'עודכן ✅', 'ok');
      // הכתיבה לגיליון כבויה — אומרים את זה במפורש
      if (res.sheetSkipped && mode === 'save') {
        $('#q-result', box).insertAdjacentHTML('afterbegin', '<section class="card" style="border-color:var(--warn)"><b>⚠️ הגיליון לא עודכן</b><p class="small" style="margin:4px 0 0">ההצעה נוצרה, אבל הכתיבה ל"פניות על הפרק" כבויה — סטטוס, מחיר ושאר הפרטים צריך לעדכן ידנית בגיליון.</p></section>');
      }
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  };
  form.addEventListener('submit', ev => { ev.preventDefault(); send('save'); });
  $('#q-now', box).addEventListener('click', () => send('save', true));
  $('#q-update', box).addEventListener('click', () => send('update'));
  // הגעה מטיוטה בכרטיס האירוע
  const doc = openDoc && (d.quotes || []).find(q => q.docId === openDoc);
  if (doc) (doc.draft ? showQuoteDraft : showQuoteResult)($('#q-result', box), e, doc, lastEmail);
}

// =====================================================
// טבלת "תמחורים" ליד ההצעה + מחשבון. הנתונים מהגיליון (office@), כאן רק מפענחים:
//   שורת קטגוריה = טקסט בלי מחיר. שורת פריט = שם + מחיר (+ עמודות "כולל…" + הערות).
//   סכום ("25,000") → בסיס/תוספת · אחוז ("150%", "120% … +5,000") → מכפיל (+תוספת) · "+ עלות…" → שדה עלות.
// =====================================================
const PRICE_NUM = s => { const m = String(s || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

function parsePriceTable(rows) {
  const items = [];
  let section = '', flagCols = [];
  (rows || []).forEach(r => {
    const [a, b] = [String(r[0] || '').trim(), String(r[1] || '').trim()];
    if (!a && !b) {
      const hdr = r.slice(2).map(x => String(x || '').trim());
      if (hdr.some(Boolean)) flagCols = hdr;   // "כולל הגברה", "כולל ויג'יי", "הערות"
      return;
    }
    if (a && !b) { section = a; return; }
    if (!a) return;
    const pct = b.match(/(\d+(?:\.\d+)?)\s*%/);
    const plus = b.match(/\+\s*([\d,]+)(?!\s*יורו)/);
    const it = { section, label: a, text: b, note: '', flags: [] };
    r.slice(2).forEach((v, i) => {
      const t = String(v || '').trim(), h = flagCols[i] || '';
      if (!t) return;
      if (/^(✓|✔|v|V|כן)$/.test(t)) it.flags.push({ h, on: true });
      else if (/^(x|X|✗|לא)$/.test(t)) it.flags.push({ h, on: false });
      else it.note = t;
    });
    if (pct) { it.kind = 'mult'; it.mult = parseFloat(pct[1]) / 100; it.add = plus ? PRICE_NUM(plus[1]) : 0; if (/יורו/.test(b)) it.note = it.note || b; }
    else { it.amount = PRICE_NUM(b); it.needsCost = /עלות/.test(b); it.kind = /אירוע|אירוח/.test(section) ? 'base' : /מרחק/.test(a) ? 'dist' : 'extra'; }
    it.group = it.kind === 'base' ? 'base' : it.kind === 'dist' ? 'dist' : it.kind === 'mult' ? (/חג/.test(a) ? 'holiday' : 'loc') : '';
    items.push(it);
  });
  return items;
}

function pricePanelHtml(table, e) {
  if (!table) return '';
  if (table.error) return `<details class="card price-panel"><summary><h2>📋 תמחורים</h2></summary><p class="small warn-text">${esc(table.error)}</p></details>`;
  const items = parsePriceTable(table.rows);
  if (!items.length) return '';
  let html = '', sec = null;
  items.forEach((it, i) => {
    if (it.section !== sec) { if (sec !== null) html += '</div>'; sec = it.section; html += `<div class="pp-sec"><div class="pp-sec-title">${esc(sec)}</div>`; }
    const type = it.group ? 'radio' : 'checkbox';
    const flags = it.flags.map(f => `<span class="pp-flag ${f.on ? 'on' : ''}">${f.on ? '✓' : '✗'} ${esc(f.h.replace(/^כולל\s*/, ''))}</span>`).join('');
    html += `<label class="pp-row"><input type="${type}" name="pp-${it.group || 'x' + i}" value="${i}" data-i="${i}">
      <span class="pp-label">${esc(it.label)}${flags ? `<span class="pp-flags">${flags}</span>` : ''}${it.note ? `<span class="small muted pp-note" title="${esc(it.note)}">${esc(it.note)}</span>` : ''}</span>
      <span class="pp-price">${esc(it.text)}</span></label>`;
    if (it.needsCost) html += `<div class="pp-cost" data-for="${i}" hidden><input type="number" min="0" placeholder="עלות הזמר/ים ₪" data-cost="${i}"></div>`;
  });
  html += '</div>';
  return `<details class="card price-panel" id="pp"><summary><h2>📋 תמחורים</h2><span class="small muted">מחשבון</span></summary>
    <div class="pp-body">${html}</div>
    <div class="pp-result" id="pp-result"><p class="small muted" style="margin:0">סמן שורות כדי לחשב מחיר</p></div>
    <div class="btn-row" style="margin-top:8px"><button class="btn" type="button" id="pp-apply" disabled>➡️ החל על ההצעה</button><button class="btn ghost" type="button" id="pp-clear">נקה</button></div>
  </details>`;
}

function bindPricePanel(box, form, e, table) {
  const panel = $('#pp', box);
  if (!panel) return;
  const items = parsePriceTable((table || {}).rows || []);
  if (!items.length) return;
  if (window.matchMedia('(min-width: 900px)').matches) panel.open = true;
  // ברירת מחדל לפי סוג האירוע וכמות האורחים
  const guests = parseInt(String(e.guestCount || '').replace(/[^0-9]/g, ''), 10);
  const type = String(e.eventType || '');
  const pre = items.findIndex(it => it.kind === 'base' && (
    (/פרטי/.test(type) && /פרטי/.test(it.label)) ||
    (/עסקי|חברה|ארגון/.test(type) && !isNaN(guests) && (() => {
      const n = (it.label.match(/\d+/g) || []).map(Number);
      if (/מתחת/.test(it.label)) return guests < n[0];
      if (/בין/.test(it.label)) return guests >= n[0] && guests <= n[1];
      if (/מעל/.test(it.label)) return guests >= n[0];
      return false;
    })())));
  if (pre >= 0) $(`[data-i="${pre}"]`, panel).checked = true;
  // רדיו שאפשר לבטל בלחיצה חוזרת
  $$('input[type=radio]', panel).forEach(r => r.addEventListener('click', () => {
    if (r.dataset.was === '1') { r.checked = false; r.dataset.was = ''; } else { $$(`[name="${r.name}"]`, panel).forEach(x => { x.dataset.was = ''; }); r.dataset.was = '1'; }
    calc();
  }));
  const chosen = () => $$('input[data-i]:checked', panel).map(x => items[+x.dataset.i]);
  const nis = n => '₪' + Math.round(n).toLocaleString('he-IL');
  let last = null;
  const calc = () => {
    $$('.pp-cost', panel).forEach(c => { c.hidden = !$(`[data-i="${c.dataset.for}"]`, panel).checked; });
    const sel = chosen();
    const base = sel.find(it => it.kind === 'base');
    const res = $('#pp-result', panel);
    if (!base) { res.innerHTML = '<p class="small muted" style="margin:0">בחר אירוע / אירוח כבסיס</p>'; $('#pp-apply', panel).disabled = true; last = null; return; }
    const steps = [];
    let b = base.amount || 0;
    steps.push(`${base.label}: ${nis(b)}`);
    if (base.needsCost) { const c = parseFloat($(`[data-cost="${items.indexOf(base)}"]`, panel).value) || 0; if (c) { b += c; steps.push(`+ עלות זמר/ים ${nis(c)}`); } }
    ['loc', 'holiday'].forEach(g => {
      const m = sel.find(it => it.group === g);
      if (m) { b = b * m.mult + (m.add || 0); steps.push(`${m.label}: ×${m.mult}${m.add ? ' + ' + nis(m.add) : ''} → ${nis(b)}`); }
    });
    const dist = sel.find(it => it.group === 'dist');
    const extras = sel.filter(it => it.kind === 'extra');
    let total = b;
    if (dist) { total += dist.amount; steps.push(`+ ${dist.label} ${nis(dist.amount)}`); }
    extras.forEach(x => { total += x.amount; steps.push(`+ ${x.label} ${nis(x.amount)}`); });
    // תוספת שכבר כלולה בבסיס ("כולל ויג'יי")
    const dup = extras.filter(x => base.flags.some(f => f.on && f.h.replace(/^כולל\s*/, '') && x.label.includes(f.h.replace(/^כולל\s*/, '').replace(/'/g, '')))).map(x => x.label);
    res.innerHTML = `<div class="small">${steps.map(esc).join('<br>')}</div>
      <div class="pp-total">סה"כ: ${nis(total)}</div>
      ${dup.length ? `<p class="small warn-text" style="margin:4px 0 0">⚠️ ${esc(dup.join(', '))} כבר כלול באירוע שנבחר</p>` : ''}
      ${sel.some(it => it.note && /יורו/.test(it.note)) ? '<p class="small muted" style="margin:4px 0 0">💶 התוספת ביורו לא נכללת בסכום — מציינים בנפרד</p>' : ''}`;
    $('#pp-apply', panel).disabled = false;
    last = { baseAfter: Math.round(b), dist, extras, sel };
  };
  panel.addEventListener('change', calc);
  panel.addEventListener('input', ev => { if (ev.target.dataset.cost != null) calc(); });
  $('#pp-clear', panel).addEventListener('click', () => { $$('input[data-i]', panel).forEach(x => { x.checked = false; x.dataset.was = ''; }); calc(); });
  // החלה על טופס ההצעה: מחיר בסיס (אחרי מכפילים) + סימון התוספות בסעיפים שלהן — בלי ספירה כפולה
  $('#pp-apply', panel).addEventListener('click', () => {
    if (!last) return;
    const set = (sel, on) => { const c = $(sel, form); if (c) c.checked = on; };
    form.elements.price.value = last.baseAfter;
    const ex = k => last.extras.find(x => k.test(x.label));
    [['dj', /דיג/], ['vj', /ויג/], ['mc', /מנחה/]].forEach(([k, re]) => {
      const x = ex(re);
      set('#q-' + k, !!x);
      if (x && form.elements[k + 'Price']) form.elements[k + 'Price'].value = x.amount;
    });
    set('#q-dist', !!last.dist);
    if (last.dist) form.elements.distanceExtra.value = last.dist.amount;
    const loc = last.sel.find(it => it.group === 'loc'), hol = last.sel.find(it => it.group === 'holiday');
    set('#q-eilat', !!(loc && /אילת/.test(loc.label)));
    set('#q-abroad', !!(loc && /חו"ל|חול/.test(loc.label)));
    set('#q-holidayEve', !!(hol && /ערב/.test(hol.label)));
    set('#q-holiday', !!(hol && !/ערב/.test(hol.label)));
    form.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.price.dispatchEvent(new Event('input', { bubbles: true }));
    toast('המחיר והתוספות הוכנסו להצעה ✅', 'ok');
    form.elements.price.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  calc();
}

// טיוטה: המסמך נוצר — עורכים ב-Docs, ואז מייצאים PDF (כולל המפרטים המקושרים במסמך)
function showQuoteDraft(box, e, res, lastEmail) {
  box.innerHTML = `
    <section class="card" style="border-color:var(--warn)">
      <h2>✏️ טיוטת הצעה</h2>
      <p class="small" style="margin-top:0">1. פותחים את המסמך ועורכים כמה שצריך (השינויים נשמרים לבד).<br>2. חוזרים לכאן ולוחצים "ייצא PDF". המפרטים שמקושרים במסמך יצורפו לסוף ה-PDF.</p>
      <div class="btn-row">
        <a class="btn" href="${esc(res.docUrl)}" target="_blank">✏️ פתח לעריכה</a>
        <button class="btn secondary" id="q-export">📄 ייצא PDF</button>
      </div>
    </section>`;
  box.scrollIntoView({ behavior: 'smooth' });
  $('#q-export', box).addEventListener('click', () => exportQuote(box, e, res.docId, lastEmail));
}

async function exportQuote(box, e, docId, lastEmail) {
  busy(true, 'מייצא PDF ומצרף מפרטים… (עד דקה)');
  try {
    const res = await api('quote_export', { row: e.row, key: e.key, docId });
    showQuoteResult(box, e, res, lastEmail);
    toast('ה-PDF מוכן ✅', 'ok');
  } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
}

// קישור ללקוח: צפייה בהצעה או אישור וחתימה (quote.html)
const signLink = token => new URL('q/?t=' + encodeURIComponent(token), location.href).href;

// ---------- תבנית הודעת וואטסאפ להצעה (נערכת בהגדרות, קבועה לכולם) ----------
const QUOTE_WA_DEFAULT = 'היי {שם_פרטי}, מה נשמע?\nמצורפת הצעת המחיר עבור {אירוע} ({יום} {תאריך}):\n{קישור}\nבקישור אפשר לצפות בהצעה, ואם הכול מתאים — לאשר ולחתום ישירות 🙏\nלכל שאלה אני כאן 🎤';
const QUOTE_WA_VARS = [
  ['שם_פרטי', 'השם הפרטי של הלקוח'], ['לקוח', 'שם הלקוח (עד הפסיק הראשון)'], ['אירוע', 'שם האירוע המלא'],
  ['תאריך', 'תאריך האירוע'], ['יום', 'יום בשבוע'], ['מיקום', 'מיקום'], ['קישור', 'הקישור להצעה']
];
function quoteMsgVars(e, link) {
  const client = String(e.name || '').split(',')[0].trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(e.date || '');
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return {
    'שם_פרטי': client.split(/\s+/)[0] || '', 'לקוח': client, 'אירוע': e.name || '',
    'תאריך': m ? `${+m[3]}/${+m[2]}/${m[1]}` : '', 'יום': m ? 'יום ' + days[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : '',
    'מיקום': e.location || '', 'קישור': link || ''
  };
}
function fillTemplate(tpl, vars) {
  return String(tpl).replace(/\{([^{}\s]+)\}/g, (all, k) => (k in vars ? vars[k] : all))
    .replace(/[ \t]*\(\s*\)/g, '').replace(/ {2,}/g, ' ');   // משתנה ריק — בלי סוגריים ריקים
}

async function showQuoteResult(box, e, res, lastEmail) {
  if (!res.signToken && res.pdfId && !res.signed) {
    try { res.signToken = (await api('quote_sign_link', { pdfId: res.pdfId })).token; } catch (err) { /* בלי קישור — נשלח את ה-PDF */ }
  }
  const link = res.signToken ? signLink(res.signToken) : res.pdfUrl;
  let tpl = '';
  try { tpl = (await api('quote_options')).waTemplate || ''; } catch (err) { /* ברירת מחדל */ }
  const msg = fillTemplate(tpl || QUOTE_WA_DEFAULT, quoteMsgVars(e, link));
  box.innerHTML = `
    <section class="card" style="border-color:var(--ok)">
      <h2>✅ ההצעה מוכנה</h2>
      ${(res.attached = typeof res.attached === 'string' ? res.attached.split(', ').filter(Boolean) : res.attached || []).length ? `<p class="small" style="margin-top:0">📎 צורפו ל-PDF: ${res.attached.map(esc).join(', ')}</p>` : '<p class="small muted" style="margin-top:0">לא נמצאו קבצי PDF מקושרים לצירוף</p>'}
      ${res.mergeError ? `<p class="small" style="color:var(--warn)">⚠️ ${esc(res.mergeError)}</p>` : ''}
      <div class="btn-row">
        <a class="btn ghost" href="${esc(res.pdfUrl)}" target="_blank">👁️ צפה ב-PDF</a>
        ${res.signToken ? `<a class="btn ghost" href="${esc(signLink(res.signToken))}" target="_blank">✍️ איך הלקוח רואה</a>` : ''}
        <a class="btn ghost" href="${esc(res.docUrl)}" target="_blank">✏️ ערוך מסמך</a>
        ${res.docId ? '<button class="btn ghost" id="q-reexport">🔁 ייצא שוב (אחרי תיקון)</button>' : ''}
      </div>
      <h3 style="margin-top:18px">שליחה ללקוח</h3>
      <div class="btn-row" style="margin-top:6px">
        ${e.phone ? `<a class="btn wa" id="q-wa" href="${waLink(e.phone, msg)}" target="_blank">📲 וואטסאפ ללקוח</a>` : '<span class="small muted">אין טלפון לקוח</span>'}
        <button class="btn secondary" id="q-mail-open">📧 שליחה במייל</button>
        ${res.signToken ? '<button class="btn ghost" id="q-copy-link">🔗 העתק קישור</button>' : ''}
      </div>
      ${e.phone ? `<details class="fold" style="margin-top:8px"><summary class="small">✏️ עריכת ההודעה לפני שליחה</summary>
        <textarea id="q-wa-text" rows="6">${esc(msg)}</textarea>
        <p class="small muted" style="margin:4px 0 0">שינוי כאן — רק להודעה הזו. התבנית הקבועה נערכת ב<a href="#/settings">הגדרות</a>.</p>
      </details>` : ''}
      <form id="q-mail" hidden>
        <label>מייל הלקוח</label><input name="to" type="email" required value="${esc(lastEmail)}" placeholder="client@example.com">
        <label>נושא</label><input name="subject" value="${esc('הצעת מחיר — ' + e.name)}">
        <label>הודעה</label><textarea name="body" rows="4">${esc(`היי, מה נשמע?\nמצורפת הצעת המחיר עבור ${e.name}.${res.signToken ? `\n\nלאישור וחתימה דיגיטלית: ${signLink(res.signToken)}` : ''}\n\nלכל שאלה אני כאן,\nמלך הקסטות`)}</textarea>
        <p class="small muted">ה-PDF יצורף למייל${S.user.env === 'production' ? '' : ' · 🧪 בסביבת בדיקה המייל יגיע אליך ולא ללקוח'}</p>
        <button class="btn block" type="submit">שלח מייל</button>
      </form>
    </section>`;
  box.scrollIntoView({ behavior: 'smooth' });
  if ($('#q-wa-text', box)) $('#q-wa-text', box).addEventListener('input', ev => { $('#q-wa', box).href = waLink(e.phone, ev.target.value); });
  if ($('#q-wa', box)) $('#q-wa', box).addEventListener('click', () => {
    api('quote_mark_sent', { pdfId: res.pdfId, channel: 'whatsapp' }).catch(() => {});
  });
  if ($('#q-reexport', box)) $('#q-reexport', box).addEventListener('click', () => exportQuote(box, e, res.docId, lastEmail));
  if ($('#q-copy-link', box)) $('#q-copy-link', box).addEventListener('click', async () => toast(await copyText(signLink(res.signToken)) ? 'הקישור ללקוח הועתק 🔗' : 'לא הצלחתי להעתיק', 'ok'));
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
// פרוטוקול הקמה — הצ'קליסט נטען לפי המוצר של האירוע
// =====================================================
PAGES.protocol = {
  perm: 'view:protocol', title: 'פרוטוקול הקמה',
  async render(el, r, alive) {
    const past = await api('protocol_list');
    if (!alive()) return;
    const pastHtml = past.length ? listCard('🗂️ פרוטוקולים אחרונים', past.slice(0, 15).map(h => `
      <a class="item" href="#/report/${encodeURIComponent(h.id)}">
        <div class="grow"><div class="title">${esc(h.event || 'ללא אירוע')}</div><div class="sub">${esc(h.ts)} · ${esc(h.byName)}${h.remarks ? ' · ' + esc(h.remarks) : ''}</div></div>
        ${h.missing ? `<span class="badge warn">${h.missing} חוסרים</span>` : '<span class="badge ok">תקין</span>'}
        <span class="chev">‹</span></a>`), '') : '<p class="empty">עוד אין פרוטוקולים</p>';

    // צפייה בלבד (למשל הבעלים)
    if (!can('protocol')) { el.innerHTML = pastHtml; return; }
    if (!writeOn('PROTOCOL')) { el.innerHTML = `<section class="card"><p class="small muted" style="margin:0">${PARALLEL_NOTE}</p></section>` + pastHtml; return; }

    const preRow = r.q.get('row'), preKey = r.q.get('k');
    const all = canView('events_all') ? await cached('events', () => api('events_list'), 60 * 1000) : await api('my_events');
    if (!alive()) return;
    const choices = all.filter(e => e.date && daysFromToday(e.date) >= -1 && daysFromToday(e.date) <= 7 && e.status !== 'נפל')
      .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
    const todays = choices.find(c => c.date === todayIso());
    const preVal = preRow ? `${preRow}|${preKey}` : (todays ? `${todays.row}|${todays.key}` : '');

    el.innerHTML = `
      <section class="card">
        <label style="margin-top:0">אירוע</label>
        <select id="p-event">
          <option value="">— ללא שיוך לאירוע —</option>
          ${choices.map(e => `<option value="${e.row}|${esc(e.key)}" data-type="${esc(e.eventType || '')}">${esc(e.name)} · ${esc(fmtDate(e.date))}</option>`).join('')}
          ${preRow && !choices.some(c => `${c.row}|${c.key}` === preVal) ? `<option value="${esc(preVal)}">האירוע שנבחר</option>` : ''}
        </select>
        <div class="progress-bar"><div id="p-prog" style="width:0"></div></div>
        <p class="small muted" id="p-prog-text" style="margin:4px 0 0"></p>
      </section>
      <div id="p-items"><div class="spinner dark"></div></div>
      ${pastHtml}`;
    $('#p-event', el).value = preVal;

    const loadChecklist = async () => {
      const opt = $('#p-event', el).selectedOptions[0];
      const [row, ...rest] = ($('#p-event', el).value || '').split('|');
      $('#p-items', el).innerHTML = '<div class="spinner dark"></div>';
      const cl = await api('checklist_get', { eventType: opt && opt.dataset.type || '', row: row || '', key: rest.join('|') });
      if (!alive()) return;
      renderChecklist(el, cl);
    };
    $('#p-event', el).addEventListener('change', loadChecklist);
    loadChecklist();
  }
};

function renderChecklist(el, cl) {
  const items = cl.items.map(x => Object.assign({ ok: false, photo: '' }, x));
  const photos = items.filter(x => x.type === 'photo');
  const checks = items.filter(x => x.type === 'check');
  const total = items.length;

  $('#p-items', el).innerHTML = `
    ${cl.product ? `<p class="small muted" style="margin:0 0 8px">📋 רשימת הבדיקות של "${esc(cl.product)}"</p>` : ''}
    ${photos.length ? `<section class="card"><h2>📷 תמונות</h2>
      ${photos.map(it => { const i = items.indexOf(it); return `
        <div class="photo-block">
          <div class="grow"><b>${esc(it.label)}</b>${it.note ? `<div class="small" style="color:var(--warn)">${esc(it.note)}</div>` : ''}</div>
          <img id="pv-${i}" hidden alt="">
          <button class="btn sm secondary" data-shot="${i}">📷 צלם</button>
          <input type="file" accept="image/*" capture="environment" id="in-${i}">
        </div>`; }).join('')}
    </section>` : ''}
    <section class="card"><h2>✅ בדיקות</h2>
      ${checks.map(it => { const i = items.indexOf(it); return `<label class="check"><input type="checkbox" data-check="${i}"> <span>${esc(it.label)}${it.note ? `<small class="muted" style="display:block">${esc(it.note)}</small>` : ''}</span></label>`; }).join('')}
      <label>הערות / חוסרים</label>
      <textarea id="p-remarks" rows="3" placeholder="אם חסר משהו — פרט כאן…"></textarea>
      <button class="btn block" id="p-submit" style="margin-top:14px">שלח עם חוסרים ⚠️</button>
    </section>`;

  const update = () => {
    const done = items.filter(x => x.type === 'photo' ? !!x.photo : x.ok).length;
    $('#p-prog', el).style.width = (total ? done / total * 100 : 0) + '%';
    $('#p-prog-text', el).textContent = `${done} מתוך ${total}`;
    const btn = $('#p-submit', el);
    btn.textContent = done === total ? 'שלח פרוטוקול ✅' : 'שלח עם חוסרים ⚠️';
    btn.style.background = done === total ? '' : 'var(--warn)';
    return done;
  };

  $$('[data-shot]', el).forEach(b => b.addEventListener('click', () => $('#in-' + b.dataset.shot, el).click()));
  items.forEach((it, i) => {
    if (it.type !== 'photo') return;
    $('#in-' + i, el).addEventListener('change', ev => {
      const file = ev.target.files[0];
      if (!file) return;
      resizeImage(file, 1200, b64 => {
        it.photo = b64;
        const img = $('#pv-' + i, el); img.src = b64; img.hidden = false;
        $(`[data-shot="${i}"]`, el).textContent = '✅ צלם שוב';
        update();
      });
    });
  });
  $$('[data-check]', el).forEach(c => c.addEventListener('change', () => { items[+c.dataset.check].ok = c.checked; update(); }));
  update();

  $('#p-submit', el).addEventListener('click', async () => {
    const done = update();
    const [row, ...rest] = ($('#p-event', el).value || '').split('|');
    const remarks = $('#p-remarks', el).value.trim();
    busy(true, 'מעלה תמונות ושומר… (עד 30 שניות)');
    try {
      const res = await api('protocol_submit', { row: row || '', key: rest.join('|'), remarks, items });
      const short = done < total || remarks;
      const header = short ? 'פרוטוקול הקמה ⚠️ יש חוסרים' : 'פרוטוקול הקמה הושלם ✅';
      const evName = $('#p-event', el).selectedOptions[0].textContent;
      const msg = `${header}\n${row ? evName + '\n' : ''}לצפייה בדוח: ${APP_URL}#/report/${encodeURIComponent(res.id)}`;
      el.innerHTML = `<section class="card" style="text-align:center">
        <div style="font-size:56px">${short ? '⚠️' : '✅'}</div>
        <h2>${short ? 'הפרוטוקול נשלח עם חוסרים' : 'הפרוטוקול הושלם!'}</h2>
        <p class="muted">${esc(remarks || (short ? 'חלק מהסעיפים לא הושלמו — מצוין בדוח.' : 'כל הסעיפים אומתו והתמונות נשמרו.'))}</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
          ${res.managers.map(m => `<a class="btn wa block" target="_blank" href="${waLink(m.phone, msg)}">שלח ל${esc(m.name)} בוואטסאפ</a>`).join('')}
          ${res.managers.length ? '' : `<a class="btn wa block" target="_blank" href="${waLink('', msg)}">שתף בוואטסאפ</a>`}
          <a class="btn secondary block" href="#/report/${encodeURIComponent(res.id)}">צפה בדוח</a>
        </div></section>`;
    } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });
}

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
  perm: 'view:protocol', title: 'דוח הקמה', navAs: 'protocol',
  async render(el, r, alive) {
    const d = await api('protocol_get', { id: r.arg });
    if (!alive()) return;
    const missing = d.items.filter(x => !x.ok);
    el.innerHTML = `
      <section class="card"><div class="card-head"><h2>דוח הקמה · ${esc(d.timestamp)}</h2>
        ${missing.length ? `<span class="badge warn">${missing.length} חוסרים</span>` : '<span class="badge ok">תקין</span>'}</div>
        ${d.event ? `<p class="muted" style="margin-top:0">${esc(d.event)}</p>` : ''}
        ${d.items.map(x => `<div class="report-row ${x.ok ? '' : 'miss'}"><span>${x.ok ? '✅' : '❌'}</span><span>${x.type === 'photo' ? '📷 ' : ''}${esc(x.label)}</span></div>`).join('')}
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
  perm: 'view:summary', title: 'סיכום שבועי', navAs: 'home',
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
      ${can('summary') ? `<section class="card">
        <p class="small muted" style="margin-top:0">מפיק PDF לתיקיית הדוחות ושולח במייל אל: <b>${esc(d.recipients)}</b></p>
        <button class="btn block" id="s-send">📧 הפק ושלח דוח שבועי</button>
        <div id="s-confirm" hidden>
          <p><b>לשלוח את הדוח עכשיו?</b></p>
          <div class="btn-row"><button class="btn ghost" id="s-no">ביטול</button><button class="btn" id="s-yes">כן, שלח</button></div>
        </div>
        <div id="s-res"></div>
      </section>` : ''}`;

    if (!can('summary')) return;
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
// שאלות ובקשות אישור
// =====================================================
PAGES.requests = {
  perm: null, title: 'בקשות',
  async render(el, r, alive) {
    const boxes = [['in', 'אליי'], ['out', 'ששלחתי']];
    if (can('admin')) boxes.push(['all', 'הכול']);
    let box = r.q.get('box') || 'in';
    if (!boxes.some(b => b[0] === box)) box = 'in';
    const list = await api('req_list', { box });
    if (!alive()) return;
    const pending = list.filter(q => q.status === 'ממתין');
    const done = list.filter(q => q.status !== 'ממתין');
    el.innerHTML = `
      ${can('requests') ? '<a class="btn block" href="#/request-new" style="margin-bottom:12px">📨 שאלה / בקשת אישור חדשה</a>' : ''}
      <div class="chips">${boxes.map(([k, t]) => `<a class="chip ${k === box ? 'on' : ''}" href="#/requests?box=${k}">${t}</a>`).join('')}</div>
      ${listCard(`⏳ ממתינות (${pending.length})`, pending.map(reqItem), box === 'in' ? 'אין בקשות שמחכות לך 🎉' : 'אין בקשות ממתינות')}
      ${done.length ? listCard('📁 טופלו', done.slice(0, 50).map(reqItem), '') : ''}`;
  }
};

PAGES['request-new'] = {
  perm: 'requests', title: 'שאלה / בקשת אישור', navAs: 'requests',
  async render(el, r, alive) {
    const preRow = r.q.get('row'), preKey = r.q.get('k');
    const [people, events] = await Promise.all([
      cached('people', () => api('users_public'), 5 * 60 * 1000),
      canView('events_all') ? cached('events', () => api('events_list'), 60 * 1000) : api('my_events')
    ]);
    if (!alive()) return;
    const others = people.filter(u => u.id !== S.user.id);
    let lastTo = load('mk_last_req_to');
    if (!others.some(u => u.id === lastTo)) lastTo = '';
    const today = todayIso();
    const evOpts = events.filter(e => e.status !== 'נפל' && (!e.date || e.date >= today))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const preVal = preRow ? `${preRow}|${preKey}` : '';

    el.innerHTML = `
      <section class="card">
        <form id="rq">
          <div class="seg">
            <label><input type="radio" name="type" value="approval" checked><span>✅ בקשת אישור</span></label>
            <label><input type="radio" name="type" value="question"><span>❓ שאלה</span></label>
          </div>
          <label>למי</label>
          <select name="to" required><option value="">— בחר —</option>${others.map(u => `<option value="${esc(u.id)}" ${u.id === lastTo ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
          <label>אירוע קשור (לא חובה)</label>
          <select name="event"><option value="">— כללי, בלי אירוע —</option>
            ${evOpts.map(e => `<option value="${e.row}|${esc(e.key)}">${esc(e.name)}${e.date ? ' · ' + esc(fmtDate(e.date)) : ''}</option>`).join('')}
            ${preRow && !evOpts.some(e => `${e.row}|${e.key}` === preVal) ? `<option value="${esc(preVal)}">האירוע שנבחר</option>` : ''}
          </select>
          <label>נושא *</label><input name="subject" required maxlength="200" placeholder="למשל: הנחה של 10% ללקוח">
          <label>פירוט</label><textarea name="details" rows="4" placeholder="כל מה שצריך לדעת כדי להחליט"></textarea>
          <div class="grid2">
            <div><label>תאריך יעד לתשובה</label><input name="due" type="date"></div>
            <div style="display:flex;align-items:flex-end"><label class="check" style="margin:0 0 10px"><input type="checkbox" name="urgent"> 🔴 דחוף</label></div>
          </div>
          <button class="btn block" type="submit" style="margin-top:16px">שלח</button>
        </form>
      </section>`;
    const f = $('#rq', el);
    f.event.value = preVal;
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const [row, ...rest] = (f.event.value || '').split('|');
      busy(true, 'שולח…');
      try {
        const q = await api('req_create', {
          type: f.type.value, to: f.to.value, row: row || '', key: rest.join('|'),
          subject: f.subject.value, details: f.details.value, due: f.due.value, urgent: f.urgent.checked
        });
        store('mk_last_req_to', f.to.value);
        toast('נשלח ✅ — עכשיו אפשר להודיע בוואטסאפ', 'ok');
        location.hash = `#/request/${encodeURIComponent(q.id)}?new=1`;
      } catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
    });
  }
};

function requestWaMessage(q, toRecipient) {
  const link = `${APP_URL}#/request/${encodeURIComponent(q.id)}`;
  if (toRecipient) {
    return [
      `${q.urgent ? '🔴 ' : ''}${q.type === 'approval' ? '✅ בקשת אישור' : '❓ שאלה'} מ${q.fromName}:`,
      `*${q.subject}*`,
      q.eventName ? `🎤 ${q.eventName}` : null,
      q.due ? `⏰ עד ${fmtDate(q.due)}` : null,
      '', `לתשובה: ${link}`
    ].filter(x => x !== null).join('\n');
  }
  return [`עניתי על "${q.subject}": *${q.status}*`, '', `לפרטים: ${link}`].join('\n');
}

PAGES.request = {
  perm: null, title: 'בקשה', navAs: 'requests',
  async render(el, r, alive) {
    const q = await api('req_get', { id: r.arg });
    if (!alive()) return;
    renderRequest(el, q, r.q.get('new') === '1');
  }
};

function renderRequest(el, q, justCreated) {
  setTitle(q.typeLabel);
  const canWrite = (q.mine || q.toMe) && q.status !== 'בוטל';
  el.innerHTML = `
    ${justCreated && q.otherPhone ? `<section class="card attention">
      <b>✓ הבקשה נשלחה ל${esc(q.toName)}</b>
      <p class="small muted" style="margin:4px 0 10px">היא תופיע לו בדף הבית. כדי שידע מיד:</p>
      <a class="btn wa block" target="_blank" href="${waLink(q.otherPhone, requestWaMessage(q, true))}">📲 הודע ל${esc(q.toName)} בוואטסאפ</a>
    </section>` : ''}
    <section class="card req-head ${q.urgent && q.status === 'ממתין' ? 'urgent' : ''}">
      <div class="card-head"><span class="badge brand">${q.type === 'approval' ? '✅' : '❓'} ${esc(q.typeLabel)}</span>${reqStatusBadge(q)}</div>
      <h2 style="margin:6px 0">${q.urgent ? '🔴 ' : ''}${esc(q.subject)}</h2>
      <p class="small muted" style="margin:0">מאת <b>${esc(q.fromName)}</b> אל <b>${esc(q.toName)}</b> · ${esc(q.created)}${q.due ? ' · ⏰ עד ' + esc(fmtDate(q.due)) : ''}</p>
      ${q.eventName ? `<p style="margin:8px 0 0">🎤 ${q.eventRow ? `<a href="${eventHref({ row: q.eventRow, key: q.key })}">${esc(q.eventName)}</a>` : esc(q.eventName)}${q.eventDate ? ' · ' + esc(fmtDate(q.eventDate)) : ''}</p>` : ''}
      ${q.details ? `<div class="note-box" style="margin-top:10px">${esc(q.details)}</div>` : ''}
    </section>

    ${q.canDecide && q.type === 'approval' ? `<section class="card decide">
      <h2>מה ההחלטה?</h2>
      <textarea id="d-text" rows="2" placeholder="הערה (לא חובה)"></textarea>
      <div class="btn-row">
        <button class="btn approve" data-decide="approve">✅ מאשר</button>
        <button class="btn danger" data-decide="reject">❌ לא מאשר</button>
      </div>
    </section>` : ''}

    <section class="card">
      <h2>💬 שיחה</h2>
      <div class="thread">${q.messages.length ? q.messages.map(m => `
        <div class="msg ${m.fromId === S.user.id ? 'me' : ''} ${m.kind === 'decision' ? 'decision' : ''}">
          <div class="msg-meta">${esc(m.name)} · ${esc(m.at)}</div>
          <div class="msg-text">${esc(m.text)}</div>
        </div>`).join('') : '<p class="empty">עוד אין תגובות</p>'}</div>
      ${canWrite ? `<textarea id="m-text" rows="2" placeholder="${q.toMe && q.type === 'question' && q.status === 'ממתין' ? 'התשובה שלך…' : 'הוסף הודעה…'}"></textarea>
      <button class="btn secondary block" id="m-send" style="margin-top:8px">${q.toMe && q.type === 'question' && q.status === 'ממתין' ? 'שלח תשובה' : 'שלח'}</button>` : ''}
    </section>

    <div class="btn-row">
      ${q.otherPhone && (q.mine || q.toMe) ? `<a class="btn wa" target="_blank" href="${waLink(q.otherPhone, requestWaMessage(q, q.mine))}">📲 וואטסאפ ל${esc(q.mine ? q.toName : q.fromName)}</a>` : ''}
      ${q.mine && q.status === 'ממתין' ? '<button class="btn ghost" id="r-cancel">בטל בקשה</button>' : ''}
    </div>`;

  const reload = async (res, msg) => { renderRequest(el, res, false); if (msg) toast(msg, 'ok'); };
  $$('[data-decide]', el).forEach(b => b.addEventListener('click', async () => {
    busy(true, 'שולח החלטה…');
    try { reload(await api('req_decide', { id: q.id, decision: b.dataset.decide, text: $('#d-text', el).value }), 'ההחלטה נשלחה ✅ — אפשר להודיע בוואטסאפ'); }
    catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  }));
  if ($('#m-send', el)) $('#m-send', el).addEventListener('click', async () => {
    const text = $('#m-text', el).value.trim();
    if (!text) return;
    busy(true, 'שולח…');
    try { reload(await api('req_reply', { id: q.id, text }), 'נשלח ✅'); }
    catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });
  if ($('#r-cancel', el)) $('#r-cancel', el).addEventListener('click', async ev => {
    const b = ev.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'בטוח? לחץ שוב'; return; }
    busy(true, 'מבטל…');
    try { reload(await api('req_cancel', { id: q.id }), 'הבקשה בוטלה'); }
    catch (err) { toast(err.message, 'bad'); } finally { busy(false); }
  });
}
