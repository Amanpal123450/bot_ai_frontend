import React, { useMemo, useState } from "react";
import Chatbot from "./components/Chatbot";
import KikooModel from "./3D_model/KikooModel";

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const FLOWERS = [
  { left: "8%", h: 34, c: "#f06ea9", d: 0 },
  { left: "21%", h: 26, c: "#ffb62e", d: -1.2 },
  { left: "70%", h: 30, c: "#fff3c4", d: -0.6 },
  { left: "83%", h: 38, c: "#ff9f1c", d: -2 },
  { left: "93%", h: 24, c: "#b79cff", d: -1.6 },
  { left: "47%", h: 20, c: "#8ec5ff", d: -2.4 },
];

function App() {
  const [speaking, setSpeaking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [inputTarget, setInputTarget] = useState(null);
  const [thinking, setThinking] = useState(false);

  const blades = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 70 }, (_, i) => ({
      left: `${(i / 70) * 100 + r() * 1.2 - 0.6}%`,
      height: 10 + r() * 16,
      width: 5 + r() * 5,
      delay: -r() * 3,
      color: ["#2f8f2c", "#3fa83a", "#59c040", "#2a7f2a"][Math.floor(r() * 4)],
    }));
  }, []);

  return (
    <div className="font-sans">
      {/*
        MOBILE (<640px): poori screen, model upar (flex-1), input neeche
        DESKTOP (sm+): pehle jaisa chhota widget, bottom-right
      */}
      <div
        className="
          fixed inset-0 z-[1000] flex h-[100dvh] w-full flex-col bg-white
          sm:inset-auto sm:bottom-5 sm:right-5 sm:h-auto sm:w-[380px] sm:rounded-2xl
        "
      >
        {/* Model area */}
        <div
          className="
            relative min-h-0 flex-1 overflow-hidden
            sm:h-[520px] sm:flex-none sm:rounded-t-2xl md:h-[320px]
          "
        >
          <KikooModel speaking={speaking} typing={typing} thinking={thinking} />

          {/* grass blades */}
          {blades.map((b, i) => (
            <span
              key={i}
              className="mb-blade"
              style={{
                left: b.left,
                height: b.height,
                width: b.width,
                background: b.color,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}

          {/* flowers */}
          {FLOWERS.map((f, i) => (
            <div
              key={i}
              className="mb-flower"
              style={{ left: f.left, bottom: "8%", height: f.h, width: 14, animationDelay: `${f.d}s` }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  width: 2,
                  height: "100%",
                  background: "#2f7d2d",
                  transform: "translateX(-50%)",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: -4,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: f.c,
                  boxShadow: "inset -2px -2px 0 rgba(0,0,0,.12)",
                }}
              />
            </div>
          ))}
        </div>

        {/* Suggestions + input yahan portal hote hain */}
        <div
          ref={setInputTarget}
          className="
            shrink-0 overflow-hidden bg-white pb-[env(safe-area-inset-bottom)]
            shadow-[0_-4px_20px_rgba(0,0,0,0.08)]
            sm:rounded-b-2xl sm:pb-0 sm:shadow-[0_4px_20px_rgba(0,0,0,0.1)]
          "
        />
      </div>

      {/* Hidden chatbot: sirf logic aur portal ke liye */}
      <Chatbot
        onSpeakingChange={setSpeaking}
        onTypingChange={setTyping}
        onThinkingChange={setThinking}
        inputTarget={inputTarget}
      />
    </div>
  );
}

export default App;