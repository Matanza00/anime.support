// "The star thief": a scroll-driven pencil chase for the homepage.
// A masked thief (B) steals the glowing star, the hero (A) chases him down the page, they duel at the
// section headings, the thief taunts from the top of the sticky "Airing next" panel, and in the end the
// hero captures him and throws him into the anime.support logo in the footer.
//
// Everything is placed in SCREEN space from the live layout each frame, so the action is always where the
// reader is looking: scenes happen on the gap above whichever section heading is on screen, and between
// headings the two slide down the page edges level with the reader. Scrolling back replays it in reverse.
import { makeArtist, P as BASE, BLADE, lerp, angLerp, ease } from './sketch-fight.js';

const K = 0.5; // scene units → CSS px (a fighter is ~105 px tall)
const HIP = 86;
const P = {
  ...BASE,
  run1: { n: [14, -92], hd: [22, -114], k1: [34, 32], f1: [58, 70], k2: [-18, 42], f2: [-50, 60], e1: [26, -62], h1: [40, -44], e2: [-4, -64], h2: [-22, -46], s: 168 },
  run2: { n: [14, -90], hd: [22, -112], k1: [8, 46], f1: [-6, 86], k2: [34, 26], f2: [26, 64], e1: [24, -60], h1: [38, -42], e2: [12, -62], h2: [30, -50], s: 172 },
  slide: { n: [2, -94], hd: [6, -116], k1: [14, 40], f1: [18, 84], k2: [-6, 42], f2: [-2, 86], e1: [22, -60], h1: [30, -34], e2: [-16, -112], h2: [-12, -134], s: 80 },
  taunt: { n: [-4, -95], hd: [-2, -118], k1: [26, 42], f1: [44, 86], k2: [-24, 44], f2: [-46, 86], e1: [22, -66], h1: [40, -52], e2: [-18, -116], h2: [-14, -142], s: -30 },
  lift: { n: [0, -96], hd: [4, -118], k1: [28, 42], f1: [46, 86], k2: [-26, 42], f2: [-46, 86], e1: [16, -126], h1: [12, -152], e2: [-16, -126], h2: [-12, -152], s: 100 },
  victory: { n: [0, -96], hd: [4, -119], k1: [26, 42], f1: [44, 86], k2: [-24, 44], f2: [-46, 86], e1: [20, -120], h1: [22, -148], e2: [-14, -66], h2: [-24, -42], s: -88 },
  hang: { n: [0, -95], hd: [4, -118], k1: [10, 40], f1: [6, 84], k2: [-6, 44], f2: [-14, 82], e1: [6, -125], h1: [4, -150], e2: [22, -80], h2: [44, -92], s: 90 },
  down: { n: [-6, -60], hd: [-10, -80], k1: [30, 30], f1: [50, 80], k2: [-20, 40], f2: [-40, 84], e1: [24, -40], h1: [40, -20], e2: [-20, -40], h2: [-34, -20], s: 20 },
};
const FIGHT_T = 1.6;
const FIGHT_A = [[0, 'clash'], [0.4, 'strike'], [0.8, 'clash'], [1.2, 'block'], [1.6, 'clash']];
const FIGHT_B = [[0, 'clash'], [0.4, 'block'], [0.8, 'clash'], [1.2, 'strike'], [1.6, 'clash']];
const FIGHT_HITS = [0.4, 0.8, 1.2];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (q, a, b) => clamp01((q - a) / (b - a)); // 0..1 progress of q within [a, b]

function build(name, dir, name2 = name, u = 0) {
  const a = P[name], b = P[name2];
  const out = { dir };
  for (const k of Object.keys(a)) if (k !== 's') out[k] = [dir * lerp(a[k][0], b[k][0], u), lerp(a[k][1], b[k][1], u)];
  const s = angLerp(a.s, b.s, u);
  out.s = dir < 0 ? 180 - s : s;
  const r = (out.s * Math.PI) / 180;
  out.tip = [out.h1[0] + Math.cos(r) * BLADE, out.h1[1] + Math.sin(r) * BLADE];
  return out;
}
function fromKeys(keys, t, dir) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const u = ease(clamp01((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0])));
  return build(keys[i][1], dir, keys[i + 1][1], u);
}

export function start(canvas, { hero, logo } = {}) {
  const ctx = canvas.getContext('2d');
  const art = makeArtist(ctx);
  let dpr = 1, gaps = [], aside = null, wrapBox = null;
  // displayed positions (screen px, feet), eased toward each frame's target so scene changes look like leaps
  const shown = { A: null, B: null };

  /* ---------- layout: where the scenes are (document y), measured on load and on resize ---------- */
  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    const sy = scrollY;
    const wrapEl = hero?.closest('.wrap') || document.querySelector('main .wrap');
    if (!wrapEl) return (gaps = []);
    const w = wrapEl.getBoundingClientRect();
    wrapBox = { left: w.left, right: w.right };
    // a sticky sidebar long enough to stand on ("Airing next")
    aside = [...document.querySelectorAll('main .sidebar')].find((a) => a.getBoundingClientRect().height > 300) || null;
    const asideTop = aside ? aside.getBoundingClientRect().top + sy : Infinity;
    const list = [];
    if (hero) list.push({ y: hero.getBoundingClientRect().bottom + sy - 18, type: 'steal' });
    for (const h of document.querySelectorAll('main .section-head')) {
      if (h.closest('.sidebar, aside')) continue;
      const r = h.getBoundingClientRect();
      if (r.left > w.left + 80 || r.width < 200) continue;
      const y = r.top + sy - 10;
      if (list.length && y - list.at(-1).y < 240) continue;
      list.push({ y, type: 'scene' });
    }
    // give each section heading its part of the story
    const scenes = list.filter((g) => g.type === 'scene');
    scenes.forEach((g, i) => {
      const next = scenes[i + 1]?.y ?? Infinity;
      if (asideTop > g.y - 60 && asideTop < next) g.type = 'perch';
      else if (i === scenes.length - 1) g.type = 'capture';
      else g.type = i % 2 ? 'fight' : 'chase';
    });
    const foot = document.querySelector('footer');
    if (foot && logo) list.push({ y: foot.getBoundingClientRect().top + sy - 4, type: 'throw' });
    gaps = list;
  }

  /* ---------- drawing helpers ---------- */
  function place(f, feet, { scale = 1, rot = 0, alpha = 1, ground = true, vx = 0, vy = 0, prevS } = {}) {
    if (feet[1] < -160 || feet[1] > innerHeight + 160) return;
    ctx.setTransform(dpr * K * scale, 0, 0, dpr * K * scale, dpr * feet[0], dpr * feet[1]);
    ctx.translate(0, -HIP);
    if (rot) ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    const g = { ...f, x: 0, y: 0, ground: ground ? HIP : null };
    art.drawFighter(g, { x: -vx, y: -vy, s: prevS ?? f.s }, f.kind);
    if (f.star) star(f.h2, 9);
    ctx.globalAlpha = 1;
  }
  function star([cx, cy], r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push([cx + Math.cos(a) * rr, cy - 8 + Math.sin(a) * rr]);
    }
    for (let i = 0; i < 10; i++) art.line(pts[i], pts[(i + 1) % 10], { w: 1.2, passes: 1, alpha: 0.95, wob: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + art.j(0.3);
      art.line([cx + Math.cos(a) * (r + 4), cy - 8 + Math.sin(a) * (r + 4)], [cx + Math.cos(a) * (r + 10), cy - 8 + Math.sin(a) * (r + 10)], { w: 0.8, passes: 1, alpha: 0.6 });
    }
  }
  function sparks(f, feet) {
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * feet[0], dpr * feet[1]);
    ctx.translate(0, -HIP);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + art.j(1.1);
      const p0 = [f.tip[0] + art.j(4), f.tip[1] + art.j(4)];
      art.line(p0, [p0[0] + Math.cos(a) * 12, p0[1] + Math.sin(a) * 12], { w: 1, passes: 1, alpha: 0.8 });
    }
  }
  function burst(at, age, size = 1) {
    ctx.setTransform(dpr * K * size, 0, 0, dpr * K * size, dpr * at[0], dpr * at[1]);
    art.drawImpact([0, 0], age);
  }
  function shout(at) {
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * at[0], dpr * at[1]);
    art.line([0, -30], [2, -6], { w: 3, passes: 2 });
    art.circle([2, 4], 2);
  }

  /* ---------- the story, one frame ---------- */
  function scene(t) {
    const vh = innerHeight, sy = scrollY;
    const maxS = Math.max(1, document.documentElement.scrollHeight - vh);
    const xL = Math.max(34, wrapBox.left - 30), xR = Math.min(innerWidth - 34, wrapBox.right + 30);
    const mid = (wrapBox.left + wrapBox.right) / 2;
    let A = null, B = null; // targets: { at:[x,y], f, opts }
    // the thief dangles by one hand from the corner of the sticky "Airing next" panel, swinging and waving the star
    const hanging = (ar) => ({ at: [ar.right + 10, ar.top + 26 + (150 + HIP) * K], f: build('hang', -1), star: true, hang: true, noSword: true, rot: Math.sin(t * 2.4) * 0.16 });
    const extras = [];

    // which scene is on screen: the first heading gap not yet scrolled near the top
    let cur = null, prev = null;
    for (const g of gaps) {
      const enter = g.y - 0.95 * vh, exit = Math.min(g.y - 0.3 * vh, maxS);
      if (sy < enter) break;
      if (sy <= exit) { cur = { g, q: exit > enter ? clamp01((sy - enter) / (exit - enter)) : 1, y: g.y - sy }; break; }
      prev = g;
    }

    if (cur) {
      const { g, q, y } = cur;
      const across = (from, to, k) => lerp(from, to, ease(k));
      if (g.type === 'steal') {
        const hb = hero.getBoundingClientRect();
        const tx = hb.right - 150, hx = hb.right - 340;
        if (q < 0.3) {
          B = { at: [tx, y], f: build('taunt', -1), star: true };
          A = { at: [hx, y], f: build('crouch', 1) };
          extras.push(() => shout([hx + 4, y - 150 * K]));
        } else {
          const k = seg(q, 0.3, 1);
          B = { at: [across(tx, xR, k), y], run: 1, star: true };
          A = { at: [across(hx, xR - 120, k), y], run: 1 };
        }
      } else if (g.type === 'chase' || g.type === 'perch') {
        // thief runs across the gap, the hero leaps after him; on the perch scene the thief escapes up onto the sidebar
        const fromR = (gaps.indexOf(g) % 2) === 1;
        const from = fromR ? xR : xL, to = fromR ? xL : xR;
        const k = seg(q, 0.05, 0.75);
        const bx = across(from, to, k), dir = Math.sign(to - from);
        B = { at: [bx, y], run: 1, star: true };
        A = { at: [bx - dir * 150, y - (k > 0.4 && k < 0.6 ? Math.sin(seg(k, 0.4, 0.6) * Math.PI) * 50 : 0)], run: 1 };
        if (g.type === 'perch' && aside && q > 0.75) {
          const ar = aside.getBoundingClientRect();
          B = hanging(ar);
        }
      } else if (g.type === 'fight' || g.type === 'capture') {
        const dir = 1;
        const ax = mid - 62, bx = mid + 62;
        if (q < 0.15) {
          A = { at: [ax, y], run: 1 }; B = { at: [bx, y], f: build('stance', -1), star: true };
        } else if (q < (g.type === 'capture' ? 0.55 : 0.8)) {
          const ft = t % FIGHT_T, pt = (ft - 0.08 + FIGHT_T) % FIGHT_T;
          A = { at: [ax, y], f: fromKeys(FIGHT_A, ft, dir), prevS: fromKeys(FIGHT_A, pt, dir).s };
          B = { at: [bx, y], f: fromKeys(FIGHT_B, ft, -dir), prevS: fromKeys(FIGHT_B, pt, -dir).s, star: true };
          const hit = FIGHT_HITS.find((h) => ft >= h && ft - h < 0.35);
          if (hit !== undefined) extras.push(() => burst([mid, y - 105 * K], ft - hit, 0.8));
        } else if (g.type === 'fight') {
          const k = seg(q, 0.8, 1); // the thief breaks away to the next section
          B = { at: [across(bx, xR, k), y], run: 1, star: true };
          A = { at: [across(ax, xR - 140, k), y], run: 1 };
        } else {
          // capture: the winning blow, the thief goes down, the hero lifts him overhead
          const k = seg(q, 0.55, 0.7);
          if (q < 0.7) {
            A = { at: [ax + 20, y], f: build('clash', dir, 'strike', ease(k)) };
            B = { at: [bx + k * 30, y], f: build('block', -1, 'down', ease(k)), star: true, noSword: true };
            if (k < 0.7) extras.push(() => burst([mid + 10, y - 95 * K], k * 0.7, 1.4));
          } else {
            A = { at: [ax + 20, y], f: build('lift', dir), noSword: true, carry: true };
          }
        }
      } else if (g.type === 'throw') {
        // the hero carries the thief to the footer logo and throws him in
        const lr = logo.getBoundingClientRect();
        const target = [lr.left + lr.width * 0.28, lr.top + lr.height * 0.45];
        const start = [Math.min(xR, lr.right + 260), y];
        const k1 = seg(q, 0, 0.35), k2 = seg(q, 0.35, 0.75);
        const ax = lerp(start[0], lr.right + 90, ease(k1));
        if (q < 0.35) {
          A = { at: [ax, y], run: 1, noSword: true, carry: true, dir: -1 };
        } else {
          A = { at: [ax, y], f: build(q < 0.75 ? 'lift' : 'victory', -1), noSword: q < 0.75 };
          if (q < 0.75) {
            // thrown: an arc from the hero's hands into the logo, spinning and shrinking
            const hands = [ax, y - (HIP + 150) * K];
            const e = ease(k2);
            const p = [lerp(hands[0], target[0], e), lerp(hands[1], target[1], e) - Math.sin(k2 * Math.PI) * 120];
            extras.push(() => place({ ...build('jump', -1), kind: 'B', mask: true, noSword: true }, [p[0], p[1] + HIP * K * (1 - e * 0.6)], { rot: -k2 * 9, scale: lerp(1, 0.25, e), alpha: 1 - seg(k2, 0.85, 1), ground: false }));
          }
          if (q > 0.68) extras.push(() => burst(target, Math.min(0.49, (q - 0.68) * 1.6), 1.1));
          if (q > 0.75) extras.push(() => { ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * target[0], dpr * (target[1] - 34)); star([0, 0], 12); });
        }
        logo.classList.toggle('logo-hit', q > 0.72);
      }
    } else if (prev) {
      // between headings: both slide down the page edges, level with the reader
      const sliding = (x, yy, face) => ({ at: [x, yy], f: build('slide', face), slide: true });
      const ar = aside?.getBoundingClientRect();
      const onAside = prev.type === 'perch' && ar && ar.top > 0.05 * vh && ar.top < 0.7 * vh;
      if (prev.type === 'capture') {
        A = { at: [xL, 0.6 * vh], f: build('lift', 1), noSword: true, carry: true, slide: true };
      } else {
        A = sliding(onAside ? ar.left - 14 : xL, 0.42 * vh, 1);
        B = onAside ? hanging(ar) : { ...sliding(xR, 0.62 * vh, -1), star: true };
      }
    }
    if (!cur || cur.g.type !== 'throw') logo?.classList.remove('logo-hit');
    return { A, B, extras };
  }

  function drawActor(key, tgt, t, moving) {
    if (!tgt) { shown[key] = null; return; }
    const prevAt = shown[key] || tgt.at;
    const dist = Math.hypot(tgt.at[0] - prevAt[0], tgt.at[1] - prevAt[1]);
    const at = dist > 2 ? [lerp(prevAt[0], tgt.at[0], 0.35), lerp(prevAt[1], tgt.at[1], 0.35)] : tgt.at;
    shown[key] = at;
    const vx = at[0] - prevAt[0], vy = at[1] - prevAt[1];
    const dir = tgt.dir || (Math.abs(vx) > 0.5 ? Math.sign(vx) : tgt.f?.dir || (key === 'A' ? 1 : -1));
    let f;
    if (dist > 60) f = build('jump', dir); // flying to the next scene
    else if (tgt.run) f = Math.abs(vx) > 0.4 ? build('run1', dir, 'run2', (Math.sin(t * 14) + 1) / 2) : build(tgt.carry ? 'lift' : 'stance', dir);
    else f = tgt.f;
    if (tgt.carry) { // arms stay up holding the thief, whatever the legs are doing
      const l = build('lift', dir);
      f = { ...f, e1: l.e1, h1: l.h1, e2: l.e2, h2: l.h2 };
    }
    f = { ...f, kind: key, mask: key === 'B', noSword: tgt.noSword || tgt.carry, star: key === 'B' && tgt.star };
    if (tgt.hang && dist <= 60) f = { ...tgt.f, kind: key, mask: true, noSword: true, star: tgt.star };
    const air = dist > 60 || tgt.slide || tgt.hang;
    place(f, at, { ground: !air, vx: vx / K / 2, vy: vy / K / 2, prevS: tgt.prevS, rot: tgt.hang ? tgt.rot : 0 });
    if (tgt.slide && moving && !tgt.carry) sparks(f, at);
    if (tgt.carry) {
      // the defeated thief, held overhead
      const thief = { ...build('down', -dir), kind: 'B', mask: true, noSword: true };
      place(thief, [at[0], at[1] - 150 * K], { rot: -dir * Math.PI / 2, ground: false });
    }
  }

  let lastY = scrollY, lastMove = 0;
  function render(now) {
    const t = now / 1000;
    art.setSeed(Math.floor(t * 12));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    const active = scrollY > 40 && gaps.length && wrapBox;
    hero?.querySelector('.sketch-fight')?.classList.toggle('away', Boolean(active));
    canvas.classList.toggle('on', Boolean(active));
    if (!active) { shown.A = shown.B = null; return; }
    if (Math.abs(scrollY - lastY) > 0.5) lastMove = now;
    lastY = scrollY;
    const { A, B, extras } = scene(t);
    drawActor('B', B, t, now - lastMove < 250);
    drawActor('A', A, t, now - lastMove < 250);
    for (const x of extras) x();
  }

  measure();
  let raf = 0, last = 0, pending = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30 fps
    last = now;
    render(now);
  };
  raf = requestAnimationFrame(loop);
  const remeasure = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(measure); };
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.body);
  addEventListener('resize', remeasure);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener('resize', remeasure);
    hero?.querySelector('.sketch-fight')?.classList.remove('away');
    logo?.classList.remove('logo-hit');
  };
}
