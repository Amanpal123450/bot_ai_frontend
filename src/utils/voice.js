// const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

// let currentAudio = null;

// export async function playNaturalVoice(text, setSpeaking = null) {
//   if (currentAudio) {
//     currentAudio.pause();
//     currentAudio.currentTime = 0;
//     currentAudio = null;
//   }

//   if (setSpeaking) setSpeaking(true);

//   try {
//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), 15000);

//     const res = await fetch(`${API_BASE}/api/speak`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ text: text?.slice(0, 1000) }),
//       signal: controller.signal,
//     });

//     clearTimeout(timeoutId);

//     if (!res.ok) throw new Error(`Voice generation failed: ${res.status}`);

//     const data = await res.json();
//     if (!data.audio) throw new Error("No audio received");

//     const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
//     currentAudio = audio;

//     // 🔑 Yehi promise hai jo "poora bolne tak" Chatbot.jsx ko rokta hai
//     await new Promise((resolve, reject) => {
//       audio.onended = () => {
//         if (setSpeaking) setSpeaking(false);
//         if (currentAudio === audio) currentAudio = null;
//         resolve();
//       };

//       audio.onerror = () => {
//         if (setSpeaking) setSpeaking(false);
//         if (currentAudio === audio) currentAudio = null;
//         reject(new Error("Audio playback error"));
//       };

//       audio.play().catch(reject);
//     });
//   } catch (err) {
//     if (setSpeaking) setSpeaking(false);
//     currentAudio = null;

//     if (err.name === "AbortError") {
//       console.error("Voice generation timed out");
//     } else {
//       console.error("Voice generation failed:", err);
//     }
//     throw err;
//   }
// }

// export function stopVoice() {
//   if (currentAudio) {
//     currentAudio.pause();
//     currentAudio.currentTime = 0;
//     currentAudio = null;
//   }
// }

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

let currentAudio = null;
let playToken = 0;

export async function playNaturalVoice(text, setSpeaking = null) {
  const myToken = ++playToken;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.src = "";
    currentAudio.load(); // 
    currentAudio = null;
  }

  if (setSpeaking) setSpeaking(true);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text?.slice(0, 1000) }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (myToken !== playToken) {
      if (setSpeaking) setSpeaking(false);
      return;
    }

    if (!res.ok) throw new Error(`Voice generation failed: ${res.status}`);

    const data = await res.json();
    if (!data.audio) throw new Error("No audio received");

    if (myToken !== playToken) {
      if (setSpeaking) setSpeaking(false);
      return;
    }

    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
    currentAudio = audio;

    await new Promise((resolve, reject) => {
      audio.onended = () => {
        if (myToken === playToken) {
          if (setSpeaking) setSpeaking(false);
          currentAudio = null;
        }
        resolve();
      };

      audio.onerror = () => {
        if (myToken === playToken) {
          if (setSpeaking) setSpeaking(false);
          currentAudio = null;
        }
        reject(new Error("Audio playback error"));
      };

      if (myToken !== playToken) {
        resolve();
        return;
      }

      audio.play().catch(reject);
    });
  } catch (err) {
    if (myToken === playToken) {
      if (setSpeaking) setSpeaking(false);
      currentAudio = null;
    }

    if (err.name === "AbortError") {
      console.error("Voice generation timed out");
    } else {
      console.error("Voice generation failed:", err);
    }
    throw err;
  }
}

export function stopVoice() {
  playToken++; 
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.src = "";
    currentAudio.load();
    currentAudio = null;
  }
}