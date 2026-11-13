// Pixel art as data. A rect is [x, y, w, h, color] in art units; y counts up from the
// floor line (so it's negative), and color is a palette key or a "#hex".
import { div } from "gpui-kit";

// px per art unit; the scene sets it from its height before drawing.
export let P = 3;
export const setScale = (p) => { P = p; };
export const BOX = 30; // units above the floor line a sprite's box reaches

export const mirror = (rects, width) => rects.map(([x, y, w, h, c]) => [width - x - w, y, w, h, c]);

export function rects(list, pal, p = P) {
  return list.map(([x, y, w, h, c]) =>
    div().absolute().left(x * p).top((BOX + y) * p).w(w * p).h(h * p).bg(pal[c] ?? c));
}

// One movable part of a sprite: its own box, so a loop on it moves all its rects.
export function layer(list, pal, width, p = P) {
  return div().absolute().left(0).top(0).w(width * p).h(BOX * p).children(rects(list, pal, p));
}

// Horses face right; the left-facing ones are mirrored in a box HORSE wide.
export const HORSE = 28;

const NECK_UP = [
  [20, -22, 4, 6, "coat"], [22, -25, 4, 4, "coat"], [25, -23, 3, 3, "coat"], [27, -22, 1, 2, "muzzle"],
  [22, -27, 1, 2, "coat"], [24, -26, 1, 1, "coat2"], [23, -24, 1, 1, "eye"],
  [19, -23, 1, 6, "mane"], [20, -25, 2, 3, "mane"], [26, -23, 1, 2, "blaze"],
  [24, -25, 1, 4, "halter"], [25, -22, 2, 1, "halter"],
];

export const STAND = {
  body: [[5, -18, 16, 1, "coat"], [4, -17, 20, 8, "coat"], [6, -10, 16, 1, "coat2"]],
  tail: [[2, -17, 2, 2, "mane"], [1, -16, 2, 7, "mane"], [0, -9, 2, 2, "mane"]],
  neckUp: NECK_UP,
  // Head in the manger.
  neckDown: [
    [21, -18, 4, 4, "coat"], [23, -15, 3, 4, "coat"], [23, -12, 4, 3, "coat"], [25, -10, 3, 3, "coat"], [27, -9, 1, 2, "muzzle"],
    [23, -13, 1, 1, "coat2"], [24, -12, 1, 1, "eye"], [20, -18, 1, 4, "mane"], [22, -15, 1, 3, "mane"],
    [26, -10, 1, 2, "blaze"], [25, -12, 1, 3, "halter"],
  ],
  // The far legs and the near legs swing opposite ways at a trot.
  farLegs: [[5, -9, 2, 8, "coat2"], [5, -1, 2, 1, "hoof"], [19, -9, 2, 8, "coat2"], [19, -1, 2, 1, "hoof"]],
  nearLegs: [[7, -9, 2, 6, "coat"], [7, -3, 2, 2, "sock"], [7, -1, 2, 1, "hoof"], [21, -9, 2, 6, "coat"], [21, -3, 2, 2, "sock"], [21, -1, 2, 1, "hoof"]],
  backLegs: [[5, -9, 2, 8, "coat2"], [5, -1, 2, 1, "hoof"], [7, -9, 2, 6, "coat"], [7, -3, 2, 2, "sock"], [7, -1, 2, 1, "hoof"]],
  farFront: [[19, -9, 2, 8, "coat2"], [19, -1, 2, 1, "hoof"]],
  // A front hoof lifted to paw the ground.
  paw: [[21, -9, 2, 3, "coat"], [22, -7, 2, 2, "coat"], [23, -6, 2, 1, "sock"], [25, -6, 1, 1, "hoof"]],
  pawFar: [[19, -9, 2, 3, "coat2"], [20, -7, 2, 2, "coat2"], [22, -6, 1, 1, "hoof"]],
  ribbon: [[24, -16, 3, 3, "ribbon"], [25, -15, 1, 1, "ribbonCenter"], [24, -13, 1, 2, "ribbon"], [26, -13, 1, 2, "ribbon"]],
  // Saddlebags with a carrot in them, carried out the barn door.
  bags: [[9, -19, 9, 2, "saddle"], [11, -17, 5, 5, "bag"], [11, -17, 5, 1, "bagFlap"],
    [13, -21, 1, 2, "carrot"], [12, -22, 1, 1, "leaf"], [14, -22, 1, 1, "leaf"]],
  blanket: [[8, -19, 11, 3, "blanket"]],
  basket: [[9, -23, 9, 4, "basket"], [9, -23, 9, 1, "basketRim"],
    [10, -24, 2, 1, "apple"], [13, -25, 2, 2, "apple"], [16, -24, 1, 1, "apple"], [14, -26, 1, 1, "leaf"]],
};

// Lying down in the straw.
export const LIE = {
  body: [[5, -9, 16, 1, "coat"], [4, -8, 20, 7, "coat"], [6, -2, 16, 1, "coat2"],
    [8, -2, 6, 2, "coat2"], [17, -2, 6, 2, "coat2"], [13, -1, 2, 1, "hoof"], [22, -1, 2, 1, "hoof"],
    [1, -8, 2, 7, "mane"], [0, -2, 3, 1, "mane"]],
  head: [[22, -11, 4, 5, "coat"], [24, -8, 4, 3, "coat"], [26, -5, 2, 3, "coat"], [27, -4, 1, 2, "muzzle"],
    [24, -10, 1, 2, "coat2"], [25, -7, 1, 1, "eye"], [21, -12, 1, 5, "mane"], [26, -8, 1, 3, "halter"]],
};

// The head and neck, for the portrait and the pasture call.
export const HEAD = [...STAND.body, ...NECK_UP];

// Headphones over the ears, for horses out in another machine's pasture.
export const HEADSET = [[21, -28, 4, 1, "headset"], [21, -27, 1, 2, "headset"], [24, -27, 1, 2, "headset"]];

export const SLOT = 48; // units per stall
export const STALL = {
  stall: [
    [0, -28, 48, 28, "stallWall"], [0, -21, 48, 1, "stallLine"], [0, -14, 48, 1, "stallLine"], [0, -7, 48, 1, "stallLine"],
    [0, -30, 48, 2, "post"], [0, -30, 2, 30, "post"], [46, -30, 2, 30, "post"],
    [4, -28, 12, 9, "frame"],
    [39, -28, 1, 2, "iron"], [38, -26, 3, 4, "lantern"], [39, -25, 1, 2, "lanternGlass"],
    [2, -1, 44, 1, "straw"], [5, -2, 3, 1, "straw"], [17, -2, 2, 1, "straw"], [33, -2, 4, 1, "straw"],
  ],
  manger: [
    [30, -12, 10, 2, "hay"], [31, -13, 2, 1, "hay2"], [35, -13, 3, 1, "hay"],
    [26, -10, 15, 2, "mangerTop"], [27, -8, 13, 4, "manger"], [28, -4, 2, 4, "post"], [37, -4, 2, 4, "post"],
    [42, -6, 3, 1, "iron"], [42, -5, 3, 4, "mug"],
  ],
  shoe: [[31, -28, 2, 1, "iron"], [30, -27, 1, 3, "shoeIron"], [33, -27, 1, 3, "shoeIron"], [30, -24, 4, 1, "shoeIron"]],
  screen: [5, -27, 10, 7], // the chalkboard, drawn by the scene: it changes with the horse
  bulb: [38, -25, 3, 2],
};

export const APPLES = [
  [2, -19, 8, 4, "bucketGrey"], [2, -20, 8, 1, "iron"], [3, -21, 2, 1, "apple"], [5, -22, 2, 2, "apple"], [7, -21, 2, 1, "apple"], [6, -23, 1, 1, "leaf"],
];
export const BUCKET_PILE = [[42, -9, 3, 3, "mug2"], [42, -12, 3, 3, "bucketGrey"], [43, -15, 3, 3, "mug2"]];

export const PUMPKIN = {
  width: 8,
  rects: [[3, -7, 1, 1, "stem"], [1, -6, 6, 1, "pumpkin"], [0, -5, 8, 5, "pumpkin"], [2, -5, 1, 5, "pumpkinShade"], [5, -5, 1, 5, "pumpkinShade"],
    [1, -4, 2, 1, "pumpkinFace"], [5, -4, 2, 1, "pumpkinFace"], [2, -2, 4, 1, "pumpkinFace"]],
};
export const TREE = {
  width: 16,
  rects: [[7, -26, 2, 2, "star"], [6, -24, 4, 4, "tree"], [4, -20, 8, 5, "tree2"], [2, -15, 12, 6, "tree"], [1, -9, 14, 4, "tree2"],
    [7, -5, 2, 3, "trunk"], [5, -2, 6, 2, "pot"], [5, -18, 1, 1, "ornRed"], [9, -13, 1, 1, "ornBlue"], [4, -11, 1, 1, "ornGold"],
    [11, -8, 1, 1, "ornRed"], [7, -21, 1, 1, "ornGold"], [12, -12, 1, 1, "ornGold"], [3, -7, 1, 1, "ornBlue"]],
};

// Where nappers lie down.
export const STRAW = {
  width: 34,
  rects: [
    [0, -3, 34, 3, "straw"], [3, -5, 28, 2, "straw"], [6, -6, 22, 1, "hay2"],
    [2, -4, 1, 1, "hay2"], [10, -5, 3, 1, "hay2"], [20, -4, 4, 1, "hay2"], [29, -3, 3, 1, "hay2"], [15, -7, 2, 1, "straw"],
  ],
};

export const TROUGH = {
  width: 20,
  rects: [
    [0, -9, 1, 8, "troughRim"], [19, -9, 1, 8, "troughRim"], [1, -8, 18, 1, "water"], [1, -7, 18, 6, "trough"],
    [1, -4, 18, 1, "iron"], [2, -1, 2, 1, "troughRim"], [16, -1, 2, 1, "troughRim"],
    [16, -18, 2, 9, "iron"], [13, -18, 4, 1, "iron"], [12, -19, 1, 2, "iron"], [17, -14, 2, 1, "iron"],
  ],
};

// Hay bales and an oat sack, where the apples go.
export const FEED = {
  width: 22,
  rects: [
    [0, -8, 12, 8, "hay"], [0, -8, 12, 1, "hay2"], [0, -4, 12, 1, "hay2"], [3, -8, 1, 8, "twine"], [8, -8, 1, 8, "twine"],
    [1, -15, 10, 7, "hay"], [1, -15, 10, 1, "hay2"], [4, -15, 1, 7, "twine"], [8, -15, 1, 7, "twine"],
    [13, -9, 7, 9, "sack"], [14, -10, 5, 1, "sackTie"], [15, -11, 3, 1, "sack"], [14, -6, 5, 2, "sackLabel"],
  ],
};

// A barrel with a pitchfork in it.
export const BARREL = {
  width: 9,
  rects: [
    [6, -24, 1, 15, "handleWood"], [4, -27, 1, 3, "iron"], [6, -27, 1, 3, "iron"], [8, -27, 1, 3, "iron"], [4, -24, 5, 1, "iron"],
    [0, -9, 9, 9, "barrel"], [0, -7, 9, 1, "iron"], [0, -3, 9, 1, "iron"], [7, -9, 2, 9, "barrelShade"],
  ],
};

// The barn cat, facing right, in a box CAT units wide.
export const CAT = 14;
export const KITTY = {
  body: [[0, -8, 1, 4, "cat"], [1, -5, 1, 1, "cat"], [2, -5, 8, 3, "cat"], [4, -5, 1, 3, "catStripe"], [6, -5, 1, 3, "catStripe"],
    [3, -3, 6, 1, "catLight"], [9, -7, 4, 4, "cat"], [9, -8, 1, 1, "cat"], [12, -8, 1, 1, "cat"], [11, -6, 1, 1, "catEye"], [12, -4, 1, 1, "catLight"]],
  legsA: [[3, -2, 1, 2, "catStripe"], [8, -2, 1, 2, "cat"]],
  legsB: [[5, -2, 1, 2, "cat"], [9, -2, 1, 2, "catStripe"]],
  sit: [[1, -2, 4, 1, "cat"], [1, -3, 1, 1, "cat"], [4, -6, 5, 6, "cat"], [5, -4, 3, 3, "catLight"], [6, -10, 4, 4, "cat"],
    [6, -11, 1, 1, "cat"], [9, -11, 1, 1, "cat"], [8, -9, 1, 1, "catEye"], [5, -6, 1, 2, "catStripe"]],
  sleep: [[1, -2, 3, 1, "cat"], [2, -4, 9, 4, "cat"], [4, -4, 1, 3, "catStripe"], [6, -4, 1, 3, "catStripe"], [8, -5, 4, 3, "cat"],
    [8, -6, 1, 1, "cat"], [11, -6, 1, 1, "cat"], [9, -4, 2, 1, "catStripe"]],
};

export const PALETTE = {
  stallWall: "#8a5a35", stallLine: "#74482a", post: "#5c3a22", frame: "#a0683f",
  iron: "#4a4a52", lantern: "#3b3b44", lanternGlass: "#f2d27a", shoeIron: "#9aa3ad",
  manger: "#7d4f2e", mangerTop: "#a0683f", hay: "#e3c25e", hay2: "#c9a13f", straw: "#e8cf7a", twine: "#8a6a3a",
  mug: "#c9b79c", mug2: "#e07a5f", bucketGrey: "#9aa3ad",
  trough: "#7a8691", troughRim: "#5b6670", water: "#8fd0f5",
  sack: "#d8c8a0", sackTie: "#8a6a3a", sackLabel: "#3f7a55",
  barrel: "#8a5a35", barrelShade: "#6b4428", handleWood: "#c9995b",
  apple: "#d94a3a", leaf: "#3f9a55", carrot: "#f08c3a",
  hoof: "#2a2420", eye: "#1d1d24",
  saddle: "#5c3a22", bag: "#a0683f", bagFlap: "#7d4f2e",
  blanket: "#c0392b", basket: "#c9995b", basketRim: "#a87c43",
  ribbon: "#3d6fe0", ribbonCenter: "#e0b43d", headset: "#2b2b33",
  pumpkin: "#e8761e", pumpkinShade: "#c45f12", stem: "#5a7a2a", pumpkinFace: "#ffd76a",
  tree: "#2f7a43", tree2: "#3f9a55", trunk: "#6b4a30", pot: "#c0643f", star: "#ffd76a", ornRed: "#e05252", ornBlue: "#3d8be0", ornGold: "#e0b43d",
  cat: "#e39b4a", catLight: "#f5d3a3", catStripe: "#b86f2c", catEye: "#2a2a2a",
};

// Water buckets by agent program: who drinks from what.
export const BUCKETS = { claude: "#d97757", codex: "#e8e8e8", gemini: "#4f86f7", cursor: "#2b2b2b", opencode: "#58b368", amp: "#9b6bdc" };

// Bay, chestnut, black, grey, palomino, white, dun, dark bay.
export const COATS = ["#8b5a2b", "#a0522d", "#2e2622", "#a8a8a8", "#d9b26a", "#e8e4dc", "#b8956a", "#5c3a22"];
export const MANES = ["#1d1612", "#3a2416", "#e8dcc0", "#5a3a20", "#2b2b2b"];
export const HALTERS = ["#e07a5f", "#3d8be0", "#58b368", "#9b6bdc", "#e0b43d", "#e05c8c", "#2fb3a8", "#f08c3a"];
const WHITE = "#f2efe8";

export const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

// A horse's colors, the same every time for the same terminal.
export function look(address) {
  let h = 2166136261;
  for (const ch of address) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (list, salt) => list[(((h >>> salt) ^ (h >>> (salt + 7))) >>> 0) % list.length];
  const coat = pick(COATS, 0);
  return {
    ...PALETTE,
    coat, coat2: shade(coat, 0.78), muzzle: shade(coat, 0.6), mane: pick(MANES, 5), halter: pick(HALTERS, 9),
    sock: (h >>> 13) & 1 ? WHITE : coat, blaze: (h >>> 17) & 1 ? WHITE : coat, salt: h,
  };
}

// The apple delivery: a chestnut pony in a red blanket.
export const COURIER = {
  ...PALETTE, coat: "#a0522d", coat2: "#7d4023", muzzle: "#603119", mane: "#e8dcc0", halter: "#c0392b",
  sock: WHITE, blaze: WHITE, salt: 11,
};
