import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
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
  eye: /^eye\.001$/i, // har 6 sec -> Blender ki nayi eye.001 clip
  talk: /toking/i, // bot bolte waqt -> toking
  typing: /^typing$/i,
  thinking: /thi(n)?king/i,
};

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

  const clips = useMemo(() => {
    const result = [];
    for (const [name, re] of Object.entries(CLIP_PATTERNS)) {
      const src = animations.find((a) => re.test(a.name.trim()));
      if (!src) {
        console.warn(`⚠️ "${name}" animation GLB mein nahi mili`);
        continue;
      }

      // Blender clip "eye.001" ko runtime ki logical key "eye" do;
      // tracks/keyframes bilkul original hi rehte hain.
      let c =
        name === "eye"
          ? new THREE.AnimationClip(name, src.duration, src.tracks)
          : keepPoseTracks(src, name);
      if (c && name === "talk") c = withoutArmTracks(c, name);
      if (!c) console.warn(`⚠️ "${name}" mein koi moving track nahi hai`);
      else result.push(c);
    }

    result.forEach((c) =>
      console.log(`Clip "${c.name}" ${c.duration.toFixed(2)}s:`, c.tracks.length, "tracks")
    );
    return result;
  }, [animations]);

  // GLB ke bone tracks ko rendered scene par seedha bind karo.
  const { actions, mixer } = useAnimations(clips, scene);
  actionsRef.current = actions;

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
    act.setEffectiveTimeScale(1);
    if (fade > 0) act.fadeIn(fade);
    else act.setEffectiveWeight(1); // fadeOut ke baad weight 0 reh jaata hai, wapas 1 karo
    act.play();
  }, []);

  // Har 6 sec mein Blender wali original eye clip chalao (sirf jab model free ho).
  const startEyeTimer = useCallback(() => {
    clearInterval(eyeTimerRef.current);
    eyeTimerRef.current = setInterval(() => {
      if (busyRef.current || oneShotRef.current) return;
      console.log("👁 eye animation");
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
