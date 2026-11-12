// Pencil-sketch sword fight: two original fighters drawn on a <canvas> in a hand-drawn style.
// ~10 s loop, rendered at 12 fps ("on twos", like hand-drawn animation) so it costs very little CPU.
// start(canvas, { still }) → stop(). With still: true it draws one frame (the clash) and stops.

const FPS = 12;
const LOOP = 10;
const BLADE = 112;
const INK = '235, 228, 255';

// Poses for a fighter facing right. Hip at (0,0), y grows downward. s = sword angle in degrees (0 = right).
const P = {
  stance: { n: [0, -95], hd: [6, -118], k1: [28, 42], f1: [48, 86], k2: [-24, 44], f2: [-48, 86], e1: [24, -68], h1: [42, -54], e2: [4, -66], h2: [34, -52], s: -38 },
  crouch: { n: [16, -78], hd: [26, -99], k1: [36, 40], f1: [52, 72], k2: [-30, 48], f2: [-58, 72], e1: [4, -58], h1: [-18, -42], e2: [-4, -56], h2: [-12, -40], s: 168 },
  dash: { n: [38, -78], hd: [54, -95], k1: [46, 30], f1: [82, 64], k2: [-40, 28], f2: [-86, 52], e1: [14, -58], h1: [-14, -48], e2: [24, -62], h2: [-8, -50], s: 176 },
  clash: { n: [20, -88], hd: [30, -110], k1: [36, 40], f1: [62, 86], k2: [-30, 42], f2: [-66, 86], e1: [40, -80], h1: [62, -92], e2: [28, -74], h2: [54, -86], s: -52 },
  jump: { n: [-4, -86], hd: [-8, -108], k1: [32, -6], f1: [12, 30], k2: [12, 8], f2: [-16, 36], e1: [24, -62], h1: [46, -78], e2: [10, -60], h2: [38, -74], s: -82 },
  strike: { n: [16, -84], hd: [26, -104], k1: [34, 16], f1: [30, 56], k2: [-20, 26], f2: [-42, 52], e1: [42, -50], h1: [64, -30], e2: [30, -48], h2: [56, -30], s: 42 },
  block: { n: [-8, -88], hd: [-14, -108], k1: [30, 42], f1: [56, 86], k2: [-30, 42], f2: [-56, 86], e1: [18, -112], h1: [34, -126], e2: [-14, -110], h2: [-4, -126], s: -4 },
};

// [time, hipX, hipY, pose]
const A = [[0, 250, 245, 'stance'], [1.4, 240, 259, 'crouch'], [2.1, 360, 250, 'dash'], [2.5, 410, 245, 'clash'], [3.3, 398, 245, 'clash'], [3.9, 330, 150, 'jump'], [5.0, 440, 138, 'jump'], [5.6, 500, 150, 'strike'], [6.4, 512, 158, 'strike'], [7.2, 420, 148, 'jump'], [8.2, 250, 245, 'stance'], [10, 250, 245, 'stance']];
const B = [[0, 750, 245, 'stance'], [1.4, 760, 259, 'crouch'], [2.1, 640, 250, 'dash'], [2.5, 590, 245, 'clash'], [3.3, 602, 245, 'clash'], [3.9, 690, 200, 'jump'], [5.0, 640, 245, 'block'], [5.6, 640, 245, 'block'], [6.4, 646, 258, 'block'], [7.2, 680, 245, 'stance'], [8.2, 750, 245, 'stance'], [10, 750, 245, 'stance']];
const IMPACTS = [2.5, 5.6];
const LANDINGS = [[5.0, 'B'], [8.2, 'A'], [8.2, 'B']];
const GROUND = 331;

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const angLerp = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

function fighterAt(keys, t, mirror) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const [t0, x0, y0, p0] = keys[i];
  const [t1, x1, y1, p1] = keys[i + 1];
  const u = ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
  const a = P[p0], b = P[p1];
  const m = mirror ? -1 : 1;
  const out = { x: lerp(x0, x1, u), y: lerp(y0, y1, u), dir: m };
  for (const k of Object.keys(a)) {
    if (k === 's') continue;
    out[k] = [out.x + m * lerp(a[k][0], b[k][0], u), out.y + lerp(a[k][1], b[k][1], u)];
  }
  const s = angLerp(a.s, b.s, u);
  out.s = mirror ? 180 - s : s;
  const r = (out.s * Math.PI) / 180;
  out.tip = [out.h1[0] + Math.cos(r) * BLADE, out.h1[1] + Math.sin(r) * BLADE];
  return out;
}

function intersect([a, b], [c, d]) {
  const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
  if (!den) return null;
  const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
  const u = -((a[0] - b[0]) * (a[1] - c[1]) - (a[1] - b[1]) * (a[0] - c[0])) / den;
  return t >= -0.1 && t <= 1.1 && u >= -0.1 && u <= 1.1 ? [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] : null;
}

export function start(canvas, { still = false, at = 2.58 } = {}) {
  const ctx = canvas.getContext('2d');
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const j = (amt) => (rnd() - 0.5) * 2 * amt;

  // impact points: where the blades cross at each impact moment
  const impacts = IMPACTS.map((t) => {
    const a = fighterAt(A, t, false), b = fighterAt(B, t, true);
    return { t, p: intersect([a.h1, a.tip], [b.h1, b.tip]) || [lerp(a.h1[0], a.tip[0], 0.6), lerp(a.h1[1], a.tip[1], 0.6)] };
  });

  let W = 0, H = 0, scale = 1, ox = 0, oy = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    scale = Math.min(W / 1000, H / 420) * dpr;
    ox = (canvas.width - 1000 * scale) / 2;
    oy = (canvas.height - 420 * scale) / 2;
  }

  function line(a, b, { w = 1.3, passes = 2, alpha = 0.85, wob = 1.6 } = {}) {
    for (let p = 0; p < passes; p++) {
      const over = 2 + rnd() * 4; // pencil overshoot past the ends
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const mx = (a[0] + b[0]) / 2 + j(wob * 1.5), my = (a[1] + b[1]) / 2 + j(wob * 1.5);
      ctx.beginPath();
      ctx.moveTo(a[0] - ux * over + j(wob), a[1] - uy * over + j(wob));
      ctx.quadraticCurveTo(mx, my, b[0] + ux * over + j(wob), b[1] + uy * over + j(wob));
      ctx.lineWidth = w * (p ? 0.7 : 1);
      ctx.strokeStyle = `rgba(${INK}, ${alpha * (p ? 0.5 : 1)})`;
      ctx.stroke();
    }
  }
  function circle([cx, cy], r) {
    for (let p = 0; p < 2; p++) {
      ctx.beginPath();
      const start = rnd() * Math.PI * 2, turns = 1.08 + rnd() * 0.1;
      for (let i = 0; i <= 26; i++) {
        const a = start + (i / 26) * Math.PI * 2 * turns;
        const rr = r + j(1.3);
        i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.lineWidth = p ? 0.9 : 1.4;
      ctx.strokeStyle = `rgba(${INK}, ${p ? 0.45 : 0.85})`;
      ctx.stroke();
    }
  }

  function drawFighter(f, prev, kind) {
    const vx = f.x - prev.x, vy = f.y - prev.y;
    const back = -f.dir;
    // ground shadow (hatched), smaller when airborne
    const air = Math.max(0, GROUND - (f.y + 86));
    const sw = Math.max(14, 46 - air * 0.18);
    for (let i = 0; i < 6; i++) {
      const x = f.x - sw + (i / 5) * sw * 2;
      line([x, GROUND + 6], [x + 9, GROUND + 1], { w: 0.8, passes: 1, alpha: 0.35, wob: 0.8 });
    }
    // limbs with volume: two tapered contour lines, like a pencil figure drawing
    const limb = (a, b, wa, wb, alpha = 0.85) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      line([a[0] + nx * wa, a[1] + ny * wa], [b[0] + nx * wb, b[1] + ny * wb], { w: 1.2, passes: 1, alpha, wob: 1 });
      line([a[0] - nx * wa, a[1] - ny * wa], [b[0] - nx * wb, b[1] - ny * wb], { w: 1.2, passes: 1, alpha, wob: 1 });
    };
    const hip = [f.x, f.y];
    const flare = kind === 'B' ? 11 : 4.5; // B wears wide hakama trousers
    for (const [k, ft] of [[f.k2, f.f2], [f.k1, f.f1]]) {
      limb(hip, k, 7, kind === 'B' ? 8 : 5.5);
      limb(k, ft, kind === 'B' ? 8 : 5, flare);
      line(ft, [ft[0] + 13 * f.dir, ft[1] + 1], { w: 1.6, passes: 1 });
    }
    // torso: shoulders wider than the waist
    const tx = f.n[0] - f.x, ty = f.n[1] - f.y, tl = Math.hypot(tx, ty) || 1;
    const px = -ty / tl, py = tx / tl;
    const shL = [f.n[0] + px * 13, f.n[1] + py * 13 + 6], shR = [f.n[0] - px * 13, f.n[1] - py * 13 + 6];
    line(shL, [f.x + px * 9, f.y + py * 9], { w: 1.4, passes: 2 });
    line(shR, [f.x - px * 9, f.y - py * 9], { w: 1.4, passes: 2 });
    line(shL, shR, { w: 1.2, passes: 1 });
    line([f.x + px * 10, f.y + py * 10 - 4], [f.x - px * 10, f.y - py * 10 - 4], { w: 1.6, passes: 1 }); // belt
    for (let i = 1; i < 4; i++) {
      const t = i / 4, cx = lerp(f.n[0], f.x, t), cy = lerp(f.n[1], f.y, t);
      line([cx - 5, cy + 5], [cx + 5, cy - 5], { w: 0.7, passes: 1, alpha: 0.35, wob: 0.5 });
    }
    if (kind === 'A') {
      // long coat tails flapping behind
      const fl = Math.sin(performance.now() / 120) * 5;
      for (const off of [-4, 5]) {
        const end = [f.x + back * (34 + Math.abs(vx) * 2.2) + off, f.y + 40 - vy * 1.2 + fl + off];
        ctx.beginPath();
        ctx.moveTo(f.x + back * 6, f.y - 6);
        ctx.quadraticCurveTo(f.x + back * 20 + j(2), f.y + 18 + off, end[0] + j(2), end[1] + j(2));
        ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${INK}, 0.7)`; ctx.stroke();
      }
    }
    // arms
    limb(f.n, f.e2, 4.5, 3.6, 0.7); limb(f.e2, f.h2, 3.6, 2.6, 0.7);
    limb(f.n, f.e1, 4.5, 3.6); limb(f.e1, f.h1, 3.6, 2.6);
    circle(f.h1, 3.5);
    // head: round skull, a chin pointing where they face, one eye stroke
    const hd = f.hd;
    circle(hd, 14);
    line([hd[0] + f.dir * 5, hd[1] + 11], [hd[0] + f.dir * 15, hd[1] + 5], { w: 1.4, passes: 1 });
    line([hd[0] + f.dir * 6, hd[1] - 1], [hd[0] + f.dir * 12, hd[1] - 3], { w: 1.8, passes: 1, alpha: 0.95 });
    line([hd[0], hd[1] + 14], [f.n[0], f.n[1]], { w: 1.4, passes: 1 }); // neck
    if (kind === 'A') {
      for (let i = 0; i < 7; i++) {
        const a = (-175 + i * 26) * (Math.PI / 180);
        const base = [hd[0] + Math.cos(a) * 13, hd[1] + Math.sin(a) * 13];
        const lean = back * (10 + Math.abs(vx) * 0.6);
        const len = 10 + (i % 2) * 6;
        line(base, [base[0] + Math.cos(a) * len + lean, base[1] + Math.sin(a) * len - 5 - vy * 0.2], { w: 1.3, passes: 1 });
      }
      // scarf trailing behind the neck
      const sway = Math.sin(performance.now() / 160) * 6;
      const tail = [f.n[0] + back * (46 + Math.abs(vx) * 2), f.n[1] - 6 - vy * 1.5 + sway];
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(f.n[0], f.n[1] - 2 + k * 5);
        ctx.quadraticCurveTo(f.n[0] + back * 22, f.n[1] - 12 + sway + k * 5, tail[0], tail[1] + k * 6);
        ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${INK}, ${0.75 - k * 0.2})`; ctx.stroke();
      }
    } else {
      const sway = Math.sin(performance.now() / 210) * 5;
      const tip = [hd[0] + back * (44 + Math.abs(vx) * 1.5), hd[1] + 26 - vy * 1.2 + sway];
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(hd[0] + back * 8, hd[1] - 11);
        ctx.quadraticCurveTo(hd[0] + back * 36 + j(2), hd[1] - 16 + j(2) + k * 3, tip[0] + j(3), tip[1] + j(3) + k * 3);
        ctx.lineWidth = k ? 0.8 : 1.3; ctx.strokeStyle = `rgba(${INK}, ${k ? 0.4 : 0.8})`; ctx.stroke();
      }
      // bangs + headband
      for (let i = 0; i < 3; i++) line([hd[0] + f.dir * (2 + i * 4), hd[1] - 13], [hd[0] + f.dir * (5 + i * 5), hd[1] - 2], { w: 1, passes: 1, alpha: 0.7 });
      line([hd[0] - 14, hd[1] - 6], [hd[0] + 14, hd[1] - 8], { w: 1.2, passes: 1, alpha: 0.7 });
    }
    // sword: blade, guard, handle
    const r = (f.s * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    line(f.h1, f.tip, { w: 1.4, passes: 2, alpha: 0.95, wob: 0.8 });
    line([f.h1[0] + c * 6 - s * 7, f.h1[1] + s * 6 + c * 7], [f.h1[0] + c * 6 + s * 7, f.h1[1] + s * 6 - c * 7], { w: 1.6, passes: 1 });
    line(f.h1, [f.h1[0] - c * 18, f.h1[1] - s * 18], { w: 2.2, passes: 1 });
    // swing smear when the blade moves fast
    const pr = (prev.s * Math.PI) / 180;
    let da = ((((f.s - prev.s) % 360) + 540) % 360) - 180;
    if (Math.abs(da) > 12) {
      for (let k = 0; k < 4; k++) {
        const rr = BLADE * (0.55 + k * 0.15);
        ctx.beginPath();
        ctx.arc(f.h1[0], f.h1[1], rr, pr, r, da < 0);
        ctx.lineWidth = 0.8; ctx.strokeStyle = `rgba(${INK}, ${0.18 + k * 0.06})`; ctx.stroke();
      }
    }
    // speed lines when moving fast
    const sp = Math.hypot(vx, vy);
    if (sp > 6) {
      for (let k = 0; k < 6; k++) {
        const y = f.y - 90 + k * 30 + j(6), x = f.x + back * (30 + rnd() * 30);
        line([x, y], [x - (vx / sp) * (40 + sp * 3), y - (vy / sp) * (40 + sp * 3)], { w: 0.8, passes: 1, alpha: 0.35 });
      }
    }
  }

  function drawImpact(p, age) {
    const k = age / 0.5;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + j(0.12);
      const r0 = 8 + k * 30, r1 = r0 + 18 + rnd() * 34 * (1 - k);
      line([p[0] + Math.cos(a) * r0, p[1] + Math.sin(a) * r0], [p[0] + Math.cos(a) * r1, p[1] + Math.sin(a) * r1], { w: 1.1 * (1 - k) + 0.4, passes: 1, alpha: 0.9 * (1 - k) });
    }
    circle(p, 8 + k * 30);
    // sparks
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, d = 20 + k * 90 * rnd();
      const q = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d + k * 20];
      line(q, [q[0] + Math.cos(a) * 6, q[1] + Math.sin(a) * 6], { w: 1, passes: 1, alpha: 1 - k });
    }
  }

  function drawDust(x, age) {
    const k = age / 0.6;
    for (const d of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const cx = x + d * (14 + k * 50 + i * 10), cy = GROUND - 4 - i * 4 - k * 10;
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + k * 8, Math.PI, 0);
        ctx.lineWidth = 0.9; ctx.strokeStyle = `rgba(${INK}, ${0.5 * (1 - k)})`; ctx.stroke();
      }
    }
  }

  function frame(t) {
    const step = Math.floor(t * FPS);
    seed = 1 + (step % 9973) * 7919; // lines "boil" a little each frame, like hand-drawn animation
    const tt = (step / FPS) % LOOP;
    const pt = (tt - 1 / FPS + LOOP) % LOOP;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // camera shake on impact
    const hit = impacts.find((i) => tt >= i.t && tt - i.t < 0.25);
    const shake = hit ? 3 * (1 - (tt - hit.t) / 0.25) : 0;
    ctx.setTransform(scale, 0, 0, scale, ox + j(shake) * scale, oy + j(shake) * scale);
    ctx.lineCap = 'round';
    // ground
    line([60, GROUND], [520, GROUND + 1], { w: 1.2, alpha: 0.6 });
    line([480, GROUND + 1], [940, GROUND], { w: 1.2, alpha: 0.6 });
    for (let i = 0; i < 9; i++) {
      const x = 100 + i * 100 + j(10);
      line([x, GROUND + 10], [x + 26, GROUND + 10 + j(1)], { w: 0.7, passes: 1, alpha: 0.25 });
    }
    const a = fighterAt(A, tt, false), b = fighterAt(B, tt, true);
    drawFighter(a, fighterAt(A, pt, false), 'A');
    drawFighter(b, fighterAt(B, pt, true), 'B');
    for (const i of impacts) if (tt >= i.t && tt - i.t < 0.5) drawImpact(i.p, tt - i.t);
    for (const [lt, who] of LANDINGS) {
      if (tt >= lt && tt - lt < 0.6) drawDust((who === 'A' ? a : b).x, tt - lt);
    }
  }

  resize();
  if (still) {
    frame(at);
    return () => {};
  }
  let raf = 0, last = -1;
  const t0 = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000;
    const step = Math.floor(t * FPS);
    if (step === last) return; // only draw 12 times a second
    last = step;
    frame(t);
  };
  raf = requestAnimationFrame(loop);
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
}
