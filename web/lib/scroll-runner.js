// Scroll-driven pencil swordsman for the homepage. As the reader scrolls, he leaves the header, runs across
// the gap above each section, fights an opponent there (and keeps fighting while the reader pauses), slides
// down the page edge to the next section, and at the very bottom wins one last fight and leaps into the
// footer logo. Everything is drawn on one fixed, click-through canvas; position comes from the scroll
// position, the fighting and pencil "boil" from the clock.
import { makeArtist, P as BASE, BLADE, lerp, angLerp, ease } from './sketch-fight.js';

const K = 0.5; // scene units → CSS pixels (a fighter is ~90 px tall)
const HIP = 86; // hip height above the feet, in scene units
const P = {
  ...BASE,
  run1: { n: [14, -92], hd: [22, -114], k1: [34, 32], f1: [58, 70], k2: [-18, 42], f2: [-50, 60], e1: [26, -62], h1: [40, -44], e2: [-4, -64], h2: [-22, -46], s: 168 },
  run2: { n: [14, -90], hd: [22, -112], k1: [8, 46], f1: [-6, 86], k2: [34, 26], f2: [26, 64], e1: [24, -60], h1: [38, -42], e2: [12, -62], h2: [30, -50], s: 172 },
  slide: { n: [2, -94], hd: [6, -116], k1: [14, 40], f1: [18, 84], k2: [-6, 42], f2: [-2, 86], e1: [22, -60], h1: [30, -34], e2: [-16, -112], h2: [-12, -134], s: 80 },
};
// fight loop (seconds): the two trade blows; impacts where the blades meet
const FIGHT_T = 1.6;
const FIGHT_A = [[0, 'clash'], [0.4, 'strike'], [0.8, 'clash'], [1.2, 'block'], [1.6, 'clash']];
const FIGHT_B = [[0, 'clash'], [0.4, 'block'], [0.8, 'clash'], [1.2, 'strike'], [1.6, 'clash']];
const FIGHT_HITS = [0.4, 0.8, 1.2];

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** A fighter's joints (hip at 0,0, in scene units) blended between two poses. dir 1 = facing right. */
function build(pa, pb, u, dir) {
  const a = P[pa], b = P[pb];
  const out = { x: 0, y: 0, dir };
  for (const k of Object.keys(a)) {
    if (k !== 's') out[k] = [dir * lerp(a[k][0], b[k][0], u), lerp(a[k][1], b[k][1], u)];
  }
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
  return build(keys[i][1], keys[i + 1][1], u, dir);
}

export function start(canvas, { hero, logo } = {}) {
  const ctx = canvas.getContext('2d');
  const art = makeArtist(ctx);
  let dpr = 1, segs = [], vTotal = 1, maxScroll = 1;
  let lastV = 0, lastMove = 0, runDist = 0, prevPos = null;

  /* ---------- the route through the page (document coordinates, CSS px) ---------- */
  function buildRoute() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const sy = scrollY;
    const wrap = (hero?.closest('.wrap') || document.querySelector('main .wrap'))?.getBoundingClientRect();
    if (!wrap) return (segs = []);
    const xL = Math.max(30, wrap.left - 26), xR = Math.min(innerWidth - 30, wrap.right + 26);
    const heroBox = hero?.getBoundingClientRect();
    const startPt = [heroBox ? heroBox.right - 150 : wrap.right - 150, (heroBox ? heroBox.bottom : 200) + sy - 22];
    // run lines: just above each main-column section heading, at least 260 px apart
    const ys = [];
    for (const h of document.querySelectorAll('main .section-head')) {
      if (h.closest('.sidebar, aside')) continue;
      const r = h.getBoundingClientRect();
      if (r.left > wrap.left + 80 || r.width < 200) continue;
      const y = r.top + sy - 12;
      if (y > startPt[1] + 200 && (!ys.length || y - ys.at(-1) > 260)) ys.push(y);
    }
    const foot = document.querySelector('footer')?.getBoundingClientRect();
    const lg = logo?.getBoundingClientRect();
    const out = [];
    let cur = startPt, side = 'R';
    const run = (to, fight) => { out.push({ type: 'run', a: cur, b: to, fight }); cur = to; };
    const slide = (toY) => { out.push({ type: 'slide', a: cur, b: [cur[0], toY] }); cur = [cur[0], toY]; };
    run([xR, startPt[1]], false); // runs off from the header fight
    for (const y of ys) {
      slide(y);
      side = side === 'R' ? 'L' : 'R';
      run([side === 'R' ? xR : xL, y], true);
    }
    if (foot && lg) {
      const fy = foot.top + sy - 14;
      if (fy - cur[1] > 120) slide(fy);
      const target = [lg.left + lg.width / 2, lg.top + sy + lg.height / 2];
      const landX = target[0] + (cur[0] > target[0] ? 120 : -120);
      run([landX, fy], true); // the last fight
      out.push({ type: 'leap', a: cur, b: target });
    }
    // scroll budget: runs and the leap borrow from the slide that follows, so the swordsman stays on screen
    for (let i = 0; i < out.length; i++) {
      const s = out[i];
      s.len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      s.dv = s.type === 'slide' ? s.len : s.type === 'leap' ? 140 : Math.max(120, (s.fight ? 0.55 : 0.3) * s.len);
    }
    let v = 0;
    for (const s of out) { s.v0 = v; v += s.dv; s.v1 = v; }
    vTotal = Math.max(1, v);
    segs = out;
  }

  /* ---------- drawing ---------- */
  function place(f, feet, { scale = 1, rot = 0, alpha = 1, ground = 0, vx = 0, vy = 0, prevS }) {
    const sx = feet[0], syy = feet[1] - scrollY;
    if (syy < -150 || syy > innerHeight + 150) return;
    ctx.setTransform(dpr * K * scale, 0, 0, dpr * K * scale, dpr * sx, dpr * syy);
    ctx.translate(0, -HIP);
    if (rot) ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    f.ground = ground === null ? null : HIP;
    art.drawFighter(f, { x: -vx, y: -vy, s: prevS ?? f.s }, f.kind || 'A');
    ctx.globalAlpha = 1;
  }
  function burst(at, age, size = 1) {
    const syy = at[1] - scrollY;
    ctx.setTransform(dpr * K * size, 0, 0, dpr * K * size, dpr * at[0], dpr * syy);
    art.drawImpact([0, 0], age);
  }

  function render(now) {
    const t = now / 1000;
    art.setSeed(Math.floor(t * 12));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    const active = scrollY > 40 && segs.length;
    hero?.querySelector('.sketch-fight')?.classList.toggle('away', Boolean(active));
    canvas.classList.toggle('on', Boolean(active));
    if (!active) return;

    const v = clamp01(scrollY / maxScroll) * vTotal;
    if (Math.abs(v - lastV) > 0.5) lastMove = now;
    const moving = now - lastMove < 260;
    const dvSign = Math.sign(v - lastV) || 1;
    lastV = v;
    const s = segs.find((x) => v <= x.v1) || segs.at(-1);
    const u = clamp01((v - s.v0) / (s.v1 - s.v0));
    const dir = Math.sign(s.b[0] - s.a[0]) || (s.a[0] > innerWidth / 2 ? -1 : 1);

    if (s.type === 'slide') {
      // hop off the ledge, then slide down the page edge, sword scraping sparks
      const pos = [s.a[0], lerp(s.a[1], s.b[1], u)];
      const face = s.a[0] > innerWidth / 2 ? -1 : 1;
      if (u < 0.08) {
        const k = u / 0.08;
        place(build('jump', 'slide', ease(k), face), [pos[0] - face * Math.sin(k * Math.PI) * 26, pos[1]], { ground: null, vy: 6 });
      } else if (u > 0.93) {
        place(build('slide', 'crouch', ease((u - 0.93) / 0.07), face), pos, { vy: 2 });
      } else {
        const f = build('slide', 'slide', 0, face);
        place(f, pos, { ground: null, vy: moving ? 9 : 0 });
        if (moving) {
          // sparks off the blade tip
          ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * pos[0], dpr * (pos[1] - scrollY));
          ctx.translate(0, -HIP);
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + art.j(1.1);
            const p0 = [f.tip[0] + art.j(4), f.tip[1] + art.j(4)];
            art.line(p0, [p0[0] + Math.cos(a) * 12, p0[1] + Math.sin(a) * 12], { w: 1, passes: 1, alpha: 0.8 });
          }
        }
      }
    } else if (s.type === 'run') {
      const y = s.a[1];
      const runPose = (x) => {
        const was = prevPos;
        if (was && Math.abs(was - x) < 400) runDist += Math.abs(x - was);
        prevPos = x;
        if (!moving) return build('stance', 'stance', 0, dir);
        const ph = (Math.sin(runDist * 0.09) + 1) / 2;
        return build('run1', 'run2', ph, dir);
      };
      if (!s.fight) {
        const x = lerp(s.a[0], s.b[0], u);
        place(runPose(x), [x, y], { vx: moving ? dir * dvSign * 8 : 0 });
      } else {
        const mid = (s.a[0] + s.b[0]) / 2;
        const gap = 62 * K * 2.2;
        const bx = mid + dir * gap * 0.5;
        if (u < 0.35) {
          const x = lerp(s.a[0], mid - dir * gap * 0.5, ease(u / 0.35));
          place(runPose(x), [x, y], { vx: moving ? dir * 8 : 0 });
          const wait = build('stance', 'stance', 0, -dir);
          wait.kind = 'B';
          place(wait, [bx, y], {});
        } else if (u < 0.78) {
          // the duel: keeps going on the clock even when the reader stops scrolling
          const ft = (t % FIGHT_T);
          const fa = fromKeys(FIGHT_A, ft, dir), fb = fromKeys(FIGHT_B, ft, -dir);
          const pa = fromKeys(FIGHT_A, (ft - 0.08 + FIGHT_T) % FIGHT_T, dir), pb = fromKeys(FIGHT_B, (ft - 0.08 + FIGHT_T) % FIGHT_T, -dir);
          fa.kind = 'A'; fb.kind = 'B';
          place(fa, [mid - dir * gap * 0.5, y], { prevS: pa.s });
          place(fb, [bx, y], { prevS: pb.s });
          const hit = FIGHT_HITS.find((h) => ft >= h && ft - h < 0.35);
          if (hit !== undefined) burst([mid, y - 105 * K], ft - hit, 0.8);
        } else if (u < 0.88) {
          // finishing blow: the opponent is knocked flying
          const k = (u - 0.78) / 0.1;
          const fa = build('clash', 'strike', ease(Math.min(1, k * 2)), dir);
          fa.kind = 'A';
          place(fa, [mid - dir * gap * 0.3, y], { vx: dir * 4 });
          const fb = build('block', 'jump', ease(k), -dir);
          fb.kind = 'B';
          place(fb, [bx + dir * k * 220, y - Math.sin(k * Math.PI * 0.8) * 120], { rot: dir * k * 3, alpha: 1 - k * 0.9, ground: null, vx: dir * 10 });
          if (k < 0.6) burst([mid + dir * 10, y - 100 * K], k * 0.8, 1.3);
        } else {
          const x = lerp(mid - dir * gap * 0.3, s.b[0], ease((u - 0.88) / 0.12));
          place(runPose(x), [x, y], { vx: moving ? dir * 8 : 0 });
        }
      }
    } else if (s.type === 'leap') {
      // the final leap into the logo
      const e = ease(u);
      const x = lerp(s.a[0], s.b[0], e);
      const y = lerp(s.a[1], s.b[1], e) - Math.sin(u * Math.PI) * 170;
      const done = u > 0.94;
      logo?.classList.toggle('logo-hit', u > 0.97);
      if (!done) place(build('crouch', 'jump', Math.min(1, u * 4), dir), [x, y], { scale: lerp(1, 0.45, e), ground: null, vy: -4 });
      if (u > 0.85) burst([s.b[0], s.b[1]], Math.min(0.49, (u - 0.85) * 2), 0.7);
    }
    if (s.type !== 'leap') logo?.classList.remove('logo-hit');
  }

  /* ---------- loop ---------- */
  buildRoute();
  let raf = 0, last = 0, pending = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30 fps is plenty for pencil lines
    last = now;
    render(now);
  };
  raf = requestAnimationFrame(loop);
  const rebuild = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(buildRoute); };
  const ro = new ResizeObserver(rebuild);
  ro.observe(document.body);
  addEventListener('resize', rebuild);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener('resize', rebuild);
    hero?.querySelector('.sketch-fight')?.classList.remove('away');
    logo?.classList.remove('logo-hit');
  };
}
