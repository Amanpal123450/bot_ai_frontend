import React, { useMemo } from "react";

/**
 * Cartoon meadow background (blue sky, drifting clouds, swaying trees,
 * rolling hills, waving grass, bobbing flowers).
 * Pure SVG + CSS animation: no extra libraries, light on performance.
 * Fills its parent (parent must be position: relative/absolute).
 */

const CSS = `
.mb-root { position:absolute; inset:0; overflow:hidden; pointer-events:none;
  background: linear-gradient(180deg,#1f63d8 0%,#3f8cec 38%,#8fd0fa 70%,#c6ebff 100%); }
.mb-layer { position:absolute; left:0; right:0; }

/* clouds */
.mb-cloud { position:absolute; left:0; will-change:transform;
  animation: mb-drift linear infinite; }
@keyframes mb-drift {
  from { transform: translateX(-40vw); }
  to   { transform: translateX(120vw); }
}
@keyframes mb-drift-box { /* container-relative drift */
  from { left:-45%; } to { left:110%; }
}
.mb-cloud { animation-name: mb-drift-box; }

/* trees sway */
.mb-tree { position:absolute; bottom:0; transform-origin:50% 100%;
  animation: mb-sway 6s ease-in-out infinite; }
@keyframes mb-sway {
  0%,100% { transform: rotate(-1.4deg); }
  50%     { transform: rotate(1.4deg); }
}

/* grass blades wave */
.mb-blade { position:absolute; bottom:0; transform-origin:50% 100%;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  animation: mb-wave 3.2s ease-in-out infinite; }
@keyframes mb-wave {
  0%,100% { transform: skewX(-7deg); }
  50%     { transform: skewX(7deg); }
}

/* flowers bob */
.mb-flower { position:absolute; transform-origin:50% 100%;
  animation: mb-bob 3.6s ease-in-out infinite; }
@keyframes mb-bob {
  0%,100% { transform: rotate(-6deg); }
  50%     { transform: rotate(6deg); }
}

/* slow breathing of far hills */
.mb-hills { animation: mb-hill 14s ease-in-out infinite alternate; }
@keyframes mb-hill { from { transform: translateX(-1.5%);} to { transform: translateX(1.5%);} }

@media (prefers-reduced-motion: reduce) {
  .mb-cloud,.mb-tree,.mb-blade,.mb-flower,.mb-hills { animation: none !important; }
}
`;

function Cloud({ top, width, duration, delay, opacity = 1 }) {
  return (
    <div
      className="mb-cloud"
      style={{
        top,
        width,
        opacity,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg viewBox="0 0 140 70" width="100%" style={{ display: "block" }}>
        <g fill="#e3effb">
          <circle cx="38" cy="46" r="22" />
          <circle cx="68" cy="38" r="28" />
          <circle cx="102" cy="46" r="22" />
          <rect x="38" y="46" width="64" height="22" rx="11" />
        </g>
        <g fill="#ffffff">
          <circle cx="38" cy="42" r="21" />
          <circle cx="68" cy="33" r="27" />
          <circle cx="102" cy="42" r="21" />
          <rect x="38" y="42" width="64" height="20" rx="10" />
        </g>
      </svg>
    </div>
  );
}

function Tree({ side, size, bottom, delay, flip = false, tone = 0 }) {
  const greens = [
    ["#2f7a2f", "#3f9a3a", "#6cc04a"],
    ["#3b8a34", "#58ad3f", "#9bd957"],
  ][tone];
  return (
    <div
      className="mb-tree"
      style={{
        [side]: "-4%",
        bottom,
        width: size,
        animationDelay: `${delay}s`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      <svg viewBox="0 0 120 160" width="100%" style={{ display: "block" }}>
        <path d="M54 160 L58 90 L62 90 L66 160 Z" fill="#7a4a2a" />
        <path d="M58 110 L38 92 M62 104 L84 84" stroke="#7a4a2a" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="52" r="40" fill={greens[0]} />
        <circle cx="34" cy="72" r="26" fill={greens[0]} />
        <circle cx="88" cy="72" r="26" fill={greens[0]} />
        <circle cx="58" cy="48" r="34" fill={greens[1]} />
        <circle cx="38" cy="66" r="20" fill={greens[1]} />
        <circle cx="84" cy="66" r="20" fill={greens[1]} />
        <circle cx="50" cy="36" r="20" fill={greens[2]} opacity=".85" />
        <circle cx="76" cy="46" r="12" fill={greens[2]} opacity=".7" />
      </svg>
    </div>
  );
}

// deterministic pseudo-random so the layout does not change between renders
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function MeadowBackground() {
  

  const flowers = useMemo(
    () => [
      { left: "8%", h: 34, c: "#f06ea9", d: 0 },
      { left: "21%", h: 26, c: "#ffb62e", d: -1.2 },
      { left: "70%", h: 30, c: "#fff3c4", d: -0.6 },
      { left: "83%", h: 38, c: "#ff9f1c", d: -2 },
      { left: "93%", h: 24, c: "#b79cff", d: -1.6 },
      { left: "47%", h: 20, c: "#8ec5ff", d: -2.4 },
    ],
    []
  );

  return (
    <div className="mb-root" aria-hidden="true">
      <style>{CSS}</style>

      {/* clouds */}
      <Cloud top="6%" width="34%" duration={70} delay={-10} />
      <Cloud top="16%" width="24%" duration={95} delay={-55} opacity={0.95} />
      <Cloud top="3%" width="18%" duration={120} delay={-90} opacity={0.9} />
      <Cloud top="26%" width="16%" duration={85} delay={-30} opacity={0.85} />

      {/* far hills */}
      <div className="mb-layer mb-hills" style={{ bottom: "30%", height: "26%", left: "-4%", right: "-4%" }}>
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block" }}>
          <path d="M0 70 Q60 20 130 55 T260 45 T400 50 L400 100 L0 100 Z" fill="#8fd16a" />
        </svg>
      </div>

      {/* distant small trees */}
      <div className="mb-layer" style={{ bottom: "40%", height: "14%" }}>
        {[["14%", 0.9], ["38%", 0.7], ["62%", 0.8], ["86%", 0.9]].map(([l, s], i) => (
          <div key={i} style={{ position: "absolute", left: l, bottom: 0, width: `${9 * s}%` }}>
            <svg viewBox="0 0 40 50" width="100%" style={{ display: "block" }}>
              <rect x="18" y="30" width="4" height="20" fill="#6d4a2e" />
              <circle cx="20" cy="22" r="16" fill="#4a9a3d" />
              <circle cx="17" cy="18" r="9" fill="#74be4f" opacity=".8" />
            </svg>
          </div>
        ))}
      </div>

      {/* mid hill */}
      <div className="mb-layer" style={{ bottom: "20%", height: "28%" }}>
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block" }}>
          <path d="M0 55 Q90 10 190 45 T400 30 L400 100 L0 100 Z" fill="#6cc24a" />
        </svg>
      </div>

      {/* side trees (middle stays free for the model) */}
      <Tree side="left" size="34%" bottom="24%" delay={0} tone={0} />
      <Tree side="right" size="40%" bottom="18%" delay={-2} tone={1} flip />

      {/* foreground meadow */}
      <div
        className="mb-layer"
        style={{
          bottom: 0,
          height: "30%",
          background: "linear-gradient(180deg,#52b33f 0%,#3f9a34 55%,#2f8a2b 100%)",
          borderTopLeftRadius: "50% 18%",
          borderTopRightRadius: "50% 18%",
        }}
      >
        {/* dirt path */}
        <svg
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <path d="M260 22 Q330 30 400 24 L400 52 Q320 44 240 34 Z" fill="#b98a5a" opacity=".9" />
        </svg>

     
      </div>
    </div>
  );
}