/* =============================================
   app.js — Family Calendar Logic
   Works in LOCAL mode now.
   Switches to Supabase when credentials are added.
   ============================================= */

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentDate  = new Date();
let currentView  = 'month';
let events       = [];          // all events in memory
let editingId    = null;        // ID of event being edited (null = new event)
let selectedWho  = null;        // 'mom', 'dad', or 'both'

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateMonthLabel();
  await loadEvents();
  renderMonth();
  renderList();
  registerServiceWorker();
});

// ─── SERVICE WORKER (PWA) ─────────────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ─── DATA LAYER — works locally OR with Supabase ─────────────────────────────

async function loadEvents() {
  if (window.SUPABASE_READY && window.supabaseClient) {
    const { data, error } = await window.supabaseClient
      .from('events')
      .select('*')
      .order('date', { ascending: true });
    if (!error) { events = data || []; return; }
  }
  // Fallback: localStorage
  events = JSON.parse(localStorage.getItem('fam_events') || '[]');
}

async function saveToStorage(event) {
  if (window.SUPABASE_READY && window.supabaseClient) {
    if (event.id && typeof event.id === 'string' && event.id.startsWith('local-')) {
      // It was a local event, insert as new
      const { id, ...rest } = event;
      const { data, error } = await window.supabaseClient.from('events').insert(rest).select().single();
      if (!error) return data;
    }
    const { data, error } = await window.supabaseClient
      .from('events').upsert(event).select().single();
    if (!error) return data;
  }
  // Fallback: localStorage
  const stored = JSON.parse(localStorage.getItem('fam_events') || '[]');
  const idx = stored.findIndex(e => e.id === event.id);
  if (idx >= 0) stored[idx] = event; else stored.push(event);
  localStorage.setItem('fam_events', JSON.stringify(stored));
  return event;
}

async function deleteFromStorage(id) {
  if (window.SUPABASE_READY && window.supabaseClient) {
    await window.supabaseClient.from('events').delete().eq('id', id);
  }
  const stored = JSON.parse(localStorage.getItem('fam_events') || '[]');
  localStorage.setItem('fam_events', JSON.stringify(stored.filter(e => e.id !== id)));
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
  // Remove all day cells (keep the 7 header labels)
  const headers = grid.querySelectorAll('.day-label');
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // First day of month (Monday = 0)
  let firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  firstDay = (firstDay === 0) ? 6 : firstDay - 1;  // convert to Mon=0

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  // Day cells
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

    // Dots for events
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
  // Remove any existing day sheet
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

      if (ev.time) {
        const meta = document.createElement('div');
        meta.className = 'day-event-meta';
        meta.textContent = formatTime(ev.time) + ' · ' + whoLabel(ev.who);
        info.appendChild(meta);
      } else {
        const meta = document.createElement('div');
        meta.className = 'day-event-meta';
        meta.textContent = whoLabel(ev.who);
        info.appendChild(meta);
      }

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

  const today = toDateStr(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );

  const upcoming = events
    .filter(e => e.date >= today)
    .sort((a, b) => (a.date + (a.time||'')) > (b.date + (b.time||'')) ? 1 : -1);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="no-events">
        <p style="font-size:2.5rem;margin-bottom:12px;">🗓</p>
        <p>Ingen kommende hendelser.</p>
        <p style="margin-top:8px;">Trykk på <strong>＋ Legg til</strong> for å legge til noe!</p>
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
  editingId    = null;
  selectedWho  = null;

  document.getElementById('modal-title').textContent = event ? 'Rediger hendelse' : 'Ny hendelse';
  document.getElementById('event-title').value = event ? event.title : '';
  document.getElementById('event-date').value  = event ? event.date  : (prefillDate || todayStr());
  document.getElementById('event-time').value  = event ? (event.time || '') : '';
  document.getElementById('event-note').value  = event ? (event.note || '') : '';

  // Who selection
  ['mom','dad','both'].forEach(w => {
    document.getElementById('who-' + w).className = 'who-btn';
  });
  if (event) {
    selectWho(event.who);
  }

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
    const btn = document.getElementById('who-' + w);
    btn.className = 'who-btn' + (w === who ? ' selected-' + w : '');
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
    id:    editingId || 'local-' + Date.now(),
    title,
    date,
    time:  time || null,
    who:   selectedWho,
    note:  note || null,
  };

  const saved = await saveToStorage(event);
  if (saved) {
    const idx = events.findIndex(e => e.id === event.id);
    if (idx >= 0) events[idx] = saved; else events.push(saved);
  }

  closeModal();
  renderMonth();
  renderList();
  showToast(editingId ? '✅ Hendelse oppdatert!' : '✅ Hendelse lagt til!');
}

async function deleteEvent() {
  if (!editingId) return;
  if (!confirm('Er du sikker på at du vil slette denne hendelsen?')) return;
  await deleteFromStorage(editingId);
  events = events.filter(e => e.id !== editingId);
  closeModal();
  renderMonth();
  renderList();
  showToast('🗑 Hendelse slettet');
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toDateStr(year, month, day) {
  return year + '-' +
    String(month + 1).padStart(2, '0') + '-' +
    String(day).padStart(2, '0');
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
