'use strict';

/* =========================================================
   Le mie abitudini — habit tracker personale
   Tutti i dati restano sul dispositivo (localStorage).
   ========================================================= */

const STORE_KEY = 'abitudini.v1';
const EMOJIS = ['✅', '💧', '🏃', '📖', '🧘', '💪', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '📵', '🌅', '🙏', '🚶'];
const REVIEW_HOUR = 19; // da quest'ora compare il bilancio di fine giornata

/* ---------- Utilità ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/* ---------- Date (chiavi "AAAA-MM-GG" in ora locale) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => keyOf(new Date());
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const fmtLong = (k) => parseKey(k).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtWeekday = (k) => parseKey(k).toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
const fmtDayNum = (k) => parseKey(k).getDate();

function fmtMin(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}:${pad(m)}` : `${m}`) + `:${pad(sec)}`;
}

/* ---------- Stato e salvataggio ---------- */
function defaults() {
  return { version: 1, habits: [], days: {}, settings: { studyGoal: 120 }, timer: null };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Dati non leggibili', e); }
  return defaults();
}
function normalize(s) {
  const d = defaults();
  if (!s || typeof s !== 'object') return d;
  return {
    ...d,
    ...s,
    habits: Array.isArray(s.habits) ? s.habits : [],
    days: s.days && typeof s.days === 'object' ? s.days : {},
    settings: { ...d.settings, ...(s.settings || {}) },
  };
}
let state = load();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('⚠️ Impossibile salvare i dati'); }
}

const day = (k) => state.days[k] || {};
const dayW = (k) => state.days[k] || (state.days[k] = {});

/* ---------- Stato dell'interfaccia ---------- */
let viewKey = todayKey();
let lastToday = todayKey();
let tab = 'oggi';
let editingTop3 = false;

/* ---------- Logica: abitudini ---------- */
const habitsFor = (k) => state.habits.filter((h) => h.created <= k);
const habitDone = (h, k) => !!(day(k).habits || {})[h.id];

function toggleHabit(id, k) {
  const d = dayW(k);
  d.habits = d.habits || {};
  if (d.habits[id]) delete d.habits[id]; else d.habits[id] = true;
  save();
}

/* Streak: giorni consecutivi fino a oggi (se oggi non è ancora fatto, si conta da ieri). */
function currentStreak(test) {
  let k = todayKey();
  if (!test(k)) k = addDays(k, -1);
  let n = 0;
  while (test(k)) { n++; k = addDays(k, -1); }
  return n;
}
function bestStreak(test, from) {
  let best = 0, cur = 0;
  const end = todayKey();
  for (let k = from; k <= end; k = addDays(k, 1)) {
    if (test(k)) { cur++; if (cur > best) best = cur; } else cur = 0;
  }
  return best;
}
function firstKey() {
  const keys = Object.keys(state.days).concat(state.habits.map((h) => h.created));
  return keys.length ? keys.sort()[0] : todayKey();
}
const countDone = (h, endKey, n) => {
  let c = 0;
  for (let i = 0; i < n; i++) if (habitDone(h, addDays(endKey, -i))) c++;
  return c;
};

/* ---------- Logica: studio ---------- */
const studyGoal = (k) => day(k).goal ?? state.settings.studyGoal;
const studyMin = (k) => day(k).study || 0;
const studyMet = (k) => studyGoal(k) > 0 && studyMin(k) >= studyGoal(k);

function addStudy(k, min) {
  const d = dayW(k);
  if (d.goal == null) d.goal = state.settings.studyGoal;
  d.study = Math.max(0, (d.study || 0) + min);
  save();
}

/* ---------- Logica: 3 non negoziabili ---------- */
const top3 = (k) => (Array.isArray(day(k).top3) && day(k).top3.length ? day(k).top3 : null);
const top3Met = (k) => { const t = top3(k); return !!t && t.every((i) => i.done); };

/* ---------- Componenti ---------- */
const bar = (pct, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${clamp(pct, 0, 100)}%"></span></div>`;
const streakTag = (n) => `<span class="streak ${n ? '' : 'zero'}">🔥 ${n} ${n === 1 ? 'giorno' : 'giorni'}</span>`;

/* ---------- Render ---------- */
function render() {
  renderTopbar();
  const main = $('#main');
  if (tab === 'oggi') main.innerHTML = viewToday();
  else if (tab === 'progressi') main.innerHTML = viewProgress();
  else main.innerHTML = viewSettings();
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  tickTimer();
}

function renderTopbar() {
  const tb = $('#topbar');
  if (tab !== 'oggi') {
    const title = tab === 'progressi' ? 'I tuoi progressi' : 'Impostazioni';
    tb.innerHTML = `<div class="topbar-inner"><h1>${title}</h1></div>`;
    return;
  }
  const t = todayKey();
  const isToday = viewKey === t;
  const label = isToday ? 'Oggi' : viewKey === addDays(t, -1) ? 'Ieri' : 'Giorno passato';
  tb.innerHTML = `
    <div class="topbar-inner">
      <button class="icon-btn" data-action="prev-day" aria-label="Giorno precedente">‹</button>
      <div class="date-title">
        <small>${label}${isToday ? '' : ` · <button class="today-link" data-action="go-today">Torna a oggi</button>`}</small>
        <strong>${esc(fmtLong(viewKey))}</strong>
      </div>
      <button class="icon-btn" data-action="next-day" aria-label="Giorno successivo" ${isToday ? 'disabled' : ''}>›</button>
    </div>`;
}

/* ----- Vista "Oggi" ----- */
function viewToday() {
  const k = viewKey;
  const habits = habitsFor(k);
  const t3 = top3(k);

  // Percentuali per il riepilogo
  const pTop3 = t3 ? t3.filter((i) => i.done).length / t3.length : 0;
  const pHab = habits.length ? habits.filter((h) => habitDone(h, k)).length / habits.length : null;
  const pStudy = studyGoal(k) > 0 ? Math.min(1, studyMin(k) / studyGoal(k)) : 0;
  const parts = [pTop3, pStudy].concat(pHab === null ? [] : [pHab]);
  const total = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);

  return `
    <section class="card summary">
      <div class="card-head">
        <h2>Completamento giornata</h2>
        ${total === 100 ? '<span class="pill good">Perfetta! 🌟</span>' : ''}
      </div>
      <div class="big">${total}%</div>
      ${bar(total, total === 100 ? 'good' : '')}
      <div class="summary-parts">
        <div><b>${t3 ? `${t3.filter((i) => i.done).length}/${t3.length}` : '–'}</b>Non negoziabili</div>
        <div><b>${habits.length ? `${habits.filter((h) => habitDone(h, k)).length}/${habits.length}` : '–'}</b>Abitudini</div>
        <div><b>${Math.round(pStudy * 100)}%</b>Studio</div>
      </div>
    </section>
    <section class="card" id="top3">${top3Section(k)}</section>
    <section class="card" id="habits">${habitsSection(k, habits)}</section>
    <section class="card" id="study">${studySection(k)}</section>`;
}

function top3Section(k) {
  const t = top3(k);
  const isToday = k === todayKey();
  const head = `<div class="card-head"><h2>🎯 Le 3 non negoziabili</h2>${t && !editingTop3 ? '<button class="link-btn" data-action="edit-top3">Modifica</button>' : ''}</div>`;

  if (!t || editingTop3) {
    const vals = t ? t.map((i) => i.text) : [];
    const ph = ['Es. Finire il capitolo 3', 'Es. 30 minuti di corsa', 'Es. Chiamare la nonna'];
    return `${head}
      <p class="hint">${isToday ? 'Inizia la giornata: quali sono le 3 cose che farai oggi, costi quel che costi?' : 'Le priorità che avevi per questo giorno.'}</p>
      <form id="top3-form" class="top3-form">
        ${[0, 1, 2].map((i) => `
          <label class="num-input"><span>${i + 1}</span>
            <input name="t${i}" maxlength="80" value="${esc(vals[i] || '')}" placeholder="${ph[i]}" autocomplete="off" enterkeyhint="${i < 2 ? 'next' : 'done'}">
          </label>`).join('')}
        <div class="row">
          <button class="btn primary" type="submit">Fissa le priorità</button>
          ${t ? '<button class="btn ghost" type="button" data-action="cancel-top3">Annulla</button>' : ''}
        </div>
      </form>`;
  }

  const done = t.filter((i) => i.done).length;
  const items = t.map((it, i) => `
    <li><button class="check-row ${it.done ? 'done' : ''}" data-action="toggle-top3" data-i="${i}" aria-pressed="${it.done}">
      <span class="num">${i + 1}</span>
      <span class="label">${esc(it.text)}</span>
      <span class="box" aria-hidden="true">✓</span>
    </button></li>`).join('');

  // Bilancio di fine giornata
  let review = '';
  const showReview = k < todayKey() || new Date().getHours() >= REVIEW_HOUR || done === t.length;
  if (showReview) {
    const missing = t.filter((i) => !i.done);
    if (!missing.length) {
      review = `<div class="review win"><strong>🏆 Giornata vinta!</strong>Hai completato tutte le non negoziabili. Ottimo lavoro.</div>`;
    } else if (k < todayKey()) {
      review = `<div class="review"><strong>📋 Bilancio: ${done} su ${t.length}</strong>Non completate:<ul>${missing.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul></div>`;
    } else {
      review = `<div class="review"><strong>🌙 Bilancio di fine giornata: ${done} su ${t.length}</strong>Ti mancano ancora:<ul>${missing.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul></div>`;
    }
  }

  return `${head}
    <ul class="checklist">${items}</ul>
    <div class="bar-label"><span>${done} di ${t.length} completate</span><span>${streakTag(currentStreak(top3Met))}</span></div>
    ${bar((done / t.length) * 100, done === t.length ? 'good' : '')}
    ${review}`;
}

function habitsSection(k, habits) {
  const head = `<div class="card-head"><h2>✅ Abitudini</h2><button class="link-btn" data-action="add-habit">+ Nuova</button></div>`;
  if (!habits.length) {
    return `${head}<div class="empty"><div class="ico">🌱</div><p>Nessuna abitudine ancora.<br>Aggiungi la prima per iniziare a costruire la tua streak.</p>
      <button class="btn primary" data-action="add-habit">+ Aggiungi abitudine</button></div>`;
  }
  const done = habits.filter((h) => habitDone(h, k)).length;
  const items = habits.map((h) => {
    const d = habitDone(h, k);
    const week = countDone(h, k, 7);
    return `<li><button class="check-row ${d ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}" aria-pressed="${d}">
      <span class="habit-body">
        <span class="habit-name">${esc(h.emoji || '✅')} ${esc(h.name)}</span>
        <span class="habit-meta">${streakTag(currentStreak((x) => habitDone(h, x)))}<span>${week}/7 negli ultimi 7 giorni</span></span>
        ${bar((week / 7) * 100, 'thin good')}
      </span>
      <span class="box" aria-hidden="true">✓</span>
    </button></li>`;
  }).join('');
  return `${head}
    <ul class="checklist">${items}</ul>
    <div class="bar-label"><span>${done} di ${habits.length} fatte</span><span>${Math.round((done / habits.length) * 100)}%</span></div>
    ${bar((done / habits.length) * 100, done === habits.length ? 'good' : '')}`;
}

function studySection(k) {
  const m = studyMin(k), g = studyGoal(k), met = studyMet(k);
  const isToday = k === todayKey();
  const running = !!state.timer;
  const timer = isToday ? `
    <div class="timer ${running ? 'running' : ''}">
      <span class="time" id="timer-display">${running ? fmtClock(Date.now() - state.timer.start) : '⏱ Cronometro'}</span>
      ${running
        ? '<button class="btn primary small" data-action="timer-stop">⏹ Ferma e salva</button>'
        : '<button class="btn small" data-action="timer-start">▶ Avvia</button>'}
    </div>` : '';
  return `
    <div class="card-head"><h2>📚 Studio</h2><span class="pill ${met ? 'good' : ''}">Obiettivo ${fmtMin(g)}</span></div>
    <div class="study-now"><strong>${fmtMin(m)}</strong><span class="muted">di ${fmtMin(g)}</span></div>
    <div style="margin-top:10px">${bar(g ? (m / g) * 100 : 0, met ? 'good' : '')}</div>
    <div class="study-status ${met ? 'win' : ''}">${met ? '🎉 Obiettivo giornaliero raggiunto!' : `Ti mancano ${fmtMin(g - m)} per l'obiettivo`}
      · ${streakTag(currentStreak(studyMet))}</div>
    ${timer}
    <div class="quick">
      <button class="btn" data-action="study" data-min="-15" ${m <= 0 ? 'disabled' : ''}>−15</button>
      <button class="btn" data-action="study" data-min="15">+15</button>
      <button class="btn" data-action="study" data-min="30">+30</button>
      <button class="btn" data-action="study" data-min="60">+1 h</button>
    </div>
    <form class="custom-add" id="study-form">
      <input type="number" name="min" inputmode="numeric" min="1" max="1440" placeholder="Minuti studiati" aria-label="Minuti studiati">
      <button class="btn primary" type="submit">Aggiungi</button>
    </form>`;
}

/* ----- Vista "Progressi" ----- */
function viewProgress() {
  const t = todayKey();
  const from = firstKey();
  const allHabitsDone = (k) => { const hs = habitsFor(k); return hs.length > 0 && hs.every((h) => habitDone(h, k)); };

  const stat = (ico, label, test) => `
    <div class="stat"><div class="v">${currentStreak(test)}</div><div class="l">${ico} ${label}</div>
    <div class="r">Record: ${bestStreak(test, from)}</div></div>`;

  // Grafico studio ultimi 7 giorni
  const days7 = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const maxV = Math.max(state.settings.studyGoal, ...days7.map(studyMin), 1);
  const total7 = days7.reduce((a, k) => a + studyMin(k), 0);
  const goalPct = (state.settings.studyGoal / maxV) * 100;
  const cols = days7.map((k) => {
    const v = studyMin(k);
    const h = (v / maxV) * 100;
    return `<div class="col"><span class="cv">${v ? fmtMin(v).replace(' min', '′') : ''}</span>
      <div class="colbar ${v ? (studyMet(k) ? 'good' : '') : 'empty'}" style="height:${Math.max(h, 2)}%"></div></div>`;
  }).join('');

  // Abitudini
  const habits = state.habits;
  const habitCards = habits.length ? habits.map((h) => {
    const cells = [...Array(28)].map((_, i) => {
      const k = addDays(t, i - 27);
      const cls = k < h.created ? 'off' : habitDone(h, k) ? 'on' : '';
      return `<i class="${cls} ${k === t ? 'today' : ''}" title="${esc(fmtLong(k))}"></i>`;
    }).join('');
    const span = Math.min(30, Math.round((parseKey(t) - parseKey(h.created)) / 86400000) + 1);
    const pct = span > 0 ? Math.round((countDone(h, t, span) / span) * 100) : 0;
    const test = (x) => habitDone(h, x);
    return `<div class="habit-stat">
      <div class="top"><span>${esc(h.emoji || '✅')} ${esc(h.name)}</span><span>${streakTag(currentStreak(test))}</span></div>
      <div class="bar-label"><span>${span === 1 ? 'Oggi' : `Ultimi ${span} giorni`}: ${pct}%</span><span>Record: ${bestStreak(test, h.created)}</span></div>
      ${bar(pct, 'thin good')}
      <div class="heat">${cells}</div>
    </div>`;
  }).join('') : '<p class="muted">Aggiungi un\'abitudine dalla schermata Oggi per vederne i progressi.</p>';

  // Non negoziabili ultimi 14 giorni
  const days14 = [...Array(14)].map((_, i) => addDays(t, i - 13)).map((k) => {
    const x = top3(k);
    const done = x ? x.filter((i) => i.done).length : 0;
    const cls = !x ? 'none' : done === x.length ? 'win' : '';
    return `<div class="day-dot ${cls}"><b>${x ? `${done}/${x.length}` : '–'}</b>${fmtWeekday(k)} ${fmtDayNum(k)}</div>`;
  }).join('');

  return `
    <section class="card">
      <div class="card-head"><h2>🔥 Streak attuali</h2></div>
      <div class="stats">
        ${stat('🎯', 'Non negoziabili', top3Met)}
        ${stat('📚', 'Studio', studyMet)}
        ${stat('✅', 'Abitudini 100%', allHabitsDone)}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>📚 Studio · ultimi 7 giorni</h2><span class="pill">${fmtMin(total7)}</span></div>
      <p class="hint">Media: ${fmtMin(total7 / 7)} al giorno · la linea tratteggiata è il tuo obiettivo.</p>
      <div class="chart">${cols}<div class="goal-line" style="bottom:${goalPct}%"></div></div>
      <div class="chart-days">${days7.map((k) => `<span>${k === t ? 'oggi' : fmtWeekday(k)}</span>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>✅ Abitudini · ultime 4 settimane</h2></div>
      ${habitCards}
    </section>
    <section class="card">
      <div class="card-head"><h2>🎯 Non negoziabili · ultimi 14 giorni</h2></div>
      <div class="days14">${days14}</div>
    </section>`;
}

/* ----- Vista "Impostazioni" ----- */
function viewSettings() {
  const list = state.habits.length
    ? `<ul class="manage-list">${state.habits.map((h) => `
        <li><span class="name">${esc(h.emoji || '✅')} ${esc(h.name)}</span>
          <button class="btn small" data-action="rename-habit" data-id="${h.id}">Modifica</button>
          <button class="btn small danger" data-action="delete-habit" data-id="${h.id}" aria-label="Elimina ${esc(h.name)}">Elimina</button></li>`).join('')}</ul>`
    : '<p class="muted">Nessuna abitudine.</p>';
  return `
    <section class="card">
      <div class="card-head"><h2>📚 Obiettivo di studio</h2></div>
      <p class="hint">Quanti minuti vuoi studiare ogni giorno?</p>
      <form class="setting" id="goal-form">
        <input type="number" name="goal" inputmode="numeric" min="5" max="1440" step="5" value="${state.settings.studyGoal}" aria-label="Minuti al giorno">
        <span class="muted">minuti</span><span class="spacer"></span>
        <button class="btn primary" type="submit">Salva</button>
      </form>
    </section>
    <section class="card">
      <div class="card-head"><h2>✅ Le tue abitudini</h2><button class="link-btn" data-action="add-habit">+ Nuova</button></div>
      ${list}
    </section>
    <section class="card">
      <div class="card-head"><h2>📲 Installa sul telefono</h2></div>
      <p class="hint">Aggiungila alla schermata Home: si apre come un'app e i dati restano più al sicuro.</p>
      <b>iPhone (Safari)</b>
      <ol class="steps"><li>Tocca il pulsante Condividi ⬆️</li><li>Scegli «Aggiungi alla schermata Home»</li></ol>
      <b style="display:block;margin-top:10px">Android (Chrome)</b>
      <ol class="steps"><li>Tocca il menu ⋮</li><li>Scegli «Installa app» o «Aggiungi a schermata Home»</li></ol>
    </section>
    <section class="card">
      <div class="card-head"><h2>💾 Backup</h2></div>
      <p class="hint">I dati sono salvati solo su questo dispositivo. Esporta un backup ogni tanto per non perderli.</p>
      <div class="row">
        <button class="btn" data-action="export">⬇️ Esporta</button>
        <label class="btn" style="display:inline-flex;align-items:center">⬆️ Importa
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </label>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>⚠️ Zona pericolo</h2></div>
      <button class="btn danger block" data-action="reset">Cancella tutti i dati</button>
    </section>`;
}

/* ---------- Dialog abitudine ---------- */
const dialog = $('#habit-dialog');
const habitForm = $('#habit-form');
$('#emoji-grid').innerHTML = EMOJIS.map((e, i) => `
  <label><input type="radio" name="emoji" value="${e}" ${i === 0 ? 'checked' : ''}><span>${e}</span></label>`).join('');

function openHabitDialog(habit) {
  habitForm.reset();
  dialog.dataset.editId = habit ? habit.id : '';
  $('#habit-dialog-title').textContent = habit ? 'Modifica abitudine' : 'Nuova abitudine';
  $('#habit-submit').textContent = habit ? 'Salva' : 'Aggiungi';
  if (habit) {
    habitForm.name.value = habit.name;
    const r = habitForm.querySelector(`input[name=emoji][value="${CSS.escape(habit.emoji || '✅')}"]`);
    if (r) r.checked = true;
  }
  dialog.showModal();
  setTimeout(() => habitForm.name.focus(), 50);
}

dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'ok') return;
  const name = habitForm.name.value.trim();
  if (!name) return;
  const emoji = habitForm.emoji.value || '✅';
  const id = dialog.dataset.editId;
  if (id) {
    const h = state.habits.find((x) => x.id === id);
    if (h) { h.name = name; h.emoji = emoji; }
    toast('Abitudine aggiornata');
  } else {
    // Creata "oggi" o nel giorno che stai guardando, se è nel passato
    const created = tab === 'oggi' && viewKey < todayKey() ? viewKey : todayKey();
    state.habits.push({ id: uid(), name, emoji, created });
    toast(`${emoji} ${name} aggiunta`);
  }
  save();
  render();
});

/* ---------- Azioni ---------- */
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tab');
  if (tabBtn) {
    tab = tabBtn.dataset.tab;
    editingTop3 = false;
    render();
    window.scrollTo({ top: 0 });
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const t = todayKey();

  switch (a) {
    case 'prev-day': viewKey = addDays(viewKey, -1); editingTop3 = false; break;
    case 'next-day': if (viewKey < t) viewKey = addDays(viewKey, 1); editingTop3 = false; break;
    case 'go-today': viewKey = t; editingTop3 = false; break;

    case 'toggle-habit':
      toggleHabit(el.dataset.id, viewKey);
      vibrate();
      break;

    case 'toggle-top3': {
      const items = top3(viewKey);
      const it = items && items[Number(el.dataset.i)];
      if (!it) return;
      it.done = !it.done;
      save();
      vibrate();
      if (items.every((i) => i.done)) toast('🏆 Tutte e 3 completate!');
      break;
    }
    case 'edit-top3': editingTop3 = true; break;
    case 'cancel-top3': editingTop3 = false; break;

    case 'study': {
      const before = studyMet(viewKey);
      addStudy(viewKey, Number(el.dataset.min));
      if (!before && studyMet(viewKey)) toast('🎉 Obiettivo di studio raggiunto!');
      break;
    }
    case 'timer-start':
      state.timer = { start: Date.now() };
      save();
      break;
    case 'timer-stop': stopTimer(); break;

    case 'add-habit': openHabitDialog(null); return;
    case 'rename-habit': {
      const h = state.habits.find((x) => x.id === el.dataset.id);
      if (h) openHabitDialog(h);
      return;
    }
    case 'delete-habit': {
      const h = state.habits.find((x) => x.id === el.dataset.id);
      if (!h || !confirm(`Eliminare «${h.name}» e tutto il suo storico?`)) return;
      state.habits = state.habits.filter((x) => x.id !== h.id);
      Object.values(state.days).forEach((d) => { if (d.habits) delete d.habits[h.id]; });
      save();
      toast('Abitudine eliminata');
      break;
    }

    case 'export': exportData(); return;
    case 'reset':
      if (!confirm('Cancellare davvero TUTTI i dati? L\'operazione non si può annullare.')) return;
      state = defaults();
      save();
      viewKey = t;
      toast('Dati cancellati');
      break;
    default: return;
  }
  render();
});

document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.id === 'top3-form') {
    e.preventDefault();
    const old = top3(viewKey) || [];
    const items = [0, 1, 2]
      .map((i) => f[`t${i}`].value.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: !!(old.find((o) => o.text === text) || {}).done }));
    if (!items.length) { toast('Scrivi almeno una priorità'); return; }
    dayW(viewKey).top3 = items;
    editingTop3 = false;
    save();
    toast('🎯 Priorità fissate. Forza!');
    render();
  } else if (f.id === 'study-form') {
    e.preventDefault();
    const m = Math.round(Number(f.min.value));
    if (!m || m < 1) { toast('Inserisci i minuti studiati'); return; }
    const before = studyMet(viewKey);
    addStudy(viewKey, Math.min(m, 1440));
    toast(!before && studyMet(viewKey) ? '🎉 Obiettivo di studio raggiunto!' : `+${fmtMin(m)} di studio`);
    render();
  } else if (f.id === 'goal-form') {
    e.preventDefault();
    const g = clamp(Math.round(Number(f.goal.value)) || 0, 5, 1440);
    state.settings.studyGoal = g;
    dayW(todayKey()).goal = g; // vale da oggi in poi, i giorni passati restano invariati
    save();
    toast(`Obiettivo: ${fmtMin(g)} al giorno`);
    render();
  }
});

// Invio sui campi delle priorità: passa al campo successivo
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const inp = e.target;
  if (!inp.form || inp.form.id !== 'top3-form') return;
  const n = Number(inp.name.slice(1));
  if (n < 2) { e.preventDefault(); inp.form[`t${n + 1}`].focus(); }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'import-file' && e.target.files[0]) importData(e.target.files[0]);
});

/* ---------- Cronometro ---------- */
function stopTimer() {
  if (!state.timer) return;
  const ms = Date.now() - state.timer.start;
  const startKey = keyOf(new Date(state.timer.start));
  state.timer = null;
  const min = Math.round(ms / 60000);
  if (min < 1) { save(); toast('Sessione troppo breve, non salvata'); return; }
  const before = studyMet(startKey);
  addStudy(startKey, min);
  toast(!before && studyMet(startKey) ? '🎉 Obiettivo di studio raggiunto!' : `+${fmtMin(min)} di studio salvati`);
}
function tickTimer() {
  const el = $('#timer-display');
  if (el && state.timer) el.textContent = fmtClock(Date.now() - state.timer.start);
}
setInterval(tickTimer, 1000);

/* ---------- Backup ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `abitudini-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup esportato');
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || !Array.isArray(data.habits) || typeof data.days !== 'object') throw new Error('formato');
      if (!confirm('Sostituire i dati attuali con quelli del backup?')) return;
      state = normalize(data);
      save();
      toast('Backup importato ✔︎');
      render();
    } catch (err) {
      toast('File non valido');
    }
  };
  r.readAsText(file);
}

/* ---------- Varie ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function vibrate() { try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* niente */ } }

// Se l'app resta aperta oltre la mezzanotte, passa automaticamente al nuovo giorno
function checkNewDay() {
  const t = todayKey();
  if (t !== lastToday) {
    if (viewKey === lastToday) viewKey = t;
    lastToday = t;
    render();
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkNewDay(); render(); } });
setInterval(checkNewDay, 60 * 1000);

// Chiede al browser di non cancellare i dati in caso di poco spazio
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Funzionamento offline
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render();
