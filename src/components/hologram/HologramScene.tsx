"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleBustSurface, sampleNeuralMesh } from "./bust";

export type HoloState = "idle" | "hover" | "processing";

interface SceneProps {
  state: HoloState;
  reducedMotion: boolean;
  density?: number;
  onReady?: () => void;
}

const CYAN = new THREE.Color("#5be7f5");
const VIOLET = new THREE.Color("#9879ff");
const HOT = new THREE.Color("#e9fbff");

// Rotates the head region toward the cursor while the shoulders stay put.
// The weight blends smoothly across the neck so no seam appears.
const HEAD_GLSL = /* glsl */ `
  uniform float uYaw;
  uniform float uPitch;
  vec3 applyHead(vec3 p, out mat3 R) {
    float w = smoothstep(-0.12, 0.34, p.y);
    float a = uYaw * w;
    float b = uPitch * w;
    float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
    mat3 ry = mat3(ca, 0.0, -sa, 0.0, 1.0, 0.0, sa, 0.0, ca);
    mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cb, sb, 0.0, -sb, cb);
    R = ry * rx;
    vec3 pivot = vec3(0.0, 0.06, -0.03);
    return R * (p - pivot) + pivot;
  }
`;

const BUST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uScanY;
  uniform float uReveal;
  uniform float uGlitch;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorHot;
  attribute float aRand;
  varying vec3 vColor;
  varying float vAlpha;
  ${HEAD_GLSL}
  void main() {
    mat3 R;
    vec3 p = applyHead(position, R);
    vec3 n = normalize(R * normal);
    p += n * (sin(uTime * 1.15) * 0.007 + sin(uTime * 2.3 + aRand * 40.0) * 0.003 * (0.5 + uEnergy));

    float slice = floor(p.y * 26.0);
    float g = step(0.94, fract(sin(slice * 91.7 + floor(uTime * 14.0)) * 43758.5453));
    p.x += g * uGlitch * 0.035;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 viewN = normalize(normalMatrix * n);
    float facing = abs(dot(viewN, normalize(-mv.xyz)));
    // Favour vertical silhouette edges over upward-facing surfaces (top of head, shoulders).
    float rim = pow(1.0 - facing, 2.2) * mix(0.3, 1.0, length(n.xz));
    float scan = exp(-pow((position.y - uScanY) * 7.0, 2.0));
    float contour = pow(abs(sin(position.y * 42.0 + uTime * 0.6)), 16.0);
    float shown = 1.0 - smoothstep(uReveal - 0.12, uReveal, position.y);
    float front = exp(-pow((position.y - uReveal) * 18.0, 2.0)) * step(uReveal, 1.4);

    float h = clamp((position.y + 1.0) / 2.2, 0.0, 1.0);
    vec3 col = mix(uColorB, uColorA, smoothstep(0.12, 0.8, h));
    col = mix(col, uColorHot, clamp(scan * 0.5 + front, 0.0, 1.0));
    vColor = col;

    float a = 0.12 + rim * 0.9 + contour * 0.22 + scan * 0.85;
    a *= 0.5 + 0.65 * uEnergy;
    vAlpha = min(a, 1.15) * shown + front * 1.3;

    float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + aRand * 60.0);
    gl_PointSize = (0.75 + aRand * 0.9) * twinkle * uPixelRatio * (13.0 / -mv.z) * (1.0 + scan * 0.8 + front * 1.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 2.4);
    gl_FragColor = vec4(vColor * (0.55 + glow * 0.9), glow * vAlpha);
  }
`;

const NEURAL_VERT = /* glsl */ `
  attribute float aT;
  attribute float aPhase;
  varying float vT;
  varying float vPhase;
  ${HEAD_GLSL}
  void main() {
    mat3 R;
    vec3 p = applyHead(position, R);
    vT = aT;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const NEURAL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uReveal;
  uniform vec3 uColor;
  varying float vT;
  varying float vPhase;
  void main() {
    float head = fract(uTime * (0.22 + uEnergy * 0.55) + vPhase);
    float pulse = smoothstep(0.14, 0.0, abs(vT - head));
    float a = (0.035 + pulse * 0.75) * (0.3 + uEnergy) * smoothstep(0.4, 1.2, uReveal);
    gl_FragColor = vec4(uColor, a);
  }
`;

const NODE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uReveal;
  uniform vec3 uColor;
  varying vec3 vColor;
  varying float vAlpha;
  ${HEAD_GLSL}
  void main() {
    mat3 R;
    vec3 p = applyHead(position, R);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float seed = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float blink = pow(0.5 + 0.5 * sin(uTime * (1.5 + seed * 3.0) + seed * 50.0), 6.0);
    vColor = uColor;
    vAlpha = (0.25 + blink * 0.9) * (0.35 + uEnergy) * smoothstep(0.4, 1.2, uReveal);
    gl_PointSize = (1.4 + blink * 2.4) * uPixelRatio * (12.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const CORE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uReveal;
  varying float vAlpha;
  ${HEAD_GLSL}
  void main() {
    mat3 R;
    vec3 p = applyHead(position, R);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float beat = 0.5 + 0.5 * sin(uTime * (1.6 + uEnergy * 2.2));
    vAlpha = (0.35 + beat * 0.35) * (0.4 + uEnergy) * smoothstep(0.6, 1.3, uReveal);
    gl_PointSize = (70.0 + beat * 26.0 + uEnergy * 40.0) * uPixelRatio * (4.6 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const CORE_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 18.0);
    float halo = exp(-d * d * 4.0) * 0.35;
    vec3 col = mix(uColorB, uColorA, core) + vec3(core * 0.6);
    gl_FragColor = vec4(col, (core + halo) * vAlpha);
  }
`;

const RING_VERT = /* glsl */ `
  attribute float aA;
  varying float vA;
  void main() {
    vA = aA;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uDash;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uReveal;
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float dash = step(0.38, fract(vA * uDash));
    float comet = pow(fract(vA - uTime * uSpeed), 7.0);
    float a = (0.07 + dash * 0.16 + comet * 0.95) * uOpacity * (0.45 + uEnergy * 0.8);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), comet * 0.45), a * smoothstep(-0.6, 0.6, uReveal));
  }
`;

const DUST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  attribute float aRand;
  varying vec3 vColor;
  varying float vAlpha;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  void main() {
    vec3 p = position;
    float span = 3.0;
    p.y = mod(p.y + 1.35 + uTime * (0.04 + aRand * 0.07) * (0.6 + uEnergy), span) - 1.35;
    p.x += sin(uTime * 0.3 + aRand * 20.0) * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float edge = smoothstep(-1.35, -0.9, p.y) * (1.0 - smoothstep(1.2, 1.65, p.y));
    vColor = mix(uColorB, uColorA, aRand);
    vAlpha = edge * (0.25 + 0.45 * aRand) * (0.5 + uEnergy * 0.7);
    gl_PointSize = (0.6 + aRand * 1.4) * uPixelRatio * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const CONE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.8);
    float streaks = 0.55 + 0.45 * sin(vUv.x * 6.2831 * 36.0 + uTime * 0.8);
    float a = fade * streaks * (0.05 + uEnergy * 0.07);
    gl_FragColor = vec4(uColor, a);
  }
`;

const DISC_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float pool = exp(-d * d * 3.2) * 0.22;
    float wave = smoothstep(0.03, 0.0, abs(fract(d * 1.1 - uTime * 0.18) - 0.5) - 0.47) * (1.0 - d);
    vec3 col = mix(uColorA, uColorB, d);
    gl_FragColor = vec4(col, (pool + wave * 0.18) * (0.5 + uEnergy * 0.6));
  }
`;

function additive(params: THREE.ShaderMaterialParameters) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    ...params,
  });
}

function makeRing(radius: number, dash: number, speed: number, opacity: number, color: THREE.Color, shared: Record<string, THREE.IUniform>) {
  const segments = 256;
  const pos = new Float32Array(segments * 3);
  const ang = new Float32Array(segments);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pos.set([Math.cos(a) * radius, 0, Math.sin(a) * radius], i * 3);
    ang[i] = i / segments;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aA", new THREE.BufferAttribute(ang, 1));
  const mat = additive({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uTime: shared.uTime,
      uEnergy: shared.uEnergy,
      uReveal: shared.uReveal,
      uDash: { value: dash },
      uSpeed: { value: speed },
      uOpacity: { value: opacity },
      uColor: { value: color },
    },
  });
  return new THREE.LineLoop(geo, mat);
}

function buildHologram(density: number) {
  const shared: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uEnergy: { value: 0.45 },
    uPixelRatio: { value: 1 },
    uScanY: { value: -1.2 },
    uReveal: { value: -1.3 },
    uGlitch: { value: 0 },
    uYaw: { value: 0 },
    uPitch: { value: 0 },
    uColorA: { value: CYAN.clone() },
    uColorB: { value: VIOLET.clone() },
    uColorHot: { value: HOT.clone() },
  };

  const root = new THREE.Group();
  const figure = new THREE.Group();
  root.add(figure);

  // Bust point cloud
  const bust = sampleBustSurface(Math.round(15000 * density));
  const bustGeo = new THREE.BufferGeometry();
  bustGeo.setAttribute("position", new THREE.BufferAttribute(bust.positions, 3));
  bustGeo.setAttribute("normal", new THREE.BufferAttribute(bust.normals, 3));
  bustGeo.setAttribute("aRand", new THREE.BufferAttribute(bust.rands, 1));
  figure.add(new THREE.Points(bustGeo, additive({ vertexShader: BUST_VERT, fragmentShader: POINT_FRAG, uniforms: shared })));

  // Neural mesh inside the skull
  const neural = sampleNeuralMesh(Math.round(170 * Math.max(0.6, density)));
  const segGeo = new THREE.BufferGeometry();
  segGeo.setAttribute("position", new THREE.BufferAttribute(neural.segments, 3));
  segGeo.setAttribute("aT", new THREE.BufferAttribute(neural.segT, 1));
  segGeo.setAttribute("aPhase", new THREE.BufferAttribute(neural.segPhase, 1));
  figure.add(
    new THREE.LineSegments(
      segGeo,
      additive({
        vertexShader: NEURAL_VERT,
        fragmentShader: NEURAL_FRAG,
        uniforms: { ...shared, uColor: { value: new THREE.Color("#a9f6ff") } },
      }),
    ),
  );
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(neural.nodes, 3));
  figure.add(
    new THREE.Points(
      nodeGeo,
      additive({ vertexShader: NODE_VERT, fragmentShader: POINT_FRAG, uniforms: { ...shared, uColor: { value: new THREE.Color("#c9fbff") } } }),
    ),
  );

  // Intelligence core
  const coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0.6, -0.04]), 3));
  figure.add(new THREE.Points(coreGeo, additive({ vertexShader: CORE_VERT, fragmentShader: CORE_FRAG, uniforms: shared })));

  // Orbital rings
  const rings = new THREE.Group();
  const r1 = makeRing(0.92, 48, 0.09, 1, CYAN, shared);
  r1.position.y = 0.6;
  r1.rotation.set(0.32, 0, 0.12);
  const r2 = makeRing(1.22, 90, -0.05, 0.8, VIOLET, shared);
  r2.position.y = -0.18;
  r2.rotation.set(0.22, 0, -0.08);
  const r3 = makeRing(1.06, 30, 0.13, 0.55, new THREE.Color("#8fd8ff"), shared);
  r3.position.y = 0.32;
  r3.rotation.set(1.25, 0.4, 0);
  rings.add(r1, r2, r3);
  root.add(rings);

  // Projector base
  const base = new THREE.Group();
  base.position.y = -1.1;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 96),
    additive({ vertexShader: CONE_VERT, fragmentShader: DISC_FRAG, uniforms: shared, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  base.add(disc);
  base.add(makeRing(0.62, 64, 0.05, 0.9, CYAN, shared), makeRing(0.98, 140, -0.03, 0.6, VIOLET, shared), makeRing(1.38, 4, 0.02, 0.35, CYAN, shared));

  const ticks: number[] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r0 = i % 10 === 0 ? 1.1 : 1.14;
    ticks.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
  }
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ticks), 3));
  base.add(new THREE.LineSegments(tickGeo, new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));

  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 0.58, 2.0, 72, 1, true),
    additive({ vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, uniforms: { ...shared, uColor: { value: CYAN } }, side: THREE.DoubleSide }),
  );
  cone.position.y = 1.0;
  base.add(cone);
  root.add(base);

  // Ambient dust
  const dustCount = Math.round(520 * density);
  const dustPos = new Float32Array(dustCount * 3);
  const dustRand = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.pow(Math.random(), 0.7) * 1.4;
    dustPos.set([Math.cos(a) * r, Math.random() * 3 - 1.35, Math.sin(a) * r * 0.6], i * 3);
    dustRand[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aRand", new THREE.BufferAttribute(dustRand, 1));
  root.add(new THREE.Points(dustGeo, additive({ vertexShader: DUST_VERT, fragmentShader: POINT_FRAG, uniforms: shared })));

  return { root, figure, rings: [r1, r2, r3], shared };
}

function Hologram({ state, reducedMotion, density = 1, onReady }: SceneProps) {
  const { gl } = useThree();
  const holo = useMemo(() => buildHologram(density), [density]);
  const pointer = useRef({ x: 0, y: 0 });
  const glitch = useRef({ next: 2, until: 0 });
  const startedAt = useRef<number | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    holo.shared.uPixelRatio.value = gl.getPixelRatio();
    readyRef.current?.();
    return () => {
      holo.root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    };
  }, [gl, holo]);

  useEffect(() => {
    if (reducedMotion) holo.shared.uReveal.value = 2;
  }, [holo, reducedMotion]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const u = holo.shared;
    const speed = reducedMotion ? 0.25 : 1;
    u.uTime.value += delta * speed;
    const t = u.uTime.value;

    const targetEnergy = state === "processing" ? 1 : state === "hover" ? 0.78 : 0.45;
    u.uEnergy.value = THREE.MathUtils.damp(u.uEnergy.value, targetEnergy, 3, delta);
    const e = u.uEnergy.value;

    // Materialize from the base on first load — driven by wall-clock time so a
    // throttled frame rate can't stall it.
    if (u.uReveal.value < 2) {
      startedAt.current ??= performance.now();
      u.uReveal.value = Math.min(2, -1.3 + ((performance.now() - startedAt.current) / 1000) * 2.1);
    }

    // Vertical scan sweep — faster while orchestrating.
    const scanSpeed = state === "processing" ? 1.25 : 0.42;
    u.uScanY.value += delta * scanSpeed * speed;
    if (u.uScanY.value > 1.5) u.uScanY.value = -1.3;

    // Occasional, subtle signal glitches.
    if (!reducedMotion) {
      if (t > glitch.current.next) {
        glitch.current.until = t + 0.12;
        glitch.current.next = t + (state === "processing" ? 0.8 : 3) + Math.random() * 3;
      }
      u.uGlitch.value = t < glitch.current.until ? 1 : 0;
    }

    // Shift toward violet while thinking.
    (u.uColorA.value as THREE.Color).lerpColors(CYAN, VIOLET, state === "processing" ? 0.18 + 0.12 * Math.sin(t * 3) : 0);

    // Head rests in a three-quarter view (so the profile reads as a face),
    // follows the pointer, and the body sways gently.
    const idleYaw = Math.sin(t * 0.32) * 0.1;
    u.uYaw.value = THREE.MathUtils.damp(u.uYaw.value, 0.3 + pointer.current.x * 0.36 + idleYaw, 2.5, delta);
    u.uPitch.value = THREE.MathUtils.damp(u.uPitch.value, 0.04 + pointer.current.y * 0.14, 2.5, delta);
    holo.figure.rotation.y = THREE.MathUtils.damp(holo.figure.rotation.y, 0.1 + pointer.current.x * 0.1, 2, delta);
    holo.figure.position.y = Math.sin(t * 0.8) * 0.02;

    const ringBoost = 1 + e * 1.4;
    holo.rings[0].rotation.y += delta * 0.18 * ringBoost * speed;
    holo.rings[1].rotation.y -= delta * 0.1 * ringBoost * speed;
    holo.rings[2].rotation.y += delta * 0.14 * ringBoost * speed;
    const s = 1 + (state === "processing" ? 0.05 : 0) + Math.sin(t * 2) * 0.004;
    holo.rings[0].scale.setScalar(THREE.MathUtils.damp(holo.rings[0].scale.x, s, 3, delta));
  });

  return <primitive object={holo.root} />;
}

export default function HologramScene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.06, 5.0], fov: 30, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.0, 0)}
      style={{ background: "transparent" }}
    >
      <Hologram {...props} />
    </Canvas>
  );
}
