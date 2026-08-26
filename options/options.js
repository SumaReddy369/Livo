const FIELDS = ['provider', 'apiKey', 'model', 'scanIntervalMinutes', 'lookbackDays', 'maxEmailsPerScan', 'userPreferences'];

const DEFAULTS = {
  provider: 'openai',
  apiKey: '',
  model: '',
  scanIntervalMinutes: 30,
  lookbackDays: 3,
  maxEmailsPerScan: 20,
  userPreferences: ''
};

async function load() {
  const { settings } = await chrome.storage.local.get('settings');
  const merged = { ...DEFAULTS, ...(settings || {}) };
  for (const f of FIELDS) {
    document.getElementById(f).value = merged[f];
  }
}

const NUMERIC_FIELDS = ['scanIntervalMinutes', 'lookbackDays', 'maxEmailsPerScan'];

document.getElementById('save').addEventListener('click', async () => {
  const settings = {};
  for (const f of FIELDS) {
    const value = document.getElementById(f).value;
    settings[f] = NUMERIC_FIELDS.includes(f)
      ? Number(value) || DEFAULTS[f]
      : value.trim();
  }

  await chrome.storage.local.set({ settings });
  await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' }).catch(() => {});

  const status = document.getElementById('save-status');
  status.textContent = 'Saved.';
  status.classList.remove('error');
  setTimeout(() => (status.textContent = ''), 2500);
});

document.getElementById('connect-gmail').addEventListener('click', () => {
  const status = document.getElementById('gmail-status');
  status.textContent = 'Connecting…';
  status.classList.remove('error');
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      status.textContent = chrome.runtime.lastError?.message || 'Connection failed.';
      status.classList.add('error');
    } else {
      status.textContent = 'Gmail connected.';
    }
  });
});

document.getElementById('clear-events').addEventListener('click', async () => {
  await chrome.storage.local.set({ events: [], processedIds: [] });
  const status = document.getElementById('save-status');
  status.textContent = 'All events cleared.';
  setTimeout(() => (status.textContent = ''), 2500);
});

load();
