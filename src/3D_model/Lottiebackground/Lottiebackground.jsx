// import React, { useEffect, useState } from "react";
// import { DotLottieReact } from "@lottiefiles/dotlottie-react";
// import PlaygroundBackground from "./Playgroundbackground.jsx";
// // import PlaygroundBackground from "./PlaygroundBackground";

// // Lottie file yahan rakho: public/backgrounds/playground.lottie  (ya .json, to neeche src badal do)
// const LOTTIE_SRC = "/backgrounds/playground.lottie";

// // Lottie file mili to wahi chalegi. File nahi mili / load nahi hui to
// // pehle wala SVG playground background dikhega, yaani kuch tootega nahi.
// export default function LottieBackground({ src = LOTTIE_SRC }) {
//   const [ok, setOk] = useState(false);
//   const [reduced] = useState(
//     () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
//   );

//   useEffect(() => {
//     let alive = true;
//     // Vite dev mein file na ho to bhi index.html (200) aa jata hai, isliye type bhi dekhte hain
//     fetch(src, { method: "HEAD" })
//       .then((r) => {
//         const type = r.headers.get("content-type") || "";
//         if (alive) setOk(r.ok && !type.includes("text/html"));
//       })
//       .catch(() => alive && setOk(false));
//     return () => {
//       alive = false;
//     };
//   }, [src]);

//   if (!ok) return <PlaygroundBackground />;

//   return (
//     <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
//       <DotLottieReact
//         src={src}
//         loop={!reduced}
//         autoplay={!reduced}
//         layout={{ fit: "cover", align: [0.5, 1] }} // box bhar do, neeche se align
//         style={{ width: "100%", height: "100%" }}
//       />
//     </div>
//   );
// }