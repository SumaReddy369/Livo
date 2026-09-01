# Livo — Personal Operations Manager (Chrome Extension)

Livo watches your Gmail inbox and surfaces the small number of things that actually need your attention — money leaks, expirations, deadlines, and travel logistics — before they become problems. It is an action-detection engine, not an email summarizer.

Every new email is analyzed by an LLM using the Livo master prompt (`src/prompt.js`), which returns strictly validated JSON events in four categories: `MONEY_LEAK`, `EXPIRATION`, `ACTION_DEADLINE`, and `TRAVEL`. Events appear in a side-panel digest organized into **Urgent / Needs attention / Upcoming**.

## Project layout

```
manifest.json          Manifest V3 config (permissions, OAuth, side panel)
src/prompt.js          The Livo master system prompt + per-email templating
src/background.js      Service worker: scheduled scans, dedup, storage, reminders
src/gmail.js           Gmail REST API client (list/read messages, MIME parsing)
src/llm.js             Provider abstraction (OpenAI / Anthropic / Gemini) + JSON validation
sidepanel/             The daily digest UI
options/               Settings page (provider, API key, scan cadence, preferences)
icons/                 Extension icons (regenerate with tools/make-icons.ps1)
```

## Setup

### 1. Load the extension

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Note the generated **Extension ID** — you need it for the next step.

### 2. Create a Google OAuth client (one-time)

Livo reads Gmail through the official API with a read-only scope.

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create a project (e.g. "Livo").
2. Enable the **Gmail API** (APIs & Services → Library).
3. Configure the **OAuth consent screen** (External, add yourself as a test user).
4. Create credentials → **OAuth client ID** → Application type: **Chrome Extension** → paste your Extension ID.
5. Copy the client ID into `manifest.json` under `oauth2.client_id`, then reload the extension.

> Tip: to keep the extension ID stable across reloads/machines, add a `key` field to the manifest (Chrome docs: "Keep a consistent extension ID").

### 3. Configure Livo

1. Click the Livo icon → the side panel opens → **Open settings** (or right-click the icon → Options).
2. Pick an AI provider (OpenAI, Anthropic, or Gemini) and paste your API key. It is stored only in local extension storage.
3. Click **Connect Gmail** and approve the read-only permission.
4. Optionally add personal preferences (e.g. "Netflix is essential — don't suggest canceling it").
5. Save, then hit **Scan now** in the side panel.

## How it works

- A background alarm scans recent inbox mail on your chosen cadence (default every 30 minutes, looking back 3 days, max 20 emails per scan). Already-processed message IDs are skipped, so each email is only analyzed once.
- Each email's headers, timestamps, and body are inserted into the master prompt's `FINAL INPUT` block along with your current date/timezone, preferences, and a compact list of previously detected events (for model-side deduplication).
- Model output is strictly validated: only allowed categories/severities/action types survive, dates must be `YYYY-MM-DD`, and financial values must be numeric — anything else becomes `null` or is discarded. A second, local dedup pass keys on category + entity + date.
- Suggested actions are **recommendations, never executions**: "Cancel Trial" opens the source email so you act yourself; "Remind Me" schedules a Chrome notification. Livo never claims an action was completed.
- Every event can be marked done, snoozed a day, dismissed, or restored. HIGH-severity active events show as a red badge count on the toolbar icon.

## Website (landing page + waitlist)

The `website/` folder is a static landing page with an animated demo of the extension and a waitlist form backed by Supabase.

### Set up the waitlist database

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard, open **SQL Editor**, paste the contents of `website/supabase-setup.sql`, and run it. This creates a `waitlist` table locked down with row-level security (visitors can only insert, never read).
3. Copy your project's **URL** and **anon public key** from Project Settings → API into `website/config.js`.

The anon key is safe to expose in frontend code because RLS only allows inserts.

### Preview and deploy

- Preview locally by opening `website/index.html` in a browser (everything is static — no build step).
- Deploy the `website/` folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Signups appear in Supabase → Table Editor → `waitlist`.
- To replace the animated demo with a real screen recording later, swap the `.demo-stage` block in `index.html` for a `<video>` tag.

## Privacy notes

- Email content goes only to the AI provider you configure, one email at a time, truncated to ~9 KB of text.
- Nothing is sent to any Livo server — there is no server.
- The Gmail scope is read-only (`gmail.readonly`); Livo cannot modify or send mail.
