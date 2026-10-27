/*
 * icons3d.js — a matte, "soft 3D" division icon set, generated from simple solids.
 *
 * ⚠️ PREVIEW-ONLY EXPLORATION (plan 2026-10-25 I8 / D9). Not an asset pipeline: these are
 * illustrative stand-ins to judge the DIRECTION — Uber-style object icons, matte, no gloss —
 * and how three colourways read at 46px and 32px. Final production icons would be drawn (or
 * modelled and rendered) by a designer from this brief.
 *
 * How it works: one isometric projection `P(x, y, z)`, and four solids built on it — `box`,
 * `cyl` (vertical cylinder), `disc` (a circle on any plane, sampled, so it is exact in iso) and
 * screen-space ellipses for round things. Every face carries a TONE CLASS, never a colour:
 *   t = top (lightest) · l = left / front (base) · r = right (shade) · d = darkest (tyres)
 *   w = glass / tint · p / pr = paper top / side · x = contrast detail · sh = ground shadow
 * `preview.css` maps those to a colourway via `--ic` (mono: blue in light, white in dark;
 * brand: each division's own logo colour). Matte by construction: flat faces, no gradients,
 * no specular highlight. Same-colour strokes with round joins soften the edges.
 *
 * ⚠️ Classic script (see controller.js). Assigns `window.ICONS3D`. No `style=""` anywhere
 * (CSP); the only attribute written after render is `transform`, by `fit()`.
 */
"use strict";

window.ICONS3D = (function () {
  const S = 9;
  const C30 = Math.cos(Math.PI / 6);
  const P = (x, y, z) => [50 + (x - y) * C30 * S, 58 + (x + y) * 0.5 * S - z * S];
  const f = (n) => Math.round(n * 100) / 100;
  const pts = (list) => list.map(([a, b]) => `${f(a)} ${f(b)}`).join(" L ");
  const poly = (cls, list) => `<path class="${cls}" d="M ${pts(list)} Z"/>`;

  /* An axis-aligned box: right (x-face), left (y-face), then top — back faces never show. */
  function box(x, y, z, w, d, h, c = {}) {
    const [t, l, r] = [c.t || "t", c.l || "l", c.r || "r"];
    const X = x + w, Y = y + d, Z = z + h;
    return poly(r, [P(X, y, z), P(X, Y, z), P(X, Y, Z), P(X, y, Z)])
      + poly(l, [P(x, Y, z), P(X, Y, z), P(X, Y, Z), P(x, Y, Z)])
      + poly(t, [P(x, y, Z), P(X, y, Z), P(X, Y, Z), P(x, Y, Z)]);
  }

  /* A circle on a plane, sampled: exact under the projection. plane: "z" | "y" | "x". */
  function circle(plane, cx, cy, cz, r, from = 0, to = 2 * Math.PI, n = 32) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = from + (to - from) * (i / n), u = r * Math.cos(a), v = r * Math.sin(a);
      out.push(plane === "z" ? P(cx + u, cy + v, cz) : plane === "y" ? P(cx + u, cy, cz + v) : P(cx, cy + u, cz + v));
    }
    return out;
  }
  const disc = (cls, plane, cx, cy, cz, r) => poly(cls, circle(plane, cx, cy, cz, r));

  /* A vertical cylinder: two side halves (left lit, right shaded) and a top. */
  function cyl(cx, cy, z, r, h, c = {}) {
    const q = Math.PI / 4;
    const half = (a0, a1) => {
      const bottom = circle("z", cx, cy, z, r, a0, a1, 16);
      const top = circle("z", cx, cy, z + h, r, a1, a0, 16);
      return [...bottom, ...top];
    };
    return poly(c.r || "r", half(-q, q)) + poly(c.l || "l", half(q, 3 * q)) + disc(c.t || "t", "z", cx, cy, z + h, r);
  }

  const ell = (cls, cx, cy, rx, ry) => `<ellipse class="${cls}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/>`;
  const line = (cls, a, b) => `<path class="${cls}" d="M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}"/>`;
  /* A polygon drawn on a y-face (y fixed), given in (x, z) pairs. */
  const onY = (cls, y, xz) => poly(cls, xz.map(([x, z]) => P(x, y, z)));
  const onX = (cls, x, yz) => poly(cls, yz.map(([y, z]) => P(x, y, z)));
  const rectY = (cls, y, x0, x1, z0, z1) => onY(cls, y, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  const rectX = (cls, x, y0, y1, z0, z1) => onX(cls, x, [[y0, z0], [y1, z0], [y1, z1], [y0, z1]]);
  /*
   * The part of the ball (centre 50,50, radius R) left uncovered by the same circle moved by
   * (dx, dy): a crescent on the side away from the move. Sampled, so no arc-flag guesswork.
   */
  const crescent = (cls, R, dx, dy, n = 40) => {
    const d = Math.hypot(dx, dy), h = Math.sqrt(R * R - d * d / 4);
    const mx = 50 + dx / 2, my = 50 + dy / 2, ux = -dy / d, uy = dx / d;
    const A = [mx + ux * h, my + uy * h], B = [mx - ux * h, my - uy * h];
    const away = Math.atan2(-dy, -dx), TAU = 2 * Math.PI, norm = (x) => ((x % TAU) + TAU) % TAU;
    const arc = (cx, cy, p0, p1) => {
      const a0 = Math.atan2(p0[1] - cy, p0[0] - cx), pos = norm(Math.atan2(p1[1] - cy, p1[0] - cx) - a0);
      const total = norm(away - a0) < pos ? pos : pos - TAU;
      return Array.from({ length: n + 1 }, (_, i) => [cx + R * Math.cos(a0 + total * i / n), cy + R * Math.sin(a0 + total * i / n)]);
    };
    return poly(cls, [...arc(50, 50, A, B), ...arc(50 + dx, 50 + dy, B, A)]);
  };
  /* Basketball seams, tilted by `deg`. The endpoints are rotated here and each arc gets the same
     x-axis rotation, instead of a rotated <g>: a rotated group's bounding box is the box of a
     rotated box, which is larger than the ball, so fit() would shrink the icon. */
  const seams = (deg) => {
    const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const R = ([x, y]) => [50 + (x - 50) * c - (y - 50) * s, 50 + (x - 50) * s + (y - 50) * c];
    const arc = (p0, rx, ry, sweep, p1) => { const [a, b] = R(p0), [m, n] = R(p1);
      return `M ${f(a)} ${f(b)} A ${rx} ${ry} ${deg} 0 ${sweep} ${f(m)} ${f(n)}`; };
    return `<path class="xd" d="${[arc([20, 50], 30, 7, 0, [80, 50]), arc([50, 20], 5, 30, 1, [50, 80]),
      arc([32.8, 25.4], 12, 28, 1, [32.8, 74.6]), arc([67.2, 25.4], 12, 28, 0, [67.2, 74.6])].join(" ")}"/>`;
  };
  const shadow = (w, d) => ell("sh", 50, 58 + 0.5, (w + d) * 0.5 * C30 * S + 4, (w + d) * 0.25 * S + 2);

  const DRAW = {
    /*
     * Court v2 basketball (2026-10-26, user: "change the ball icon"; then "not there yet", replaced by A). A matte basketball on the same light
     * model as the solids: mid-tone body, a light crescent upper left (the "top face" tone, not a
     * highlight spot), a shade crescent lower right, and seams that wrap the sphere: equator and
     * meridian as foreshortened ellipses plus the two side curves, all tilted 10°. The seams are
     * the deep tone at a fixed screen width (`.xd`), so they read at 42px.
     */
    "ezzy-court-v2": () => ell("sh", 50, 86, 26, 6)
      + `<circle class="l" cx="50" cy="50" r="30"/>`
      + crescent("t", 30, 2.6, 3) + crescent("r", 30, -6, -7)
      + seams(-10),
    /* Court — CHOSEN 2026-10-26 (second pick): E, the pickleball paddle (drawn below as ezzy-court-e).
       The tennis ball (A) was chosen first the same day, then replaced at the user's request. */
    "ezzy-court": () => DRAW["ezzy-court-e"](),
    /*
     * E · Pickleball paddle, with a small holed ball so it reads as pickleball, not table tennis.
     * Drawn flat, then tilted -20° by rotating the points (not a rotated <g>: see seams()). The
     * face is a rounded rectangle: the light tone as the playing surface, and the edge guard and
     * the thickness behind it both in the main blue, one outline colour (user, 2026-10-27: "a bit
     * too dark"; it was a shade-tone guard and a deep-tone edge round a main-blue surface). The
     * grip is wrapped. Shadow and ball sit on the same ground line as the handle.
     */
    "ezzy-court-e": () => {
      const T = -20 * Math.PI / 180, ox = 46, oy = 50;
      const rot = ([x, y]) => [ox + (x - ox) * Math.cos(T) - (y - oy) * Math.sin(T), oy + (x - ox) * Math.sin(T) + (y - oy) * Math.cos(T)];
      const rr = (cx, cy, w, h, r, k = 8) => {
        const out = [], cs = [[cx + w / 2 - r, cy - h / 2 + r, -Math.PI / 2], [cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2], [cx - w / 2 + r, cy - h / 2 + r, Math.PI]];
        for (const [x, y, a0] of cs) for (let i = 0; i <= k; i++) { const a = a0 + (Math.PI / 2) * (i / k); out.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
        return out;
      };
      const shape = (cls, list, dx = 0, dy = 0) => poly(cls, list.map(rot).map(([x, y]) => [x + dx, y + dy]));
      const face = rr(46, 34, 36, 40, 13), guard = rr(46, 34, 31, 35, 10.5), handle = rr(46, 64, 9.5, 24, 4.2, 4);
      const wraps = [58, 62.5, 67, 71.5].map((y) => { const [a, b] = [rot([41.5, y]), rot([50.5, y + 2.2])];
        return `M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}`; }).join(" ");
      const bx = 72, by = 67, br = 10;
      return ell("sh", 58, 78, 26, 4.5)
        + shape("d", handle, 2.2, 1.8) + shape("l", face, 2.6, 2.2)
        + shape("r", handle) + `<path class="xd" d="${wraps}"/>`
        + shape("l", face) + shape("t", guard)
        + `<circle class="r" cx="${bx}" cy="${by}" r="${br}"/><circle class="l" cx="${f(bx - 1)}" cy="${f(by - 1.2)}" r="${f(br - 1.4)}"/>`
        + ell("d", bx - 3, by - 3, 1.8, 1.8) + ell("d", bx + 2.6, by - 2, 1.7, 1.7) + ell("d", bx - 2.2, by + 2.6, 1.7, 1.7) + ell("d", bx + 3.2, by + 3.4, 1.5, 1.5);
    },
    /* ── Court alternatives (2026-10-26, user: "not there yet … a different ball look"). A was chosen
       on 2026-10-26, then replaced by E (the paddle, above); A–D and v1/v2 stay only for the `court` screen. ── */
    /* A · Tennis ball: a soft sphere and one wrapping seam (two facing curves). */
    "ezzy-court-a": () => ell("sh", 50, 86, 26, 6)
      + `<circle class="l" cx="50" cy="50" r="30"/>` + crescent("t", 30, 2.6, 3) + crescent("r", 30, -6, -7)
      + `<path class="xw" d="M 27 30.7 C 41 40 41 60 27 69.3 M 73 30.7 C 59 40 59 60 73 69.3"/>`,
    /* B · Pickleball: the same sphere with holes, smaller towards the edge. */
    "ezzy-court-b": () => {
      const hole = (a, d, r) => ell("d", 48 + d * Math.cos(a), 48 + d * Math.sin(a), r * (1 - d / 60), r);
      /* Fewer, larger holes than a real ball: 13 survive 42px; 17 merged into texture. */
      let holes = ell("d", 47, 46, 3.6, 3.6);
      for (let k = 0; k < 5; k++) holes += hole(k * 2 * Math.PI / 5 + 0.3, 13.5, 3.2);
      for (let k = 0; k < 7; k++) holes += hole(k * 2 * Math.PI / 7 + 0.15, 23.5, 2.7);
      return ell("sh", 50, 86, 26, 6) + `<circle class="l" cx="50" cy="50" r="30"/>`
        + crescent("t", 30, 2.6, 3) + crescent("r", 30, -6, -7) + holes;
    },
    /* C · Shuttlecock: a feather skirt (a cone, lit left, shaded right) on a round cork. */
    "ezzy-court-c": () => ell("sh", 50, 86, 18, 4.5)
      + `<path class="l" d="M 26 26 L 43 64 L 50 65.5 L 50 30 Z"/>`
      + `<path class="r" d="M 50 30 L 50 65.5 L 57 64 L 74 26 Z"/>`
      + ell("t", 50, 26, 24, 8) + ell("d", 50, 26.6, 19.5, 5.6)
      + `<path class="ln" d="M 36 31 L 46 64 M 43 33 L 48 65 M 57 33 L 52 65 M 64 31 L 54 64"/>`
      + `<path class="pr" d="M 41 64 A 9 3.6 0 0 1 59 64 L 59 66 A 9 13 0 0 1 41 66 Z"/>`
      + `<path class="p" d="M 41 64 A 9 3.6 0 0 1 59 64 A 9 3.6 0 0 1 41 64 Z M 41 66 A 9 13 0 0 0 50 79 L 50 66.6 A 9 3.6 0 0 1 41 66 Z"/>`,
    /* D · Court: a small court slab with lines, and a ball on it. Literally "Court". */
    "ezzy-court-d": () => {
      const L = (a, b) => `M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}`;
      const z = 0.55, x0 = -2.9, x1 = 2.9, y0 = -2, y1 = 2;
      const lines = [L(P(x0 + 0.35, y0 + 0.3, z), P(x1 - 0.35, y0 + 0.3, z)), L(P(x1 - 0.35, y0 + 0.3, z), P(x1 - 0.35, y1 - 0.3, z)),
        L(P(x1 - 0.35, y1 - 0.3, z), P(x0 + 0.35, y1 - 0.3, z)), L(P(x0 + 0.35, y1 - 0.3, z), P(x0 + 0.35, y0 + 0.3, z)),
        L(P(0, y0 + 0.3, z), P(0, y1 - 0.3, z))].join(" ");
      const ring = circle("z", 0, 0, z, 0.9);
      const ball = (cx, cy, r) => `<circle class="r" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/><circle class="l" cx="${f(cx - r * 0.12)}" cy="${f(cy - r * 0.14)}" r="${f(r * 0.86)}"/>`;
      const [bx, by] = P(1.4, -0.9, z);
      return shadow(4.6, 3) + box(x0, y0, 0, x1 - x0, y1 - y0, z)
        + `<path class="xl" d="${lines} M ${pts(ring)} Z"/>` + ell("sh", bx + 1, by + 0.5, 7, 2.6) + ball(bx, by - 7, 7.5);
    },
    /* Court v1, kept only for the comparison screen (`court`). Not used anywhere else. */
    "ezzy-court-v1": () => ell("sh", 50, 86, 26, 6)
      /* Matte shading without a highlight: the dark ball, then a slightly smaller lit ball nudged
         up-left, which leaves a crescent of shade on the lower right. */
      + `<circle class="r" cx="50" cy="50" r="30"/><circle class="l" cx="47.5" cy="47.5" r="26"/>`
      + `<path class="xs" d="M 50 20 C 61 36 61 64 50 80 M 20.5 46 C 36 40 64 40 79.5 46 M 30 27 C 41 39 41 61 30 73 M 70 27 C 59 39 59 61 70 73"/>`,
    /* Care — a first-aid case with a handle and a cross. */
    "ezzy-care": () => shadow(4.4, 3)
      + box(-0.9, -0.25, 2.8, 0.3, 0.5, 0.6) + box(0.6, -0.25, 2.8, 0.3, 0.5, 0.6) + box(-0.9, -0.25, 3.4, 1.8, 0.5, 0.3)
      + box(-2.2, -1.5, 0, 4.4, 3, 2.8)
      + rectY("pr", 1.5, -2.2, 2.2, 1.95, 2.1)
      /* Cross arms 0.7 → 0.9 thick (2026-10-26 sharpening): at 42px the thinner arms were ~2px and broke up. */
      + onY("x", 1.5, [[-0.45, 0.4], [0.45, 0.4], [0.45, 0.98], [1.05, 0.98], [1.05, 1.87], [0.45, 1.87], [0.45, 2.45], [-0.45, 2.45], [-0.45, 1.87], [-1.05, 1.87], [-1.05, 0.98], [-0.45, 0.98]]),
    /* Well — stacked spa stones with a leaf. */
    "ezzy-well": () => {
      const pebble = (cx, cy, rx, ry) => ell("r", cx, cy + 3.2, rx, ry) + ell("l", cx, cy, rx, ry) + ell("t", cx - rx * 0.12, cy - ry * 0.3, rx * 0.62, ry * 0.45);
      return ell("sh", 50, 84, 32, 6) + pebble(50, 72, 31, 10) + pebble(50, 55, 24, 8.5) + pebble(50, 41, 16, 7)
        + `<path class="t" d="M 56 34 C 58 22 68 16 78 16 C 77 27 69 34 56 34 Z"/><path class="r" d="M 56 34 C 63 29 69 24 74 19"/>`;
    },
    /* Drive — a steering wheel tilted toward the viewer. */
    "ezzy-drive": () => {
      const ring = (cls, cy) => `<path class="${cls}" fill-rule="evenodd" d="M 18 ${cy} A 32 24 0 1 0 82 ${cy} A 32 24 0 1 0 18 ${cy} Z M 27 ${cy} A 23 16 0 1 1 73 ${cy} A 23 16 0 1 1 27 ${cy} Z"/>`;
      return ell("sh", 50, 84, 30, 6) + ring("r", 55) + ring("l", 50)
        + `<path class="t" d="M 27 50 L 41 47 L 41 53 L 27 54 Z M 73 50 L 59 47 L 59 53 L 73 54 Z M 46 56 L 54 56 L 53 66 L 47 66 Z"/>`
        + ell("r", 50, 54, 10, 7.5) + ell("t", 50, 51.5, 10, 7.5) + ell("x", 50, 51.5, 3.4, 2.5);
    },
    /* Pets — a food bowl with kibble and a paw. */
    "ezzy-pets": () => ell("sh", 50, 84, 32, 6)
      + `<path class="l" d="M 20 44 L 28 72 A 22 9 0 0 0 72 72 L 80 44 Z"/>`
      + `<path class="r" d="M 50 56 L 50 81 A 22 9 0 0 0 72 72 L 80 44 A 30 12 0 0 1 50 56 Z"/>`
      + ell("t", 50, 44, 30, 12) + ell("r", 50, 45, 24, 8.5) + ell("w", 50, 46.5, 19, 5.6)
      + ell("x", 50, 68, 5, 3.6) + ell("x", 43.5, 62.5, 2.1, 1.7) + ell("x", 48, 60.5, 2.1, 1.7) + ell("x", 52, 60.5, 2.1, 1.7) + ell("x", 56.5, 62.5, 2.1, 1.7),
    /* Food — a catering cloche on a plate. */
    "ezzy-food": () => ell("sh", 50, 84, 36, 6) + ell("r", 50, 75, 40, 11) + ell("t", 50, 72, 40, 11)
      + `<path class="l" d="M 17 70 A 33 34 0 0 1 83 70 Z"/>`
      + `<path class="r" d="M 54 36.4 A 33 34 0 0 1 83 70 L 63 70 C 66 56 63 45 54 36.4 Z"/>`
      + `<path class="t" d="M 33 52 C 36 46 41 42 46 40" />`
      + ell("r", 50, 37, 6.5, 3.2) + ell("t", 50, 34.5, 6.5, 3.2),
    /* Home — a house with a pitched roof, a door and a window. */
    "ezzy-home": () => shadow(3.6, 3.2)
      + poly("r", [P(-2, 0, 4), P(2, 0, 4), P(2, -1.9, 2.3), P(-2, -1.9, 2.3)])
      + box(-1.8, -1.6, 0, 3.6, 3.2, 2.4)
      + poly("r", [P(1.8, -1.6, 2.4), P(1.8, 1.6, 2.4), P(1.8, 0, 4)])
      + poly("t", [P(-2, 1.9, 2.3), P(2, 1.9, 2.3), P(2, 0, 4), P(-2, 0, 4)])
      + rectY("x", 1.6, -0.45, 0.45, 0, 1.45) + rectX("w", 1.8, -1.0, 0.1, 1.0, 1.8),
    /* Ride — a compact car, three-quarter view. */
    "ezzy-ride": () => shadow(5.2, 2.4)
      + box(-2.6, -1.2, 0.45, 5.2, 2.4, 1.0)
      + box(-1.5, -1.05, 1.45, 2.6, 2.1, 0.85)
      + rectY("w", 1.05, -1.3, -0.25, 1.6, 2.15) + rectY("w", 1.05, -0.1, 0.95, 1.6, 2.15) + rectX("w", 1.1, -0.85, 0.85, 1.6, 2.15)
      + rectX("x", 2.6, -0.95, -0.45, 0.95, 1.2) + rectX("x", 2.6, 0.45, 0.95, 0.95, 1.2)
      + disc("d", "y", -1.55, 1.2, 0.45, 0.62) + disc("t", "y", -1.55, 1.2, 0.45, 0.26)
      + disc("d", "y", 1.6, 1.2, 0.45, 0.62) + disc("t", "y", 1.6, 1.2, 0.45, 0.26),
    /* Learn — a stack of three books, pages on the right, a ribbon. */
    "ezzy-learn": () => shadow(4.2, 3)
      + box(-2.1, -1.5, 0, 4.2, 3, 0.75, { r: "p" })
      + box(-1.7, -1.35, 0.75, 3.8, 2.7, 0.7, { r: "p" })
      + box(-1.5, -1.1, 1.45, 3.4, 2.3, 0.65, { r: "p" })
      + rectY("x", 1.2, 0.6, 0.95, 0.9, 2.1),
    /* Stay — a bed with a headboard, pillow and blanket. */
    "ezzy-stay": () => shadow(4.4, 3.2)
      + box(-2.2, -1.6, 0, 0.4, 3.2, 2.3)
      + box(-1.8, -1.6, 0, 4.0, 3.2, 0.75)
      + box(-1.75, -1.55, 0.75, 3.9, 3.1, 0.5, { t: "p", l: "pr", r: "pr" })
      + box(-1.55, -1.25, 1.25, 0.9, 2.5, 0.4, { t: "p", l: "pr", r: "pr" })
      + box(-0.3, -1.6, 1.25, 2.5, 3.2, 0.14),
    /* Work — an open laptop. */
    "ezzy-work": () => shadow(4.4, 3)
      + box(-2.2, -1.5, 0, 4.4, 3, 0.25)
      + poly("r", [P(-1.8, -0.9, 0.25), P(1.8, -0.9, 0.25), P(1.8, 0.4, 0.25), P(-1.8, 0.4, 0.25)])
      + poly("r", [P(-0.6, 0.65, 0.25), P(0.6, 0.65, 0.25), P(0.6, 1.3, 0.25), P(-0.6, 1.3, 0.25)])
      + box(-2.2, -1.5, 0.25, 4.4, 0.22, 2.7)
      + rectY("x", -1.28, -1.95, 1.95, 0.5, 2.7),
    /* Park — a parking sign on a post. */
    "ezzy-park": () => shadow(1.4, 1.4)
      + box(-0.7, -0.7, 0, 1.4, 1.4, 0.25) + cyl(0, 0, 0.25, 0.2, 2.2)
      + box(-1.45, -0.15, 2.2, 2.9, 0.3, 2.7)
      + onY("x", 0.15, [[-0.75, 2.55], [-0.2, 2.55], [-0.2, 3.35], [0.8, 3.35], [0.8, 4.55], [-0.75, 4.55]])
      + rectY("l", 0.15, -0.2, 0.3, 3.8, 4.1),
    /* Law — scales of justice. */
    "ezzy-law": () => {
      const pan = (x) => line("ln", P(x, 0, 3.45), P(x - 0.7, 0, 1.95)) + line("ln", P(x, 0, 3.45), P(x + 0.7, 0, 1.95))
        + cyl(x, 0, 1.8, 0.85, 0.16);
      return shadow(2.6, 2.6) + pan(-2.1)
        + cyl(0, 0, 0, 1.25, 0.35) + cyl(0, 0, 0.35, 0.2, 3.25)
        + box(-2.35, -0.12, 3.35, 4.7, 0.24, 0.24)
        + `<circle class="t" cx="${f(P(0, 0, 3.95)[0])}" cy="${f(P(0, 0, 3.95)[1])}" r="3.6"/>`
        + pan(2.1);
    },
  };

  /** One icon: `set` is "mono" or "brand". The group is fitted to the box by `fit()`. */
  const svg = (slug, set) => `
    <svg class="i3" data-icset="${set}" data-division="${slug}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g class="i3g">${DRAW[slug] ? DRAW[slug]() : ""}</g>
    </svg>`;

  /* Centre every drawing and scale it to the same visual size (86% of the box). */
  function fit(root) {
    root.querySelectorAll("svg.i3 > g.i3g").forEach((g) => {
      if (g.dataset.fitted) return;
      const b = g.getBBox();
      if (!b.width || !b.height) return;
      const k = 86 / Math.max(b.width, b.height);
      const tx = 50 - (b.x + b.width / 2) * k, ty = 50 - (b.y + b.height / 2) * k;
      g.setAttribute("transform", `translate(${f(tx)} ${f(ty)}) scale(${f(k)})`);
      g.dataset.fitted = "1";
    });
  }

  return { svg, fit, SLUGS: Object.keys(DRAW) };
})();
