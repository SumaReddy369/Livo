// Gmail REST API helpers. Auth is handled via chrome.identity (OAuth token
// tied to the client_id in manifest.json).

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'No auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

export function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

async function gmailFetch(token, path) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 401) {
    await removeCachedToken(token);
    throw new Error('gmail-auth-expired');
  }
  if (!res.ok) {
    throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function listRecentMessageIds(token, lookbackDays, maxResults) {
  const q = encodeURIComponent(`newer_than:${lookbackDays}d -in:chats -in:trash -in:spam`);
  const data = await gmailFetch(token, `/messages?q=${q}&maxResults=${maxResults}`);
  return (data.messages || []).map((m) => m.id);
}

export async function getMessage(token, id) {
  const msg = await gmailFetch(token, `/messages/${id}?format=full`);
  return parseMessage(msg);
}

function header(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function decodeBase64Url(data) {
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

// Walk the MIME tree collecting text/plain (preferred) and text/html parts.
function extractBody(payload) {
  let plain = '';
  let html = '';
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plain += decodeBase64Url(part.body.data) + '\n';
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64Url(part.body.data) + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return plain.trim() || stripHtml(html);
}

const MAX_BODY_CHARS = 9000;

function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const dateHeader = header(headers, 'Date');
  const sent = dateHeader ? new Date(dateHeader) : new Date(Number(msg.internalDate));
  const tzMatch = dateHeader ? dateHeader.match(/([+-]\d{4}|[A-Z]{2,5})\s*(\(.*\))?$/) : null;

  let body = extractBody(msg.payload) || msg.snippet || '';
  if (body.length > MAX_BODY_CHARS) {
    body = body.slice(0, MAX_BODY_CHARS) + '\n[...email truncated...]';
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: header(headers, 'From'),
    to: header(headers, 'To'),
    subject: header(headers, 'Subject'),
    sentDate: isNaN(sent) ? null : sent.toISOString().slice(0, 10),
    sentTime: isNaN(sent) ? null : sent.toISOString().slice(11, 16) + ' UTC',
    timezone: tzMatch ? tzMatch[1] : 'unknown',
    body
  };
}
