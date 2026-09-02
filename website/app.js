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

/* ------------------------- dollar → trash scene (one bill, clear story) ------------------------- */

function initMoneyScene() {
  const canvas = document.getElementById("money-canvas");
  const scene = document.querySelector(".money-scene");
  if (!canvas || !scene) return;

  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phaseLabel = document.getElementById("money-phase-label");
  const phaseCopy = document.getElementById("money-phase-copy");
  const phaseDot = document.getElementById("money-dot");

  // Two clear beats: off (bill → trash), on (Livo catches it).
  const OFF_MS = 3200;
  const ON_MS = 3200;
  const GAP_MS = 700;
  const CYCLE = OFF_MS + GAP_MS + ON_MS + GAP_MS;

  let w = 420;
  let h = 250;
  let dpr = 1;
  let lastPhase = "";

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function roundRect(x, y, rw, rh, r) {
    const rad = Math.min(r, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
    ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
    ctx.arcTo(x, y + rh, x, y, rad);
    ctx.arcTo(x, y, x + rw, y, rad);
    ctx.closePath();
  }

  function drawBill(x, y, scale, caught) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const bw = 72;
    const bh = 38;
    const grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    if (caught) {
      grad.addColorStop(0, "#157a4a");
      grad.addColorStop(0.5, "#2db56a");
      grad.addColorStop(1, "#157a4a");
    } else {
      grad.addColorStop(0, "#c9a227");
      grad.addColorStop(0.5, "#e8cc5a");
      grad.addColorStop(1, "#c9a227");
    }
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(22, 49, 38, 0.25)";
    ctx.lineWidth = 1.5;
    roundRect(-bw / 2, -bh / 2, bw, bh, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = caught ? "#06351f" : "#3d2d08";
    ctx.font = "800 16px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$99", 0, 1);
    ctx.restore();
  }

  function drawTrash(x, y, lidOpen) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(22, 49, 38, 0.12)";
    ctx.beginPath();
    ctx.ellipse(0, 36, 42, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#6b7f73";
    ctx.strokeStyle = "#4d5f55";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-34, -4);
    ctx.lineTo(-26, 34);
    ctx.quadraticCurveTo(0, 42, 26, 34);
    ctx.lineTo(34, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2c3a32";
    ctx.beginPath();
    ctx.ellipse(0, -4, 32, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -8);
    ctx.rotate(-lidOpen * 0.9);
    ctx.fillStyle = "#7d9185";
    ctx.strokeStyle = "#4d5f55";
    roundRect(-40, -7, 80, 11, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5c7166";
    roundRect(-9, -13, 18, 7, 3);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawLivo(x, y, power) {
    if (power <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = power;
    ctx.translate(x, y);
    const size = 48;
    const g = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    g.addColorStop(0, "#1a7a4c");
    g.addColorStop(1, "#0f5c3a");
    ctx.fillStyle = g;
    roundRect(-size / 2, -size / 2, size, size, 13);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 24px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("L", 0, 1);
    ctx.restore();
  }

  function setCaption(on) {
    const key = on ? "on" : "off";
    if (key === lastPhase) return;
    lastPhase = key;
    phaseLabel.textContent = on ? "Livo on" : "Livo off";
    phaseCopy.textContent = on
      ? "With Livo, the $99 leak is caught."
      : "Without Livo, the leak hits the trash.";
    phaseDot.classList.toggle("on", on);
  }

  function easeIn(t) {
    return t * t;
  }

  function tick(now) {
    const t = now % CYCLE;
    const on = t >= OFF_MS + GAP_MS && t < OFF_MS + GAP_MS + ON_MS;
    setCaption(on);

    const cx = w / 2;
    const startY = 28;
    const catchY = h * 0.42;
    const trashY = h - 48;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f7fbf8";
    ctx.fillRect(0, 0, w, h);

    let billY = startY;
    let billScale = 1;
    let caught = false;
    let lid = 0;
    let livoPower = 0;

    if (t < OFF_MS) {
      const p = Math.min(1, t / (OFF_MS - 400));
      billY = startY + (trashY - 18 - startY) * easeIn(p);
      if (p > 0.82) {
        lid = Math.min(1, (p - 0.82) / 0.18);
        billScale = 1 - (p - 0.82) / 0.18;
      }
    } else if (t < OFF_MS + GAP_MS) {
      billY = -80;
      lid = Math.max(0, 1 - (t - OFF_MS) / 250);
    } else if (t < OFF_MS + GAP_MS + ON_MS) {
      const local = t - OFF_MS - GAP_MS;
      livoPower = Math.min(1, local / 280);
      const p = Math.min(1, local / (ON_MS - 500));
      const mid = startY + (catchY - startY) * easeIn(Math.min(1, p / 0.55));
      if (p < 0.55) {
        billY = mid;
      } else {
        caught = true;
        const absorb = (p - 0.55) / 0.45;
        billY = catchY;
        billScale = Math.max(0, 1 - absorb);
        billY = catchY - absorb * 8;
      }
    } else {
      livoPower = Math.max(0, 1 - (t - (OFF_MS + GAP_MS + ON_MS)) / 280);
      billY = -80;
    }

    drawTrash(cx, trashY, lid);
    drawLivo(cx, catchY, livoPower);
    if (billY > -40 && billScale > 0.04) drawBill(cx, billY, billScale, caught);

    if (!reduced) requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduced) {
    setCaption(true);
    requestAnimationFrame((now) => {
      ctx.fillStyle = "#f7fbf8";
      ctx.fillRect(0, 0, w, h);
      drawTrash(w / 2, h - 48, 0);
      drawLivo(w / 2, h * 0.42, 1);
      drawBill(w / 2, h * 0.42, 1, true);
    });
    return;
  }

  requestAnimationFrame(tick);
}

initMoneyScene();

