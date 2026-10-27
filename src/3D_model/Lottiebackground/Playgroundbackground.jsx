import React from "react";

// Bacho ka jungle-playground background: sirf SVG + CSS animation, koi library/image nahi.
// (clouds, sooraj ki kirnen, jhoola, seesaw, ghubbare, titliyan, chidiyan, uchhalti gend, jhande, phool)

const anim = (name, dur, delay = 0, timing = "ease-in-out") =>
  `animation:${name} ${dur}s ${timing} ${delay}s infinite;`;
const origin = (x, y) => `transform-origin:${x}px ${y}px;transform-box:view-box;`;

const CSS = `
@keyframes kk-drift{from{transform:translateX(-150px)}to{transform:translateX(540px)}}
@keyframes kk-spin{to{transform:rotate(360deg)}}
@keyframes kk-swing{0%,100%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}}
@keyframes kk-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes kk-rise{0%{transform:translateY(0);opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translateY(-690px);opacity:0}}
@keyframes kk-wobble{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}
@keyframes kk-bounce{
  0%,100%{transform:translateY(0) scale(1.1,.9);animation-timing-function:cubic-bezier(.2,.6,.4,1)}
  50%{transform:translateY(-74px) scale(.96,1.04);animation-timing-function:cubic-bezier(.6,0,.8,.4)}}
@keyframes kk-shadow{0%,100%{transform:scaleX(1.15);opacity:.3}50%{transform:scaleX(.55);opacity:.12}}
@keyframes kk-seesaw{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}
@keyframes kk-flap{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.2)}}
@keyframes kk-flapy{0%,100%{transform:scaleY(1)}50%{transform:scaleY(-.5)}}
@keyframes kk-float{0%,100%{transform:translate(0,0)}25%{transform:translate(36px,-24px)}50%{transform:translate(8px,-54px)}75%{transform:translate(-32px,-26px)}}
@keyframes kk-fly{from{transform:translateX(-70px)}to{transform:translateX(480px)}}
@keyframes kk-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@media (prefers-reduced-motion: reduce){.kk-bg *{animation:none !important}}
`;

function cloud(y, s, dur, delay) {
  return `<g transform="translate(0 ${y}) scale(${s})"><g style="${anim("kk-drift", dur, delay, "linear")}" fill="#fff" opacity=".95">
    <ellipse cx="0" cy="0" rx="36" ry="14"/><circle cx="-16" cy="-9" r="14"/><circle cx="6" cy="-15" r="19"/><circle cx="26" cy="-6" r="12"/></g></g>`;
}

function balloon(x, color, dur, delay) {
  return `<g transform="translate(${x} 625)"><g style="${anim("kk-rise", dur, delay, "linear")}"><g style="${anim("kk-wobble", 3.2, delay / 3)}">
    <path d="M0 20 q-5 14 2 28 q5 12 -2 28" stroke="#6b7280" stroke-width="1.5" fill="none"/>
    <ellipse cx="0" cy="0" rx="14" ry="18" fill="${color}"/><path d="M-3 17 L3 17 L0 23Z" fill="${color}"/>
    <ellipse cx="-5" cy="-7" rx="3.5" ry="6" fill="#fff" opacity=".45"/></g></g></g>`;
}

function bird(y, s, dur, delay) {
  return `<g transform="translate(0 ${y}) scale(${s})"><g style="${anim("kk-fly", dur, delay, "linear")}"><g style="${anim("kk-bob", 1.1)}">
    <path d="M0 0 q6 -9 12 0 q6 -9 12 0" stroke="#37474f" stroke-width="2.4" fill="none" stroke-linecap="round" style="${anim("kk-flapy", 0.55)}${origin(12, 0)}"/></g></g></g>`;
}

function butterfly(x, y, c1, c2, dur, delay) {
  return `<g transform="translate(${x} ${y})"><g style="${anim("kk-float", dur, delay)}">
    <g style="${anim("kk-flap", 0.38)}${origin(0, 0)}">
      <ellipse cx="-7" cy="-3" rx="8" ry="6" fill="${c1}" transform="rotate(-25 -7 -3)"/><ellipse cx="7" cy="-3" rx="8" ry="6" fill="${c1}" transform="rotate(25 7 -3)"/>
      <ellipse cx="-5" cy="4" rx="5" ry="4" fill="${c2}"/><ellipse cx="5" cy="4" rx="5" ry="4" fill="${c2}"/></g>
    <rect x="-1.2" y="-7" width="2.4" height="15" rx="1.2" fill="#5b3a1e"/></g></g>`;
}

function flower(x, y, color, delay) {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${(x + 4.6 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(y + 4.6 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="3.4" fill="${color}"/>`)
    .join("");
  return `<g style="${anim("kk-sway", 2.8 + (delay % 3) * 0.4, -delay)}${origin(x, y + 16)}">
    <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 16}" stroke="#2e7d32" stroke-width="2"/>${petals}<circle cx="${x}" cy="${y}" r="2.4" fill="#ffb703"/></g>`;
}

function buildPlayground() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const p = (r) => `${(320 + r * Math.cos(a)).toFixed(1)}`;
    const q = (r) => `${(95 + r * Math.sin(a)).toFixed(1)}`;
    return `<line x1="${p(48)}" y1="${q(48)}" x2="${p(68)}" y2="${q(68)}"/>`;
  }).join("");

  const flagColors = ["#ff5a5f", "#ffd23f", "#4cc9f0", "#7bd88f", "#c77dff", "#ff8a4c", "#ff5a5f", "#ffd23f", "#4cc9f0"];
  const flags = flagColors
    .map((c, i) => {
      const t = (i + 0.7) / (flagColors.length + 0.4);
      const x = t * 400;
      const y = 44 + 80 * t * (1 - t) + 1;
      return `<path d="M${(x - 12).toFixed(1)} ${y.toFixed(1)} L${(x + 12).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y + 26).toFixed(1)}Z" fill="${c}" style="${anim("kk-sway", 2.4, -i * 0.3)}${origin(+x.toFixed(1), +y.toFixed(1))}"/>`;
    })
    .join("");

  const vines = [[130, 112], [196, 70], [262, 96]]
    .map(
      ([x, h], i) =>
        `<g style="${anim("kk-sway", 4 + i, -i)}${origin(x, 0)}"><path d="M${x} 0 C${x - 10} ${h * 0.4} ${x + 12} ${h * 0.7} ${x} ${h}" stroke="#2f8f45" stroke-width="5" fill="none" stroke-linecap="round"/>
        <ellipse cx="${x + 7}" cy="${h * 0.55}" rx="9" ry="4.5" fill="#3fb35a" transform="rotate(-30 ${x + 7} ${h * 0.55})"/>
        <ellipse cx="${x - 7}" cy="${h * 0.85}" rx="9" ry="4.5" fill="#3fb35a" transform="rotate(30 ${x - 7} ${h * 0.85})"/></g>`
    )
    .join("");

  const bushes = [[20, 575, 34], [70, 590, 28], [140, 596, 22], [270, 596, 22], [335, 588, 28], [385, 574, 34]]
    .map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? "#3aa655" : "#2e9c4a"}"/>`)
    .join("");

  const flowers = [
    [30, 548, "#ff6fa5"], [100, 566, "#ffffff"], [160, 574, "#ffd23f"],
    [245, 574, "#ff8a4c"], [300, 566, "#ff6fa5"], [372, 548, "#ffffff"],
  ].map(([x, y, c], i) => flower(x, y, c, i)).join("");

  return `<svg class="kk-bg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%">
  <style>${CSS}</style>
  <defs>
    <linearGradient id="kk-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd6ff"/><stop offset=".55" stop-color="#e3f7d0"/><stop offset="1" stop-color="#fff3c4"/></linearGradient>
    <radialGradient id="kk-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6a8"/><stop offset="1" stop-color="#fff6a8" stop-opacity="0"/></radialGradient>
    <linearGradient id="kk-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be36f"/><stop offset="1" stop-color="#4fa843"/></linearGradient>
  </defs>

  <rect width="400" height="600" fill="url(#kk-sky)"/>
  <circle cx="320" cy="95" r="90" fill="url(#kk-sun)"/>
  <g style="${anim("kk-spin", 40, 0, "linear")}${origin(320, 95)}" stroke="#ffd23f" stroke-width="5" stroke-linecap="round">${rays}</g>
  <circle cx="320" cy="95" r="38" fill="#ffe066"/>

  ${cloud(78, 1, 70, -10)}${cloud(140, 0.7, 95, -55)}${cloud(48, 0.55, 120, -90)}

  <path d="M0 340 Q70 280 150 330 T300 320 T400 305 L400 600 L0 600Z" fill="#86cf7f"/>
  <path d="M0 395 Q90 345 190 388 T400 372 L400 600 L0 600Z" fill="#5fb260"/>
  <path d="M0 482 Q200 452 400 482 L400 600 L0 600Z" fill="url(#kk-ground)"/>

  ${bird(120, 1, 22, -4)}${bird(175, 0.75, 30, -18)}

  <!-- baayein ka ped + jhoola -->
  <path d="M26 600 C34 470 24 330 40 190 L64 190 C62 330 72 470 80 600Z" fill="#8a5a33"/>
  <path d="M46 560 C50 470 44 380 52 260" stroke="#6e4524" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g style="${anim("kk-sway", 5)}${origin(52, 230)}">
    <circle cx="52" cy="170" r="58" fill="#237f3c"/><circle cx="18" cy="190" r="44" fill="#2e9c4a"/>
    <circle cx="92" cy="195" r="42" fill="#2e9c4a"/><circle cx="55" cy="130" r="42" fill="#3fb35a"/>
  </g>
  <line x1="58" y1="208" x2="96" y2="200" stroke="#7a4a28" stroke-width="6" stroke-linecap="round"/>
  <g style="${anim("kk-swing", 3.4)}${origin(94, 202)}">
    <line x1="94" y1="202" x2="76" y2="322" stroke="#b08968" stroke-width="2.5"/><line x1="94" y1="202" x2="112" y2="322" stroke="#b08968" stroke-width="2.5"/>
    <rect x="66" y="320" width="56" height="10" rx="5" fill="#ff5a5f"/><rect x="66" y="320" width="56" height="4" rx="2" fill="#ff8a8e"/>
  </g>

  <!-- daayein ka ped -->
  <path d="M374 600 C366 480 376 340 360 210 L336 210 C338 340 328 480 320 600Z" fill="#8a5a33"/>
  <path d="M352 560 C348 470 354 390 346 290" stroke="#6e4524" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g style="${anim("kk-sway", 5.6, -2)}${origin(348, 250)}">
    <circle cx="348" cy="190" r="58" fill="#237f3c"/><circle cx="384" cy="212" r="44" fill="#2e9c4a"/>
    <circle cx="306" cy="215" r="40" fill="#2e9c4a"/><circle cx="344" cy="148" r="42" fill="#3fb35a"/>
  </g>

  ${vines}

  <path d="M0 44 Q200 124 400 44" stroke="#8a5a33" stroke-width="2.5" fill="none"/>${flags}

  ${bushes}${flowers}

  <!-- seesaw -->
  <polygon points="320,528 306,556 334,556" fill="#6c757d"/>
  <g style="${anim("kk-seesaw", 2.4)}${origin(320, 528)}">
    <rect x="276" y="522" width="88" height="8" rx="4" fill="#ff7b54"/>
    <circle cx="282" cy="520" r="5" fill="#ffd23f"/><circle cx="358" cy="520" r="5" fill="#ffd23f"/>
  </g>

  <!-- uchhalti gend -->
  <ellipse cx="60" cy="590" rx="16" ry="4" fill="#000" style="${anim("kk-shadow", 1.1, 0, "ease-in-out")}${origin(60, 590)}"/>
  <g style="${anim("kk-bounce", 1.1, 0, "linear")}${origin(60, 584)}">
    <circle cx="60" cy="568" r="16" fill="#ff5a5f"/><path d="M46 563 Q60 555 74 563" stroke="#fff" stroke-width="3" fill="none"/>
    <path d="M48 576 Q60 583 72 576" stroke="#ffd23f" stroke-width="3" fill="none"/>
  </g>

  ${balloon(135, "#ff5a5f", 17, -3)}${balloon(215, "#4cc9f0", 21, -12)}${balloon(290, "#ffd23f", 15, -7)}
  ${butterfly(95, 255, "#ff8fab", "#ffc2d1", 7, 0)}${butterfly(300, 300, "#ffd23f", "#fff0a8", 8.5, -3)}${butterfly(210, 215, "#b388ff", "#d7c2ff", 9.5, -5)}
</svg>`;
}

const PLAYGROUND_SVG = buildPlayground();

export default function PlaygroundBackground() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: PLAYGROUND_SVG }}
    />
  );
}