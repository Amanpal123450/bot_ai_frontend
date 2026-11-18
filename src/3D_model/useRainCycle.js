import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// =====================================================================
// Har 20 sec ka cycle:
//   0s - 19s    -> kuch nahi chalta
//   20s         -> startRain + run DONO EK SAATH (Plane.001 pop-in bhi isi time)
//   ~29s        -> barish band, Plane.001 gayab
//   40s, 60s... -> startRain + run phir se, aise hi baar baar
// =====================================================================
const CYCLE_S = 20;
const START_AT_S = 20; // 0s par kuch nahi; 20s, 40s, 60s... par startRain + run
const RUN_DELAY_S = 0; // startRain ke kitne sec baad run (0 = dono ek saath)

// Plane.001 animation
const PLANE_IN_S = 0.8;
const PLANE_OUT_S = 0.8;

// ---- Blender ParticleSettings.001 (tumhari .blend se) ----
// totpart 1000, frame_start 1, frame_end 200, lifetime 50, 24 fps
// size 0.05, normal velocity 1.0, gravity 1.0 (9.81 m/s^2)
// render as = Object -> Icosphere.002 (blue drop)
const FPS = 24;
const TOTPART = 1000;
const EMIT_FRAMES = 200 - 1;
const EMIT_DURATION_S = EMIT_FRAMES / FPS; // ~8.3s
const EMIT_RATE = TOTPART / EMIT_DURATION_S; // ~120 drops/sec
const LIFE_S = 50 / FPS; // ~2.08s
const NORMAL_VELOCITY = 1.0;
const GRAVITY = 9.81;
const PARTICLE_SIZE = 0.05;

// ---- Boondein CHOTI rakhne ke liye ----
// 1 = Blender jitni (0.05 * 0.3675 = 0.018), 0.6 = thodi aur choti
const RAIN_SIZE_MULT = 0.6;

// Is height ke neeche boond khatam (scene-local y). Zameen dikhe to adjust karo.
const RAIN_FLOOR_Y = -0.2;
const POOL = 400; // ek saath itni boondein screen par (kaafi hai)

const EMIT_START_S = 0; // barish run ke saath hi shuru
const EMIT_END_S = EMIT_START_S + EMIT_DURATION_S;
const PLANE_OUT_START_S = EMIT_END_S + 1.2;

const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInQuad = (x) => x * x;

export function useRainCycle({ scene, busyRef, playOneShot }) {
  const st = useRef({
    clock: 0,
    idx: -1,
    t: 0,
    runFired: false,
    acc: 0,
    plane: null,
    planeBaseScale: 1,
    rain: null,
    dropScale: 0.02,
    px: new Float32Array(POOL),
    py: new Float32Array(POOL),
    pz: new Float32Array(POOL),
    vy: new Float32Array(POOL),
    age: new Float32Array(POOL),
    alive: new Uint8Array(POOL),
    dummy: new THREE.Object3D(),
  });

  // Plane.001 aur boond (Icosphere.002) dhoondo, InstancedMesh banao
  useEffect(() => {
    const S = st.current;
    let plane = null;
    let drop = null;
    scene.traverse((o) => {
      // GLTFLoader naam se "." hata deta hai: Plane.001 -> Plane001
      if (o.isMesh && /^Plane\.?001$/.test(o.name)) plane = o;
      if (o.isMesh && /^Icosphere\.?002$/.test(o.name)) drop = o;
    });

    if (!plane) console.warn("⚠️ Plane.001 GLB mein nahi mila");
    if (!drop) console.warn("⚠️ Icosphere.002 (barish ki boond) GLB mein nahi mili");
    if (!plane || !drop) return;

    // badal (Plane.001): shuru mein chhupa, click na pakde
    S.plane = plane;
    S.planeBaseScale = plane.scale.x;
    plane.material = plane.material.clone();
    plane.material.transparent = true;
    plane.material.opacity = 0;
    plane.material.depthWrite = false;
    plane.visible = false;
    plane.raycast = () => {};
    plane.userData.ignoreBounds = true; // head-click height calculation mein na ginein

    // template boond Blender mein door rakhi thi -> chhupa do, uski geometry/material use karo
    drop.visible = false;
    drop.userData.ignoreBounds = true;
    S.dropScale = drop.scale.x * PARTICLE_SIZE * RAIN_SIZE_MULT;

    const rain = new THREE.InstancedMesh(drop.geometry, drop.material, POOL);
    rain.frustumCulled = false;
    rain.raycast = () => {}; // click boondon par na ruke
    rain.userData.ignoreBounds = true;
    rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    S.dummy.scale.setScalar(0);
    S.dummy.updateMatrix();
    for (let i = 0; i < POOL; i++) rain.setMatrixAt(i, S.dummy.matrix);
    scene.add(rain);
    S.rain = rain;
    S.alive.fill(0);

    console.log("Rain ready. drop scale:", S.dropScale.toFixed(4));

    return () => {
      scene.remove(rain);
      rain.dispose();
      S.rain = null;
    };
  }, [scene]);

  useFrame((_, rawDelta) => {
    const S = st.current;
    if (!S.plane || !S.rain) return;
    const dt = Math.min(rawDelta, 0.05);

    // ---- cycle clock ----
    // 0s: kuch nahi | 20s: startRain + run | 40s: startRain + run | ...
    S.clock += Math.min(rawDelta, 1); // asli time se, taaki low fps par 20s sahi rahe
    const idx = S.clock >= START_AT_S ? Math.floor((S.clock - START_AT_S) / CYCLE_S) : -1;
    if (idx !== S.idx) {
      S.idx = idx;
      S.runFired = false;
      S.acc = 0;
    }
    const t = idx >= 0 ? S.clock - START_AT_S - idx * CYCLE_S : -1;
    S.t = t;

    // ---- 1) Plane.001 animation ----
    let k = 0;
    if (t < 0) k = 0;
    else if (t < PLANE_IN_S) k = easeOutBack(t / PLANE_IN_S);
    else if (t < PLANE_OUT_START_S) k = 1;
    else if (t < PLANE_OUT_START_S + PLANE_OUT_S)
      k = 1 - easeInQuad((t - PLANE_OUT_START_S) / PLANE_OUT_S);

    const plane = S.plane;
    plane.visible = k > 0.001;
    plane.scale.setScalar(S.planeBaseScale * Math.max(k, 0));
    plane.material.opacity = THREE.MathUtils.clamp(k, 0, 1);

    // ---- 2) "run" (RUN_DELAY_S baad, abhi startRain ke saath hi) ----
    if (!S.runFired && t >= RUN_DELAY_S) { // t<0 par kabhi nahi chalega
      S.runFired = true;
      if (!busyRef.current) playOneShot("run");
    }

    // ---- 3) barish emit (Plane.001 ke area se) ----
    if (t >= EMIT_START_S && t < EMIT_END_S) {
      S.acc += EMIT_RATE * dt;
      const half = S.planeBaseScale; // poori plane ki chaudai se girein
      while (S.acc >= 1) {
        S.acc -= 1;
        let i = -1;
        for (let j = 0; j < POOL; j++) {
          if (!S.alive[j]) {
            i = j;
            break;
          }
        }
        if (i < 0) break;
        S.alive[i] = 1;
        S.px[i] = plane.position.x + (Math.random() * 2 - 1) * half;
        S.pz[i] = plane.position.z + (Math.random() * 2 - 1) * half;
        S.py[i] = plane.position.y - 0.05;
        S.vy[i] = NORMAL_VELOCITY;
        S.age[i] = Math.random() * 0.05; // thoda random taaki ek saath na girein
      }
    }

    // ---- 4) boondein update ----
    const d = S.dummy;
    const rain = S.rain;
    for (let i = 0; i < POOL; i++) {
      if (S.alive[i]) {
        S.vy[i] -= GRAVITY * dt;
        S.py[i] += S.vy[i] * dt;
        S.age[i] += dt;
        if (S.py[i] < RAIN_FLOOR_Y || S.age[i] > LIFE_S) S.alive[i] = 0;
      }
      if (S.alive[i]) {
        d.position.set(S.px[i], S.py[i], S.pz[i]);
        d.scale.setScalar(S.dropScale);
      } else {
        d.position.set(0, 0, 0);
        d.scale.setScalar(0);
      }
      d.updateMatrix();
      rain.setMatrixAt(i, d.matrix);
    }
    rain.instanceMatrix.needsUpdate = true;
  });
}