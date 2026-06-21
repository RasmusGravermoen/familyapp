/* =============================================
   app.js — Family Calendar Logic
   ============================================= */

let currentDate      = new Date();
let currentView      = 'month';
let events           = [];
let editingId        = null;
let selectedWho      = null;
let selectedVoiceWho = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateMonthLabel();
  showLoading(true);
  registerServiceWorker();
  await waitForSupabase();
  await loadEvents();
  showLoading(false);
  renderMonth();
  renderList();

  // 1) Realtime: dytter endringer ut til alle umiddelbart (under 1 sek)
  subscribeRealtime();

  // 2) Hent på nytt med en gang appen åpnes/får fokus (viktigst på telefon)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshNow();
  });
  window.addEventListener('focus', refreshNow);

  // 3) Sikkerhetsnett: hent på nytt hvert 30. sek i tilfelle realtime mister tilkobling
  setInterval(refreshNow, 30000);
});

async function refreshNow() {
  await loadEvents();
  renderMonth();
  renderList();
}

function showLoading(on) {
  let el = document.getElementById('loading-overlay');
  if (on) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.style.cssText = `
        position: fixed; inset: 0; background: var(--bg);
        display: flex; align-items: center; justify-content: center;
        z-index: 999; flex-direction: column; gap: 16px;
      `;
      el.innerHTML = `
        <div style="font-size:2.5rem;">📅</div>
        <div style="font-size:1.1rem; color: var(--text-muted); font-family: var(--font-body);">Laster kalender...</div>
      `;
      document.body.appendChild(el);
    }
  } else {
    if (el) el.remove();
  }
}

function waitForSupabase() {
  return new Promise((resolve) => {
    if (!window.SUPABASE_READY) return resolve();
    if (window.supabaseClient) return resolve();
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (window.supabaseClient || tries > 30) { clearInterval(interval); resolve(); }
    }, 100);
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ─── REALTIME ───────────────────────────────────────────────────────────────
// Lytter på endringer i events-tabellen og oppdaterer kalenderen umiddelbart.
function subscribeRealtime() {
  if (!(window.SUPABASE_READY && window.supabaseClient)) return;
  window.supabaseClient
    .channel('events-changes')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => applyRealtimeChange(payload))
    .subscribe();
}

function applyRealtimeChange(payload) {
  const row = payload.new && payload.new.id ? payload.new : payload.old;
  if (!row) return;
  if (payload.eventType === 'DELETE') {
    events = events.filter(e => e.id !== row.id);
  } else {
    const idx = events.findIndex(e => e.id === row.id);
    if (idx >= 0) events[idx] = row; else events.push(row);
  }
  renderMonth();
  renderList();
}

// ─── DATA LAYER ───────────────────────────────────────────────────────────────

async function loadEvents() {
  if (window.SUPABASE_READY && window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('events').select('*').order('date', { ascending: true });
      if (!error && data) {
        events = data;
        return;
      }
    } catch(e) {
      console.error('Supabase feil:', e);
    }
  }
  events = JSON.parse(localStorage.getItem('fam_events') || '[]');
}

async function saveToStorage(event) {
  // Supabase aktiv = databasen er fasit. Feiler kallet, kaster vi en feil
  // slik at brukeren får beskjed i stedet for en falsk "lagret".
  if (window.SUPABASE_READY && window.supabaseClient) {
    let result;
    if (event.id && typeof event.id === 'string' && event.id.startsWith('local-')) {
      const { id, ...rest } = event;
      result = await window.supabaseClient.from('events').insert(rest).select().single();
    } else {
      result = await window.supabaseClient.from('events').upsert(event).select().single();
    }
    if (result.error) throw result.error;
    return result.data;
  }
  // Demo-/lokalmodus (ingen Supabase konfigurert): lagre kun i nettleseren
  const stored = JSON.parse(localStorage.getItem('fam_events') || '[]');
  const idx = stored.findIndex(e => e.id === event.id);
  if (idx >= 0) stored[idx] = event; else stored.push(event);
  localStorage.setItem('fam_events', JSON.stringify(stored));
  return event;
}

async function deleteFromStorage(id) {
  if (window.SUPABASE_READY && window.supabaseClient) {
    const { error } = await window.supabaseClient.from('events').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const stored = JSON.parse(localStorage.getItem('fam_events') || '[]');
  localStorage.setItem('fam_events', JSON.stringify(stored.filter(e => e.id !== id)));
}

// ─── NORSK TEKSTPARSER ────────────────────────────────────────────────────────

const MONTHS = {
  'januar':1,'februar':2,'mars':3,'april':4,'mai':5,'juni':6,
  'juli':7,'august':8,'september':9,'oktober':10,'november':11,'desember':12,
  'jan':1,'feb':2,'mar':3,'apr':4,'jun':6,'jul':7,'aug':8,'sep':9,'okt':10,'nov':11,'des':12
};

const DAY_WORDS = {
  'første':1,'andre':2,'tredje':3,'fjerde':4,'femte':5,'sjette':6,
  'syvende':7,'åttende':8,'niende':9,'tiende':10,'ellevte':11,'tolvte':12,
  'trettende':13,'fjortende':14,'femtende':15,'sekstende':16,'syttende':17,
  'attende':18,'nittende':19,'tjuende':20,'tjueførste':21,'tjueandre':22,
  'tjuetredje':23,'tjuefjerde':24,'tjuefemte':25,'tjuesjette':26,
  'tjuesyvende':27,'tjueåttende':28,'tjueniende':29,'trettiende':30,'enogtrettiende':31
};

const TIME_WORDS = {
  'ett':1,'to':2,'tre':3,'fire':4,'fem':5,'seks':6,'sju':7,'syv':7,
  'åtte':8,'ni':9,'ti':10,'elleve':11,'tolv':12,'tretten':13,'fjorten':14,
  'femten':15,'seksten':16,'sytten':17,'atten':18,'nitten':19,'tjue':20,
  'tjueen':21,'tjueto':22,'tjuetre':23
};

function parseNorwegianText(text) {
  const lower = text.toLowerCase().trim();
  let day = null, month = null, year = null, hour = null, minute = 0;

  const today = new Date();

  // Finn dag + måned (tall)
  const dayNumMatch = lower.match(/\b(\d{1,2})\s*\.?\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|des)\b/);
  if (dayNumMatch) {
    day = parseInt(dayNumMatch[1]);
    month = MONTHS[dayNumMatch[2]];
  }

  // Finn dag + måned (ord)
  if (!day) {
    for (const [word, num] of Object.entries(DAY_WORDS)) {
      const re = new RegExp('\\b' + word + '\\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|des)\\b');
      const m = lower.match(re);
      if (m) { day = num; month = MONTHS[m[1]]; break; }
    }
  }

  // Finn år
  const yearMatch = lower.match(/\b(202[4-9]|203\d)\b/);
  if (yearMatch) year = parseInt(yearMatch[1]);
  if (!year) {
    year = today.getFullYear();
    if (month && month < today.getMonth() + 1) year++;
    if (month && month === today.getMonth() + 1 && day && day < today.getDate()) year++;
  }

  // Finn tid (tall)
  const timeNumMatch = lower.match(/(?:kl\.?\s*|klokk[ae]?\s*)(\d{1,2})(?::(\d{2}))?/);
  if (timeNumMatch) {
    hour = parseInt(timeNumMatch[1]);
    minute = timeNumMatch[2] ? parseInt(timeNumMatch[2]) : 0;
  }

  // Finn tid (ord)
  if (hour === null) {
    const timeWordMatch = lower.match(/(?:kl\.?\s*|klokk[ae]?\s*)(ett|to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|elleve|tolv|tretten|fjorten|femten|seksten|sytten|atten|nitten|tjue|tjueen|tjueto|tjuetre)\b/);
    if (timeWordMatch && TIME_WORDS[timeWordMatch[1]] !== undefined) {
      hour = TIME_WORDS[timeWordMatch[1]];
    }
  }

  // Bygg tittel
  let titleText = text;
  titleText = titleText.replace(/\b\d{1,2}\s*\.?\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|des)\b/gi, '');
  for (const word of Object.keys(DAY_WORDS)) {
    const re = new RegExp('\\b' + word + '\\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|des)\\b', 'gi');
    titleText = titleText.replace(re, '');
  }
  titleText = titleText.replace(/(?:kl\.?\s*|klokk[ae]?\s*)\d{1,2}(?::\d{2})?/gi, '');
  titleText = titleText.replace(/(?:kl\.?\s*|klokk[ae]?\s*)(ett|to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|elleve|tolv|tretten|fjorten|femten|seksten|sytten|atten|nitten|tjue|tjueen|tjueto|tjuetre)\b/gi, '');
  titleText = titleText.replace(/\b(202[4-9]|203\d)\b/g, '');
  titleText = titleText.replace(/\s+/g, ' ').trim().replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
  const title = titleText ? titleText.charAt(0).toUpperCase() + titleText.slice(1) : text;

  let dateStr = null;
  if (day && month && year) {
    dateStr = year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
  }
  const timeStr = hour !== null ? String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0') : null;

  return { date: dateStr, time: timeStr, title };
}

// ─── VOICE INPUT ──────────────────────────────────────────────────────────────

function openVoiceModal() {
  selectedVoiceWho = null;
  document.getElementById('voice-input').value = '';
  document.getElementById('voice-status').classList.add('hidden');
  ['mom','dad','both'].forEach(w => {
    document.getElementById('voice-who-' + w).className = 'who-btn';
  });
  document.getElementById('voice-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('voice-input').focus(), 300);
}

function closeVoiceModal() {
  document.getElementById('voice-modal-overlay').classList.add('hidden');
  selectedVoiceWho = null;
}

function handleVoiceOverlayClick(e) {
  if (e.target === document.getElementById('voice-modal-overlay')) closeVoiceModal();
}

function selectVoiceWho(who) {
  selectedVoiceWho = who;
  ['mom','dad','both'].forEach(w => {
    document.getElementById('voice-who-' + w).className = 'who-btn' + (w === who ? ' selected-' + w : '');
  });
}

function processVoiceInput() {
  const input = document.getElementById('voice-input').value.trim();
  if (!input) { showToast('Skriv eller dikter en hendelse først 🎤'); return; }
  if (!selectedVoiceWho) { showToast('Velg hvem hendelsen gjelder 👇'); return; }

  const parsed = parseNorwegianText(input);
  const todayDateStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  closeVoiceModal();
  setTimeout(() => {
    openModal(null, parsed.date || todayDateStr);
    document.getElementById('event-title').value = parsed.title || '';
    document.getElementById('event-date').value  = parsed.date  || todayDateStr;
    document.getElementById('event-time').value  = parsed.time  || '';
    document.getElementById('event-note').value  = '';
    selectWho(selectedVoiceWho);
    showToast('✨ Sjekk og lagre hendelsen!');
  }, 200);
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────

function switchView(view) {
  currentView = view;
  document.getElementById('view-month').classList.toggle('active', view === 'month');
  document.getElementById('view-list').classList.toggle('active', view === 'list');
  document.getElementById('btn-month').classList.toggle('active', view === 'month');
  document.getElementById('btn-list').classList.toggle('active', view === 'list');
}

function updateMonthLabel() {
  const months = ['Januar','Februar','Mars','April','Mai','Juni',
                  'Juli','August','September','Oktober','November','Desember'];
  document.getElementById('current-month-label').textContent =
    months[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
}

function changeMonth(dir) {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
  updateMonthLabel();
  renderMonth();
}

// ─── MONTH VIEW ───────────────────────────────────────────────────────────────

function renderMonth() {
  const grid = document.querySelector('.calendar-grid');
  const headers = grid.querySelectorAll('.day-label');
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = (firstDay === 0) ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year, month, d);
    const dayEvents = events.filter(e => e.date === dateStr);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      cell.classList.add('today');
    }
    const num = document.createElement('span');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);
    dayEvents.forEach(ev => {
      const dot = document.createElement('span');
      dot.className = 'cal-dot dot-' + ev.who;
      cell.appendChild(dot);
    });
    cell.onclick = () => openDaySheet(dateStr, dayEvents);
    grid.appendChild(cell);
  }
}

function openDaySheet(dateStr, dayEvents) {
  const existing = document.getElementById('day-sheet');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'day-events-overlay';
  overlay.id = 'day-sheet';

  const modal = document.createElement('div');
  modal.className = 'day-events-modal';

  const title = document.createElement('h2');
  title.className = 'day-events-title';
  title.textContent = formatDateNorwegian(dateStr);
  modal.appendChild(title);

  if (dayEvents.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color: var(--text-muted); padding: 10px 0 16px;';
    empty.textContent = 'Ingen hendelser denne dagen.';
    modal.appendChild(empty);
  } else {
    dayEvents.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'day-event-item';
      const dot = document.createElement('span');
      dot.className = 'day-event-dot dot-' + ev.who;
      item.appendChild(dot);
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'day-event-name';
      name.textContent = ev.title;
      info.appendChild(name);
      const meta = document.createElement('div');
      meta.className = 'day-event-meta';
      meta.textContent = (ev.time ? formatTime(ev.time) + ' · ' : '') + whoLabel(ev.who);
      info.appendChild(meta);
      item.appendChild(info);
      item.onclick = () => { overlay.remove(); openModal(ev); };
      modal.appendChild(item);
    });
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'day-events-add';
  addBtn.textContent = '＋ Legg til hendelse';
  addBtn.onclick = () => { overlay.remove(); openModal(null, dateStr); };
  modal.appendChild(addBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'day-events-close';
  closeBtn.textContent = 'Lukk';
  closeBtn.onclick = () => overlay.remove();
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────

function renderList() {
  const container = document.getElementById('event-list');
  container.innerHTML = '';
  const today = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const upcoming = events
    .filter(e => e.date >= today)
    .sort((a, b) => (a.date + (a.time||'')) > (b.date + (b.time||'')) ? 1 : -1);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="no-events">
        <p style="font-size:2.5rem;margin-bottom:12px;">🗓</p>
        <p>Ingen kommende hendelser.</p>
        <p style="margin-top:8px;">Trykk på <strong>🎤 Si en hendelse</strong> for å legge til!</p>
      </div>`;
    return;
  }

  upcoming.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.onclick = () => openModal(ev);
    const bar = document.createElement('div');
    bar.className = 'event-color-bar bar-' + ev.who;
    card.appendChild(bar);
    const body = document.createElement('div');
    body.className = 'event-card-body';
    const titleEl = document.createElement('div');
    titleEl.className = 'event-card-title';
    titleEl.textContent = ev.title;
    body.appendChild(titleEl);
    const meta = document.createElement('div');
    meta.className = 'event-card-meta';
    const timeStr = ev.time ? ' kl. ' + formatTime(ev.time) : '';
    meta.textContent = formatDateNorwegian(ev.date) + timeStr + '  ·  ' + whoLabel(ev.who);
    body.appendChild(meta);
    if (ev.note) {
      const note = document.createElement('div');
      note.className = 'event-card-note';
      note.textContent = ev.note;
      body.appendChild(note);
    }
    card.appendChild(body);
    container.appendChild(card);
  });
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function openModal(event = null, prefillDate = null) {
  editingId   = null;
  selectedWho = null;
  document.getElementById('modal-title').textContent = event ? 'Rediger hendelse' : 'Ny hendelse';
  document.getElementById('event-title').value = event ? event.title : '';
  document.getElementById('event-date').value  = event ? event.date  : (prefillDate || todayStr());
  document.getElementById('event-time').value  = event ? (event.time || '') : '';
  document.getElementById('event-note').value  = event ? (event.note || '') : '';
  ['mom','dad','both'].forEach(w => {
    document.getElementById('who-' + w).className = 'who-btn';
  });
  if (event) selectWho(event.who);
  document.getElementById('btn-delete').classList.toggle('hidden', !event);
  if (event) editingId = event.id;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('event-title').focus(), 300);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId   = null;
  selectedWho = null;
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function selectWho(who) {
  selectedWho = who;
  ['mom','dad','both'].forEach(w => {
    document.getElementById('who-' + w).className = 'who-btn' + (w === who ? ' selected-' + w : '');
  });
}

async function saveEvent() {
  const title = document.getElementById('event-title').value.trim();
  const date  = document.getElementById('event-date').value;
  const time  = document.getElementById('event-time').value;
  const note  = document.getElementById('event-note').value.trim();
  if (!title) { showToast('Skriv inn hva som skjer 📝'); return; }
  if (!date)  { showToast('Velg en dato 📅'); return; }
  if (!selectedWho) { showToast('Velg hvem hendelsen gjelder 👇'); return; }
  const event = {
    id: editingId || 'local-' + Date.now(),
    title, date,
    time:  time || null,
    who:   selectedWho,
    note:  note || null,
  };
  const wasEditing = !!editingId;
  let saved;
  try {
    saved = await saveToStorage(event);
  } catch (e) {
    console.error('Lagring feilet:', e);
    showToast('⚠️ Ikke lagret – sjekk internett og prøv igjen');
    return; // hold modalen åpen så de kan prøve på nytt
  }
  const idx = events.findIndex(e => e.id === event.id);
  if (idx >= 0) events[idx] = saved; else events.push(saved);
  closeModal();
  renderMonth();
  renderList();
  showToast(wasEditing ? '✅ Hendelse oppdatert!' : '✅ Hendelse lagt til!');
}

async function deleteEvent() {
  if (!editingId) return;
  if (!confirm('Er du sikker på at du vil slette denne hendelsen?')) return;
  const id = editingId;
  try {
    await deleteFromStorage(id);
  } catch (e) {
    console.error('Sletting feilet:', e);
    showToast('⚠️ Ikke slettet – sjekk internett og prøv igjen');
    return;
  }
  events = events.filter(e => e.id !== id);
  closeModal();
  renderMonth();
  renderList();
  showToast('🗑 Hendelse slettet');
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toDateStr(year, month, day) {
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function todayStr() {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatDateNorwegian(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = ['januar','februar','mars','april','mai','juni',
                  'juli','august','september','oktober','november','desember'];
  const days = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
  const d = new Date(year, month - 1, day);
  return days[d.getDay()] + ' ' + day + '. ' + months[month - 1] + ' ' + year;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return h + ':' + m;
}

function whoLabel(who) {
  return who === 'mom' ? '👩 Mor' : who === 'dad' ? '👨 Far' : '👨‍👩‍ Begge';
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2900);
}
