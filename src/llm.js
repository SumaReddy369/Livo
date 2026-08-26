// LLM provider abstraction. Each provider takes the fully assembled Livo
// prompt and must return the raw model text, which we then parse as JSON.

export const PROVIDER_DEFAULTS = {
  openai: { model: 'gpt-4o-mini' },
  anthropic: { model: 'claude-3-5-haiku-latest' },
  gemini: { model: 'gemini-2.0-flash' }
};

export async function analyzeEmail(settings, prompt) {
  const raw = await callProvider(settings, prompt);
  return parseLivoJson(raw);
}

async function callProvider(settings, prompt) {
  const { provider, apiKey } = settings;
  const model = settings.model || PROVIDER_DEFAULTS[provider]?.model;
  if (!apiKey) throw new Error('missing-api-key');

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).map((c) => c.text || '').join('');
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

const CATEGORIES = ['MONEY_LEAK', 'EXPIRATION', 'ACTION_DEADLINE', 'TRAVEL'];
const SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'];
const ACTION_TYPES = ['CANCEL', 'COMPARE', 'REMIND', 'VIEW_DETAILS', 'IGNORE'];

// Parse and validate the model output against the Livo schema. Anything the
// prompt forbids (bad category, non-numeric money, malformed date) is
// discarded rather than shown to the user.
export function parseLivoJson(raw) {
  let text = (raw || '').trim();
  // Defensive: strip code fences if the model ignored the no-markdown rule.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model returned no JSON');
  const parsed = JSON.parse(text.slice(start, end + 1));

  const events = Array.isArray(parsed.events) ? parsed.events : [];
  const valid = events
    .filter((e) => CATEGORIES.includes(e.category) && SEVERITIES.includes(e.severity))
    .map((e) => ({
      category: e.category,
      severity: e.severity,
      title: String(e.title || '').slice(0, 80),
      summary: String(e.summary || ''),
      entity_name: e.entity_name ?? null,
      event_date: /^\d{4}-\d{2}-\d{2}$/.test(e.event_date || '') ? e.event_date : null,
      financial_impact: {
        amount_change: numOrNull(e.financial_impact?.amount_change),
        new_recurring_cost: numOrNull(e.financial_impact?.new_recurring_cost),
        currency: e.financial_impact?.currency || 'USD'
      },
      suggested_actions: (Array.isArray(e.suggested_actions) ? e.suggested_actions : [])
        .filter((a) => ACTION_TYPES.includes(a.action_type))
        .map((a) => ({ label: String(a.label || a.action_type), action_type: a.action_type }))
    }));

  return { has_actionable_event: valid.length > 0, events: valid };
}

function numOrNull(v) {
  return typeof v === 'number' && isFinite(v) ? v : null;
}
