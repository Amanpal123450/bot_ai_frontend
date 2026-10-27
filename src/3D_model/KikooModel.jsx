import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import LottieBackground from "./Lottiebackground/Lottiebackground";

const MODEL_URL = "/models/10.glb";
const IDLE_DELAY_MS = 10000;
const ONE_SHOT_NAMES = ["idle", "jump"];
const BASE_POSE_RE = /noramal\.001/i;
const CLIP_PATTERNS = {
  intro: /hayy/i, // page reload par      -> hayy(2)
  idle: /noramal\.001/i, // har 10 sec baad -> noramal.001
  jump: /^jump$/i, // model par click par  -> jump
  talk: /toking2/i, // bot bolte waqt       -> toking
  typing: /^typing$/i,
};

// Jin actions mein blink chahiye
const BLINK_ACTIONS = CLIP_PATTERNS;

const BLINK_SMOOTH = 25; // chhota = blink slow aur naram, bada = fast
const LID_GAIN = 1; // palak kitni band ho (1 = poori band)

function sampleCurve(curve, t) {
  if (!curve || !curve.length) return 0;
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [t0, v0] = curve[i];
    const [t1, v1] = curve[i + 1];
    if (t >= t0 && t <= t1) {
      const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
      return v0 + (v1 - v0) * k;
    }
  }
  return curve[curve.length - 1][1];
}

// Bone001 (palak control) ke angle se curve: [time, closure 0..1]
function buildBlinkCurve(animations, re) {
  const clip = animations.find((a) => re.test(a.name.trim()));
  const tr = clip?.tracks.find((t) => /Bone001\.quaternion$/i.test(t.name));
  if (!tr) return null;

  const q = new THREE.Quaternion();
  const q0 = new THREE.Quaternion().fromArray(tr.values, 0);
  const pts = Array.from(tr.times).map((time, i) => {
    q.fromArray(tr.values, i * 4);
    return [time, q.angleTo(q0)];
  });
  const max = Math.max(...pts.map((p) => p[1]));
  if (!max || max < 1e-3) return null; // is clip mein palak hile hi nahi
  return pts.map(([time, a]) => [time, Math.min(a / max, 1)]);
}

const _pq = new THREE.Quaternion();
const _off = new THREE.Quaternion();
const _eul = new THREE.Euler();
const _lid = new THREE.Quaternion();

// Track sach mein hil raha hai ya constant hai?
function isMoving(t, eps = 1e-4) {
  const size = t.getValueSize();
  for (let k = 0; k < size; k++) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = k; i < t.values.length; i += size) {
      min = Math.min(min, t.values[i]);
      max = Math.max(max, t.values[i]);
    }
    if (max - min > eps) return true;
  }
  return false;
}

// Sirf wo tracks rakho jo sach mein hilte hain
function onlyMoving(clip, name) {
  const tracks = clip.tracks.filter((t) => isMoving(t));
  if (!tracks.length) return null;
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

// Naya: sirf constant SCALE tracks hatao (wo faltu hain).
// Rotation/position tracks hamesha rakho, taaki bazu aur haath ki pose clip ke hisaab se rahe.
function keepPoseTracks(clip, name) {
  const tracks = clip.tracks.filter((t) => {
    if (/\.scale$/i.test(t.name)) return isMoving(t);
    return true;
  });
  if (!tracks.length) return null;
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

// Talk clip mein bazu/haath ke tracks hata do, taaki haath neeche hi rahein
const ARM_BONE_RE = /^Bone_0(2[3-9]|3[0-2])\./; // Bone_023 ... Bone_032

function withoutArmTracks(clip, name) {
  const tracks = clip.tracks.filter((t) => !ARM_BONE_RE.test(t.name));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

function Model({ speaking, typing }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL_URL);

  useEffect(() => {
  console.log("GLB FILE:", MODEL_URL);
  console.log("TOTAL GLB ANIMATIONS:", animations.length);

  console.table(
    animations.map((animation, index) => ({
      Number: index + 1,
      Name: animation.name,
      Duration: animation.duration.toFixed(2) + " seconds",
    }))
  );
}, [animations]);

  const [introDone, setIntroDone] = useState(false); // hayy khatam hua?
  const idleTimerRef = useRef(null);
  const busyRef = useRef(true); // intro / talk / typing chal raha hai?
  const oneShotRef = useRef(false); // idle ya jump chal raha hai?
  const actionsRef = useRef({});
  const eyesRef = useRef([]);
  const lidsRef = useRef([]);
  const blinkRef = useRef(0);

  // Har action ka apna blink curve
  const blinkCurves = useMemo(() => {
    const curves = {};
    for (const [name, re] of Object.entries(BLINK_ACTIONS)) {
      curves[name] = buildBlinkCurve(animations, re);
    }
    console.log(
      "Blink curves ->",
      Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, v?.length ?? null]))
    );
    return curves;
  }, [animations]);

  // Paws alag armature hain jo scene root par pade hain. Unhe haath ki bone se jodo
  // (ye base pose wale effect se PEHLE aana chahiye)
  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    const meta = scene.getObjectByName("metarig");
    if (meta) {
      const pairs = [
        ["SmartRigArmature001", "handR"],
        ["SmartRigArmature", "handL"],
      ];
      for (const [rigName, boneName] of pairs) {
        const rig = scene.getObjectByName(rigName);
        const bone = meta.getObjectByName(boneName);
        if (rig && bone && rig.parent !== bone) {
          bone.attach(rig);
          console.log(`Paw jodi: ${rigName} -> ${boneName}`);
        }
      }
    }
    // skinned meshes move karte hain, isliye culling band
    scene.traverse((o) => {
      if (o.isSkinnedMesh) o.frustumCulled = false;
    });
  }, [scene]);

  // Base pose: GLB ka rest pose T-pose hai, haath neeche wala pose yahan lagta hai
  // Clip ke pehle frame (t=0) ki pose lagate hain, chahe track hile ya na hile
  useLayoutEffect(() => {
    const src = animations.find((a) => BASE_POSE_RE.test(a.name.trim()));
    if (!src) {
      console.warn("⚠️ base pose wali action nahi mili");
      return;
    }
    let n = 0;
   for (const t of src.tracks) {
  const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(t.name);
  const node = THREE.PropertyBinding.findNode(scene, nodeName);
  if (!node) continue;

  // const v = t.values.slice(0, t.getValueSize());   // purana: pehla frame
  const size = t.getValueSize();
  const v = t.values.slice(t.values.length - size);   // naya: aakhri frame

  if (propertyName === "quaternion") node.quaternion.fromArray(v);
  else if (propertyName === "position") node.position.fromArray(v);
  else if (propertyName === "scale") node.scale.fromArray(v);
  n++;
}
    console.log(`Base pose lagaya ("${src.name.trim()}"): ${n} tracks`);
  }, [scene, animations]);

  // Aankh ke safed hisse ka material nahi hai, to three.js default metal lagata hai
  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!/^eye_in\d*$/i.test(o.name)) return;
      o.children.forEach((child) => {
        if (!child.isMesh || !child.material?.color) return;
        const c = child.material.color;
        if (c.r + c.g + c.b < 0.05) return; // kaali putli ko mat chhedo

        const white = child.material.clone();
        white.color.set(0xffffff);
        white.metalness = 0;
        white.roughness = 0.35;
        child.material = white;
      });
    });
  }, [scene]);

  // Palak (eye up / eye down hemispheres): band hone ka rotation pehle se nikal lo
  useLayoutEffect(() => {
    const lids = [];
    scene.traverse((o) => {
      if (/^eye_(up|down)\d*$/i.test(o.name) && o.isMesh && o.parent) {
        if (!o.userData.lidBase) o.userData.lidBase = o.quaternion.clone();
        o.quaternion.copy(o.userData.lidBase);
        lids.push(o);
      }
    });
    scene.updateMatrixWorld(true);

    const wq = new THREE.Quaternion();
    const pq0 = new THREE.Quaternion();
    const list = lids.map((o) => {
      const P = o.geometry.attributes.position;
      const pole = new THREE.Vector3();
      const v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) pole.add(v.fromBufferAttribute(P, i));
      pole.normalize();

      o.getWorldQuaternion(wq);
      const worldPole = pole.clone().applyQuaternion(wq);

      const target = new THREE.Vector3(0, worldPole.y >= 0 ? 1 : -1, 0);
      const qWorld = new THREE.Quaternion().setFromUnitVectors(worldPole, target);

      o.parent.getWorldQuaternion(pq0);
      const close = pq0.clone().invert().multiply(qWorld).multiply(pq0);

      return { node: o, base: o.userData.lidBase, close };
    });
    lidsRef.current = list;
    console.log("Eyelids:", list.map((l) => l.node.name));
  }, [scene]);

  // Clips: GLB ke andar se sirf wo animations lo jo chahiye
  const clips = useMemo(() => {
    console.log(
      "GLB animations:",
      animations.map((a) => `"${a.name}" (${a.duration.toFixed(2)}s)`)
    );

    const result = [];
    for (const [name, re] of Object.entries(CLIP_PATTERNS)) {
      const src = animations.find((a) => re.test(a.name.trim()));
      if (!src) {
        console.warn(`⚠️ "${name}" animation GLB mein nahi mili`);
        continue;
      }

      
      // const c = onlyMoving(src, name);
     // const c = keepPoseTracks(src, name);
let c = keepPoseTracks(src, name);
if (c && name === "talk") c = withoutArmTracks(c, name); // 👈 toking mein haath neeche
      if (!c) console.warn(`⚠️ "${name}" mein koi moving track nahi hai`);
      else result.push(c);
    }

    result.forEach((c) =>
      console.log(`Clip "${c.name}" ${c.duration.toFixed(2)}s:`, c.tracks.length, "tracks")
    );
    return result;
  }, [animations]);

  const { actions, mixer } = useAnimations(clips, group);
  actionsRef.current = actions;

  // Aankh ke eyeball nodes dhoondo
  useEffect(() => {
    const list = [];
    scene.traverse((o) => {
      if (/^eye_in\d*$/i.test(o.name) && o.parent) {
        if (!o.userData.baseQ) o.userData.baseQ = o.quaternion.clone();
        list.push(o);
      }
    });
    eyesRef.current = list;
  }, [scene]);

  // Ek baar chalne wala action (idle ya jump)
  const playOneShot = useCallback((name) => {
    const act = actionsRef.current[name];
    if (!act) return;
    oneShotRef.current = true;
    act.reset();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.fadeIn(0.3).play();
  }, []);

  // Idle: 10 sec baad noramal.001
  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (busyRef.current || oneShotRef.current) return;
      console.log("▶️ idle: noramal.001");
      playOneShot("idle");
    }, IDLE_DELAY_MS);
  }, [playOneShot]);

  // Model par click -> jump
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (busyRef.current) return; // intro / talk / typing ke waqt ignore
      clearTimeout(idleTimerRef.current);
      ONE_SHOT_NAMES.forEach((n) => actionsRef.current[n]?.fadeOut(0.2));
      console.log("▶️ click: jump");
      playOneShot("jump");
    },
    [playOneShot]
  );

  // Har frame par palak jhapkao (actions ke time se sync)
  useFrame((_, delta) => {
    let tb = 0;
    for (const name of Object.keys(BLINK_ACTIONS)) {
      const a = actionsRef.current[name];
      const curve = blinkCurves[name];
      if (a && curve && a.isRunning()) {
        tb = Math.max(tb, sampleCurve(curve, a.time) * a.getEffectiveWeight());
      }
    }
    blinkRef.current += (tb - blinkRef.current) * (1 - Math.exp(-BLINK_SMOOTH * delta));

    // aankh ki putli (base position par rakho)
    for (const node of eyesRef.current) {
      node.parent.getWorldQuaternion(_pq);
      _off.setFromEuler(_eul.set(0, 0, 0, "YXZ"));
      node.quaternion
        .copy(_pq)
        .invert()
        .multiply(_off)
        .multiply(_pq)
        .multiply(node.userData.baseQ);
    }

    // palak
    const c = THREE.MathUtils.clamp(blinkRef.current * LID_GAIN, 0, 1);
    for (const lid of lidsRef.current) {
      _lid.identity().slerp(lid.close, c);
      lid.node.quaternion.copy(_lid).multiply(lid.base);
    }
  });

  // intro / idle / jump khatam hone par
  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e) => {
      if (actions.intro && e.action === actions.intro) {
        e.action.fadeOut(0.4);
        setIntroDone(true);
      }
      if (ONE_SHOT_NAMES.some((n) => actions[n] && e.action === actions[n])) {
        e.action.fadeOut(0.4);
        oneShotRef.current = false;
        if (!busyRef.current) scheduleIdle(); // phir 10 sec baad
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer, actions, scheduleIdle]);

  // 1) Page load / reload par "hayy(2)" (ek baar)
  useEffect(() => {
    const intro = actions.intro;
    if (!intro) {
      setIntroDone(true);
      return;
    }
    intro.reset();
    intro.setLoop(THREE.LoopOnce, 1);
    intro.clampWhenFinished = true;
    intro.play();
    return () => intro.stop();
  }, [actions]);

  // 2) Talk (toking): audio chalte waqt
  useEffect(() => {
    const talk = actions.talk;
    if (!talk) return;
    if (speaking) {
      talk.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    } else {
      talk.fadeOut(0.3);
    }
  }, [speaking, actions]);

  // 3) Typing: user type kare tab
  useEffect(() => {
    const t = actions.typing;
    if (!t) return;
    if (typing) {
      console.log("▶️ typing play");
      t.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    } else {
      t.fadeOut(0.3);
    }
  }, [typing, actions]);

  // 4) Idle (noramal.001) sirf tab jab koi aur animation na ho
  useEffect(() => {
    const busy = speaking || typing || !introDone;
    busyRef.current = busy;

    if (busy) {
      clearTimeout(idleTimerRef.current);
    } else if (!oneShotRef.current) {
      scheduleIdle();
    }

    // speaking/typing aaye to intro/idle/jump hata do, warna mix honge
    if (speaking || typing) {
      actionsRef.current.intro?.fadeOut(0.3);
      ONE_SHOT_NAMES.forEach((n) => actionsRef.current[n]?.fadeOut(0.3));
      oneShotRef.current = false;
      if (!introDone) setIntroDone(true);
    }

    return () => clearTimeout(idleTimerRef.current);
  }, [speaking, typing, introDone, scheduleIdle]);

  return (
    <group ref={group}>
      <primitive
        object={scene}
        scale={2}
        position={[0, -2, 0]}
        onClick={handleClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      />
    </group>
  );
}

// Jungle + playground background (sirf SVG, koi image nahi chahiye)
function JungleBackground() {
  const flowers = [
    [30, 548, "#ff6fa5"], [52, 560, "#ffd23f"], [92, 572, "#ffffff"],
    [150, 566, "#ff8a4c"], [250, 570, "#ffd23f"], [312, 556, "#ff6fa5"],
    [350, 570, "#ffffff"], [372, 548, "#ff8a4c"],
  ];
  const flags = ["#ff5a5f", "#ffd23f", "#4cc9f0", "#7bd88f", "#c77dff", "#ff8a4c", "#ff5a5f", "#ffd23f", "#4cc9f0"];

  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="kk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8e0ff" />
          <stop offset="0.55" stopColor="#e6f8d2" />
          <stop offset="1" stopColor="#fff3c4" />
        </linearGradient>
        <radialGradient id="kk-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6a8" stopOpacity="1" />
          <stop offset="1" stopColor="#fff6a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kk-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9be36f" />
          <stop offset="1" stopColor="#4fa843" />
        </linearGradient>
      </defs>

      {/* aasmaan + sooraj */}
      <rect width="400" height="600" fill="url(#kk-sky)" />
      <circle cx="320" cy="95" r="80" fill="url(#kk-sun)" />

      {/* door ki pahadiyan */}
      <path d="M0 340 Q70 280 150 330 T300 320 T400 305 L400 600 L0 600Z" fill="#86cf7f" />
      <path d="M0 395 Q90 345 190 388 T400 372 L400 600 L0 600Z" fill="#5fb260" />

      {/* zameen */}
      <path d="M0 482 Q200 452 400 482 L400 600 L0 600Z" fill="url(#kk-ground)" />

      {/* baayein ka ped */}
      <path d="M26 600 C34 470 24 330 40 190 L64 190 C62 330 72 470 80 600Z" fill="#8a5a33" />
      <path d="M46 560 C50 470 44 380 52 260" stroke="#6e4524" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="52" cy="170" r="58" fill="#237f3c" />
      <circle cx="18" cy="190" r="44" fill="#2e9c4a" />
      <circle cx="92" cy="195" r="42" fill="#2e9c4a" />
      <circle cx="55" cy="130" r="42" fill="#3fb35a" />

      {/* daayein ka ped */}
      <path d="M374 600 C366 480 376 340 360 210 L336 210 C338 340 328 480 320 600Z" fill="#8a5a33" />
      <path d="M352 560 C348 470 354 390 346 290" stroke="#6e4524" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="348" cy="190" r="58" fill="#237f3c" />
      <circle cx="384" cy="212" r="44" fill="#2e9c4a" />
      <circle cx="306" cy="215" r="40" fill="#2e9c4a" />
      <circle cx="344" cy="148" r="42" fill="#3fb35a" />

      {/* latakti bel */}
      {[[130, 0, 112], [196, 0, 70], [262, 0, 96]].map(([x, y, h], i) => (
        <g key={i}>
          <path d={`M${x} ${y} C${x - 10} ${h * 0.4} ${x + 12} ${h * 0.7} ${x} ${h}`} stroke="#2f8f45" strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx={x + 7} cy={h * 0.55} rx="9" ry="4.5" fill="#3fb35a" transform={`rotate(-30 ${x + 7} ${h * 0.55})`} />
          <ellipse cx={x - 7} cy={h * 0.85} rx="9" ry="4.5" fill="#3fb35a" transform={`rotate(30 ${x - 7} ${h * 0.85})`} />
        </g>
      ))}

      {/* rang-birange jhande (playground jaisa) */}
      <path d="M0 18 Q200 58 400 18" stroke="#8a5a33" strokeWidth="2.5" fill="none" />
      {flags.map((c, i) => {
        const t = (i + 0.7) / (flags.length + 0.4);
        const x = t * 400;
        const y = 18 + 40 * 2 * t * (1 - t) * 1.0 + 1;
        return <path key={i} d={`M${x - 12} ${y} L${x + 12} ${y} L${x} ${y + 26}Z`} fill={c} />;
      })}

      {/* neeche ki jhaadiyan */}
      {[[20, 575, 34], [70, 590, 28], [140, 596, 22], [270, 596, 22], [335, 588, 28], [385, 574, 34]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#3aa655" : "#2e9c4a"} />
      ))}

      {/* phool */}
      {flowers.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill={c} />
          <circle cx={x} cy={y} r="2" fill="#ffb703" />
        </g>
      ))}

      {/* titliyan */}
      <g transform="translate(95 250)">
        <ellipse cx="-6" cy="0" rx="7" ry="5" fill="#ff8fab" transform="rotate(-20 -6 0)" />
        <ellipse cx="6" cy="0" rx="7" ry="5" fill="#ff8fab" transform="rotate(20 6 0)" />
        <rect x="-1" y="-5" width="2" height="10" rx="1" fill="#6b3a1e" />
      </g>
      <g transform="translate(300 300)">
        <ellipse cx="-6" cy="0" rx="7" ry="5" fill="#ffd23f" transform="rotate(-20 -6 0)" />
        <ellipse cx="6" cy="0" rx="7" ry="5" fill="#ffd23f" transform="rotate(20 6 0)" />
        <rect x="-1" y="-5" width="2" height="10" rx="1" fill="#6b3a1e" />
      </g>
    </svg>
  );
}

export default function KikooModel({ speaking = false, typing = false }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#a8e0ff" }}>
      <LottieBackground />
      <Canvas camera={{ position: [0, -0.7, 4.3], fov: 40, near: 0.1, far: 50 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[15, 15, 15]} intensity={3} />
        <Model speaking={speaking} typing={typing} />
        <OrbitControls
          target={[0, -0.7, 0]}
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
        />
      </Canvas>
    </div>
  );
}