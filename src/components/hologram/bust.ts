// Procedural humanoid bust described as a signed distance field (SDF).
// Sampling its surface yields the point cloud for the Master Clone hologram —
// no model files to download, and the silhouette stays stylized rather than uncanny.

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function ellipsoid(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  const px = x - cx;
  const py = y - cy;
  const pz = z - cz;
  const k0 = Math.hypot(px / rx, py / ry, pz / rz);
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

function capsule(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

function smin(a: number, b: number, k: number) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

export function bustSDF(x: number, y: number, z: number) {
  const ax = Math.abs(x);
  // Skull and face
  let d = ellipsoid(x, y, z, 0, 0.64, -0.03, 0.45, 0.53, 0.53);
  d = smin(d, ellipsoid(x, y, z, 0, 0.41, 0.07, 0.395, 0.41, 0.43), 0.14);
  // Jaw angles give a squarer, more human lower face
  d = smin(d, ellipsoid(ax, y, z, 0.25, 0.27, 0.06, 0.12, 0.11, 0.2), 0.1);
  d = smin(d, ellipsoid(x, y, z, 0, 0.165, 0.17, 0.165, 0.115, 0.15), 0.1);
  d = smin(d, ellipsoid(ax, y, z, 0.245, 0.47, 0.3, 0.12, 0.08, 0.11), 0.07);
  d = smin(d, ellipsoid(x, y, z, 0, 0.665, 0.385, 0.33, 0.07, 0.13), 0.06);
  // Nose
  d = smin(d, capsule(x, y, z, 0, 0.62, 0.465, 0, 0.46, 0.55, 0.042), 0.05);
  d = smin(d, ellipsoid(x, y, z, 0, 0.445, 0.535, 0.075, 0.052, 0.058), 0.04);
  // Lips
  d = smin(d, ellipsoid(x, y, z, 0, 0.318, 0.47, 0.115, 0.034, 0.05), 0.035);
  d = smin(d, ellipsoid(x, y, z, 0, 0.278, 0.462, 0.1, 0.03, 0.045), 0.03);
  // Eye sockets and eyes
  d = smax(d, -ellipsoid(ax, y, z, 0.162, 0.565, 0.5, 0.095, 0.058, 0.09), 0.05);
  d = smin(d, ellipsoid(ax, y, z, 0.162, 0.565, 0.43, 0.062, 0.048, 0.058), 0.02);
  // Ears
  d = smin(d, ellipsoid(ax, y, z, 0.46, 0.52, -0.03, 0.05, 0.13, 0.085), 0.05);
  // Neck, sloping trapezius, deltoids, chest
  d = smin(d, capsule(x, y, z, 0, 0.25, -0.06, 0, -0.3, -0.04, 0.185), 0.1);
  d = smin(d, capsule(ax, y, z, 0.06, -0.2, -0.07, 0.66, -0.52, -0.05, 0.15), 0.2);
  d = smin(d, ellipsoid(ax, y, z, 0.76, -0.66, -0.02, 0.2, 0.26, 0.21), 0.14);
  d = smin(d, ellipsoid(x, y, z, 0, -0.86, 0, 0.72, 0.46, 0.3), 0.16);
  // Flat cut at the base of the bust
  return Math.max(d, -(y + 1.02));
}

function gradient(x: number, y: number, z: number): [number, number, number] {
  const e = 0.0015;
  const a = bustSDF(x + e, y - e, z - e);
  const b = bustSDF(x - e, y - e, z + e);
  const c = bustSDF(x - e, y + e, z - e);
  const d = bustSDF(x + e, y + e, z + e);
  const nx = a - b - c + d;
  const ny = -a - b + c + d;
  const nz = -a + b - c + d;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BustSamples {
  positions: Float32Array;
  normals: Float32Array;
  rands: Float32Array;
  count: number;
}

/** Roughly uniform samples on the bust surface (rejection in a thin shell, then projection). */
export function sampleBustSurface(count: number, seed = 11): BustSamples {
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  let i = 0;
  let guard = 0;
  while (i < count && guard < count * 60) {
    guard++;
    const inHead = rng() < 0.5;
    let x = inHead ? (rng() * 2 - 1) * 0.6 : (rng() * 2 - 1) * 1.12;
    let y = inHead ? 0.02 + rng() * 1.22 : -1.04 + rng() * 1.3;
    let z = inHead ? -0.62 + rng() * 1.3 : (rng() * 2 - 1) * 0.42;
    if (Math.abs(bustSDF(x, y, z)) > 0.035) continue;
    for (let k = 0; k < 4; k++) {
      const d = bustSDF(x, y, z);
      const [nx, ny, nz] = gradient(x, y, z);
      x -= d * nx;
      y -= d * ny;
      z -= d * nz;
    }
    if (Math.abs(bustSDF(x, y, z)) > 0.004 || y < -1.0) continue;
    const [nx, ny, nz] = gradient(x, y, z);
    positions.set([x, y, z], i * 3);
    normals.set([nx, ny, nz], i * 3);
    rands[i] = rng();
    i++;
  }
  return { positions: positions.subarray(0, i * 3), normals: normals.subarray(0, i * 3), rands: rands.subarray(0, i), count: i };
}

/** Points inside the skull, connected to near neighbours — the "neural" mesh. */
export function sampleNeuralMesh(nodes: number, seed = 5) {
  const rng = mulberry32(seed);
  const pts: number[][] = [];
  let guard = 0;
  while (pts.length < nodes && guard < nodes * 200) {
    guard++;
    const x = (rng() * 2 - 1) * 0.42;
    const y = 0.32 + rng() * 0.8;
    const z = -0.5 + rng() * 0.9;
    if (bustSDF(x, y, z) < -0.07) pts.push([x, y, z]);
  }
  const seg: number[] = [];
  const t: number[] = [];
  const phase: number[] = [];
  for (let a = 0; a < pts.length; a++) {
    let links = 0;
    for (let b = a + 1; b < pts.length && links < 3; b++) {
      const d = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1], pts[a][2] - pts[b][2]);
      if (d < 0.24) {
        seg.push(...pts[a], ...pts[b]);
        t.push(0, 1);
        const p = rng();
        phase.push(p, p);
        links++;
      }
    }
  }
  return {
    nodes: new Float32Array(pts.flat()),
    segments: new Float32Array(seg),
    segT: new Float32Array(t),
    segPhase: new Float32Array(phase),
  };
}
