const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

let currentAudio = null;
let currentResolve = null;
let playToken = 0;
let callId = 0;
let streamAbort = null;

/* iOS / Safari fix: audio "unlock"
 * Ek hi <audio> element hai: pehle tap par unlock hota hai, phir har chunk usi mein bajta hai. */
const player = new Audio();
player.setAttribute("playsinline", "");
player.preload = "auto";
let unlocked = false;

function silentWavUrl() {
  const sampleRate = 8000;
  const samples = 800; // 0.1 sec ki khamoshi
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

const UNLOCK_EVENTS = ["touchend", "click", "keydown"];

function unlockAudio() {
  if (unlocked || currentAudio) return; // awaaz chal rahi ho to chhedo mat
  try {
    player.src = silentWavUrl();
    const p = player.play();
    Promise.resolve(p)
      .then(() => {
        unlocked = true;
        player.pause();
        UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlockAudio));
      })
      .catch(() => {});
  } catch {
    /* agle tap par dobara koshish */
  }
}

if (typeof document !== "undefined") {
  UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, unlockAudio, { passive: true }));
}

function loadPlayer(url) {
  player.src = url;
  return player;
}

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

export function chatWithVoice({
  message,
  history = [],
  gameState = {},
  onStart,
  onEnd,
  onText, // optional: live text tokens
  timeoutMs = 20000,
}) {
  stopVoice();
  const myToken = ++playToken;

  const controller = new AbortController();
  streamAbort = controller;
  let timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return new Promise((resolveAnswer, rejectAnswer) => {
    const queue = [];
    let gotAnswer = false;
    let streamDone = false;
    let playing = false;
    let started = false;
    let ended = false;

    let finishPlayback;
    const playback = new Promise((r) => (finishPlayback = r));

    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timeoutId);
      if (started) onEnd?.();
      finishPlayback();
    };

    const cancelled = () => myToken !== playToken;

    const playNext = () => {
      if (cancelled()) return finish();
      if (playing) return;

      const b64 = queue.shift();
      if (!b64) {
        if (streamDone) finish();
        return;
      }

      playing = true;
      const audio = loadPlayer(`data:audio/mpeg;base64,${b64}`);
      currentAudio = audio;
      currentResolve = finish;

      const next = () => {
        playing = false;
        playNext();
      };

      audio.onplaying = () => {
        if (!started && !cancelled()) {
          started = true;
          onStart?.();
        }
      };
      audio.onended = next;
      audio.onerror = next;
      audio.play().catch(next);
    };

    const handleEvent = (evt) => {
      if (evt.type === "answer") {
        gotAnswer = true;
        clearTimeout(timeoutId);
        resolveAnswer({
          data: { answer: evt.answer, gameState: evt.gameState, image: evt.image },
          playback,
        });
      } else if (evt.type === "text") {
        onText?.(evt.delta);
      } else if (evt.type === "replace") {
        queue.length = 0;
        if (currentAudio) {
          currentResolve = null;
          killCurrentAudio();
        }
        playing = false;
      } else if (evt.type === "audio") {
        queue.push(evt.audio);
        playNext();
      } else if (evt.type === "error") {
        throw new Error(evt.error || "Chat failed");
      }
    };

    (async () => {
      const res = await fetch(`${API_BASE}/api/chat-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, gameState }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Chat API failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handleEvent(JSON.parse(line));
        }
      }

      streamDone = true;
      if (!playing && queue.length === 0) finish();
      else playNext();
    })().catch((err) => {
      if (cancelled()) {
        if (!gotAnswer) rejectAnswer(Object.assign(new Error("cancelled"), { name: "CancelledError" }));
        return finish();
      }
      if (!gotAnswer) {
        clearTimeout(timeoutId);
        return rejectAnswer(err);
      }
      console.error("Voice stream error:", err);
      streamDone = true;
      if (!playing && queue.length === 0) finish();
    });
  });
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

    const audio = loadPlayer(`data:audio/mpeg;base64,${data.audio}`);
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
  streamAbort?.abort();
  streamAbort = null;
  killCurrentAudio();
}