/* ========================================================================
   Livo landing page: animated product demo + Supabase waitlist
   ======================================================================== */

/* ------------------------- animated demo ------------------------- */

const DEMO_EMAILS = [
  {
    from: "StreamMax", subject: "Your free trial ends tomorrow — you'll be charged $99",
    color: "#e5484d", initial: "S", verdict: "flag",
  },
  {
    from: "Comcast", subject: "Upcoming changes to your monthly rate",
    color: "#4f7cff", initial: "C", verdict: "flag",
  },
  {
    from: "Delta Air Lines", subject: "Check-in is now open for your flight to Austin",
    color: "#8a5cf6", initial: "D", verdict: "flag",
  },
  {
    from: "Amazon", subject: "Your order has shipped!",
    color: "#f0b429", initial: "A", verdict: "noise",
  },
  {
    from: "DoorDash", subject: "Your order has been delivered",
    color: "#3dd68c", initial: "D", verdict: "noise",
  },
];

const DEMO_EVENTS = [
  {
    bucket: "urgent", sev: "high", cat: "MONEY LEAK", date: "Tomorrow",
    title: "StreamMax Trial Ends Tomorrow",
    sum: "Your free trial converts to a $99/year charge tomorrow unless canceled.",
    entity: "StreamMax", money: "$99 charge", savings: "Potential savings: $99",
    actions: [{ label: "Cancel Trial", primary: true }, { label: "Remind Me" }],
  },
  {
    bucket: "urgent", sev: "high", cat: "TRAVEL", date: "Tomorrow",
    title: "Flight Check-In Available",
    sum: "Check-in is open for tomorrow's 8:40 AM Delta flight to Austin.",
    entity: "Delta Air Lines", money: null, savings: null,
    actions: [{ label: "Check In Now", primary: true }],
  },
  {
    bucket: "attention", sev: "medium", cat: "MONEY LEAK", date: "Oct 1",
    title: "Comcast Rate Increases $15",
    sum: "Your internet plan rises from $55 to $70/month — that's $180 more per year.",
    entity: "Comcast", money: "+$15 \u2192 $70", savings: null,
    actions: [{ label: "Compare Plans", primary: true }, { label: "Review Changes" }],
  },
];

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let demoRun = 0; // token so a replay cancels the previous run

function buildInboxRow(mail) {
  const row = document.createElement("div");
  row.className = "inbox-row";
  row.innerHTML = `
    <span class="inbox-avatar" style="background:${mail.color}">${mail.initial}</span>
    <span class="inbox-text">
      <span class="inbox-from">${mail.from}</span>
      <span class="inbox-subject">${mail.subject}</span>
    </span>
    <span class="inbox-tag ${mail.verdict === "flag" ? "flag" : "noise"}">
      ${mail.verdict === "flag" ? "FLAGGED" : "IGNORED"}
    </span>`;
  return row;
}

function buildEventCard(ev) {
  const card = document.createElement("div");
  card.className = "demo-event";
  card.innerHTML = `
    <div class="demo-event-head">
      <span class="sev-dot ${ev.sev}"></span>
      <span class="cat-chip">${ev.cat}</span>
      <span class="demo-event-date">${ev.date}</span>
    </div>
    <div class="demo-event-title">${ev.title}</div>
    <div class="demo-event-sum">${ev.sum}</div>
    <div class="demo-event-meta">
      <span class="demo-entity">${ev.entity}</span>
      ${ev.money ? `<span class="money-chip-demo">${ev.money}</span>` : ""}
      ${ev.savings ? `<span class="savings-pill">${ev.savings}</span>` : ""}
    </div>
    <div class="demo-event-actions">
      ${ev.actions.map((a) => `<button class="demo-act ${a.primary ? "primary" : ""}">${a.label}</button>`).join("")}
    </div>
    <div class="demo-manage">
      <span>Open email</span><span>Mark done</span><span>Snooze 1 day</span><span>Dismiss</span>
    </div>`;
  return card;
}

async function runDemo() {
  const token = ++demoRun;
  const alive = () => token === demoRun;

  const inbox = $("demo-inbox-list");
  const events = $("demo-events");
  const panel = $("demo-panel");
  const status = $("demo-status");
  const caption = $("demo-caption");
  const badge = $("demo-badge");
  const extIcon = $("demo-ext-icon");
  const scanLabel = $("demo-scan-label");

  inbox.innerHTML = "";
  events.querySelectorAll(".demo-bucket").forEach((b) => {
    b.hidden = true;
    b.querySelector(".bucket-cards").innerHTML = "";
  });
  panel.classList.remove("open");
  badge.classList.remove("show");
  extIcon.classList.remove("pulse");
  scanLabel.textContent = "Scan now";
  scanLabel.classList.remove("scanning");
  status.textContent = "Idle";

  caption.textContent = "A normal day. Emails keep arriving…";
  const rows = DEMO_EMAILS.map(buildInboxRow);
  rows.forEach((r) => inbox.appendChild(r));

  await sleep(600);
  for (const row of rows) {
    if (!alive()) return;
    row.classList.add("show");
    await sleep(420);
  }

  if (!alive()) return;
  await sleep(700);
  caption.textContent = "Livo scans quietly in the background — one email at a time.";
  extIcon.classList.add("pulse");
  panel.classList.add("open");
  scanLabel.textContent = "Scanning…";
  scanLabel.classList.add("scanning");
  await sleep(800);

  for (let i = 0; i < rows.length; i++) {
    if (!alive()) return;
    const row = rows[i];
    const mail = DEMO_EMAILS[i];
    row.classList.add("scanning");
    status.textContent = `Analyzing: "${mail.subject.slice(0, 38)}…"`;
    await sleep(850);
    if (!alive()) return;
    row.classList.remove("scanning");
    row.querySelector(".inbox-tag").classList.add("show");
    row.classList.add(mail.verdict === "flag" ? "flagged" : "ignored");
  }

  if (!alive()) return;
  extIcon.classList.remove("pulse");
  scanLabel.textContent = "Scan now";
  scanLabel.classList.remove("scanning");
  status.textContent = "3 things need your attention · 2 ignored as noise";
  caption.textContent = "Only what matters makes it through. Noise never does.";

  for (const ev of DEMO_EVENTS) {
    if (!alive()) return;
    const bucket = $(`demo-bucket-${ev.bucket}`);
    bucket.hidden = false;
    const card = buildEventCard(ev);
    bucket.querySelector(".bucket-cards").appendChild(card);
    await sleep(60);
    card.classList.add("show");
    await sleep(650);
  }

  if (!alive()) return;
  badge.textContent = "2";
  badge.classList.add("show");
  caption.textContent = "Clear severity. Exact dollars. One-click next steps. That's Livo.";

  await sleep(6500);
  if (!alive()) return;
  runDemo(); // loop
}

$("demo-replay").addEventListener("click", () => runDemo());

// start the demo when it scrolls into view (or immediately if already visible)
const stage = $("demo-stage");
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      runDemo();
    }
  },
  { threshold: 0.35 }
);
observer.observe(stage);

/* ------------------------- Supabase waitlist ------------------------- */

const SUPABASE_URL = window.LIVO_CONFIG?.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.LIVO_CONFIG?.SUPABASE_ANON_KEY || "";

async function joinWaitlist(name, email) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("YOUR_PROJECT")) {
    return { ok: false, msg: "Waitlist isn't configured yet — add your Supabase keys to config.js." };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
    });
    if (res.status === 201) {
      return { ok: true, msg: "You're on the list! We'll email you when Livo opens up." };
    }
    if (res.status === 409) {
      return { ok: true, msg: "You're already on the waitlist — see you soon!" };
    }
    const body = await res.text();
    console.error("Supabase error", res.status, body);
    return { ok: false, msg: "Something went wrong. Please try again in a minute." };
  } catch (err) {
    console.error(err);
    return { ok: false, msg: "Network error — check your connection and try again." };
  }
}

function wireForm(formId, msgId) {
  const form = $(formId);
  const msg = $(msgId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.elements.name.value;
    const email = form.elements.email.value;
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Joining…";
    msg.className = "form-msg";
    msg.textContent = "";

    const result = await joinWaitlist(name, email);

    msg.textContent = result.msg;
    msg.classList.add(result.ok ? "ok" : "err");
    btn.disabled = false;
    btn.textContent = "Join the waitlist";
    if (result.ok) form.reset();
  });
}

wireForm("hero-waitlist", "hero-waitlist-msg");
wireForm("cta-waitlist", "cta-waitlist-msg");
