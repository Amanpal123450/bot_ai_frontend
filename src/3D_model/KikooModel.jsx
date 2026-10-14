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

const MODEL_URL = "/models/kikoo_v2.glb";
const IDLE_DELAY_MS = 5000; // idle rehne par har 10 sec mein random hello / look
// Idle mein random ye animations chalengi (look + ye one-shot actions)
const ONE_SHOT_NAMES = ["hello", "normal"];
  
// Base pose (haath neeche) is action ke constant tracks se aata hai
const BASE_POSE_RE = /^look/i;

// Jin actions mein blink chahiye (key = actions ka naam)
const BLINK_ACTIONS = {
  fly: /fly/i,
  hello: /hello|wave/i,
  normal: /^normal$/i,
  talk: /t[ao]lk|speak/i,
  typing: /typ/i,
};

// Aankh ka look: [time(sec), yaw, pitch] radians
// yaw + = viewer ke right, pitch + = neeche
const LOOK_SEQ = [
  [0.0, 0, 0],
  [0.6, 0.5, -0.1],
  [1.5, -0.5, -0.15],
  [2.3, 0.2, 0.2],
  [2.9, 0, 0],
  [3.25, 0, 0],
];
const LOOK_DURATION = 3.25;

// Blink: [time, closure 0..1]. Asli curve look action ki Bone.001 se banti hai,
// ye sirf backup hai
const BLINK_FALLBACK = [
  [0, 0],
  [2.71, 0],
  [2.92, 1],
  [3.12, 0.8],
  [3.25, 0],
];
const BLINK_SMOOTH = 25; // chhota = blink slow aur naram (30 bahut fast tha), bada = fast
const LID_GAIN = 1; // palak kitni band ho (1 = poori band)

const smooth = (x) => x * x * (3 - 2 * x);
function sampleLook(t) {
  for (let i = 0; i < LOOK_SEQ.length - 1; i++) {
    const [t0, y0, p0] = LOOK_SEQ[i];
    const [t1, y1, p1] = LOOK_SEQ[i + 1];
    if (t >= t0 && t <= t1) {
      const k = smooth((t - t0) / (t1 - t0));
      return [y0 + (y1 - y0) * k, p0 + (p1 - p0) * k];
    }
  }
  return [0, 0];
}

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
// ref = { q0, maxAngle } look action se aata hai, taaki sab clips same scale par hon
function buildBlinkCurve(animations, re, ref) {
  const clip = animations.find((a) => re.test(a.name.trim()));
  const tr = clip?.tracks.find((t) => /^Bone001\.quaternion$/i.test(t.name));
  if (!tr) return null;

  const q = new THREE.Quaternion();
  const q0 = ref?.q0 ?? new THREE.Quaternion().fromArray(tr.values, 0);
  const pts = Array.from(tr.times).map((time, i) => {
    q.fromArray(tr.values, i * 4);
    return [time, q.angleTo(q0)];
  });
  const max = ref?.maxAngle ?? Math.max(...pts.map((p) => p[1]));
  if (!max || max < 1e-3) return null;
  // is clip mein palak hile hi nahi to null
  if (Math.max(...pts.map((p) => p[1])) < 1e-3) return null;
  return pts.map(([time, a]) => [time, Math.min(a / max, 1)]);
}

// look clip se reference nikalo
function buildBlinkRef(animations) {
  const clip = animations.find((a) => /^look/i.test(a.name.trim()));
  const tr = clip?.tracks.find((t) => /^Bone001\.quaternion$/i.test(t.name));
  if (!tr) return null;
  const q0 = new THREE.Quaternion().fromArray(tr.values, 0);
  const q = new THREE.Quaternion();
  let maxAngle = 0;
  for (let i = 0; i < tr.times.length; i++) {
    q.fromArray(tr.values, i * 4);
    maxAngle = Math.max(maxAngle, q.angleTo(q0));
  }
  return maxAngle > 1e-3 ? { q0, maxAngle } : null;
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

function Model({ speaking, typing }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL_URL);

  const [introDone, setIntroDone] = useState(false); // fly khatam hua?
  const idleTimerRef = useRef(null);
  const busyRef = useRef(true);
  const oneShotRef = useRef(false); // hello chal raha hai?
  const actionsRef = useRef({});
  const eyesRef = useRef([]);
  const lidsRef = useRef([]);
  const lookRef = useRef({ playing: false, t: 0, yaw: 0, pitch: 0, blink: 0 });

  // Har action ka apna blink curve: look (procedural) + fly, hello, normal, talk, typing
  const blinkCurves = useMemo(() => {
    const ref = buildBlinkRef(animations);
    const curves = {
      look: buildBlinkCurve(animations, /^look/i, ref) ?? BLINK_FALLBACK,
    };
    for (const [name, re] of Object.entries(BLINK_ACTIONS)) {
      curves[name] = buildBlinkCurve(animations, re, ref);
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
      ["SmartRigArmature001", "handR"], // right paw
      ["SmartRigArmature", "handL"],
    ];
    for (const [rigName, boneName] of pairs) {
      const rig = scene.getObjectByName(rigName);
      const bone = meta.getObjectByName(boneName);
      if (rig && bone && rig.parent !== bone) {
        bone.attach(rig); // world position same rehti hai, bas ab bone ke saath chalega
        console.log(`Paw jodi: ${rigName} -> ${boneName}`);
      }
    }
  }
  // skinned meshes move karte hain, isliye culling band (nahi to paw gayab ho sakta hai)
  scene.traverse((o) => {
    if (o.isSkinnedMesh) o.frustumCulled = false;
  });
}, [scene]);

  // Base pose: GLB ka rest pose T-pose hai, haath neeche wala pose yahan lagta hai
  useLayoutEffect(() => {
    const src = animations.find((a) => BASE_POSE_RE.test(a.name.trim()));
    if (!src) {
      console.warn("⚠️ base pose wali action nahi mili");
      return;
    }
    let n = 0;
    for (const t of src.tracks) {
      if (isMoving(t)) continue;
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(t.name);
      const node = THREE.PropertyBinding.findNode(scene, nodeName);
      if (!node) continue;
      const v = t.values.slice(0, t.getValueSize());
      if (propertyName === "quaternion") node.quaternion.fromArray(v);
      else if (propertyName === "position") node.position.fromArray(v);
      else if (propertyName === "scale") node.scale.fromArray(v);
      n++;
    }
    console.log(`Base pose lagaya ("${src.name.trim()}"): ${n} tracks`);
  }, [scene, animations]);

  // Aankh ke safed hisse ka material nahi hai, to three.js default metal (metalness 1) lagata hai
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
        o.quaternion.copy(o.userData.lidBase); // pehle rest par lao
        lids.push(o);
      }
    });
    scene.updateMatrixWorld(true);

    const wq = new THREE.Quaternion();
    const pq0 = new THREE.Quaternion();
    const list = lids.map((o) => {
      // hemisphere ka pole = geometry ki average direction
      const P = o.geometry.attributes.position;
      const pole = new THREE.Vector3();
      const v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) pole.add(v.fromBufferAttribute(P, i));
      pole.normalize();

      o.getWorldQuaternion(wq);
      const worldPole = pole.clone().applyQuaternion(wq);

      // band hone par pole seedha upar (ya neeche) hona chahiye
      const target = new THREE.Vector3(0, worldPole.y >= 0 ? 1 : -1, 0);
      const qWorld = new THREE.Quaternion().setFromUnitVectors(worldPole, target);

      o.parent.getWorldQuaternion(pq0);
      const close = pq0.clone().invert().multiply(qWorld).multiply(pq0);

      return { node: o, base: o.userData.lidBase, close };
    });
    lidsRef.current = list;
    console.log("Eyelids:", list.map((l) => l.node.name));
  }, [scene]);

  // Debug: props sach mein badal rahe hain?
  useEffect(() => {
    console.log("props -> typing:", typing, "| speaking:", speaking);
  }, [typing, speaking]);

  const clips = useMemo(() => {
    console.log(
      "GLB animations:",
      animations.map((a) => `"${a.name}" (${a.duration.toFixed(2)}s)`)
    );

    const find = (re) => animations.find((a) => re.test(a.name.trim()));
    const result = [];

    const add = (src, name) => {
      if (!src) {
        console.warn(`⚠️ "${name}" animation GLB mein nahi mili`);
        return null;
      }
      const c = onlyMoving(src, name);
      if (!c) console.warn(`⚠️ "${name}" mein koi moving track nahi hai`);
      else result.push(c);
      return c;
    };

    add(find(/fly/i), "fly");
    add(find(/hello|wave/i), "hello");
    add(find(/^normal$/i), "normal");
    add(find(/t[ao]lk|speak/i), "talk"); // "Tolk " bhi chalega
    add(find(/typ/i), "typing");

    result.forEach((c) =>
      console.log(`Clip "${c.name}" ${c.duration.toFixed(2)}s:`, c.tracks.map((t) => t.name))
    );
    return result;
  }, [animations]);

  const { actions, mixer } = useAnimations(clips, group);
  actionsRef.current = actions;

  // Aankh ke eyeball nodes dhoondo (eye in / eye in.001)
  useEffect(() => {
    const list = [];
    scene.traverse((o) => {
      if (/^eye_in\d*$/i.test(o.name) && o.parent) {
        if (!o.userData.baseQ) o.userData.baseQ = o.quaternion.clone();
        list.push(o);
      }
    });
    eyesRef.current = list;
    console.log("Eye nodes:", list.map((o) => o.name));
  }, [scene]);

  // Idle: 10 sec baad random hello ya look
  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (busyRef.current || oneShotRef.current) return;

      const avail = ONE_SHOT_NAMES.filter((n) => actionsRef.current[n]);
      const pool = ["look", ...avail];
      const pick = pool[Math.floor(Math.random() * pool.length)];

      if (pick === "look") {
        console.log("▶️ random: look");
        lookRef.current.playing = true;
        lookRef.current.t = 0;
      } else {
        console.log("▶️ random:", pick);
        const act = actionsRef.current[pick];
        oneShotRef.current = true;
        act.reset();
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
        act.fadeIn(0.3).play();
      }
    }, IDLE_DELAY_MS);
  }, []);

  // Har frame par aankh ghumao aur palak jhapkao
  useFrame((_, delta) => {
    const s = lookRef.current;
    let ty = 0;
    let tp = 0;
    let tb = 0;

    if (s.playing) {
      s.t += delta;
      if (s.t >= LOOK_DURATION) {
        s.playing = false;
        if (!busyRef.current) scheduleIdle(); // phir 10 sec baad
      } else {
        [ty, tp] = sampleLook(s.t);
        tb = sampleCurve(blinkCurves.look, s.t);
      }
    }

    // fly / hello / normal / talk / typing chalte waqt unka blink, action ke time se sync
    for (const name of Object.keys(BLINK_ACTIONS)) {
      const a = actionsRef.current[name];
      const curve = blinkCurves[name];
      if (a && curve && a.isRunning()) {
        tb = Math.max(tb, sampleCurve(curve, a.time) * a.getEffectiveWeight());
      }
    }

    const k = 1 - Math.exp(-14 * delta);
    s.yaw += (ty - s.yaw) * k;
    s.pitch += (tp - s.pitch) * k;
    s.blink += (tb - s.blink) * (1 - Math.exp(-BLINK_SMOOTH * delta));

    // aankh ki putli
    for (const node of eyesRef.current) {
      node.parent.getWorldQuaternion(_pq);
      _off.setFromEuler(_eul.set(s.pitch, s.yaw, 0, "YXZ"));
      node.quaternion
        .copy(_pq)
        .invert()
        .multiply(_off)
        .multiply(_pq)
        .multiply(node.userData.baseQ);
    }

    // palak
    const c = THREE.MathUtils.clamp(s.blink * LID_GAIN, 0, 1);
    for (const lid of lidsRef.current) {
      _lid.identity().slerp(lid.close, c);
      lid.node.quaternion.copy(_lid).multiply(lid.base);
    }
  });

  // fly / hello khatam hone par
  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e) => {
      if (actions.fly && e.action === actions.fly) {
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

  // 1) Page load / reload par fly (ek baar)
  useEffect(() => {
    const fly = actions.fly;
    if (!fly) {
      setIntroDone(true);
      return;
    }
    fly.reset();
    fly.setLoop(THREE.LoopOnce, 1);
    fly.clampWhenFinished = true;
    fly.play();
    return () => fly.stop();
  }, [actions]);

  // 2) Talk: audio chalte waqt
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

  // 4) Random hello/look sirf tab jab koi aur animation na ho
  useEffect(() => {
    const busy = speaking || typing || !introDone;
    busyRef.current = busy;

    if (busy) {
      clearTimeout(idleTimerRef.current);
      lookRef.current.playing = false; // aankh aur palak smoothly normal par aa jaayenge
    } else {
      scheduleIdle();
    }

    // speaking/typing aaye to fly/hello hata do, warna talk ke saath mix honge
    if (speaking || typing) {
      actionsRef.current.fly?.fadeOut(0.3);
      ONE_SHOT_NAMES.forEach((n) => actionsRef.current[n]?.fadeOut(0.3));
      oneShotRef.current = false;
      if (!introDone) setIntroDone(true);
    }

    return () => clearTimeout(idleTimerRef.current);
  }, [speaking, typing, introDone, scheduleIdle]);

  return (
    <group ref={group}>
      <primitive object={scene} scale={2} position={[0, -2, 0]} />
    </group>
  );
}

export default function KikooModel({ speaking = false, typing = false }) {
  return (
    <div style={{ width: "500px", height: "500px" }}>
      <Canvas camera={{ position: [0, 1, 8], fov: 40, near: 1, far: 50 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[5, 5, 5]} intensity={3} />
        <Model speaking={speaking} typing={typing} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}