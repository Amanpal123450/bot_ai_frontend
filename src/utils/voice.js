const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

let currentAudio = null;
let currentResolve = null; // stopVoice par atka hua await chhodne ke liye
let playToken = 0;         // cancel track karne ke liye
let callId = 0;            // sirf naye playNaturalVoice call par badhta hai

function killCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onplaying = null;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.src = "";
    currentAudio.load();
    currentAudio = null;
  }
  const r = currentResolve;
  currentResolve = null;
  r?.();
}

export async function playNaturalVoice(text, setSpeaking = null, options = {}) {
  const { onStart, onEnd } = options;
  const myToken = ++playToken;
  const myCall = ++callId;

  killCurrentAudio();

  let started = false;
  let timeoutId;
  if (setSpeaking) setSpeaking(true);

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text?.slice(0, 1000) }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (myToken !== playToken) return;
    if (!res.ok) throw new Error(`Voice generation failed: ${res.status}`);

    const data = await res.json();
    if (!data.audio) throw new Error("No audio received");
    if (myToken !== playToken) return;

    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
    currentAudio = audio;

    await new Promise((resolve, reject) => {
      currentResolve = resolve;

      audio.onplaying = () => {
        if (!started && myToken === playToken) {
          started = true;
          onStart?.();
        }
      };
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback error"));

      audio.play().catch(reject);
    });
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("Voice generation timed out");
    } else {
      console.error("Voice generation failed:", err);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (started) onEnd?.();
    if (myToken === playToken) {
      currentAudio = null;
      currentResolve = null;
    }
    
    if (myCall === callId && setSpeaking) setSpeaking(false);
  }
}

export function stopVoice() {
  playToken++;
  killCurrentAudio();
}