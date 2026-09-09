/* Replicates the marquee integrator exactly as written in kj-v2.js and
   checks the properties that matter. */
const DRIFT = 25, HOVER_DRIFT = 3, VEL_MAX = 900, DECAY = 0.06;

function run({ fps, seconds, w, dir, scrollDeltas = [] }) {
  const dtNominal = 1 / fps;
  let x = dir > 0 ? -w : 0, vel = 0, t = 0, i = 0;
  const samples = [];
  const scrollAt = new Map(scrollDeltas.map(([at, dy]) => [Math.round(at * fps), dy]));
  const frames = Math.round(seconds * fps);
  let wraps = 0;
  for (let f = 0; f < frames; f++) {
    if (scrollAt.has(f)) {
      let dy = scrollAt.get(f);
      if (Math.abs(dy) > 240) dy = dy > 0 ? 240 : -240;
      vel += dy * 14;
      if (vel > VEL_MAX) vel = VEL_MAX;
      if (vel < -VEL_MAX) vel = -VEL_MAX;
    }
    let dt = dtNominal; if (dt > 0.1) dt = 0.1;
    vel *= Math.pow(DECAY, dt);
    if (Math.abs(vel) < 0.5) vel = 0;
    const base = DRIFT;
    const before = x;
    x += (base * dir + vel * dir) * dt;
    const pre = x;
    x = ((x % w) - w) % w;
    if (Math.abs(x - pre) > 1e-9) wraps++;
    t += dt;
    if (f % Math.round(fps/4) === 0) samples.push(x);
  }
  return { x, vel, wraps, t, samples };
}

const W = 5290;
let fails = 0;
const ok = (name, cond, detail='') => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (!cond) fails++;
};

// 1. Frame-rate independence: 60Hz vs 120Hz vs 144Hz must travel the same distance.
const a60  = run({ fps: 60,  seconds: 10, w: W, dir: -1 });
const a120 = run({ fps: 120, seconds: 10, w: W, dir: -1 });
const a144 = run({ fps: 144, seconds: 10, w: W, dir: -1 });
const spread = Math.max(a60.x, a120.x, a144.x) - Math.min(a60.x, a120.x, a144.x);
ok('frame-rate independent over 10s', spread < 0.5,
   `60Hz=${a60.x.toFixed(2)} 120Hz=${a120.x.toFixed(2)} 144Hz=${a144.x.toFixed(2)} spread=${spread.toFixed(3)}px`);

// 2. Drift rate is the declared 25 px/s.
const d1 = run({ fps: 60, seconds: 1, w: W, dir: -1 });
ok('drift is ~25 px/s', Math.abs(Math.abs(d1.x) - DRIFT) < 0.6, `moved ${Math.abs(d1.x).toFixed(2)}px in 1s`);

// 3. Opposite directions.
const left  = run({ fps: 60, seconds: 2, w: W, dir: -1 });
const right = run({ fps: 60, seconds: 2, w: 4636, dir: 1 });
// Direction = sign of movement between consecutive samples, ignoring wraps.
const stepSign = r => {
  const d = [];
  for (let k = 1; k < r.samples.length; k++) {
    const s = r.samples[k] - r.samples[k-1];
    if (Math.abs(s) < 1000) d.push(Math.sign(s));   // skip wrap discontinuities
  }
  return d.every(v => v === d[0]) ? d[0] : 0;
};
ok('rows travel opposite ways', stepSign(left) === -1 && stepSign(right) === 1,
   `dir-1 steps=${stepSign(left)}  dir+1 steps=${stepSign(right)}`);
ok('a rightward row starts at -w, no startup snap',
   Math.abs(right.samples[0] - (-4636)) < 1,
   `first sample = ${right.samples[0].toFixed(1)} (want ~-4636)`);

// 4. Scrolling adds speed.
const quiet  = run({ fps: 60, seconds: 1, w: W, dir: -1 });
const pushed = run({ fps: 60, seconds: 1, w: W, dir: -1, scrollDeltas: [[0.0, 60]] });
ok('a scroll speeds it up', Math.abs(pushed.x) > Math.abs(quiet.x) * 1.5,
   `quiet=${Math.abs(quiet.x).toFixed(1)}px  scrolled=${Math.abs(pushed.x).toFixed(1)}px`);

// 5. A huge delta (scroll restoration) is clamped, not teleported.
const jump = run({ fps: 60, seconds: 1, w: W, dir: -1, scrollDeltas: [[0.0, 25000]] });
ok('a 25000px scroll jump is clamped', Math.abs(jump.x) < 400,
   `moved ${Math.abs(jump.x).toFixed(1)}px (uncapped would be tens of thousands)`);

// 6. x always stays inside [-w, 0) — one wrap handles any overshoot.
let worst = 0;
for (const fps of [24, 60, 120]) {
  for (const dir of [-1, 1]) {
    const r = run({ fps, seconds: 400, w: W, dir, scrollDeltas: [[1, 900], [5, -900], [50, 400]] });
    if (r.x > 0 || r.x <= -W) worst = r.x;
  }
}
ok('x stays in [-w, 0) across 400s and hundreds of wraps', worst === 0, worst ? `escaped to ${worst}` : 'never escaped');

// 7. Velocity decays to rest.
const decayed = run({ fps: 60, seconds: 3, w: W, dir: -1, scrollDeltas: [[0, 200]] });
ok('velocity decays back to zero', decayed.vel === 0, `vel after 3s = ${decayed.vel}`);

// 8. A long frame gap (backgrounded tab) is capped at 0.1s, so no lurch.
const lurch = run({ fps: 2, seconds: 1, w: W, dir: -1 });  // 0.5s frames -> capped to 0.1
ok('a 0.5s frame gap is capped', Math.abs(lurch.x) <= DRIFT * 0.1 * 2 + 0.1,
   `moved ${Math.abs(lurch.x).toFixed(2)}px over two half-second frames`);

console.log(fails ? `\n${fails} FAILED` : '\nall marquee motion checks pass');
process.exit(fails ? 1 : 0);
