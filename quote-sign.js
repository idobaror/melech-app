// דף ללקוח: צפייה בהצעת המחיר, או אישור וחתימה באצבע. בלי כניסה — מזוהה בקישור האישי (?t=...).
(function () {
  const CFG = window.APP_CONFIG || {};
  const token = new URLSearchParams(location.search).get('t') || '';
  const body = document.getElementById('q-body');
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

  function signedHtml(d) {
    return `<section class="card">
      <p class="cf-saved" style="margin-top:0">✅ ההצעה אושרה ונחתמה</p>
      <p class="small">נחתם ע"י <b>${esc(d.signed.name)}</b> · ${esc(d.signed.at)}</p>
      <div class="btn-row">
        ${d.signed.url ? `<a class="btn" href="${esc(d.signed.url)}" target="_blank">📄 ההצעה החתומה</a>` : ''}
        <a class="btn ghost" href="${esc(d.pdfUrl)}" target="_blank">ההצעה המקורית</a>
      </div>
      <p class="small muted" style="margin-bottom:0">תודה! ניצור קשר להמשך 🎤</p>
    </section>`;
  }

  function render(d) {
    const head = `<section class="card">
      <h2 style="margin-top:0">${esc(d.eventName)}</h2>
      ${d.date ? `<p class="muted" style="margin:0">📅 ${esc(fmtDate(d.date))}</p>` : ''}
    </section>`;
    if (d.signed) { body.innerHTML = head + signedHtml(d); return; }
    body.innerHTML = head + `
      <section class="card">
        <p style="margin-top:0">אפשר לצפות בהצעה, ואם הכול מתאים — לאשר ולחתום כאן, בלי להדפיס.</p>
        <div class="btn-row">
          <a class="btn secondary" href="${esc(d.pdfUrl)}" target="_blank">📄 צפייה בהצעה (PDF)</a>
          <button class="btn" id="open-sign">✍️ אישור וחתימה</button>
        </div>
      </section>
      <section class="card" id="sign-card" hidden>
        <h2 style="margin-top:0">✍️ אישור וחתימה</h2>
        <label>שם מלא</label><input id="s-name" maxlength="80" autocomplete="name">
        <label class="check" style="margin-top:12px"><input type="checkbox" id="s-agree"> קראתי את הצעת המחיר ואני מאשר/ת אותה</label>
        <label style="margin-top:12px">חתימה (באצבע או בעכבר)</label>
        <canvas id="s-pad" width="600" height="250" class="sign-pad"></canvas>
        <button class="link-btn" id="s-clear" type="button">נקה חתימה</button>
        <p id="s-err" class="login-error" hidden></p>
        <button class="btn block" id="s-send" style="margin-top:12px">אישור וחתימה</button>
      </section>`;

    document.getElementById('open-sign').addEventListener('click', () => {
      const c = document.getElementById('sign-card');
      c.hidden = false; c.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('s-name').focus();
    });

    // משטח חתימה
    const pad = document.getElementById('s-pad');
    const ctx = pad.getContext('2d');
    ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1030';
    let drawing = false, strokes = 0;
    const pos = ev => { const r = pad.getBoundingClientRect(); return [(ev.clientX - r.left) * pad.width / r.width, (ev.clientY - r.top) * pad.height / r.height]; };
    pad.addEventListener('pointerdown', ev => { drawing = true; strokes++; pad.setPointerCapture(ev.pointerId); const [x, y] = pos(ev); ctx.beginPath(); ctx.moveTo(x, y); ev.preventDefault(); });
    pad.addEventListener('pointermove', ev => { if (!drawing) return; const [x, y] = pos(ev); ctx.lineTo(x, y); ctx.stroke(); ev.preventDefault(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => pad.addEventListener(t, () => { drawing = false; }));
    document.getElementById('s-clear').addEventListener('click', () => { ctx.clearRect(0, 0, pad.width, pad.height); strokes = 0; });

    const err = msg => { const e = document.getElementById('s-err'); e.hidden = !msg; e.textContent = msg || ''; };
    document.getElementById('s-send').addEventListener('click', async () => {
      const name = document.getElementById('s-name').value.trim();
      if (name.length < 2) return err('נא למלא שם מלא');
      if (!document.getElementById('s-agree').checked) return err('נא לסמן שקראת ואת/ה מאשר/ת את ההצעה');
      if (!strokes) return err('נא לחתום במשטח החתימה');
      err('');
      const btn = document.getElementById('s-send');
      btn.disabled = true; btn.textContent = 'שולח…';
      try {
        const r = await call('quote_public_sign', { t: token, name, agree: true, signature: pad.toDataURL('image/png') });
        render(r);
        window.scrollTo(0, 0);
      } catch (e) {
        err(e.message);
        btn.disabled = false; btn.textContent = 'אישור וחתימה';
      }
    });
  }

  if (!token) return fail('הקישור לא תקין');
  call('quote_public_get', { t: token }).then(render).catch(e => fail(e.message));
})();
