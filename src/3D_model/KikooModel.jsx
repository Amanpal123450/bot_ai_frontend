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
import LottieBackground from "./Lottiebackground/Playgroundbackground";

const MODEL_URL = "/models/14.glb";
const EYE_INTERVAL_MS = 6000; // har 6 sec mein eye animation
const HEAD_TOP_FRACTION = 0.55; // model ke upar ke 55% hisse par click = head click
const ONE_SHOT_NAMES = ["jump", "headClick", "eye"];
const BASE_POSE_RE = /noramal\.001/i; // sirf base pose ke liye, idle mein nahi chalta
const CLIP_PATTERNS = {
  intro: /hayy/i, // page reload par -> hayy(2)
  jump: /^jump$/i, // body par click -> jump
  headClick: /head[\s_-]?click/i, // head par click -> headClick
  eye: /^eye/i, // har 6 sec -> eye
  talk: /toking/i, // bot bolte waqt -> toking
  typing: /^typing$/i,
  thinking: /thi(n)?king/i,
};

// Palak (eyelid) ke mesh ka naam: eye_up, eye_down, eye_up_1, Eye_Upper, eyelid...
const LID_RE = /^(left|right)[_\s.-]?(up|uper|upper|down|lower)$|^eye[_\s.-]?(up|down|upper|lower)|eyelid/i;

// Jin actions mein blink chahiye
const BLINK_ACTIONS = CLIP_PATTERNS;

const BLINK_SMOOTH = 25;
const LID_GAIN = 1;

// 1 = purani speed, 2.5 = lagbhag 2.5 guna slow
const BLINK_SLOWDOWN = 2.5;

// eye blink ki shape: [time, closure]
const BLINK_SHAPE = [
  [0, 0],
  [0.05, 0],
  [0.13, 1],
  [0.19, 1],
  [0.33, 0],
  [0.46, 0],
].map(([t, v]) => [t * BLINK_SLOWDOWN, v]);
const BLINK_DURATION = 0.46 * BLINK_SLOWDOWN;

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
  if (!max || max < 1e-3) return null;
  return pts.map(([time, a]) => [time, Math.min(a / max, 1)]);
}

const _pq = new THREE.Quaternion();
const _off = new THREE.Quaternion();
const _eul = new THREE.Euler();
const _lid = new THREE.Quaternion();
const _box = new THREE.Box3();

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

function keepPoseTracks(clip, name) {
  const tracks = clip.tracks.filter((t) => {
    if (/\.scale$/i.test(t.name)) return isMoving(t);
    return true;
  });
  if (!tracks.length) return null;
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

const ARM_BONE_RE = /^Bone_0(2[3-9]|3[0-2])\./;

function withoutArmTracks(clip, name) {
  const tracks = clip.tracks.filter((t) => !ARM_BONE_RE.test(t.name));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

function Model({ speaking, typing, thinking }) {
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

  const [introDone, setIntroDone] = useState(false);
  const eyeTimerRef = useRef(null);
  const busyRef = useRef(true);
  const oneShotRef = useRef(false);
  const actionsRef = useRef({});
  const eyesRef = useRef([]);
  const lidsRef = useRef([]);
  const blinkRef = useRef(0);
  const blinkStartRef = useRef(-1);

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

  // Paws ko haath ki bone se jodo
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

    scene.traverse((o) => {
      if (o.isSkinnedMesh) o.frustumCulled = false;
    });
  }, [scene]);

  // Base pose (noramal.001 ka aakhri frame)
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

      const size = t.getValueSize();
      const v = t.values.slice(t.values.length - size);

      if (propertyName === "quaternion") node.quaternion.fromArray(v);
      else if (propertyName === "position") node.position.fromArray(v);
      else if (propertyName === "scale") node.scale.fromArray(v);
      n++;
    }
    console.log(`Base pose lagaya ("${src.name.trim()}"): ${n} tracks`);
  }, [scene, animations]);

  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!/^eye_in\d*$/i.test(o.name)) return;
      o.children.forEach((child) => {
        if (!child.isMesh || !child.material?.color) return;
        const c = child.material.color;
        if (c.r + c.g + c.b < 0.05) return;

        const white = child.material.clone();
        white.color.set(0xffffff);
        white.metalness = 0;
        white.roughness = 0.35;
        child.material = white;
      });
    });
  }, [scene]);

  // Palak dhoondo
  useLayoutEffect(() => {
    const lids = [];
    scene.traverse((o) => {
      if (LID_RE.test(o.name) && o.isMesh && o.parent) {
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

    // ---- DEBUG: ek hi line, copy karna aasaan ----
    const eyeNames = [];
    const meshNames = [];
    const morphs = {};
    scene.traverse((o) => {
      if (/eye|lid|blink/i.test(o.name)) eyeNames.push(`${o.name}[${o.type}]`);
      if (o.isMesh) {
        meshNames.push(o.name);
        if (o.morphTargetDictionary) morphs[o.name] = Object.keys(o.morphTargetDictionary);
      }
    });
    console.log(
      "DEBUG-EYE",
      JSON.stringify({ lidsMile: list.map((l) => l.node.name), eyeNames, meshNames, morphs })
    );
  }, [scene]);

  const clips = useMemo(() => {
    const result = [];
    for (const [name, re] of Object.entries(CLIP_PATTERNS)) {
      const src = animations.find((a) => re.test(a.name.trim()));
      if (!src) {
        console.warn(`⚠️ "${name}" animation GLB mein nahi mili`);
        continue;
      }

      let c = keepPoseTracks(src, name);
      if (c && name === "talk") c = withoutArmTracks(c, name);
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

  // Ek baar chalne wala action (jump / headClick / eye)
  const playOneShot = useCallback((name, fade = 0.3) => {
    const act = actionsRef.current[name];
    if (!act) {
      console.warn(`❌ action "${name}" nahi mili. Jo mili hain:`, Object.keys(actionsRef.current));
      return;
    }
    console.log(`▶️ play: ${name} (${act.getClip().duration.toFixed(2)}s)`);
    oneShotRef.current = true;
    act.reset();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    if (fade > 0) act.fadeIn(fade);
    else act.setEffectiveWeight(1); // fadeOut ke baad weight 0 reh jaata hai, wapas 1 karo
    act.play();
  }, []);

  // Har 6 sec mein eye animation + blink (sirf jab model free ho)
  const startEyeTimer = useCallback(() => {
    clearInterval(eyeTimerRef.current);
    eyeTimerRef.current = setInterval(() => {
      if (busyRef.current || oneShotRef.current) return;
      console.log("👁 eye blink, palak mile:", lidsRef.current.length);
      blinkStartRef.current = performance.now() / 1000;
      playOneShot("eye", 0);
    }, EYE_INTERVAL_MS);
  }, [playOneShot]);

  // Click head par hai ya nahi
  const isHeadHit = useCallback(
    (e) => {
      const chain = [];
      let o = e.object;
      while (o) {
        chain.push(o.name);
        o = o.parent;
      }

      _box.setFromObject(scene);
      const rel = (e.point.y - _box.min.y) / (_box.max.y - _box.min.y);
      const byName = chain.some((n) => /head|face/i.test(n));
      const byHeight = rel > 1 - HEAD_TOP_FRACTION;

      console.log(
        "DEBUG-CLICK",
        JSON.stringify({ chain: chain.join(" > "), height: +rel.toFixed(2), byName, byHeight })
      );
      return byName || byHeight;
    },
    [scene]
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (busyRef.current) return;
      ONE_SHOT_NAMES.forEach((n) => actionsRef.current[n]?.fadeOut(0.2));

      if (isHeadHit(e) && actionsRef.current.headClick) {
        console.log("▶️ click: headClick");
        playOneShot("headClick");
      } else {
        console.log("▶️ click: jump");
        playOneShot("jump");
      }
    },
    [playOneShot, isHeadHit]
  );

  useFrame((_, delta) => {
    let tb = 0;
    for (const name of Object.keys(BLINK_ACTIONS)) {
      if (name === "eye") continue; // eye ka blink neeche time se chalta hai
      const a = actionsRef.current[name];
      const curve = blinkCurves[name];
      if (a && curve && a.isRunning()) {
        tb = Math.max(tb, sampleCurve(curve, a.time) * a.getEffectiveWeight());
      }
    }

    // eye blink: clip par depend nahi, seedha time se
    if (blinkStartRef.current >= 0) {
      const t = performance.now() / 1000 - blinkStartRef.current;
      if (t > BLINK_DURATION) blinkStartRef.current = -1;
      else tb = Math.max(tb, sampleCurve(BLINK_SHAPE, t));
    }

    blinkRef.current += (tb - blinkRef.current) * (1 - Math.exp(-BLINK_SMOOTH * delta));

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

    const c = THREE.MathUtils.clamp(blinkRef.current * LID_GAIN, 0, 1);
    for (const lid of lidsRef.current) {
      _lid.identity().slerp(lid.close, c);
      lid.node.quaternion.copy(_lid).multiply(lid.base);
    }
  });

  // intro / one-shot khatam hone par
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
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer, actions]);

  // 1) Page load par "hayy(2)"
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

  // 2) Talk
  useEffect(() => {
    const talk = actions.talk;
    if (!talk) return;
    if (speaking) {
      talk.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    } else {
      talk.fadeOut(0.3);
    }
  }, [speaking, actions]);

  // 3) Typing
  useEffect(() => {
    const t = actions.typing;
    if (!t) return;
    if (typing) {
      t.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    } else {
      t.fadeOut(0.3);
    }
  }, [typing, actions]);

  // 3b) Thinking
  useEffect(() => {
    const t = actions.thinking;
    if (!t) return;
    const show = thinking && !typing && !speaking;
    if (show) {
      t.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    } else {
      t.fadeOut(0.3);
    }
  }, [thinking, typing, speaking, actions]);

  // 4) Busy state + eye timer
  useEffect(() => {
    const busy = speaking || typing || thinking || !introDone;
    busyRef.current = busy;

    if (busy) {
      clearInterval(eyeTimerRef.current);
    } else {
      startEyeTimer();
    }

    if (speaking || typing || thinking) {
      actionsRef.current.intro?.fadeOut(0.3);
      ONE_SHOT_NAMES.forEach((n) => actionsRef.current[n]?.fadeOut(0.3));
      oneShotRef.current = false;
      blinkStartRef.current = -1;
      if (!introDone) setIntroDone(true);
    }

    return () => clearInterval(eyeTimerRef.current);
  }, [speaking, typing, thinking, introDone, startEyeTimer]);

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

export default function KikooModel({ speaking = false, typing = false, thinking = false }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#a8e0ff" }}>
      <LottieBackground />
      <Canvas camera={{ position: [0, -0.7, 4.3], fov: 40, near: 0.1, far: 50 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[15, 15, 15]} intensity={3} />
        <Model speaking={speaking} typing={typing} thinking={thinking} />
        <OrbitControls target={[0, -0.7, 0]} enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  );
}