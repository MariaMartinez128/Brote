'use strict';
/* Brote · cliente. JavaScript nativo, sin framework. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'; } catch { return 'Europe/Madrid'; } })();
const dayStr = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* */ } } };

const MOODS = { feliz: { e: '😄', n: 'Feliz' }, motivado: { e: '🚀', n: 'Motivado' }, tranquilo: { e: '😌', n: 'Tranquilo' }, cansado: { e: '😴', n: 'Cansado' }, triste: { e: '😔', n: 'Triste' } };
const S = { me: null, tasks: [], city: null, scens: {}, stats: null, filter: 'today', moodToday: null, busy: new Set(), view: 'dash', pomoDone: { n: 0, min: 0 } };

/* ---------- red ---------- */
async function api(path, { method = 'GET', body, raw } = {}) {
  const opts = { method, headers: { 'X-Timezone': TZ }, credentials: 'same-origin' };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch('/api' + path, opts); } catch { throw new Error('Sin conexión con el servidor. Revisa tu internet.'); }
  if (res.status === 401 && !path.startsWith('/auth/')) { showAuth(); throw new Error('Tu sesión ha caducado. Inicia sesión de nuevo.'); }
  if (raw) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Error inesperado (' + res.status + ')');
  return data;
}

/* ---------- avisos y diálogos ---------- */
function toast(msg, good) {
  const t = document.createElement('div');
  t.className = 'toast' + (good ? ' good' : ''); t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), good ? 3000 : 5000);
}
const fail = e => toast(e.message || String(e));

// Diálogo genérico (sustituye a alert/confirm/prompt). fields: [{name,label,type,value,options,required,max}]
function ask({ title, text = '', html = '', ok = 'Aceptar', danger = false, cancel = 'Cancelar', fields = [] }) {
  return new Promise(resolve => {
    const dlg = $('#dlg'), form = $('#dlgForm');
    $('#dlgTitle').textContent = title;
    $('#dlgBody').innerHTML = (text ? `<p class="muted">${esc(text)}</p>` : '') + html + fields.map(f => {
      const id = 'f_' + f.name;
      const input = f.type === 'select'
        ? `<select id="${id}">${f.options.map(o => `<option value="${esc(o.v)}" ${o.v === f.value ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`
        : f.type === 'checkbox' ? `<label class="inline"><input id="${id}" type="checkbox" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`
        : `<input id="${id}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.max ? `maxlength="${f.max}"` : ''} autocomplete="off">`;
      return f.type === 'checkbox' ? `<div style="margin-top:.7rem">${input}</div>` : `<label for="${id}">${esc(f.label)}</label>${input}`;
    }).join('');
    const okBtn = $('#dlgOk'), cancelBtn = $('#dlgCancel');
    okBtn.textContent = ok; okBtn.className = danger ? 'bad' : ''; cancelBtn.textContent = cancel; cancelBtn.classList.toggle('hidden', cancel === null);
    let result = null;
    const finish = () => { form.onsubmit = null; cancelBtn.onclick = null; dlg.onclose = null; resolve(result); };
    form.onsubmit = e => {
      e.preventDefault();
      result = fields.length ? Object.fromEntries(fields.map(f => { const el = $('#f_' + f.name); return [f.name, f.type === 'checkbox' ? el.checked : el.value]; })) : true;
      dlg.close();
    };
    cancelBtn.onclick = () => dlg.close();
    dlg.onclose = finish;
    dlg.showModal();
    (dlg.querySelector('input,select') || okBtn).focus();
  });
}
const confirmar = (title, text, ok = 'Confirmar', danger = true) => ask({ title, text, ok, danger });

// Ejecuta una acción deshabilitando el botón y mostrando un indicador (evita dobles clics)
async function busy(btn, fn) {
  if (btn.disabled) return;
  const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try { return await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; btn.innerHTML = label; }
}

/* ---------- navegación ---------- */
const VIEWS = ['dash', 'tasks', 'pomo', 'city', 'scen', 'mood', 'stats', 'cfg', 'admin'];
function show(v) {
  if (v === 'admin' && S.me?.role !== 'admin') v = 'dash';
  S.view = v;
  VIEWS.forEach(x => $('#v-' + x).classList.toggle('hidden', x !== v));
  $$('nav button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const loaders = { dash: loadDashData, tasks: loadTasks, pomo: loadTasks, city: loadCity, mood: loadMood, stats: loadStats, admin: loadAdmin, cfg: renderCfg };
  loaders[v]?.();
  renderAll();
  window.scrollTo(0, 0);
}

/* ---------- acceso ---------- */
let authMode = 'login', resetToken = null, googleOn = false;
function setAuthMode(m) {
  authMode = m;
  const reg = m === 'register', forgot = m === 'forgot', reset = m === 'reset';
  $$('#authTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === m));
  $('#authTabs').classList.toggle('hidden', forgot || reset);
  $('#nameRow').classList.toggle('hidden', !reg);
  $('#mailRow').classList.toggle('hidden', reset);
  $('#aMail').required = !reset;
  $('#passRow').classList.toggle('hidden', forgot);
  $('#aPass').required = !forgot;
  $('#aPassLbl').textContent = reset ? 'Nueva contraseña' : 'Contraseña';
  $('#aPass').autocomplete = reg || reset ? 'new-password' : 'current-password';
  $('#passHint').classList.toggle('hidden', !(reg || reset));
  $('#authBtn').textContent = { login: 'Entrar', register: 'Crear cuenta', forgot: 'Enviarme el enlace', reset: 'Guardar contraseña' }[m];
  $('#forgotBtn').classList.toggle('hidden', m !== 'login');
  $('#backBtn').classList.toggle('hidden', !(forgot || reset));
  $('#googleWrap').classList.toggle('hidden', !(googleOn && (m === 'login' || m === 'register')));
  $('#authMsg').textContent = '';
}
function showAuth() { S.me = null; $('#boot').classList.add('hidden'); $('#app').classList.add('hidden'); $('#auth').classList.remove('hidden'); }
$$('#authTabs button').forEach(b => b.onclick = () => setAuthMode(b.dataset.t));
$('#forgotBtn').onclick = () => setAuthMode('forgot');
$('#backBtn').onclick = () => { resetToken = null; history.replaceState(null, '', location.pathname); setAuthMode('login'); };
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const msg = $('#authMsg'); msg.style.color = 'var(--bad)'; msg.textContent = '';
  const email = $('#aMail').value.trim(), password = $('#aPass').value;
  await busy($('#authBtn'), async () => {
    try {
      if (authMode === 'register') {
        const r = await api('/auth/register', { method: 'POST', body: { name: $('#aName').value, email, password } });
        msg.style.color = 'var(--ok)'; msg.textContent = r.mensaje;
        if (r.confirmada) { setAuthMode('login'); $('#authMsg').style.color = 'var(--ok)'; $('#authMsg').textContent = r.mensaje; }
      } else if (authMode === 'forgot') {
        const r = await api('/auth/forgot', { method: 'POST', body: { email } });
        msg.style.color = 'var(--ok)'; msg.textContent = r.mensaje;
      } else if (authMode === 'reset') {
        const r = await api('/auth/reset', { method: 'POST', body: { token: resetToken, password } });
        resetToken = null; history.replaceState(null, '', location.pathname); setAuthMode('login');
        $('#authMsg').style.color = 'var(--ok)'; $('#authMsg').textContent = r.mensaje;
      } else {
        await api('/auth/login', { method: 'POST', body: { email, password } });
        $('#aPass').value = ''; await enter();
      }
    } catch (err) { msg.textContent = err.message; }
  });
};


/* ---------- Google (Google Identity Services) ---------- */
async function onGoogle(resp) {
  const msg = $('#authMsg'); msg.style.color = 'var(--bad)'; msg.textContent = '';
  try {
    const r = await api('/auth/google', { method: 'POST', body: { credential: resp.credential } });
    await enter(); if (r.aviso) toast(r.aviso, true);
  } catch (e) { msg.textContent = e.message; }
}
async function initGoogle() {
  try {
    const cfg = await api('/auth/config'); if (!cfg.googleClientId) return;
    await new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = ok; sc.onerror = ko; document.head.append(sc); });
    google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onGoogle, ux_mode: 'popup' });
    google.accounts.id.renderButton($('#googleBtn'), { theme: 'outline', size: 'large', text: 'continue_with', locale: 'es', width: 320 });
    googleOn = true; setAuthMode(authMode);
  } catch { /* sin Google: el acceso con correo y contraseña sigue funcionando */ }
}

/* ---------- carga inicial ---------- */
async function enter() {
  const [{ user }, scens] = await Promise.all([api('/auth/me'), S.scens.huerto ? S.scens : api('/scenarios')]);
  S.scens = scens; S.me = user;
  const u = await api('/user'); S.me = { ...user, ...u };
  $('#auth').classList.add('hidden'); $('#boot').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#navAdmin').classList.toggle('hidden', user.role !== 'admin');
  $('#who').textContent = user.name + (user.role === 'admin' ? ' · admin' : '');
  initMoodUI(); pomoInit();
  await Promise.all([loadTasks(true), loadCity(true)]);
  show('dash');
}
async function loadDashData() { try { await loadMood(true); } catch { /* el panel sigue funcionando sin ánimo */ } try { S.stats = await api('/user/stats'); renderLevel(); } catch { /* */ } }
function renderLevel() { if (S.stats) $('#navLvl').textContent = `Nivel ${S.stats.nivel} · ${S.stats.xp} XP`; }

/* ---------- tareas ---------- */
const today = () => dayStr();
const isToday = t => t.status === 'pending' ? (!t.dueDate || t.dueDate <= today()) : t.statusDay === today();
const FILTERS = { today: ['Hoy', isToday], pending: ['Pendientes', t => t.status === 'pending'], done: ['Hechas', t => t.status !== 'pending'], all: ['Todas', () => true] };
async function loadTasks(quiet) { try { S.tasks = await api('/tasks'); } catch (e) { if (!quiet) fail(e); } renderTasks(); renderPomoTasks(); }
function renderTasks() {
  $('#taskTabs').innerHTML = Object.entries(FILTERS).map(([k, [n, f]]) =>
    `<button data-f="${k}" role="tab" aria-selected="${S.filter === k}" class="${S.filter === k ? 'on' : ''}">${n} (${S.tasks.filter(f).length})</button>`).join('');
  const list = S.tasks.filter(FILTERS[S.filter][1]).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.dueDate || '9') .localeCompare(b.dueDate || '9'));
  const box = $('#taskList');
  if (!list.length) {
    const msg = { today: ['🌤️', 'No tienes nada para hoy. ¡Añade una tarea y planta tu primer brote!'], pending: ['✅', 'No tienes tareas pendientes.'], done: ['📭', 'Todavía no has completado ni fallado ninguna tarea.'], all: ['📝', 'Aún no hay tareas. Escribe la primera arriba.'] }[S.filter];
    box.innerHTML = `<div class="empty"><span class="ico">${msg[0]}</span>${msg[1]}</div>`; return;
  }
  const t = today();
  box.innerHTML = list.map(k => {
    const b = S.busy.has(k._id) ? 'disabled' : '';
    const due = k.dueDate ? (k.status === 'pending' && k.dueDate < t ? `<span class="tag off">⏰ Vencida (${esc(k.dueDate)})</span>` : `<span class="tag warn">📅 ${k.dueDate === t ? 'Hoy' : esc(k.dueDate)}</span>`) : '';
    const acts = k.status === 'pending'
      ? `<button class="ok" data-a="done" ${b}>Completar</button><button class="bad" data-a="failed" ${b}>Fallida</button>`
      : `<button class="alt" data-a="pending" ${b}>Desmarcar</button>`;
    return `<div class="task ${k.status}" data-id="${esc(k._id)}"><div class="t"><b>${esc(k.title)}</b></div>
      <span class="tag">${esc(k.type)}</span>${k.repeat === 'daily' ? '<span class="tag">↻ Diaria</span>' : ''}${due}
      <div class="acts">${acts}<button class="alt" data-a="edit" ${b} aria-label="Editar">✏️</button><button class="alt" data-a="del" ${b} aria-label="Eliminar">🗑️</button></div></div>`;
  }).join('');
}
$('#taskTabs').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { S.filter = b.dataset.f; renderTasks(); } };
$('#taskForm').onsubmit = async e => {
  e.preventDefault();
  const title = $('#tTitle').value.trim(); if (!title) return;
  await busy($('#tAdd'), async () => {
    const t = await api('/tasks', { method: 'POST', body: { title, type: $('#tType').value, dueDate: $('#tDue').value || today(), repeat: $('#tRepeat').checked ? 'daily' : 'none' } });
    S.tasks.push(t); $('#tTitle').value = ''; $('#tDue').value = ''; $('#tRepeat').checked = false; renderAll(); $('#tTitle').focus();
  });
};
$('#tType').onchange = () => { if ($('#tType').value === 'Hábito') $('#tRepeat').checked = true; };
$('#taskList').onclick = async e => {
  const btn = e.target.closest('[data-a]'); if (!btn) return;
  const row = btn.closest('.task'), task = S.tasks.find(t => t._id === row.dataset.id); if (!task) return;
  const a = btn.dataset.a;
  if (a === 'del') {
    if (!await confirmar('Eliminar tarea', `"${task.title}" se borrará. Lo que ya ganaste en tu mundo se queda.`, 'Eliminar')) return;
    try { await api('/tasks/' + task._id, { method: 'DELETE' }); S.tasks = S.tasks.filter(t => t._id !== task._id); renderAll(); } catch (er) { fail(er); }
  } else if (a === 'edit') {
    const v = await ask({ title: 'Editar tarea', ok: 'Guardar', fields: [
      { name: 'title', label: 'Título', value: task.title, required: true, max: 200 },
      { name: 'type', label: 'Tipo', type: 'select', value: task.type, options: ['Estudio', 'Trabajo', 'Hábito'].map(x => ({ v: x, t: x })) },
      { name: 'dueDate', label: 'Fecha límite', type: 'date', value: task.dueDate },
      { name: 'repeat', label: 'Repetir cada día', type: 'checkbox', value: task.repeat === 'daily' }] });
    if (!v) return;
    try { const r = await api('/tasks/' + task._id, { method: 'PUT', body: { title: v.title, type: v.type, dueDate: v.dueDate, repeat: v.repeat ? 'daily' : 'none' } }); Object.assign(task, r.task); renderAll(); } catch (er) { fail(er); }
  } else changeStatus(task, a);
};
async function changeStatus(task, status) {
  if (S.busy.has(task._id)) return;
  S.busy.add(task._id); renderTasks();
  try {
    const r = await api('/tasks/' + task._id, { method: 'PUT', body: { status } });
    Object.assign(task, r.task); S.city = r.city;
    const eff = r.effect;
    if (eff?.type === 'full') toast('Tu tablero está lleno: empieza un mundo nuevo desde "Mi mundo".', true);
    if (eff?.completed) { toast('🏆 ¡Has completado tu mundo!', true); }
    if (eff && (eff.type === 'pop' || eff.type === 'boom')) S.lastFx = eff;
    S.stats = null; api('/user/stats').then(s => { S.stats = s; renderLevel(); }).catch(() => {});
    if (S.view === 'city') renderCity();
  } catch (e) { fail(e); loadTasks(true); }
  finally { S.busy.delete(task._id); renderAll(); }
}

/* ---------- mundo ---------- */
const scen = () => S.scens[S.me?.scenario] || S.scens.huerto;
async function loadCity(quiet) { try { S.city = await api('/city'); } catch (e) { if (!quiet) fail(e); } renderCity(); }
function renderCity() {
  const sc = scen(); if (!sc || !S.city) return;
  const cells = S.city.cells, built = cells.filter(Boolean).length, full = built === cells.length;
  $('#cityTitle').textContent = sc.title;
  $('#city').style.background = sc.bg; $('#city').setAttribute('aria-label', `${sc.title}: ${built} de ${cells.length} casillas`);
  const fx = S.lastFx; S.lastFx = null;
  $('#city').innerHTML = cells.map((c, i) => `<div class="${fx && fx.index === i ? fx.type : ''}">${esc(c)}</div>`).join('');
  $('#cBuilt').textContent = built; $('#cBuiltLbl').textContent = sc.built;
  $('#cLost').textContent = S.city.lost; $('#cLostLbl').textContent = sc.lost;
  $('#cityMsg').textContent = sc.tip;
  $('#celebrate').classList.toggle('hidden', !full);
  $('#resetWorld').classList.toggle('hidden', full || !built && !S.city.lost);
}
async function resetCity(btn) {
  await busy(btn, async () => { S.city = await api('/city/reset', { method: 'POST' }); renderCity(); renderAll(); toast('Tablero reiniciado', true); });
}
$('#newWorld').onclick = e => resetCity(e.currentTarget);
$('#resetWorld').onclick = async e => {
  const btn = e.currentTarget;
  if (await confirmar('Reiniciar tablero', 'Se vaciará este tablero y su contador de pérdidas. Tus tareas no cambian.', 'Reiniciar')) resetCity(btn);
};

function renderScens() {
  $('#scens').innerHTML = Object.entries(S.scens).map(([id, s]) =>
    `<button class="scen ${S.me.scenario === id ? 'on' : ''}" data-id="${id}" aria-pressed="${S.me.scenario === id}"><span class="ico">${s.icon}</span><b>${esc(s.name)}</b><small>${S.me.scenario === id ? 'Escenario activo' : 'Jugar aquí'}</small></button>`).join('');
}
$('#scens').onclick = async e => {
  const b = e.target.closest('[data-id]'); if (!b || b.dataset.id === S.me.scenario) return;
  try { const r = await api('/user/scenario', { method: 'PUT', body: { scenario: b.dataset.id } }); S.me.scenario = r.scenario; S.city = r.city; renderAll(); show('city'); } catch (er) { fail(er); }
};

/* ---------- panel ---------- */
function renderDash() {
  const hr = new Date().getHours();
  $('#hello').textContent = `${hr < 6 ? 'Buenas noches' : hr < 13 ? 'Buenos días' : hr < 21 ? 'Buenas tardes' : 'Buenas noches'}, ${S.me.name} 👋`;
  const hoy = S.tasks.filter(isToday), hechas = hoy.filter(t => t.status === 'done').length, pend = hoy.filter(t => t.status === 'pending').length;
  const pct = hoy.length ? Math.round(hechas / hoy.length * 100) : 0;
  $('#dPct').textContent = pct + '%'; $('#dBar').style.width = pct + '%';
  $('#dTxt').textContent = hoy.length ? `${hechas} de ${hoy.length} tareas de hoy completadas${pend ? ` · te quedan ${pend}` : ' · ¡todo listo!'}` : 'No hay tareas para hoy. Añade alguna en Tareas.';
  const sc = scen();
  if (sc && S.city) { $('#dCityTitle').textContent = sc.icon + ' ' + sc.title; $('#dCity').textContent = S.city.cells.filter(Boolean).length + ' / ' + S.city.cells.length; $('#dCityLbl').textContent = sc.built; }
  $('#dTimer').textContent = fmt((S.me.pomodoro?.work || 25) * 60);
  $('#dSess').textContent = `${S.pomoDone.n} sesiones hoy · ${S.pomoDone.min} min`;
  $('#dQuote').textContent = S.moodToday?.phrase || 'Elige tu estado de ánimo para recibir una frase.';
}
$$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));

/* ---------- Pomodoro (basado en la hora de fin, no en contar ticks) ---------- */
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const MODE_NAMES = { work: 'Concentración', short: 'Descanso corto', long: 'Descanso largo' };
let P = { mode: 'work', endAt: null, left: 0, timer: null };
const dur = m => (S.me?.pomodoro?.[m] || 25) * 60;
const savePomo = () => store.set('brote_pomo', { mode: P.mode, endAt: P.endAt, left: P.left, taskId: $('#pTask').value, day: today() });
function pomoInit() {
  $('#cWork').value = S.me.pomodoro.work; $('#cShort').value = S.me.pomodoro.short; $('#cLong').value = S.me.pomodoro.long;
  S.pomoDone = { n: S.me.sessions || 0, min: S.me.focusMinutes || 0 }; renderPomoCount();
  const saved = store.get('brote_pomo');
  P = { mode: 'work', endAt: null, left: dur('work'), timer: null };
  if (saved && ['work', 'short', 'long'].includes(saved.mode)) {
    P.mode = saved.mode; P.left = saved.left || dur(saved.mode);
    if (saved.endAt) {                          // había un temporizador en marcha antes de recargar la página
      if (saved.endAt > Date.now()) { P.endAt = saved.endAt; tickStart(); }
      else { store.del('brote_pomo'); P.left = dur(P.mode); pomoFinished(saved.mode, saved.taskId); }
    }
  }
  paintPomo();
}
function renderPomoTasks() {
  const sel = $('#pTask'), keep = sel.value || store.get('brote_pomo')?.taskId || '';
  sel.innerHTML = '<option value="">Sin tarea concreta</option>' + S.tasks.filter(t => t.status === 'pending').map(t => `<option value="${esc(t._id)}">${esc(t.title)}</option>`).join('');
  sel.value = keep;
}
function renderPomoCount() { $('#pCount').textContent = S.pomoDone.n; $('#pMin').textContent = S.pomoDone.min; }
function paintPomo() {
  const left = P.endAt ? Math.max(0, Math.ceil((P.endAt - Date.now()) / 1000)) : P.left;
  $('#clock').textContent = fmt(left);
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === P.mode));
  const running = !!P.endAt;
  $('#pStart').disabled = running; $('#pPause').disabled = !running;
  document.title = running ? `${fmt(left)} · ${MODE_NAMES[P.mode]} · Brote` : 'Brote · Productividad gamificada';
  if (S.view === 'dash') $('#dTimer').textContent = fmt(left);
  return left;
}
function tickStart() { clearInterval(P.timer); P.timer = setInterval(() => { if (paintPomo() <= 0) { const mode = P.mode, taskId = $('#pTask').value; pomoStop(); pomoFinished(mode, taskId); } }, 250); }
function pomoStop() { clearInterval(P.timer); P.timer = null; P.endAt = null; P.left = dur(P.mode); store.del('brote_pomo'); paintPomo(); }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, .25, .5].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.value = .15; o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .15); });
  } catch { /* sin audio */ }
}
async function pomoFinished(mode, taskId) {
  beep();
  const msg = mode === 'work' ? '¡Sesión completada! Toca descansar 🎉' : 'Descanso terminado. ¡A por otra sesión!';
  toast(msg, true);
  if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('Brote', { body: msg, icon: '/img/icon.svg' }); } catch { /* */ } }
  if (mode === 'work') {
    try {
      const r = await api('/user/session', { method: 'POST', body: { minutes: S.me.pomodoro.work, taskId: taskId || undefined } });
      S.pomoDone = { n: r.count, min: r.focusMinutes }; renderPomoCount();
      P.mode = r.count % 4 === 0 ? 'long' : 'short';           // cada 4 sesiones, descanso largo
    } catch (e) { fail(e); P.mode = 'short'; }
  } else P.mode = 'work';
  P.left = dur(P.mode); paintPomo(); renderAll();
}
$('#pStart').onclick = () => { if (P.endAt) return; P.endAt = Date.now() + (P.left || dur(P.mode)) * 1000; savePomo(); tickStart(); paintPomo(); };
$('#pPause').onclick = () => { if (!P.endAt) return; P.left = Math.max(1, Math.ceil((P.endAt - Date.now()) / 1000)); clearInterval(P.timer); P.endAt = null; savePomo(); paintPomo(); };
$('#pReset').onclick = () => pomoStop();
$('#pTask').onchange = savePomo;
$('#modes').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; clearInterval(P.timer); P.mode = b.dataset.m; P.endAt = null; P.left = dur(P.mode); store.del('brote_pomo'); paintPomo(); };
$('#pNotif').onclick = async () => {
  if (!('Notification' in window)) return toast('Tu navegador no admite avisos');
  const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Avisos activados' : 'Avisos no permitidos', r === 'granted');
};
$('#cSave').onclick = e => busy(e.currentTarget, async () => {
  const body = { pomodoro: { work: +$('#cWork').value, short: +$('#cShort').value, long: +$('#cLong').value } };
  const u = await api('/user', { method: 'PUT', body }); S.me = { ...S.me, ...u };
  if (!P.endAt) { P.left = dur(P.mode); paintPomo(); }          // no reinicia un temporizador en marcha
  toast('Tiempos guardados', true); renderAll();
});

/* ---------- ánimo ---------- */
let curMood = null;
function initMoodUI() {
  $('#moods').innerHTML = Object.entries(MOODS).map(([k, m]) => `<button data-m="${k}" aria-pressed="false">${m.e}<span>${m.n}</span></button>`).join('');
  const opts = Object.entries(MOODS).map(([k, m]) => `<option value="${k}">${m.e} ${m.n}</option>`).join('');
  $('#phMood').innerHTML = opts; $('#adPhMood').innerHTML = opts;
}
function showMood(r) {
  curMood = r?.mood || null;
  $$('#moods button').forEach(b => { b.classList.toggle('on', b.dataset.m === curMood); b.setAttribute('aria-pressed', b.dataset.m === curMood); });
  $('#moodQuote').textContent = r ? (r.phrase || 'Aún no hay frases para este ánimo. ¡Escribe la tuya!') : 'Selecciona un estado de ánimo.';
  const src = $('#moodSrc'); src.classList.toggle('hidden', !r); if (r) src.textContent = r.own ? '✍️ Frase tuya' : '💡 Frase del sistema';
  $('#moodAgain').classList.toggle('hidden', !r);
}
async function loadMood(onlyToday) {
  S.moodToday = await api('/moods/today'); showMood(S.moodToday ? { ...S.moodToday } : null);
  if (onlyToday) { renderDash(); return; }
  const [st, phr] = await Promise.all([api('/moods/stats'), api('/phrases')]);
  $('#week').innerHTML = st.semana.map(d => {
    const day = new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' });
    return `<div class="${d.mood ? '' : 'none'}" title="${esc(d.date)}">${d.mood ? MOODS[d.mood].e : '·'}<small>${esc(day)}</small></div>`;
  }).join('');
  $('#weekTxt').textContent = `🔥 Racha: ${st.racha} día${st.racha === 1 ? '' : 's'} seguidos` + (st.masComun ? ` · Ánimo más común (30 días): ${MOODS[st.masComun].e} ${MOODS[st.masComun].n}` : '');
  S.phrases = phr; renderPhrases();
}
function renderPhrases() {
  const l = S.phrases || []; $('#phCount').textContent = l.length;
  $('#phList').innerHTML = l.length ? l.map(p => `<div class="phrase" data-id="${esc(p._id)}"><span>${MOODS[p.mood]?.e || ''}</span><span class="tx">${esc(p.text)}</span><button class="alt" data-a="edit">Editar</button><button class="alt" data-a="del">Borrar</button></div>`).join('')
    : '<div class="empty"><span class="ico">✍️</span>Aún no has escrito frases propias.</div>';
}
$('#moods').onclick = async e => {
  const b = e.target.closest('[data-m]'); if (!b) return;
  try { const r = await api('/moods', { method: 'POST', body: { mood: b.dataset.m } }); S.moodToday = r; showMood(r); loadMood(); } catch (er) { fail(er); }
};
$('#moodAgain').onclick = e => busy(e.currentTarget, async () => { const r = await api('/moods/otra', { method: 'POST', body: { mood: curMood } }); S.moodToday = r; showMood(r); });
$('#phForm').onsubmit = async e => {
  e.preventDefault();
  await busy($('#phAdd'), async () => { await api('/phrases', { method: 'POST', body: { text: $('#phText').value, mood: $('#phMood').value } }); $('#phText').value = ''; toast('Frase guardada', true); await loadMood(); });
};
$('#phList').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const p = S.phrases.find(x => x._id === b.closest('.phrase').dataset.id); if (!p) return;
  try {
    if (b.dataset.a === 'del') { if (!await confirmar('Borrar frase', `"${p.text}"`, 'Borrar')) return; await api('/phrases/' + p._id, { method: 'DELETE' }); }
    else {
      const v = await ask({ title: 'Editar frase', ok: 'Guardar', fields: [
        { name: 'mood', label: 'Estado de ánimo', type: 'select', value: p.mood, options: Object.entries(MOODS).map(([k, m]) => ({ v: k, t: m.e + ' ' + m.n })) },
        { name: 'text', label: 'Frase', value: p.text, required: true, max: 200 }] });
      if (!v) return; await api('/phrases/' + p._id, { method: 'PUT', body: v });
    }
    await loadMood();
  } catch (er) { fail(er); }
};

/* ---------- estadísticas ---------- */
function barChart(dias) {
  const W = 640, H = 200, padL = 28, padB = 24, n = dias.length, gw = (W - padL) / n;
  const maxT = Math.max(4, ...dias.map(d => d.done)), maxF = Math.max(30, ...dias.map(d => d.focus)), ch = H - padB - 10;
  let g = [0, .5, 1].map(f => `<line class="grid" x1="${padL}" x2="${W}" y1="${10 + ch * (1 - f)}" y2="${10 + ch * (1 - f)}"/><text x="${padL - 4}" y="${14 + ch * (1 - f)}" text-anchor="end">${Math.round(maxT * f)}</text>`).join('');
  dias.forEach((d, i) => {
    const x = padL + i * gw, h1 = ch * d.done / maxT, h2 = ch * Math.min(d.focus, maxF) / maxF;
    g += `<rect class="b1" x="${x + gw * .12}" y="${10 + ch - h1}" width="${gw * .36}" height="${h1}" rx="2"><title>${d.date}: ${d.done} tareas</title></rect>`;
    g += `<rect class="b2" x="${x + gw * .5}" y="${10 + ch - h2}" width="${gw * .36}" height="${h2}" rx="2"><title>${d.date}: ${d.focus} min de concentración</title></rect>`;
    g += `<text x="${x + gw / 2}" y="${H - 8}" text-anchor="middle">${+d.date.slice(8)}</text>`;
  });
  const total = dias.reduce((s, d) => s + d.done, 0), min = dias.reduce((s, d) => s + d.focus, 0);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Últimos 14 días: ${total} tareas completadas y ${min} minutos de concentración">${g}</svg>`;
}
async function loadStats() {
  try { S.stats = await api('/user/stats'); } catch (e) { return fail(e); }
  const s = S.stats, t = s.totales;
  renderLevel();
  $('#stLevel').textContent = `Nivel ${s.nivel}`; $('#stXp').textContent = `${s.xpNivel} / ${s.xpPorNivel} XP para el siguiente nivel`; $('#stBar').style.width = s.xpNivel / s.xpPorNivel * 100 + '%';
  const box = (n, l) => `<div class="stat"><div class="big">${n}</div><span class="muted">${l}</span></div>`;
  $('#stTotals').innerHTML = box(t.hechas, 'tareas completadas') + box(t.falladas, 'tareas falladas') + box(t.sesiones, 'sesiones Pomodoro') + box(Math.round(t.minutosFoco / 60 * 10) / 10 + ' h', 'de concentración') + box(t.mundosCompletos, 'mundos completados') + box(t.vencidas, 'tareas vencidas');
  $('#stChart').innerHTML = barChart(s.dias);
  const maxM = Math.max(1, ...Object.values(s.animos));
  $('#stMoods').innerHTML = Object.entries(MOODS).map(([k, m]) => `<div><span>${m.e} ${m.n}</span><div class="bar"><i style="width:${(s.animos[k] || 0) / maxM * 100}%;background:var(--accent)"></i></div><b>${s.animos[k] || 0}</b></div>`).join('');
  $('#stStreaks').innerHTML = `🔥 ${s.rachas.tareas} día${s.rachas.tareas === 1 ? '' : 's'} seguidos completando tareas<br>💬 ${s.rachas.animo} día${s.rachas.animo === 1 ? '' : 's'} seguidos registrando tu ánimo`;
  $('#stLogN').textContent = `${s.logros.filter(l => l.unlocked).length}/${s.logros.length}`;
  $('#stLogros').innerHTML = s.logros.map(l => `<div class="logro ${l.unlocked ? '' : 'lock'}"><span class="ico">${l.icon}</span><div><b>${esc(l.name)}</b><small>${esc(l.desc)}</small><div class="bar"><i style="width:${l.value / l.target * 100}%"></i></div><small>${l.value}/${l.target}</small></div></div>`).join('');
}

/* ---------- configuración ---------- */
function renderCfg() {
  $('#pfName').value = S.me.name; $('#pfMail').value = S.me.email;
  const sin = S.me.hasPassword === false;                      // cuenta creada con Google, sin contraseña propia
  $('#pwCur').required = !sin; $('#pwCur').parentElement.classList.toggle('hidden', sin);
  $('#pwBtn').textContent = sin ? 'Crear contraseña' : 'Cambiar contraseña';
}
$('#pfSave').onclick = e => busy(e.currentTarget, async () => { const u = await api('/user', { method: 'PUT', body: { name: $('#pfName').value } }); S.me = { ...S.me, ...u }; $('#who').textContent = S.me.name + (S.me.role === 'admin' ? ' · admin' : ''); toast('Perfil guardado', true); renderAll(); });
$('#themeBtn').onclick = () => { const d = document.documentElement, n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; try { localStorage.setItem('brote_theme', n); } catch { /* */ } };
$('#pwForm').onsubmit = async e => {
  e.preventDefault();
  await busy($('#pwBtn'), async () => { await api('/user/password', { method: 'PUT', body: { current: $('#pwCur').value, password: $('#pwNew').value } }); $('#pwForm').reset(); S.me.hasPassword = true; renderCfg(); toast('Contraseña guardada', true); });
};
$('#exportBtn').onclick = e => busy(e.currentTarget, async () => {
  const res = await api('/user/export', { raw: true }); if (!res.ok) throw new Error('No se pudieron descargar los datos');
  const url = URL.createObjectURL(await res.blob()), a = document.createElement('a'); a.href = url; a.download = 'brote-mis-datos.json'; a.click(); URL.revokeObjectURL(url);
});
$('#delAcc').onclick = async () => {
  const sin = S.me.hasPassword === false;
  const v = await ask({ title: 'Eliminar mi cuenta', text: `Se borrarán para siempre tu cuenta y todos tus datos. ${sin ? 'Escribe tu correo para confirmar.' : 'Escribe tu contraseña para confirmar.'}`, ok: 'Eliminar para siempre', danger: true,
    fields: [sin ? { name: 'email', label: 'Tu correo', type: 'email', required: true } : { name: 'password', label: 'Contraseña', type: 'password', required: true }] });
  if (!v) return;
  try { await api('/user', { method: 'DELETE', body: v }); store.del('brote_pomo'); showAuth(); setAuthMode('login'); $('#authMsg').style.color = 'var(--ok)'; $('#authMsg').textContent = 'Tu cuenta ha sido eliminada.'; } catch (e) { fail(e); }
};
$('#logout').onclick = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch { /* */ } store.del('brote_pomo'); clearInterval(P.timer); document.title = 'Brote'; showAuth(); setAuthMode('login'); };

/* ---------- administración ---------- */
let adTimer;
async function loadAdmin() {
  try {
    const [st, au, fr] = await Promise.all([api('/admin/stats'), api('/admin/auditoria'), api('/admin/frases')]);
    const box = (n, l) => `<div class="stat"><div class="big">${n}</div><span class="muted">${l}</span></div>`;
    $('#adStats').innerHTML = box(st.usuarios.total, 'usuarios') + box(st.usuarios.admins, 'administradores') + box(st.usuarios.sinConfirmar, 'sin confirmar') + box(st.usuarios.suspendidos, 'suspendidos') + box(st.tareas.total, 'tareas creadas') + box(st.tareas.completadas, 'tareas completadas') + box(st.sesiones7dias, 'sesiones Pomodoro (7 días)') + box(st.animos7dias.total, 'ánimos registrados (7 días)');
    $('#adAudit').innerHTML = au.length ? au.map(a => `<div class="audit"><b>${esc(a.action)}</b>${a.target ? ' · ' + esc(a.target) : ''}<br><span class="muted">${esc(a.adminEmail)} · ${new Date(a.createdAt).toLocaleString('es-ES')}</span></div>`).join('') : '<p class="muted">Todavía no hay acciones registradas.</p>';
    S.sysPhrases = fr; $('#adPhList').innerHTML = fr.map(p => `<div class="phrase" data-id="${esc(p._id)}"><span>${MOODS[p.mood]?.e || ''}</span><span class="tx">${esc(p.text)}</span><button class="alt" data-a="del">Borrar</button></div>`).join('');
    await loadUsers();
  } catch (e) { fail(e); }
}
async function loadUsers() {
  const q = $('#adSearch').value.trim();
  const users = await api('/admin/usuarios' + (q ? '?q=' + encodeURIComponent(q) : '')); S.users = users;
  $('#userList').innerHTML = users.length ? users.map(u => {
    const yo = u._id === S.me.id, tags = [u.role === 'admin' ? '<span class="tag warn">admin</span>' : '', !u.confirmed ? '<span class="tag off">sin confirmar</span>' : '', u.active === false ? '<span class="tag off">suspendido</span>' : ''].join(' ');
    return `<div class="urow" data-id="${esc(u._id)}"><div class="info"><b>${esc(u.name)}</b> ${tags}${yo ? ' <span class="tag">tú</span>' : ''}<br><span class="muted">${esc(u.email)} · ${u.tasks} tareas (${u.done} completadas)${u.lastLogin ? ' · último acceso ' + new Date(u.lastLogin).toLocaleDateString('es-ES') : ''}</span></div>
      <div class="acts">${yo ? '' : `${!u.confirmed ? '<button class="alt" data-a="confirm">Confirmar</button>' : ''}<button class="alt" data-a="role">${u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}</button><button class="alt" data-a="active">${u.active === false ? 'Reactivar' : 'Suspender'}</button><button class="alt" data-a="pass">Restablecer contraseña</button><button class="bad" data-a="del">Eliminar</button>`}</div></div>`;
  }).join('') : '<div class="empty"><span class="ico">🔍</span>Ningún usuario coincide.</div>';
}
$('#adSearch').oninput = () => { clearTimeout(adTimer); adTimer = setTimeout(() => loadUsers().catch(fail), 250); };
$('#userList').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const u = S.users.find(x => x._id === b.closest('.urow').dataset.id); if (!u) return;
  try {
    switch (b.dataset.a) {
      case 'del':
        if (!await confirmar('Eliminar usuario', `Se eliminará a ${u.name} (${u.email}) de la base de datos junto con todas sus tareas, mundos, ánimos y estadísticas. No se puede deshacer.`, 'Eliminar usuario')) return;
        await api('/admin/usuarios/' + u._id, { method: 'DELETE' }); toast('Usuario eliminado', true); break;
      case 'role':
        if (!await confirmar(u.role === 'admin' ? 'Quitar rol de administrador' : 'Dar rol de administrador', u.email, 'Confirmar', false)) return;
        await api(`/admin/usuarios/${u._id}/rol`, { method: 'PUT', body: { role: u.role === 'admin' ? 'user' : 'admin' } }); break;
      case 'active':
        if (u.active !== false && !await confirmar('Suspender cuenta', `${u.email} no podrá iniciar sesión hasta que la reactives.`, 'Suspender')) return;
        await api(`/admin/usuarios/${u._id}/activo`, { method: 'PUT', body: { active: u.active === false } }); break;
      case 'confirm': await api(`/admin/usuarios/${u._id}/confirmar`, { method: 'PUT' }); break;
      case 'pass': {
        if (!await confirmar('Restablecer contraseña', `Se generará una contraseña temporal para ${u.email} y se cerrarán sus sesiones abiertas.`, 'Generar', false)) return;
        const r = await api(`/admin/usuarios/${u._id}/password`, { method: 'PUT' });
        await ask({ title: 'Contraseña temporal', text: 'Cópiala y envíasela al usuario: solo se muestra ahora.', html: `<code>${esc(r.passwordTemporal)}</code>`, ok: 'Hecho', cancel: null }); break;
      }
    }
    await loadAdmin();
  } catch (er) { fail(er); }
};
$('#adPhForm').onsubmit = async e => {
  e.preventDefault();
  try { await api('/admin/frases', { method: 'POST', body: { text: $('#adPhText').value, mood: $('#adPhMood').value } }); $('#adPhText').value = ''; await loadAdmin(); } catch (er) { fail(er); }
};
$('#adPhList').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  try { await api('/admin/frases/' + b.closest('.phrase').dataset.id, { method: 'DELETE' }); await loadAdmin(); } catch (er) { fail(er); }
};

/* ---------- render global ---------- */
function renderAll() {
  if (!S.me) return;
  renderDash(); renderTasks(); renderPomoTasks(); renderCity(); renderScens();
  $('#navCity').textContent = (scen()?.icon || '🌍') + ' Mi mundo';
}
$$('nav button[data-v]').forEach(b => b.onclick = () => show(b.dataset.v));
$('#logo').onclick = () => show('dash');
document.addEventListener('visibilitychange', () => { if (!document.hidden && P.endAt) paintPomo(); });

/* ---------- arranque ---------- */
(async function boot() {
  const m = location.hash.match(/reset=([a-f0-9]{64})/);
  if (m) { resetToken = m[1]; showAuth(); setAuthMode('reset'); return; }
  initGoogle();
  try { await enter(); } catch { showAuth(); setAuthMode('login'); }
})();
