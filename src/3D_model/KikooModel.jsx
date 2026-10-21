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

// glb ko public/models/ folder mein rakho
   const MODEL_URL = "/models/second%20.glb";

const IDLE_DELAY_MS = 6000; // idle mein har 6 sec baad "time waste" chalega

// Jo actions ek baar chalke khatam hote hain (idle + click)
const ONE_SHOT_NAMES = ["idle", "run"];

// Base pose (haath neeche) is action ke constant tracks se aata hai
// Agar haath T-pose mein dikhein to yahan koi aur clip ka naam daalo (jaise /waking/i)
const BASE_POSE_RE = /noramal|normal/i;

// Clip ka naam (key) -> GLB ke animation naam ka regex
const CLIP_PATTERNS = {
  intro: /hayy|hello/i, // page reload par
  idle: /time\s*waste/i, // har 6 sec
  run: /^run$/i, // model par click par
  talk: /tolk|talk|toking|speak/i, // bot bolte waqt
  typing: /typ/i, // user type kare tab
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

function Model({ speaking, typing }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL_URL);

  const [introDone, setIntroDone] = useState(false); // hayy khatam hua?
  const idleTimerRef = useRef(null);
  const busyRef = useRef(true); // intro / talk / typing chal raha hai?
  const oneShotRef = useRef(false); // idle ya run chal raha hai?
  const actionsRef = useRef({});
  const eyesRef = useRef([]);
  const lidsRef = useRef([]);
  const blinkRef = useRef(0);

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
    const v = t.values.slice(0, t.getValueSize());
    if (propertyName === "quaternion") node.quaternion.fromArray(v);
    else if (propertyName === "position") node.position.fromArray(v);
    else if (propertyName === "scale") node.scale.fromArray(v);
    n++;
  }
  console.log(`Base pose lagaya ("${src.name.trim()}"): ${n} tracks`);
}, [scene, animations]);

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
      const c = onlyMoving(src, name);
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

  // Ek baar chalne wala action (idle ya run)
  const playOneShot = useCallback((name) => {
    const act = actionsRef.current[name];
    if (!act) return;
    oneShotRef.current = true;
    act.reset();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.fadeIn(0.3).play();
  }, []);

  // Idle: 6 sec baad "time waste"
  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (busyRef.current || oneShotRef.current) return;
      console.log("▶️ idle: time waste");
      playOneShot("idle");
    }, IDLE_DELAY_MS);
  }, [playOneShot]);

  // Model par click -> run
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (busyRef.current) return; // intro / talk / typing ke waqt ignore
      clearTimeout(idleTimerRef.current);
      ONE_SHOT_NAMES.forEach((n) => actionsRef.current[n]?.fadeOut(0.2));
      console.log("▶️ click: run");
      playOneShot("run");
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

  // intro / idle / run khatam hone par
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
        if (!busyRef.current) scheduleIdle(); // phir 6 sec baad
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer, actions, scheduleIdle]);

  // 1) Page load / reload par "hayy" (ek baar)
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

  // 4) Idle (time waste) sirf tab jab koi aur animation na ho
  useEffect(() => {
    const busy = speaking || typing || !introDone;
    busyRef.current = busy;

    if (busy) {
      clearTimeout(idleTimerRef.current);
    } else if (!oneShotRef.current) {
      scheduleIdle();
    }

    // speaking/typing aaye to intro/idle/run hata do, warna mix honge
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

export default function KikooModel({ speaking = false, typing = false }) {
  return (
    <div style={{ width: "500px", height: "500px" }}>
      <Canvas camera={{ position: [0, 0, 12], fov: 40, near: 1, far: 50 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[5, 5, 5]} intensity={3} />
        <Model speaking={speaking} typing={typing} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}