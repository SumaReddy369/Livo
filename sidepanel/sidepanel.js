const DAY_MS = 24 * 60 * 60 * 1000;

const els = {
  statusBar: document.getElementById('status-bar'),
  scanBtn: document.getElementById('scan-btn'),
  setupCard: document.getElementById('setup-card'),
  emptyState: document.getElementById('empty-state'),
  archive: document.getElementById('archive'),
  archiveEvents: document.getElementById('archive-events'),
  buckets: {
    urgent: document.querySelector('#bucket-urgent .bucket-events'),
    attention: document.querySelector('#bucket-attention .bucket-events'),
    upcoming: document.querySelector('#bucket-upcoming .bucket-events')
  },
  bucketSections: {
    urgent: document.getElementById('bucket-urgent'),
    attention: document.getElementById('bucket-attention'),
    upcoming: document.getElementById('bucket-upcoming')
  },
  template: document.getElementById('event-card-template')
};

document.getElementById('settings-btn').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('setup-settings-btn').addEventListener('click', () => chrome.runtime.openOptionsPage());

els.scanBtn.addEventListener('click', async () => {
  els.scanBtn.disabled = true;
  els.scanBtn.textContent = 'Scanning…';
  const res = await chrome.runtime.sendMessage({ type: 'SCAN_NOW' }).catch((e) => ({ ok: false, error: e.message }));
  els.scanBtn.disabled = false;
  els.scanBtn.textContent = 'Scan now';
  if (res && !res.ok) showStatus(`Scan failed: ${res.error}`, true);
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.events || changes.scanStatus)) render();
});

function showStatus(text, isError) {
  els.statusBar.textContent = text;
  els.statusBar.classList.toggle('error', !!isError);
  els.statusBar.classList.remove('hidden');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00');
  return Math.round((target - Date.now()) / DAY_MS);
}

function bucketFor(ev) {
  const d = daysUntil(ev.event_date);
  if (ev.severity === 'HIGH' || (d !== null && d <= 2)) return 'urgent';
  if (ev.severity === 'MEDIUM' || (d !== null && d <= 7)) return 'attention';
  return 'upcoming';
}

// Sort within a bucket: soonest date first, then biggest financial impact.
function sortEvents(a, b) {
  const da = daysUntil(a.event_date) ?? 9999;
  const db = daysUntil(b.event_date) ?? 9999;
  if (da !== db) return da - db;
  const fa = Math.abs(a.financial_impact?.amount_change ?? a.financial_impact?.new_recurring_cost ?? 0);
  const fb = Math.abs(b.financial_impact?.amount_change ?? b.financial_impact?.new_recurring_cost ?? 0);
  return fb - fa;
}

function formatDate(ev) {
  const d = daysUntil(ev.event_date);
  if (d === null) return '';
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d <= 14) return `In ${d} days`;
  return new Date(ev.event_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function currencySymbol(code) {
  return { USD: '$', EUR: '\u20ac', GBP: '\u00a3', CAD: 'C$' }[code] || (code ? code + ' ' : '$');
}

function buildCard(ev, archived) {
  const node = els.template.content.cloneNode(true);

  node.querySelector('.severity-dot').classList.add(ev.severity);
  node.querySelector('.category-chip').textContent = ev.category.replace('_', ' ');

  const dateEl = node.querySelector('.event-date');
  dateEl.textContent = formatDate(ev);
  const d = daysUntil(ev.event_date);
  if (d !== null && d <= 2) dateEl.classList.add('soon');

  node.querySelector('.event-title').textContent = ev.title;
  node.querySelector('.event-summary').textContent = ev.summary;
  node.querySelector('.entity').textContent = ev.entity_name || '';

  const fi = ev.financial_impact || {};
  const sym = currencySymbol(fi.currency);
  const moneyChip = node.querySelector('.money-chip');
  if (fi.amount_change != null) {
    moneyChip.textContent = `${fi.amount_change > 0 ? '+' : ''}${sym}${fi.amount_change}${fi.new_recurring_cost != null ? ` \u2192 ${sym}${fi.new_recurring_cost}` : ''}`;
    moneyChip.classList.remove('hidden');
  } else if (fi.new_recurring_cost != null) {
    moneyChip.textContent = `${sym}${fi.new_recurring_cost} charge`;
    moneyChip.classList.remove('hidden');
  }

  // A cancellable charge is a savings opportunity (section 37).
  const canCancel = (ev.suggested_actions || []).some((a) => a.action_type === 'CANCEL');
  if (canCancel && fi.new_recurring_cost != null) {
    const chip = node.querySelector('.savings-chip');
    chip.textContent = `Potential savings: ${sym}${fi.new_recurring_cost}`;
    chip.classList.remove('hidden');
  }

  const actionsEl = node.querySelector('.event-actions');
  if (!archived) {
    (ev.suggested_actions || []).forEach((action, i) => {
      if (action.action_type === 'IGNORE') return;
      const btn = document.createElement('button');
      btn.className = 'action-btn' + (i === 0 ? ' primary' : '');
      btn.textContent = action.label;
      btn.addEventListener('click', () => handleSuggestedAction(ev, action));
      actionsEl.appendChild(btn);
    });
  }

  node.querySelector('.act-open').addEventListener('click', () => openEmail(ev));
  const dismissBtn = node.querySelector('.act-dismiss');
  if (archived) {
    node.querySelector('.act-done').classList.add('hidden');
    node.querySelector('.act-snooze').classList.add('hidden');
    dismissBtn.textContent = 'Restore';
    dismissBtn.addEventListener('click', () => setStatusFor(ev.id, 'active'));
  } else {
    node.querySelector('.act-done').addEventListener('click', () => setStatusFor(ev.id, 'done'));
    node.querySelector('.act-snooze').addEventListener('click', () => snooze(ev.id));
    dismissBtn.addEventListener('click', () => setStatusFor(ev.id, 'dismissed'));
  }

  return node;
}

function openEmail(ev) {
  if (ev.sourceMessageId) {
    chrome.tabs.create({ url: `https://mail.google.com/mail/u/0/#all/${ev.sourceMessageId}` });
  }
}

// Livo recommends actions but never executes them (section 26); CANCEL,
// COMPARE, and VIEW_DETAILS open the source email so the user acts themselves.
function handleSuggestedAction(ev, action) {
  if (action.action_type === 'REMIND') {
    const when = ev.event_date
      ? new Date(ev.event_date + 'T09:00:00').getTime() - DAY_MS
      : Date.now() + DAY_MS;
    chrome.runtime.sendMessage({
      type: 'SET_REMINDER',
      eventId: ev.id,
      when: Math.max(when, Date.now() + 60_000)
    });
    showStatus('Reminder set.');
  } else {
    openEmail(ev);
  }
}

async function setStatusFor(id, status) {
  const { events = [] } = await chrome.storage.local.get('events');
  const ev = events.find((e) => e.id === id);
  if (ev) {
    ev.status = status;
    await chrome.storage.local.set({ events });
  }
}

async function snooze(id) {
  await setStatusFor(id, 'snoozed');
  chrome.runtime.sendMessage({ type: 'SET_REMINDER', eventId: id, when: Date.now() + DAY_MS });
  showStatus('Snoozed until tomorrow.');
}

async function render() {
  const { events = [], scanStatus, settings } = await chrome.storage.local.get(['events', 'scanStatus', 'settings']);

  const needsSetup = !settings?.apiKey;
  els.setupCard.classList.toggle('hidden', !needsSetup);

  if (scanStatus?.detail) {
    showStatus(scanStatus.state === 'scanning' ? 'Scanning your inbox…' : scanStatus.detail, scanStatus.state === 'error');
  } else if (scanStatus?.state === 'scanning') {
    showStatus('Scanning your inbox…');
  }

  const active = events.filter((e) => e.status === 'active');
  const archived = events.filter((e) => e.status === 'done' || e.status === 'dismissed');

  const grouped = { urgent: [], attention: [], upcoming: [] };
  active.forEach((ev) => grouped[bucketFor(ev)].push(ev));

  for (const name of Object.keys(grouped)) {
    const list = grouped[name].sort(sortEvents);
    els.buckets[name].replaceChildren(...list.map((ev) => buildCard(ev, false)));
    els.bucketSections[name].classList.toggle('hidden', list.length === 0);
  }

  els.emptyState.classList.toggle('hidden', active.length > 0 || needsSetup);

  els.archive.classList.toggle('hidden', archived.length === 0);
  els.archiveEvents.replaceChildren(...archived.slice(0, 30).map((ev) => buildCard(ev, true)));
}

render();
