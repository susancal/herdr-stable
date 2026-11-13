// The stable: every agent is a horse with a stall of its own. Working: head in the manger.
// Idle: they trot to the water trough and chat; idle long enough, they lie down in the straw.
// Blocked: pawing at the stall (five minutes and they rear up and the barn bell goes). Done:
// a blue ribbon and a hop in confetti until you look. New agents trot in the barn door;
// closed ones leave with saddlebags. Sub-agents stand by their parent's stall as foals and
// leave when they finish. Three finishes in five minutes and a pony brings apples. A cat
// lives here. Lights go down after dark, the windows show the real weather, and the barn
// decorates for the season. Hover a horse to see what it's on; click to go to its terminal.
import { View, div, svg } from "gpui-kit";
import { agents, terminals, spaces, panes, shared, run, setAgentOrder, playSound } from "herdr";
import * as A from "./art.js";
import * as D from "./decor.js";

// Real weather in the windows. Off by default: it sends your IP address to ipapi.co for a
// rough location, then asks Open-Meteo for the current conditions there.
const WEATHER = false;
const WALK_SPEED = 0.16; // px per ms
const CAT_SPEED = 0.12;
const NAP_AFTER = 10 * 60 * 1000;
const ALARM_AFTER = 5 * 60 * 1000;
const SWEAT_AFTER = 30 * 60 * 1000;
const BUCKETS_AFTER = 60 * 60 * 1000;
const PARTY_FINISHES = 3, PARTY_WINDOW = 5 * 60 * 1000, PARTY_LENGTH = 8 * 60 * 1000;
const GRAD_BOW = 2500;
const SOUND_GAP = 1500;
const RIBBON_WALL_W = 150;
const STRAW_SPOTS = 3;
const MIN_STALLS = 3;
const FRONT_ROW = 6;
const CHAT = ["…", "neigh", "lgtm", "🥕", "standup?", "ship it", "hay?", "brb", "tabs > spaces", "🐴", "whinny", "hmm"];
const PIZZA_CHAT = ["🍎", "crunch", "apples!", "🍎", "best day", "nom nom"];
const CHALK = ["#f4f1e6", "#f2d27a", "#a8d8f0", "#f2a8c0"];
const CONFETTI = ["#e05252", "#e0b43d", "#58b368", "#3d8be0", "#9b6bdc", "#e05c8c"];
const POSTERS = [["HAY IS\nFOR\nHORSES", "#c0643f"], ["STABLE\nRELEASE", "#3d8be0"], ["NO\nHORSING\nAROUND", "#58a368"], ["push\n--force?\nwhoa.", "#9b6bdc"]];
const STATUS = { working: "#3d8be0", blocked: "#e05252", done: "#58c26b", idle: "#9aa0aa" };
// The sidebar's space colors (mods/my-spaces), by stored name.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

function sky(hour) {
  if (hour < 5 || hour >= 21) return { top: "#141c38", bottom: "#2a3766", stars: true };
  if (hour < 7) return { top: "#9cc3e6", bottom: "#f4b98a" };
  if (hour < 17) return { top: "#7fc4f0", bottom: "#c4e6f8" };
  if (hour < 19) return { top: "#f7c98b", bottom: "#f29a6b" };
  return { top: "#3a3a6e", bottom: "#e07a5f" };
}
const lightsDown = (hour) => hour >= 20 || hour < 6;

// WMO weather codes (Open-Meteo) to what the windows show.
function weatherKind(code) {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 51) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code >= 2) return "clouds";
  return "clear";
}

function season(d) {
  const m = d.getMonth(), day = d.getDate();
  if ((m === 11 && day === 31) || (m === 0 && day <= 2)) return "newyear";
  if (m === 11) return "winter";
  if (m === 9 || (m === 10 && day <= 7)) return "halloween";
  if (m === 1 && day === 14) return "valentine";
  return null;
}

const rotate = (list, n) => list.map((_, i) => list[(i + n) % list.length]);
const clock = (d) => [`${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`, d.getHours() < 12 ? "AM" : "PM"];
const remote = (address) => address.includes("/");
const bucketOf = (a) => {
  const names = `${a.program?.key ?? ""} ${a.app ?? ""}`;
  return Object.entries(A.BUCKETS).find(([k]) => names.includes(k))?.[1] ?? A.PALETTE.mug;
};
// Live sub-agents under `addr`, however deep.
const descendants = (all, addr) =>
  all.filter((k) => k.parent === addr && k.state === "live").flatMap((k) => [k, ...descendants(all, k.address)]);

function loadNumber(key) {
  try { return Number(localStorage.getItem(key)) || null; } catch { return null; }
}
function saveNumber(key, n) {
  try { localStorage.setItem(key, String(n)); } catch {}
}
const dayOf = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
// Today's ribbons, one per finish: { who, at }. A new day starts an empty wall.
function loadRibbons(day) {
  try {
    const r = JSON.parse(localStorage.getItem("stable.ribbons") ?? "null");
    if (r?.day === day && Array.isArray(r.list)) return r;
  } catch {}
  return { day, list: [] };
}
function saveRibbons(r) {
  try { localStorage.setItem("stable.ribbons", JSON.stringify(r)); } catch {}
}

export default class Stable extends View {
  init(props, cx) {
    // Night mode dims the barn after dark. Off unless the layout sets "night": true.
    this.nightMode = props?.night === true;
    this.size = { width: 1400, height: 250 };
    this.desk = {}; // address -> desk index, kept while the agent lives
    this.at = {}; // walker -> { spot, x, y, fromX, until, dur, face }
    this.seen = {}; // address -> what we knew last render: { status, pal }
    this.idleSince = {};
    this.blockedSince = {};
    this.finishes = []; // when agents finished, for the pizza
    this.party = null; // { start }
    this.leaving = {}; // address -> pal: closed agents on their way out
    this.kids = {}; // intern address -> { x, y, p, pal } where it sat last render
    this.grads = {}; // intern address -> { x, y, p, pal, start }
    this.away = [];
    this.hovered = null;
    this.weather = null;
    this.started = false;
    this.cat = { goal: "sit", desk: null, since: Date.now() };
    this.now = new Date();
    this.ribbons = loadRibbons(dayOf(this.now));
    const partyStart = loadNumber("stable.party");
    if (partyStart && Date.now() - partyStart < PARTY_LENGTH) this.startParty(partyStart, cx);
    this.rearing = new Set();
    this.lastSound = 0;
    cx.timer.every(30000, (cx) => { this.now = new Date(); cx.notify(); });
    cx.timer.every(9000, (cx) => { if (this.wanderCat()) cx.notify(); });
    if (WEATHER) {
      this.refreshWeather(cx);
      cx.timer.every(30 * 60 * 1000, (cx) => this.refreshWeather(cx));
    }
  }

  refreshWeather(cx) {
    cx.spawn(async (cx) => {
      try {
        if (!this.where) {
          const r = await fetch("https://ipapi.co/json/");
          const j = await r.json();
          if (typeof j.latitude === "number") this.where = { lat: j.latitude.toFixed(1), lon: j.longitude.toFixed(1) };
        }
        if (!this.where) return;
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${this.where.lat}&longitude=${this.where.lon}&current=weather_code`);
        const j = await r.json();
        this.weather = weatherKind(j.current?.weather_code ?? 0);
        cx.notify();
      } catch {}
    });
  }

  // One sound at a time: anything inside the gap after the last one is dropped, so a
  // crowd arriving together trots in once. Nothing plays on the first render after a
  // reload, when everyone is already here.
  sound(name) {
    const now = Date.now();
    if (!this.started || now - this.lastSound < SOUND_GAP) return;
    this.lastSound = now;
    playSound(`mods/stable/sounds/${name}.mp3`);
  }

  // Stalls are handed out once, lowest free first, so nobody swaps. Agents that closed
  // trot out the barn door with their saddlebags.
  seat(list, door, cx) {
    const live = new Set(list.map((a) => a.address));
    for (const k of Object.keys(this.desk)) {
      if (live.has(k)) continue;
      const at = this.at[k];
      if (this.started && at && this.seen[k]) {
        this.leaving[k] = this.seen[k].pal;
        this.walk(`leave:${k}`, "door", door.x, door.y, WALK_SPEED, cx, at);
        this.sound("trot");
      }
      delete this.desk[k]; delete this.at[k]; delete this.idleSince[k]; delete this.blockedSince[k]; delete this.seen[k];
    }
    const taken = new Set(Object.values(this.desk));
    for (const a of list) {
      if (a.address in this.desk) continue;
      let i = 0;
      while (taken.has(i)) i++;
      this.desk[a.address] = i;
      taken.add(i);
      this.sound("trot");
    }
  }

  // Since-when for idle and blocked, and finishes for the ribbons and the apples.
  track(list, now, cx) {
    const changed = {};
    for (const s of spaces()) for (const t of s.tabs ?? []) changed[t.id] = t.changed_at;
    for (const a of list) {
      const was = this.seen[a.address]?.status;
      if (a.status !== "idle") delete this.idleSince[a.address];
      else this.idleSince[a.address] ??= changed[a.tab] ?? now;
      if (a.status !== "blocked") delete this.blockedSince[a.address];
      else this.blockedSince[a.address] ??= was === "blocked" || !was ? (changed[a.tab] ?? now) : now;
      if (this.started && a.status === "done" && was && was !== "done") {
        this.finishes.push(now);
        this.award(a, now);
      }
      this.seen[a.address] = { status: a.status, pal: A.look(a.address) };
    }
    this.finishes = this.finishes.filter((t) => now - t < PARTY_WINDOW);
    if (!this.party && this.finishes.length >= PARTY_FINISHES) {
      this.finishes = [];
      this.sound("crunch");
      this.startParty(now, cx);
    }
  }

  // The start is saved, so a reload partway through picks the party up where it was.
  startParty(start, cx) {
    this.party = { start };
    saveNumber("stable.party", start);
    cx.timer.after(start + PARTY_LENGTH - Date.now() + 50, (cx) => {
      this.party = null;
      saveNumber("stable.party", 0);
      cx.notify();
    });
  }

  // A ribbon for the wall, which starts empty each day.
  award(a, now) {
    const day = dayOf(new Date(now));
    if (this.ribbons.day !== day) this.ribbons = { day, list: [] };
    this.ribbons.list.push({ who: a.space_name + (a.tab_name ? ` · ${a.tab_name}` : ""), at: now });
    saveRibbons(this.ribbons);
  }

  // Starts a walk when a walker's spot changes; returns where it is (or is heading).
  // `start`: where a new walker appears (the door), instead of at its spot.
  walk(key, spot, x, y, speed, cx, start) {
    const now = Date.now();
    const fresh = !this.at[key] && Boolean(start);
    const at = this.at[key] ?? (start ? { ...start, spot: null } : null);
    if (!at) return (this.at[key] = { spot, x, y, fromX: x, until: 0, dur: 1 });
    if (at.spot === spot && at.x === x && at.y === y) return at;
    const dur = Math.max(400, Math.hypot(x - at.x, y - at.y) / speed);
    this.at[key] = { spot, x, y, fromX: at.x, until: now + dur, dur, face: at.face };
    if (spot === "door" || fresh) this.doorUntil = Math.max(this.doorUntil ?? 0, now + dur);
    cx.timer.after(dur + 30, (cx) => cx.notify());
    return this.at[key];
  }

  geometry(W, H, deskCount) {
    const P = A.P;
    const floorY = H - 30;
    const wallBottom = floorY - 14 * P;
    const slot = A.SLOT * P;
    const front = Math.min(deskCount, FRONT_ROW);
    const back = Math.max(0, deskCount - FRONT_ROW);
    const desksW = Math.max(front, back ? back + 0.5 : 0) * slot;
    const gap = 18 * P;
    const doorW = D.DOOR * P;
    const kitchen = A.FEED.width * P + gap + A.TROUGH.width * P + 24 * P + A.STRAW.width * P + 6 * P + A.BARREL.width * P;
    const room = doorW + 20 + A.BARREL.width * P + 10 + desksW + 50 + kitchen;
    const doorX = Math.max(16, Math.round((W - room) / 2));
    const plantL = doorX + doorW + 20;
    const x0 = plantL + A.BARREL.width * P + 10;
    const zoneX = x0 + desksW + 50;
    const coolerX = zoneX + A.FEED.width * P + gap;
    const couchX = coolerX + A.TROUGH.width * P + 24 * P;
    const deskPos = (i) => i < FRONT_ROW
      ? { x: x0 + i * slot, y: floorY, back: false }
      : { x: x0 + (i - FRONT_ROW) * slot + slot / 2, y: floorY - 10 * P, back: true };
    return {
      P, floorY, wallBottom, slot, x0, deskPos, zoneX, coolerX, couchX, doorX, plantL,
      plantR: couchX + A.STRAW.width * P + 6 * P,
      door: { x: doorX + 1 * P, y: wallBottom + 2 * P },
    };
  }

  // Picks the cat's next stop: a nap on an empty keyboard, or a sit somewhere on the floor.
  wanderCat() {
    const g = this.g;
    if (!g) return false;
    const c = this.cat;
    if (c.goal === "sleep" && this.away.includes(c.desk) && Date.now() - c.since < 60000) return false;
    if (this.away.length && Math.random() < 0.45) {
      this.cat = { goal: "sleep", desk: this.away[Math.floor(Math.random() * this.away.length)], since: Date.now() };
    } else {
      const span = g.couchX + A.STRAW.width * g.P - g.x0;
      this.cat = { goal: "sit", desk: null, x: Math.round(g.x0 + Math.random() * span), since: Date.now() };
    }
    return true;
  }

  render(cx) {
    const { width: W, height: H } = this.size;
    const list = agents();
    // Agents on other machines are out in another pasture: they're on the call, not in a stall.
    const here = list.filter((a) => !remote(a.address));
    const all = terminals();
    const now = Date.now();
    setAgentOrder(list.map((a) => a.address));

    A.setScale(Math.max(3, Math.min(6, Math.floor(H / 60))));
    const deskCount = Math.max(MIN_STALLS, here.length, ...Object.values(this.desk).map((i) => i + 1));
    const g = (this.g = this.geometry(W, H, deskCount));
    this.seat(here, g.door, cx);
    this.track(list, now, cx);
    const P = g.P;
    const byDesk = {};
    for (const a of here) byDesk[this.desk[a.address]] = a;
    const tabs = {};
    for (const s of spaces()) for (const t of s.tabs ?? []) tabs[t.id] = t;
    const branches = {};
    for (const p of panes()) branches[p.pane] = p.branch;

    // The apples: the pony trots in, leaves them on the hay bales, and trots out.
    const party = this.party;
    const counter = { x: g.zoneX + 2 * P, y: g.floorY };
    const courierTrip = party ? Math.max(400, Math.hypot(counter.x - g.door.x, counter.y - g.door.y) / WALK_SPEED) : 0;
    const pizzaHere = party && now >= party.start + courierTrip;

    // Where everyone goes. Long idlers lie down in the straw while there's room; the rest
    // gather around the trough (or the apples), alternating sides, further out each pair.
    const idle = here.filter((a) => a.status === "idle").sort((a, b) => this.idleSince[a.address] - this.idleSince[b.address]);
    const nappers = pizzaHere ? [] : idle.filter((a) => now - this.idleSince[a.address] > NAP_AFTER).slice(0, STRAW_SPOTS);
    const chatters = idle.filter((a) => !nappers.includes(a));
    const place = {};
    nappers.forEach((a, k) => { place[a.address] = { spot: "couch", x: g.couchX + k * 4 * P, y: g.floorY, face: 1 }; });
    const hub = pizzaHere ? { left: g.zoneX - 24 * P, right: g.zoneX + A.FEED.width * P - 2 * P }
      : { left: g.coolerX - (A.HORSE - 3) * P, right: g.coolerX + A.TROUGH.width * P - 2 * P };
    chatters.forEach((a, k) => {
      const left = k % 2 === 0;
      const ring = Math.floor(k / 2) * 14 * P;
      place[a.address] = { spot: pizzaHere ? "pizza" : "cooler", x: left ? hub.left - ring : hub.right + ring, y: g.floorY, face: left ? 1 : -1 };
    });
    for (const a of here) {
      const d = g.deskPos(this.desk[a.address]);
      place[a.address] ??= { spot: "desk", x: d.x + 2 * P, y: d.y, face: 1 };
    }
    this.away = here.filter((a) => place[a.address].spot !== "desk").map((a) => this.desk[a.address]);
    if (this.cat.goal === "sleep" && !this.away.includes(this.cat.desk)) this.wanderCat();

    const hour = this.now.getHours();
    const dark = this.nightMode && lightsDown(hour);
    const when = season(this.now);
    const hovered = here.find((a) => a.address === this.hovered);

    // After dark, a horse that needs you keeps its stall lit: both are drawn above the dimming.
    const lit = (a) => dark && (a.status === "blocked" || a.status === "done") && place[a.address].spot === "desk";
    const alarmed = here.filter((a) => a.status === "blocked" && now - (this.blockedSince[a.address] ?? now) > ALARM_AFTER);
    if (alarmed.some((a) => !this.rearing.has(a.address))) this.sound("neigh");
    this.rearing = new Set(alarmed.map((a) => a.address));
    const people = here.map((a) => {
      const p = place[a.address];
      const start = this.started ? g.door : null;
      const at = this.walk(a.address, p.spot, p.x, p.y, WALK_SPEED, cx, start);
      return { y: p.y, lit: lit(a), ...this.person(a, at, g, p.face, tabs[a.tab], alarmed.includes(a)) };
    });
    const dimPeople = people.filter((p) => !p.lit);
    const backPeople = dimPeople.filter((p) => p.y < g.floorY).map((p) => p.el);
    const frontPeople = dimPeople.filter((p) => p.y >= g.floorY).map((p) => p.el);
    const desks = Array.from({ length: deskCount }, (_, i) => {
      const pos = g.deskPos(i);
      const a = byDesk[i];
      return { back: pos.back, lit: Boolean(a) && lit(a), el: this.deskAt(i, pos, g, a, a && tabs[a.tab], a && branches[a.pane]) };
    });
    const dimDesks = desks.filter((d) => !d.lit);
    this.started = true;

    return div().id("stable").size_full().relative().overflow_hidden().bg("#a8483a")
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .children([
        ...this.room(W, H, g, sky(hour), list, all, now, when),
        ...dimDesks.filter((d) => d.back).map((d) => d.el),
        ...backPeople,
        ...dimDesks.filter((d) => !d.back).map((d) => d.el),
        this.prop(A.FEED, g.zoneX, g),
        ...(pizzaHere ? [this.prop({ width: A.FEED.width, rects: A.APPLES }, g.zoneX, g)] : []),
        this.prop(A.TROUGH, g.coolerX, g),
        this.prop(A.STRAW, g.couchX, g),
        this.prop(A.BARREL, g.plantR, g),
        when === "winter" ? this.prop(A.TREE, g.plantL - 3 * P, g) : this.prop(A.BARREL, g.plantL, g),
        ...(when === "halloween" ? [this.prop(A.PUMPKIN, g.plantL + 10 * P, g), this.prop(A.PUMPKIN, g.plantR - 9 * P, g),
          ...(pizzaHere ? [] : [this.prop(A.PUMPKIN, g.zoneX + 13 * P, g, 11 * P)])] : []),
        ...here.flatMap((a) => this.interns(a, descendants(all, a.address), g)),
        ...this.graduates(g, now, cx),
        ...frontPeople,
        ...this.leavers(g, now),
        ...(party ? [this.courier(party, counter, courierTrip, g, now, cx)] : []),
        this.kitty(g, cx),
        ...(dark ? this.night(W, H, g, byDesk, deskCount, when) : []),
        ...desks.filter((d) => d.lit).map((d) => d.el),
        ...people.filter((p) => p.lit).map((p) => p.el),
        ...people.flatMap((p) => (p.said ? [p.said] : [])),
        ...(alarmed.length ? D.alarm(W, H, g.deskPos(this.desk[alarmed[0].address]).x + 24 * P) : []),
        ...(hovered && this.at[hovered.address] ? [this.thought(hovered, this.at[hovered.address], g)] : []),
        ...(list.length ? [] : [this.sign(W, g)]),
      ]);
  }

  room(W, H, g, s, list, all, now, when) {
    const { P, wallBottom, zoneX } = g;
    const els = [
      div().absolute().left(0).top(wallBottom - 9 * P).w(W).h(9 * P).bg("#8a3a2e"),
      div().absolute().left(0).top(wallBottom - 9 * P - 2).w(W).h(2).bg("#f2efe8"),
      div().absolute().left(0).top(wallBottom - 4).w(W).h(4).bg("#5c3a22"),
      div().absolute().left(0).top(wallBottom).w(W).h(H - wallBottom).bg("#c2a46c"),
    ];
    // Vertical barn boards, and straw scattered on the dirt floor.
    for (let x = 30; x < W; x += 30) els.push(div().absolute().left(x).top(0).w(1).h(wallBottom - 9 * P - 2).bg("#933d31"));
    for (let i = 0, y = wallBottom + 6; y < H; i++, y += 9)
      for (let x = (i * 37) % 70 + 10; x < W; x += 70) els.push(div().absolute().left(x).top(y).w(6).h(1).bg("#e3c25e"));

    // Along the wall, clear of the door and kitchen: windows and posters, with bare wall
    // between them where the pasture call hangs when anyone is out.
    const winH = Math.max(36, Math.min(110, wallBottom - 9 * P - 40));
    const weather = this.weather ?? (when === "winter" ? "snow" : null);
    const remotes = list.filter((a) => remote(a.address)).map((a) => ({
      address: a.address, pane: a.pane, pal: A.look(a.address), machine: a.address.split("/")[0],
      name: a.space_name, status: a.status, title: a.title || a.tab_name || a.space_name,
    }));
    const specials = [
      ...(remotes.length ? [(x) => D.pastureCall(x + 4, 12, winH + 4, remotes)] : []),
    ];
    const busy = [[g.doorX - 40, g.doorX + D.DOOR * P + 30], [zoneX - 90, zoneX + 170 + RIBBON_WALL_W]];
    for (let x = 40, k = 0; x + 120 < W - 20; x += 220) {
      if (busy.some(([a, b]) => x + 120 > a && x < b)) continue;
      if (k % 2 === 1) {
        if (specials.length) els.push(specials.shift()(x));
      } else els.push(k % 5 === 4 ? D.poster(x + 25, 18, winH, POSTERS[Math.floor(k / 5) % POSTERS.length]) : D.windowPane(x, 16, 120, winH, s, weather));
      k++;
    }
    els.push(D.door(g.doorX, wallBottom, P, now < (this.doorUntil ?? 0)));
    els.push(D.clock(zoneX - 70, 20, ...clock(this.now)));
    const count = (st) => list.filter((a) => a.status === st).length;
    const napping = list.filter((a) => this.at[a.address]?.spot === "couch").length;
    const interns = list.reduce((n, a) => n + descendants(all, a.address).length, 0);
    if (this.ribbons.day !== dayOf(this.now)) this.ribbons = { day: dayOf(this.now), list: [] };
    els.push(D.ribbonWall(zoneX + 162, 14, RIBBON_WALL_W, winH + 10, this.ribbons.list));
    els.push(D.chalkboard(zoneX, 14, [
      ["#a8d8f0", `MUNCHING  ${count("working")}`],
      ["#9fe0a8", `UNREAD    ${count("done")}`],
      ["#ff9a8a", `STUCK     ${count("blocked")}`],
      ["#e8e4dc", `AT TROUGH ${count("idle") - napping}`],
      ["#c9c2ff", `NAPPING   ${napping}`, napping > 0],
      ["#f2d27a", `FOALS     ${interns}`, interns > 0],
      ["#ff8a7a", "APPLES!!", Boolean(this.party)],
    ]));
    if (when === "winter" || when === "newyear") els.push(...D.stringLights(W, 2));
    if (when === "newyear") els.push(D.banner(W, wallBottom - 9 * P - 30, "HAPPY NEW YEAR", "#9b6bdc"));
    if (when === "valentine") els.push(D.banner(W, wallBottom - 9 * P - 30, "♥  HAPPY VALENTINE'S  ♥", "#e05c8c"));
    return els;
  }

  sign(W, g) {
    return div().absolute().left(W / 2 - 140).top(g.wallBottom - 34).w(280).py(4).rounded(4).bg("#00000033")
      .text_size(11).text_color("#fffaf0").flex().justify_center().child("The stalls are empty. Start an agent and a horse will trot in.");
  }

  prop(art, x, g, lift = 0) {
    return div().absolute().left(x).top(g.floorY - A.BOX * g.P - lift).w(art.width * g.P).h(A.BOX * g.P).children(A.rects(art.rects, A.PALETTE));
  }

  // A stall with its manger, water bucket, lucky horseshoe and lantern, the branch on a
  // tag, the chalkboard, and the nameplate of whoever lives there.
  deskAt(i, pos, g, a, tab, branch) {
    const P = g.P;
    const st = a?.status;
    const away = Boolean(a) && this.at[a.address]?.spot !== "desk";
    const pal = a ? { ...A.PALETTE, mug: bucketOf(a) } : A.PALETTE;
    const done = st === "done" && !away;
    const overtime = st === "working" && tab?.working_since && Date.now() - tab.working_since > BUCKETS_AFTER;
    const plate = a ? this.plate(a) : null;
    return div().id(`desk-${i}`).absolute().left(pos.x).top(pos.y - A.BOX * P).w(A.SLOT * P).h(A.BOX * P + 28)
      .when(Boolean(a), (el) => el.cursor_pointer().on_click(() => run("pane.focus", { pane: a.pane })))
      .children([
        ...A.rects(A.STALL.stall, pal), ...A.rects(A.STALL.manger, pal),
        ...(overtime ? A.rects(A.BUCKET_PILE, pal) : []),
        this.screen(away ? "idle" : st, away, P),
        ...(branch ? [this.sticky(branch, P)] : []),
        A.layer(A.STALL.shoe, pal, A.SLOT).when(done, (el) => el.loop("left", { from: -1.5, to: 1.5, period: 160 })),
        ...(done ? [this.ding(P), ...this.confetti(P, a.address)] : []),
        ...(plate ? [plate.absolute().left(6 * P).top(pos.back ? (A.BOX - 29) * P : A.BOX * P + 6)] : []),
      ]);
  }

  screen(st, screensaver, P) {
    const [sx, sy, sw, sh] = A.STALL.screen;
    const bg = { blocked: "#4a1a1e", done: "#143a24", working: "#1f3328" }[st] ?? "#24352c";
    return div().absolute().left(sx * P).top((A.BOX + sy) * P).w(sw * P).h(sh * P).bg(bg).overflow_hidden()
      .when(st === "working", (el) => el.children(CHALK.map((c, k) =>
        div().absolute().left(P * (k % 2 === 0 ? 1 : 2)).top(P * (1 + 2 * k) - 1).h(P - 1).bg(c)
          .loop("width", { from: P, to: P * (8 - (k % 2)), period: 700 + k * 260, easing: "linear" }))))
      .when(st === "blocked", (el) => el.flex().items_center().justify_center().text_size(14).font_bold().text_color("#ff6b6b")
        .child("!").loop("opacity", { from: 0.4, to: 1, period: 700 }))
      .when(st === "done", (el) => el.flex().items_center().justify_center().text_size(13).font_bold().text_color("#6be38b").child("✓"))
      .when(screensaver, (el) => el.child(div().absolute().top(P * 3).h(P).w(P).bg("#f4f1e6")
        .loop("left", { from: P, to: P * 8, period: 5000 })));
  }

  sticky(branch, P) {
    return div().absolute().left(17 * P).top((A.BOX - 29) * P).w(11 * P).h(4 * P).px(2).bg("#f2e6c8")
      .border_1().border_color("#a87c43").flex().items_center().overflow_hidden()
      .text_size(7).text_color("#4a3a10").child(div().truncate().child(branch));
  }

  ding(P) {
    return div().absolute().left(29 * P).top((A.BOX - 23) * P).text_size(10).font_bold().text_color("#ffd76a")
      .child("ding!").loop("opacity", { from: 0, to: 1, period: 640 });
  }

  // Paper falling over the stall, for as long as the news is unread.
  confetti(P, seed) {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 16 }, (_, k) => {
      const r = ((h >>> (k % 24)) ^ Math.imul(k + 1, 2654435761)) >>> 0;
      const x = (4 + (r % 34)) * P;
      return div().absolute().left(x).w(P).h(k % 3 === 0 ? P * 2 : P).bg(CONFETTI[k % CONFETTI.length])
        .loop("top", { from: (A.BOX - 30) * P - (k % 5) * 8, to: (A.BOX - 1) * P, period: 1100 + ((r >>> 3) % 900), easing: "linear" })
        .loop("left", { from: x - 4, to: x + 4, period: 500 + ((r >>> 5) % 400) });
    });
  }

  spaceTile(id) {
    const icon = (shared("space.icons") ?? {})[id];
    const c = (shared("space.colors") ?? {})[id] ?? "ansi6";
    const fill = c.startsWith("#") ? c : MARK[c] ?? "#22a99a";
    return div().size(12).flex_none().rounded(3).bg(fill).flex().items_center().justify_center().text_size(8).text_color("#ffffff")
      .when(Boolean(icon?.svg), (el) => el.child(svg(icon.svg).size(8)))
      .when(Boolean(icon?.text), (el) => el.child(icon.text));
  }

  plate(a) {
    const focused = a.focused;
    return div().max_w((A.SLOT - 8) * A.P).h(16).px(5).gap(4).rounded(4).flex().items_center()
      .bg(focused ? "#fff6dd" : "#00000040").text_size(10).text_color(focused ? "#3b2a1a" : "#fffaf0")
      .child(div().size(6).flex_none().rounded_full().bg(STATUS[a.status] ?? STATUS.idle))
      .child(this.spaceTile(a.space))
      .when(remote(a.address), (el) => el.child(div().flex_none().text_size(9).text_color("#fffaf0").child("🎧")))
      .child(div().truncate().child(a.space_name + (a.tab_name ? ` · ${a.tab_name}` : "")));
  }

  // Sub-agents: foals at their parent's manger.
  interns(a, kids, g) {
    if (!kids.length) return [];
    const P = g.P;
    const p = Math.max(2, Math.round(P * 0.55));
    const pos = g.deskPos(this.desk[a.address]);
    const x0 = pos.x + 28 * P;
    const shown = kids.slice(0, 3);
    const els = shown.map((k, i) => {
      const pal = A.look(k.address);
      const x = x0 + i * 8 * P;
      this.kids[k.address] = { x, y: pos.y, p, pal };
      const busy = k.status === "working";
      const stuck = k.status === "blocked" || k.status === "error";
      return div().id(`intern-${k.address}`).absolute().left(x).top(pos.y - A.BOX * p).w(A.HORSE * p).h(A.BOX * p)
        .cursor_pointer().on_click(() => run("terminal.peek", { terminal: k.address }))
        .children([
          this.pose(pal, -1, [A.STAND.farLegs, A.STAND.nearLegs, A.STAND.tail, A.STAND.body], p),
          busy ? this.part(A.STAND.neckDown, pal, -1, p).loop("top", { from: 0, to: -1, period: 300 + i * 40 })
            : this.part(A.STAND.neckUp, pal, -1, p),
          ...(stuck ? [this.bubble((A.BOX - 27) * p - 18, "#e05252", p, -1).child("!").loop("opacity", { from: 0.5, to: 1, period: 700 })] : []),
        ]);
    });
    if (kids.length > shown.length)
      els.push(div().absolute().left(x0 + 3 * 8 * P).top(pos.y - 14 * P).px(4).rounded(4).bg("#00000055")
        .text_size(10).text_color("#fffaf0").child(`+${kids.length - shown.length}`));
    return els;
  }

  // Foals that finished: a bow where they stood, then out the barn door.
  graduates(g, now, cx) {
    const live = new Set(terminals().filter((t) => t.state === "live").map((t) => t.address));
    for (const [k, info] of Object.entries(this.kids)) {
      if (live.has(k)) continue;
      delete this.kids[k];
      if (!this.started) continue;
      this.grads[k] = { ...info, start: now };
      cx.timer.after(GRAD_BOW + 20, (cx) => cx.notify());
    }
    return Object.entries(this.grads).flatMap(([k, gr]) => {
      const box = (el, x, y) => div().id(`grad-${k}`).absolute().left(x).top(y - A.BOX * gr.p).w(A.HORSE * gr.p).h(A.BOX * gr.p).child(el);
      if (now < gr.start + GRAD_BOW) {
        const body = this.pose(gr.pal, -1, [A.STAND.farLegs, A.STAND.nearLegs, A.STAND.tail, A.STAND.body], gr.p)
          .child(this.part(A.STAND.neckDown, gr.pal, -1, gr.p).loop("top", { from: 0, to: gr.p, period: 900 }));
        return [box(body, gr.x, gr.y).child(this.bubble((A.BOX - 27) * gr.p - 18, "#3b3b44", gr.p, -1).child("🎓 thx!"))];
      }
      const at = this.walk(`grad:${k}`, "door", g.door.x, g.door.y, WALK_SPEED, cx, { x: gr.x, y: gr.y });
      if (now >= at.until && at.until > 0) { delete this.grads[k]; delete this.at[`grad:${k}`]; return []; }
      return [box(this.walker(gr.pal, -1, [], gr.p), at.x, at.y)
        .transition("left", { duration: at.dur, easing: "ease-in-out" }).transition("top", { duration: at.dur, easing: "ease-in-out" })];
    });
  }

  // Closed agents trotting out with their saddlebags.
  leavers(g, now) {
    return Object.entries(this.leaving).flatMap(([k, pal]) => {
      const at = this.at[`leave:${k}`];
      if (!at || now >= at.until) { delete this.leaving[k]; delete this.at[`leave:${k}`]; return []; }
      return [div().id(`leave-${k}`).absolute().left(at.x).top(at.y - A.BOX * g.P).w(A.HORSE * g.P).h(A.BOX * g.P)
        .transition("left", { duration: at.dur, easing: "ease-in-out" }).transition("top", { duration: at.dur, easing: "ease-in-out" })
        .child(this.walker(pal, Math.sign(at.x - at.fromX) || -1, [A.STAND.bags], g.P))];
    });
  }

  courier(party, counter, trip, g, now, cx) {
    const stay = 2500;
    const leaving = now >= party.start + trip + stay;
    if (now >= party.start + 2 * trip + stay + 100) return div();
    if (!leaving) cx.timer.after(party.start + trip + stay - now + 20, (cx) => cx.notify());
    const goal = leaving ? g.door : counter;
    const at = this.walk("courier", leaving ? "door" : "counter", goal.x, goal.y, WALK_SPEED, cx, g.door);
    const walking = now < at.until;
    const face = walking ? Math.sign(at.x - at.fromX) || 1 : 1;
    const S = A.STAND;
    const body = walking ? this.walker(A.COURIER, face, leaving ? [S.blanket] : [S.blanket, S.basket], g.P)
      : this.pose(A.COURIER, 1, [S.farLegs, S.nearLegs, S.tail, S.body, S.neckUp, S.blanket]);
    return div().id("courier").absolute().left(at.x).top(at.y - A.BOX * g.P).w(A.HORSE * g.P).h(A.BOX * g.P)
      .transition("left", { duration: at.dur, easing: "ease-in-out" }).transition("top", { duration: at.dur, easing: "ease-in-out" })
      .child(body).when(!walking, (el) => el.child(this.bubble((A.BOX - 27) * g.P - 20, "#d94a3a").child("apples! 🍎")));
  }

  person(a, at, g, placeFace, tab, alarmed) {
    const P = g.P;
    const S = A.STAND;
    const napping = at.spot === "couch";
    const base = A.look(a.address);
    const pal = napping ? { ...base, eye: "#00000000" } : base;
    const walking = Date.now() < at.until;
    const face = walking ? Math.sign(at.x - at.fromX) || 1 : placeFace;
    at.face = face;
    const st = a.status;
    const swish = (f) => this.part(S.tail, pal, f).loop("left", { from: -P / 2, to: P / 2, period: 1400 + (pal.salt % 600) });
    let body, headTop;
    if (walking) [body, headTop] = [this.walker(pal, face), 27];
    else if (at.spot === "cooler" || at.spot === "pizza") {
      body = div().absolute().size_full().loop("top", { from: 0, to: -1, period: 2600 + (pal.salt % 900) })
        .children([this.part(S.farLegs, pal, face), this.part(S.nearLegs, pal, face), swish(face), this.part(S.body, pal, face), this.part(S.neckUp, pal, face)]);
      headTop = 27;
    } else if (napping) {
      body = this.pose(pal, 1, [A.LIE.body, A.LIE.head]).loop("top", { from: 0, to: 1, period: 3400 + (pal.salt % 700) });
      headTop = 12;
    } else if (st === "working") {
      const sweaty = tab?.working_since && Date.now() - tab.working_since > SWEAT_AFTER;
      body = div().absolute().size_full().children([
        this.part(S.farLegs, pal, 1), this.part(S.nearLegs, pal, 1), swish(1), this.part(S.body, pal, 1),
        this.part(S.neckDown, pal, 1).loop("top", { from: 0, to: -P / 2, period: 280 + (pal.salt % 120) }),
        ...(sweaty ? [0, 1].map((k) => div().absolute().left((k ? 9 : 15) * P).w(P).h(P * 1.5).rounded(P).bg("#7fc4f0")
          .loop("top", { from: (A.BOX - 19 + k) * P, to: (A.BOX - 12 + k) * P, period: 900 + k * 300, easing: "ease-in" })) : []),
      ]);
      headTop = 19;
    } else if (alarmed) {
      body = this.pose(pal, 1, [S.backLegs, S.pawFar, S.paw, S.tail, S.body, S.neckUp]).loop("top", { from: 0, to: -2 * P, period: 420 });
      headTop = 27;
    } else if (st === "done") {
      body = this.pose(pal, 1, [S.farLegs, S.nearLegs, S.tail, S.body, S.neckUp, S.ribbon]).loop("top", { from: 0, to: -6, period: 560 });
      headTop = 27;
    } else {
      // blocked: pawing the ground
      body = this.pose(pal, 1, [S.backLegs, S.farFront, S.tail, S.body, S.neckUp])
        .child(this.part(S.paw, pal, 1).loop("top", { from: 0, to: -P, period: 450 }));
      headTop = 27;
    }

    const top = (A.BOX - headTop) * P - 20;
    const bubble = (color) => this.bubble(top, color, P, napping ? 1 : face);
    let said = null;
    if (walking) said = null;
    else if (at.spot === "pizza") said = bubble("#d94a3a").frames(rotate(PIZZA_CHAT, pal.salt % PIZZA_CHAT.length), 1800 + (pal.salt % 900));
    else if (at.spot === "cooler") said = bubble("#3b3b44").frames(rotate(CHAT, pal.salt % CHAT.length), 2200 + (pal.salt % 1500));
    else if (napping) said = bubble("#6b5fb5").frames(["z", "zZ", "zZz", "zZ"], 900);
    else if (alarmed) said = bubble("#e05252").child("NEIGH!!").loop("opacity", { from: 0.5, to: 1, period: 400 });
    else if (st === "blocked") said = bubble("#e05252").child("!").loop("opacity", { from: 0.5, to: 1, period: 700 });
    else if (st === "done") said = bubble("#2f9a50").child("✓");
    at.headTop = headTop;

    // The bubble rides in its own zero-size box that follows the horse, so the scene can
    // draw it above the night dimming without it catching the horse's clicks.
    const follow = (el, id) => el.id(id).absolute().left(at.x).top(at.y - A.BOX * P)
      .transition("left", { duration: at.dur, easing: "ease-in-out" })
      .transition("top", { duration: at.dur, easing: "ease-in-out" });
    return {
      el: follow(div(), `person-${a.address}`).w(A.HORSE * P).h(A.BOX * P)
        .cursor_pointer().on_click(() => run("pane.focus", { pane: a.pane }))
        .on_hover((h, cx) => {
          if (h) this.hovered = a.address;
          else if (this.hovered === a.address) this.hovered = null;
          cx.notify();
        })
        .child(body),
      said: said && follow(div(), `said-${a.address}`).w(0).h(0).child(said),
    };
  }

  // What they're working on, in a thought cloud over their head.
  thought(a, at, g) {
    const P = g.P;
    const text = (a.title || a.tab_name || a.program?.name || "thinking…").replace(/\s+/g, " ").trim();
    const x = at.x + 14 * P;
    const y = at.y - A.BOX * P + (A.BOX - (at.headTop ?? 22)) * P;
    return div().absolute().left(Math.max(4, x - 20)).top(Math.max(2, y - 54))
      .child(div().max_w(260).px(8).py(4).rounded(10).bg("#ffffff").border_1().border_color("#3b3b44")
        .text_size(10).text_color("#3b3b44").child(div().truncate().child(`💭 ${text}`)))
      .child(div().absolute().left(16).top(26).size(7).rounded_full().bg("#ffffff").border_1().border_color("#3b3b44"))
      .child(div().absolute().left(22).top(35).size(4).rounded_full().bg("#ffffff").border_1().border_color("#3b3b44"));
  }

  part(list, pal, face, p = A.P) {
    return A.layer(face < 0 ? A.mirror(list, A.HORSE) : list, pal, A.HORSE, p);
  }

  pose(pal, face, parts, p = A.P) {
    return div().absolute().size_full().children(parts.map((l) => this.part(l, pal, face, p)));
  }

  // Trotting: the near and far legs swing opposite ways, the head nods, and `extra`
  // parts ride along (saddlebags, the apple basket).
  walker(pal, face, extra = [], p = A.P) {
    return div().absolute().size_full().loop("top", { from: 0, to: -2, period: 320 }).children([
      this.part(A.STAND.farLegs, pal, face, p).loop("left", { from: -p, to: p, period: 400, easing: "linear" }),
      this.part(A.STAND.tail, pal, face, p),
      this.part(A.STAND.body, pal, face, p),
      this.part(A.STAND.neckUp, pal, face, p).loop("top", { from: 0, to: p, period: 400 }),
      ...extra.map((l) => this.part(l, pal, face, p)),
      this.part(A.STAND.nearLegs, pal, face, p).loop("left", { from: p, to: -p, period: 400, easing: "linear" }),
    ]);
  }

  kitty(g, cx) {
    const P = g.P;
    const c = this.cat;
    const onDesk = c.goal === "sleep";
    const pos = onDesk ? g.deskPos(c.desk) : null;
    const x = onDesk ? pos.x + 27 * P : (c.x ?? g.couchX - 12 * P);
    const y = onDesk ? pos.y - 12 * P : g.floorY;
    const at = this.walk("cat", `${c.goal}-${c.desk}-${c.since}`, x, y, CAT_SPEED, cx);
    const walking = Date.now() < at.until;
    if (walking) at.face = Math.sign(at.x - at.fromX) || 1;
    const face = at.face ?? 1;
    const part = (list) => A.layer(face < 0 ? A.mirror(list, A.CAT) : list, A.PALETTE, A.CAT);
    let body;
    if (walking) body = div().absolute().size_full().children([
      part(A.KITTY.legsA).loop("left", { from: -1, to: 1.5, period: 360, easing: "linear" }),
      part(A.KITTY.legsB).loop("left", { from: 1.5, to: -1, period: 360, easing: "linear" }),
      part(A.KITTY.body).loop("top", { from: 0, to: -1, period: 360 }),
    ]);
    else if (onDesk) body = div().absolute().size_full().children([
      part(A.KITTY.sleep).loop("top", { from: 0, to: 0.8, period: 2400 }),
      div().absolute().left(9 * P).top((A.BOX - 10) * P).text_size(9).font_bold().text_color("#6b5fb5").frames(["z", "zz", "zzz", ""], 800),
    ]);
    else body = part(A.KITTY.sit);
    return div().id("cat").absolute().left(at.x).top(at.y - A.BOX * P).w(A.CAT * P).h(A.BOX * P)
      .transition("left", { duration: at.dur, easing: "ease-in-out" })
      .transition("top", { duration: at.dur, easing: "ease-in-out" })
      .child(body);
  }

  // After dark: the room dims, lamps light the occupied desks, and busy screens glow.
  night(W, H, g, byDesk, deskCount, when) {
    const P = g.P;
    const [bx, by, bw, bh] = A.STALL.bulb;
    const [sx, sy] = A.STALL.screen;
    const els = [div().absolute().left(0).top(0).w(W).h(H).bg("#0b1030").opacity(0.5)];
    if (when === "winter" || when === "newyear") els.push(...D.stringLights(W, 2));
    for (let i = 0; i < deskCount; i++) {
      const a = byDesk[i];
      if (!a || this.at[a.address]?.spot !== "desk") continue;
      const pos = g.deskPos(i);
      const top = pos.y - A.BOX * P;
      els.push(div().absolute().left(pos.x + (bx - 5) * P).top(top + (A.BOX + by) * P).size(14 * P).rounded_full().bg("#ffd27a").opacity(0.18));
      els.push(div().absolute().left(pos.x + bx * P).top(top + (A.BOX + by) * P).w(bw * P).h(bh * P).bg("#fff2b0"));
      if (a.status !== "idle") {
        els.push(div().absolute().left(pos.x + (sx - 3) * P).top(top + (A.BOX + sy - 3) * P).w(16 * P).h(14 * P).rounded(6 * P)
          .bg({ working: "#7fb6ff", blocked: "#ff6b6b", done: "#6be38b" }[a.status]).opacity(0.16));
        els.push(div().absolute().left(pos.x).top(top).w(A.SLOT * P).h(A.BOX * P).child(this.screen(a.status, false, P)));
      }
    }
    return els;
  }

  // Over the head, which is on the right when facing right.
  bubble(top, color, p = A.P, face = 1) {
    return div().absolute().left(face < 0 ? 0 : (A.HORSE - 12) * p).top(top).px(5).h(16).flex().items_center().rounded(6)
      .bg("#fffdf7").border_1().border_color("#3b3b44").text_size(10).font_bold().text_color(color).whitespace_nowrap();
  }
}
