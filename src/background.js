import { buildLivoPrompt } from './prompt.js';
import { getAuthToken, listRecentMessageIds, getMessage } from './gmail.js';
import { analyzeEmail } from './llm.js';

const SCAN_ALARM = 'livo-scan';

const DEFAULT_SETTINGS = {
  provider: 'openai',
  apiKey: '',
  model: '',
  scanIntervalMinutes: 30,
  lookbackDays: 3,
  maxEmailsPerScan: 20,
  userPreferences: ''
};

// ---------- lifecycle ----------

chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  await ensureAlarm();
});

chrome.runtime.onStartup.addListener(ensureAlarm);

async function ensureAlarm() {
  const settings = await getSettings();
  const existing = await chrome.alarms.get(SCAN_ALARM);
  if (!existing || existing.periodInMinutes !== settings.scanIntervalMinutes) {
    await chrome.alarms.create(SCAN_ALARM, {
      periodInMinutes: settings.scanIntervalMinutes,
      delayInMinutes: 1
    });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    runScan({ interactive: false }).catch((e) => setStatus('error', e.message));
  } else if (alarm.name.startsWith('livo-remind:')) {
    fireReminder(alarm.name.slice('livo-remind:'.length));
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SCAN_NOW') {
    runScan({ interactive: true })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // async response
  }
  if (msg?.type === 'SETTINGS_CHANGED') {
    ensureAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'SET_REMINDER') {
    const when = new Date(msg.when).getTime();
    chrome.alarms.create(`livo-remind:${msg.eventId}`, { when });
    sendResponse({ ok: true });
  }
});

// ---------- storage helpers ----------

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

async function getState() {
  const data = await chrome.storage.local.get(['events', 'processedIds', 'scanStatus']);
  return {
    events: data.events || [],
    processedIds: data.processedIds || [],
    scanStatus: data.scanStatus || null
  };
}

async function setStatus(state, detail) {
  await chrome.storage.local.set({
    scanStatus: { state, detail: detail || null, at: Date.now() }
  });
}

// ---------- scan pipeline ----------

let scanning = false;

async function runScan({ interactive }) {
  if (scanning) return;
  scanning = true;
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      await setStatus('needs-setup', 'Add an AI provider API key in Livo settings.');
      return;
    }

    await setStatus('scanning');
    const token = await getAuthToken(interactive);
    const { events, processedIds } = await getState();

    const ids = await listRecentMessageIds(token, settings.lookbackDays, 100);
    const newIds = ids.filter((id) => !processedIds.includes(id)).slice(0, settings.maxEmailsPerScan);

    const now = new Date();
    let added = 0;

    for (const id of newIds) {
      try {
        const email = await getMessage(token, id);
        if (!email.body && !email.subject) continue;

        const prompt = buildLivoPrompt({
          emailSentDate: email.sentDate,
          emailSentTime: email.sentTime,
          emailTimezone: email.timezone,
          emailFrom: email.from,
          emailTo: email.to,
          emailSubject: email.subject,
          emailBody: email.body,
          currentDate: now.toISOString().slice(0, 10),
          currentTime: now.toTimeString().slice(0, 5),
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userPreferences: settings.userPreferences || 'none provided',
          previouslyDetectedEvents: summarizeExisting(events)
        });

        const result = await analyzeEmail(settings, prompt);

        for (const ev of result.events) {
          if (isDuplicate(events, ev)) continue;
          events.unshift({
            ...ev,
            id: crypto.randomUUID(),
            sourceMessageId: email.id,
            sourceFrom: email.from,
            sourceSubject: email.subject,
            detectedAt: Date.now(),
            status: 'active' // active | done | dismissed | snoozed
          });
          added++;
        }
      } catch (e) {
        console.warn('Livo: failed analyzing message', id, e);
      } finally {
        processedIds.push(id);
      }
    }

    // Keep bounded history.
    const trimmedIds = processedIds.slice(-1000);
    const trimmedEvents = events.slice(0, 300);

    await chrome.storage.local.set({ events: trimmedEvents, processedIds: trimmedIds });
    await setStatus('idle', `Scanned ${newIds.length} emails, found ${added} new events.`);
    await updateBadge(trimmedEvents);
  } finally {
    scanning = false;
  }
}

// Compact summary of existing events passed back into the prompt so the model
// can avoid re-reporting the same underlying event (section 28).
function summarizeExisting(events) {
  const active = events.filter((e) => e.status === 'active').slice(0, 30);
  if (!active.length) return 'none';
  return JSON.stringify(
    active.map((e) => ({
      category: e.category,
      title: e.title,
      entity_name: e.entity_name,
      event_date: e.event_date
    }))
  );
}

function isDuplicate(events, ev) {
  const key = (x) =>
    `${x.category}|${(x.entity_name || '').toLowerCase()}|${x.event_date || ''}`;
  const evKey = key(ev);
  return events.some(
    (existing) => existing.status !== 'dismissed' && key(existing) === evKey
  );
}

async function updateBadge(events) {
  const urgent = events.filter((e) => e.status === 'active' && e.severity === 'HIGH').length;
  await chrome.action.setBadgeBackgroundColor({ color: '#e5484d' });
  await chrome.action.setBadgeText({ text: urgent > 0 ? String(urgent) : '' });
}

// ---------- reminders ----------

async function fireReminder(eventId) {
  const { events } = await getState();
  const ev = events.find((e) => e.id === eventId);
  if (!ev || ev.status === 'dismissed' || ev.status === 'done') return;
  if (ev.status === 'snoozed') {
    ev.status = 'active';
    await chrome.storage.local.set({ events });
    await updateBadge(events);
  }
  chrome.notifications.create(`livo-${eventId}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `Livo: ${ev.title}`,
    message: ev.summary
  });
}
