// דף ללקוח: השלמת פרטי אירוע. בלי כניסה — מזוהה בקישור האישי (?t=...).
// מה שכבר ידוע מוצג נעול; הלקוח ממלא רק שדות ריקים. אפשר לחזור לקישור ולהשלים בהמשך.
(function () {
  const CFG = window.APP_CONFIG || {};
  const token = new URLSearchParams(location.search).get('t') || '';
  const body = document.getElementById('client-body');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  async function call(action, payload) {
    let res;
    try {
      res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload }) });
    } catch (e) { throw new Error('אין חיבור. בדקו אינטרנט ונסו שוב.'); }
    const j = JSON.parse(await res.text());
    if (!j.ok) throw new Error(j.error || 'שגיאה');
    return j.data;
  }

  const fail = msg => { body.innerHTML = `<section class="card"><p class="login-error">${esc(msg)}</p></section>`; };

  function lockedHtml(f) {
    return `<div class="cf-field locked"><div class="cf-label">${esc(f.label)} <span class="cf-lock">🔒</span></div>
      <div class="cf-value">${esc(f.value)}</div></div>`;
  }

  function inputHtml(f) {
    const help = f.help ? `<div class="small muted">${esc(f.help)}</div>` : '';
    let control;
    if (f.type === 'checks') {
      control = `<div class="cf-checks">${f.options.map(o => `<label class="perm-item"><input type="checkbox" name="${f.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div>`;
    } else if (f.type === 'textarea') {
      control = `<textarea name="${f.id}" rows="2" maxlength="500"></textarea>`;
    } else {
      control = `<input name="${f.id}" type="${f.type === 'tel' ? 'tel' : 'text'}" maxlength="500"${f.type === 'tel' ? ' inputmode="tel" dir="ltr"' : ''}>`;
    }
    return `<div class="cf-field"><label class="cf-label">${esc(f.label)}</label>${help}${control}</div>`;
  }

  function render(d, justSaved) {
    const open = d.fields.filter(f => !f.locked);
    const locked = d.fields.filter(f => f.locked);
    const ev = d.event || window.__ev || {};
    window.__ev = ev;
    body.innerHTML = `
      <section class="card">
        <h2>${esc(ev.name)}</h2>
        <p class="muted small" style="margin:0">${esc([fmtDate(ev.date), ev.location].filter(Boolean).join(' · '))}</p>
        ${justSaved ? '<p class="cf-saved">✅ תודה! הפרטים נשמרו.</p>' : ''}
        <p class="small" style="margin:10px 0 0">${open.length
          ? `כדי שנגיע מוכנים, נשמח שתשלימו את הפרטים החסרים. אפשר למלא חלק ולחזור לקישור הזה אחר כך.`
          : 'כל הפרטים אצלנו — תודה! 👑'}</p>
        <div class="cf-progress"><span style="width:${Math.round(100 * d.filled / d.total)}%"></span></div>
        <p class="small muted" style="margin:4px 0 0">${d.filled} מתוך ${d.total} פרטים</p>
      </section>
      ${open.length ? `<section class="card"><h2>✍️ פרטים להשלמה</h2>
        <form id="cf-form">${open.map(inputHtml).join('')}
          <p id="cf-err" class="login-error" hidden></p>
          <button class="btn block" type="submit" style="margin-top:14px">שליחה</button>
        </form></section>` : ''}
      ${locked.length ? `<section class="card"><h2>📋 מה שכבר ידוע לנו</h2>${locked.map(lockedHtml).join('')}
        <p class="small muted" style="margin:10px 0 0">משהו לא מדויק? כתבו לנו ונתקן.</p></section>` : ''}`;

    const form = document.getElementById('cf-form');
    if (!form) return;
    form.addEventListener('submit', async ev2 => {
      ev2.preventDefault();
      const values = {};
      open.forEach(f => {
        if (f.type === 'checks') values[f.id] = [...form.querySelectorAll(`[name="${f.id}"]:checked`)].map(x => x.value);
        else values[f.id] = form.elements[f.id].value.trim();
      });
      const btn = form.querySelector('button[type=submit]');
      const err = document.getElementById('cf-err');
      btn.disabled = true; btn.textContent = 'שולח…'; err.hidden = true;
      try {
        render(await call('client_submit', { t: token, values }), true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        err.textContent = e.message; err.hidden = false;
        btn.disabled = false; btn.textContent = 'שליחה';
      }
    });
  }

  if (!token) return fail('הקישור חסר. בדקו שהעתקתם אותו במלואו.');
  call('client_get', { t: token }).then(d => render(d), e => fail(e.message));
})();
