import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Konštanty pre výpočet kurtov ─────────────────────────────
const REG_MIN = 6; // klasika: min 6 hráčov na kurt (3v3)
const REG_MAX = 8; // klasika: max 8 hráčov na kurt (4v4)
const SMALL = 4; // 2v2: presne 4 hráči na kurt

let myName = localStorage.getItem("volley_name") || "";
let events = [];
let showPast = false;

const $ = (id) => document.getElementById(id);
const days = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return `${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
};
const isPast = (ev) =>
  new Date(`${ev.date}T${ev.time || "23:59"}`).getTime() <
  Date.now() - 3 * 3600 * 1000;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

function showError(msg) {
  const e = $("error");
  e.textContent = msg;
  e.classList.remove("hidden");
}
function hideError() {
  $("error").classList.add("hidden");
}

// Vráti optimálnu alokáciu kurtov: maximalizuje hrajúcich,
// pri zhode preferuje menej kurtov, potom viac klasík.
function calculateCourts(total, willing) {
  let best = { courts: 0, playing: 0, small: 0, reg: 0, sitting: total };
  const maxA = Math.floor(willing / SMALL);
  for (let a = 0; a <= maxA; a++) {
    const rem = total - SMALL * a;
    if (rem < 0) continue;
    const maxB = Math.floor(rem / REG_MIN);
    for (let b = 0; b <= maxB; b++) {
      const regPlayers = Math.min(rem, REG_MAX * b);
      const playing = SMALL * a + regPlayers;
      const courts = a + b;
      if (courts === 0) continue;
      const better =
        playing > best.playing ||
        (playing === best.playing && courts < best.courts) ||
        (playing === best.playing && courts === best.courts && b > best.reg);
      if (better) {
        best = { courts, playing, small: a, reg: b, sitting: total - playing };
      }
    }
  }
  return best;
}

function courtLabel(n) {
  if (n === 4) return "2v2";
  if (n === 6) return "3v3";
  if (n === 7) return "3v4";
  if (n === 8) return "4v4";
  return `${n}?`;
}

// Všetky spôsoby ako rozdeliť k klasických kurtov na súčet S (každý kurt 6–8).
function enumerateRegularSplits(k, S) {
  const results = [];
  for (let c6 = 0; c6 <= k; c6++) {
    for (let c7 = 0; c7 <= k - c6; c7++) {
      const c8 = k - c6 - c7;
      if (c8 < 0) continue;
      if (6 * c6 + 7 * c7 + 8 * c8 === S) {
        const arr = [];
        for (let i = 0; i < c8; i++) arr.push(8);
        for (let i = 0; i < c7; i++) arr.push(7);
        for (let i = 0; i < c6; i++) arr.push(6);
        results.push(arr);
      }
    }
  }
  return results;
}

// Všetky rozdelenia dosahujúce daný počet kurtov a hrajúcich hráčov.
function enumerateSplits(courts, playing, willing) {
  const results = [];
  const maxA = Math.min(Math.floor(willing / SMALL), courts);
  for (let a = 0; a <= maxA; a++) {
    const remainCourts = courts - a;
    const remainPlayers = playing - SMALL * a;
    if (remainCourts === 0) {
      if (remainPlayers === 0) results.push({ a, sizes: [] });
      continue;
    }
    if (remainPlayers < 0) continue;
    const regSplits = enumerateRegularSplits(remainCourts, remainPlayers);
    for (const rs of regSplits) results.push({ a, sizes: rs });
  }
  // Zoradiť: viac 2v2 najprv, potom väčšie kurty najprv
  results.sort((x, y) => {
    if (y.a !== x.a) return y.a - x.a;
    for (let i = 0; i < Math.max(x.sizes.length, y.sizes.length); i++) {
      const dx = y.sizes[i] ?? -1;
      const cx = x.sizes[i] ?? -1;
      if (dx !== cx) return dx - cx;
    }
    return 0;
  });
  return results;
}

function formatSplit(split) {
  const parts = [];
  for (let i = 0; i < split.a; i++) parts.push("2v2");
  for (const s of split.sizes) parts.push(courtLabel(s));
  return parts.join(" + ");
}

function courtSummary(total, willing) {
  if (total === 0) return "Nikto ešte nie je prihlásený.";
  const c = calculateCourts(total, willing);
  const totalStr = `${total} ${plural(total, "hráč", "hráči", "hráčov")}`;
  if (c.courts === 0) {
    const hints = [];
    if (willing < SMALL)
      hints.push(`${SMALL - willing}× zaškrtnutie „aj 2v2"`);
    if (total < REG_MIN) hints.push(`${REG_MIN - total} do klasiky`);
    return `${totalStr} — málo na kurt (chýba: ${hints.join(" alebo ")}).`;
  }
  const sitting =
    c.sitting > 0
      ? ` · ⚠ ${c.sitting} ${plural(c.sitting, "hráč nehrá", "hráči nehrajú", "hráčov nehrá")}`
      : "";
  const courtsLine = `${totalStr} · Rezervovať ${c.courts} ${plural(c.courts, "kurt", "kurty", "kurtov")}`;
  const labels = enumerateSplits(c.courts, c.playing, willing).map(formatSplit);
  if (labels.length <= 1) return `${courtsLine}: ${labels[0] || ""}${sitting}`;
  return `${courtsLine}${sitting}<br>Možnosti: ${labels.join(", alebo ")}`;
}

function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

async function load() {
  const { data: evs, error: e1 } = await sb
    .from("events")
    .select("*")
    .order("date")
    .order("time");
  const { data: sgs, error: e2 } = await sb
    .from("signups")
    .select("*")
    .order("created_at");
  if (e1 || e2) {
    const err = e1 || e2;
    console.error("load() zlyhal:", err);
    showError(
      "Nepodarilo sa načítať dáta – skontroluj Supabase URL/kľúč a tabuľky.\n" +
        (err.message || ""),
    );
    return;
  }
  hideError();
  events = evs.map((ev) => ({
    ...ev,
    players: sgs.filter((s) => s.event_id === ev.id),
  }));
  render();
}

function render() {
  const upcoming = events.filter((e) => !isPast(e));
  const past = events.filter(isPast).reverse();

  $("name-box").classList.toggle("hidden", !!myName);
  $("topbar").classList.toggle("hidden", !myName);
  if (myName) $("my-name-label").textContent = myName;

  $("events").innerHTML = upcoming.length
    ? upcoming.map(cardHTML).join("")
    : '<div class="empty">Zatiaľ žiadne termíny. Vytvor prvý cez „+ Nový termín“.</div>';
  $("events").style.cssText = "display:flex;flex-direction:column;gap:14px";

  $("past-section").classList.toggle("hidden", past.length === 0);
  $("past-toggle").textContent = showPast
    ? "Skryť odohrané"
    : `Odohrané termíny (${past.length})`;
  $("past-events").classList.toggle("hidden", !showPast);
  $("past-events").innerHTML = past.map(cardHTML).join("");
}

function cardHTML(ev) {
  const total = ev.players.length;
  const willing = ev.players.filter((p) => p.willing_2v2).length;
  const joined = myName && ev.players.some((p) => p.name === myName);
  const past = isPast(ev);

  const names = ev.players
    .map(
      (p) =>
        `${esc(p.name)}${p.willing_2v2 ? ' <span class="tag">2v2</span>' : ""}`,
    )
    .join(", ");

  let action = "";
  if (!past && myName) {
    if (joined) {
      action = `<button class="btn leave" data-action="leave-event" data-id="${ev.id}">Odhlásiť sa</button>`;
    } else {
      action = `
        <label class="checkbox">
          <input type="checkbox" data-w2v2="${ev.id}" />
          <span>Nemám problém hrať aj 2v2</span>
        </label>
        <button class="btn" data-action="join-event" data-id="${ev.id}">Idem hrať</button>`;
    }
  }

  return `<div class="card event ${past ? "past" : ""}">
    <button class="x" title="Zrušiť termín" data-action="delete-event" data-id="${ev.id}">&#10005;</button>
    <div class="ev-title">${fmtDate(ev.date)} &middot; ${esc(ev.time?.slice(0, 5) || "")}</div>
    <div class="ev-place">${esc(ev.place)}</div>
    ${ev.note ? `<div class="ev-note">${esc(ev.note)}</div>` : ""}
    <div class="courts">${courtSummary(total, willing)}</div>
    ${total ? `<div class="names">${names}</div>` : ""}
    ${action ? `<div class="actions">${action}</div>` : ""}
  </div>`;
}

// ── Akcie ────────────────────────────────────────────────────
function setName() {
  const first = $("fname-input").value.trim();
  const last = $("lname-input").value.trim();
  if (!first || !last) {
    showError("Zadaj meno aj priezvisko.");
    return;
  }
  myName = `${first} ${last}`;
  localStorage.setItem("volley_name", myName);
  hideError();
  render();
}

function clearName() {
  myName = "";
  localStorage.removeItem("volley_name");
  $("fname-input").value = "";
  $("lname-input").value = "";
  render();
}

function toggleForm() {
  $("form").classList.toggle("hidden");
}

function togglePast() {
  showPast = !showPast;
  render();
}

async function createEvent() {
  const date = $("f-date").value;
  const time = $("f-time").value || "18:00";
  const place = $("f-place").value.trim();
  const note = $("f-note").value.trim();

  if (!date || !place) {
    showError("Vyplň dátum a miesto.");
    return;
  }

  const { error } = await sb.from("events").insert({ date, time, place, note });
  if (error) {
    console.error("createEvent() zlyhal:", error);
    showError(
      "Uloženie zlyhalo: " +
        (error.message || "neznáma chyba") +
        (error.hint ? "\nHint: " + error.hint : "") +
        (error.details ? "\nDetail: " + error.details : ""),
    );
    return;
  }
  hideError();
  $("form").classList.add("hidden");
  $("f-place").value = "";
  $("f-note").value = "";
  load();
}

async function joinEvent(id) {
  const cb = document.querySelector(`input[data-w2v2="${id}"]`);
  const willing_2v2 = !!(cb && cb.checked);
  const { error } = await sb
    .from("signups")
    .insert({ event_id: id, name: myName, willing_2v2 });
  if (error) {
    console.error("joinEvent() zlyhal:", error);
    if (error.code === "23505") {
      showError(
        `Meno „${myName}" je už prihlásené na tomto termíne. Ak si to nie ty, priprav si iné meno (napr. pridaj druhé meno) cez „zmeniť" hore.`,
      );
    } else {
      showError("Prihlásenie zlyhalo: " + error.message);
    }
  } else load();
}

async function leaveEvent(id) {
  const { error } = await sb
    .from("signups")
    .delete()
    .eq("event_id", id)
    .eq("name", myName);
  if (error) {
    console.error("leaveEvent() zlyhal:", error);
    showError("Odhlásenie zlyhalo: " + error.message);
  } else load();
}

async function deleteEvent(id) {
  if (!confirm("Naozaj zrušiť tento termín?")) return;
  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) {
    console.error("deleteEvent() zlyhal:", error);
    showError("Zrušenie zlyhalo: " + error.message);
  } else load();
}

// ── Event delegation namiesto inline onclick ─────────────────
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  switch (action) {
    case "set-name":
      setName();
      break;
    case "clear-name":
      clearName();
      break;
    case "toggle-form":
      toggleForm();
      break;
    case "toggle-past":
      togglePast();
      break;
    case "create-event":
      createEvent();
      break;
    case "join-event":
      joinEvent(id);
      break;
    case "leave-event":
      leaveEvent(id);
      break;
    case "delete-event":
      deleteEvent(id);
      break;
  }
});

["fname-input", "lname-input"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") setName();
  });
});

// ── Realtime: zmeny od ostatných sa prejavia okamžite ────────
sb.channel("volley")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "events" },
    load,
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "signups" },
    load,
  )
  .subscribe();

if (myName) {
  const parts = myName.split(/\s+/);
  $("fname-input").value = parts[0] || "";
  $("lname-input").value = parts.slice(1).join(" ") || "";
}
load();
