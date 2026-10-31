const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws";

/* ------------------------------------------------------------------ *
 *  AUDIO PLAYER (ek hi <audio> element, mobile unlock ke saath)
 * ------------------------------------------------------------------ */
let currentAudio = null;
let currentResolve = null;
let currentCleanup = null;
let playToken = 0;
let callId = 0;

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
  currentCleanup?.();
  currentCleanup = null;
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

/*
 * Fish sends one MP3 stream in several websocket messages.  Replacing an
 * <audio> src for every message makes the browser recreate its decoder at
 * every boundary, which is heard as a small pause.  MediaSource keeps one
 * decoder and appends those bytes to the same timeline instead.
 */
function createStreamPlayer({ onStart, onEnd, onError }) {
  if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported("audio/mpeg")) {
    return null;
  }

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  const pending = [];
  let sourceBuffer = null;
  let opened = false;
  let inputEnded = false;
  let disposed = false;
  let started = false;
  let ended = false;
  let playRequested = false;

  const finish = () => {
    if (ended || disposed) return;
    ended = true;
    onEnd();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    pending.length = 0;
    player.onplaying = null;
    player.onended = null;
    player.onerror = null;
    URL.revokeObjectURL(objectUrl);
  };

  const endStream = () => {
    if (!inputEnded || !opened || !sourceBuffer || sourceBuffer.updating || pending.length) return;
    try {
      if (mediaSource.readyState === "open") mediaSource.endOfStream();
    } catch (err) {
      onError(err);
    }
  };

  const pump = () => {
    if (disposed || !sourceBuffer || sourceBuffer.updating) return;
    const next = pending.shift();
    if (!next) return endStream();
    try {
      sourceBuffer.appendBuffer(next);
    } catch (err) {
      onError(err);
    }
  };

  mediaSource.addEventListener("sourceopen", () => {
    if (disposed) return;
    opened = true;
    try {
      sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      sourceBuffer.mode = "sequence";
      sourceBuffer.addEventListener("updateend", () => {
        if (!playRequested && !disposed) {
          playRequested = true;
          player.play().catch((err) => {
            if (err.name !== "AbortError") onError(err);
          });
        }
        pump();
      });
      sourceBuffer.addEventListener("error", () => onError(new Error("Audio buffer error")));
      pump();
    } catch (err) {
      onError(err);
    }
  }, { once: true });

  player.onplaying = () => {
    if (!started && !disposed) {
      started = true;
      onStart();
    }
  };
  player.onended = finish;
  player.onerror = () => onError(new Error("Audio playback error"));
  player.src = objectUrl;
  player.load();

  currentAudio = player;
  currentCleanup = dispose;

  return {
    append(base64) {
      if (disposed) return;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      pending.push(bytes);
      pump();
    },
    end() {
      inputEnded = true;
      endStream();
    },
    dispose,
  };
}

/* ------------------------------------------------------------------ *
 *  WEBSOCKET (browser <-> server)
 * ------------------------------------------------------------------ */
let socket = null;
let socketPromise = null;
let reqId = 0;
let activeId = null;
const listeners = new Map(); // requestId -> handler

function getSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (socketPromise) return socketPromise;

  socketPromise = new Promise((resolve, reject) => {
    const s = new WebSocket(WS_URL);
    let opened = false;
    const timer = setTimeout(() => s.close(), 8000);

    s.onopen = () => { opened = true; clearTimeout(timer); socket = s; resolve(s); };
    s.onmessage = (e) => {
      let evt;
      try { evt = JSON.parse(e.data); } catch { return; }
      listeners.get(evt.id)?.(evt);
    };
    s.onclose = () => {
      clearTimeout(timer);
      const wasCurrent = socket === s || !socket;
      if (socket === s) socket = null;
      socketPromise = null;
      if (!opened) reject(new Error("WebSocket connect failed"));
      if (wasCurrent) listeners.forEach((h) => h({ type: "error", error: "Connection lost" }));
    };
    s.onerror = () => {};
  });
  return socketPromise;
}


// export function warmVoiceSocket() {
//   getSocket().catch(() => {});
// }

function sendCancel(id) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "cancel", id }));
}


export function chatWithVoice({
  message,
  history = [],
  gameState = {},
  onStart,
  onEnd,
  onText,
  timeoutMs = 20000,
}) {
  stopVoice();
  const myToken = ++playToken;
  const id = ++reqId;
  activeId = id;

  return new Promise((resolveAnswer, rejectAnswer) => {
    const queue = [];
    let gotAnswer = false;
    let streamDone = false;
    let playing = false;
    let started = false;
    let ended = false;
    let failed = false;
    let streamPlayer = null;

    let finishPlayback;
    const playback = new Promise((r) => (finishPlayback = r));
    let timeoutId = setTimeout(() => fail(new Error("Chat timeout")), timeoutMs);

    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timeoutId);
      listeners.delete(id);
      if (activeId === id) activeId = null;
      if (started) onEnd?.();
      streamPlayer?.dispose();
      finishPlayback();
    };

    const startContinuousPlayback = () => createStreamPlayer({
      onStart: () => {
        if (!started && !cancelled()) {
          started = true;
          onStart?.();
        }
      },
      onEnd: finish,
      onError: fail,
    });

    streamPlayer = startContinuousPlayback();

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

    function fail(err) {
      if (failed || ended) return;
      failed = true;
      if (cancelled()) {
        if (!gotAnswer) rejectAnswer(Object.assign(new Error("cancelled"), { name: "CancelledError" }));
        return finish();
      }
      sendCancel(id);
      if (!gotAnswer) {
        clearTimeout(timeoutId);
        rejectAnswer(err);
        if (streamPlayer) {
          streamPlayer.dispose();
          streamPlayer = null;
          killCurrentAudio();
        }
        return finish();
      }
      console.error("Voice stream error:", err);
      streamDone = true;
      if (streamPlayer) {
        streamPlayer.dispose();
        streamPlayer = null;
        killCurrentAudio();
        return finish();
      }
      if (!playing && queue.length === 0) finish();
    }

    const handleEvent = (evt) => {
      if (evt.type === "answer") {
        gotAnswer = true;
        clearTimeout(timeoutId);
        resolveAnswer({
          data: { answer: evt.answer, gameState: evt.gameState, image: evt.image },
          playback,
        });
      } 
      
      // else if (evt.type === "text") {
      //   onText?.(evt.delta);
      // } 
      
      else if (evt.type === "replace") {
        queue.length = 0;
        streamPlayer?.dispose();
        streamPlayer = null;
        if (currentAudio) {
          currentResolve = null;
          killCurrentAudio();
        }
        playing = false;
        streamPlayer = startContinuousPlayback();
      } else if (evt.type === "audio") {
        if (streamPlayer) streamPlayer.append(evt.audio);
        else {
          queue.push(evt.audio);
          playNext();
        }
      } else if (evt.type === "done") {
        streamDone = true;
        if (streamPlayer) streamPlayer.end();
        else if (!playing && queue.length === 0) finish();
        else playNext();
      } else if (evt.type === "error") {
        fail(new Error(evt.error || "Chat failed"));
      } else if (evt.type === "cancelled") {
        fail(new Error("cancelled"));
      }
    };

    listeners.set(id, handleEvent);

    getSocket()
      .then((s) => {
        console.log("main ", s)
        if (cancelled()) return;
        s.send(JSON.stringify({ type: "chat", id, message, history, gameState }));
      })
      .catch(fail);
  });
}


// export async function playNaturalVoice(text, setSpeaking = null, options = {}) {
//   const { onStart, onEnd } = options;
//   const myToken = ++playToken;
//   const myCall = ++callId;

//   killCurrentAudio();

//   let started = false;
//   let timeoutId;
//   if (setSpeaking) setSpeaking(true);

//   try {
//     const controller = new AbortController();
//     timeoutId = setTimeout(() => controller.abort(), 15000);

//     const res = await fetch(`${API_BASE}/api/speak`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ text: text?.slice(0, 1000) }),
//       signal: controller.signal,
//     });

//     clearTimeout(timeoutId);

//     if (myToken !== playToken) return;
//     if (!res.ok) throw new Error(`Voice generation failed: ${res.status}`);

//     const data = await res.json();
//     if (!data.audio) throw new Error("No audio received");
//     if (myToken !== playToken) return;

//     const audio = loadPlayer(`data:audio/mpeg;base64,${data.audio}`);
//     currentAudio = audio;

//     await new Promise((resolve, reject) => {
//       currentResolve = resolve;

//       audio.onplaying = () => {
//         if (!started && myToken === playToken) {
//           started = true;
//           onStart?.();
//         }
//       };
//       audio.onended = () => resolve();
//       audio.onerror = () => reject(new Error("Audio playback error"));

//       audio.play().catch(reject);
//     });
//   } catch (err) {
//     if (err.name === "AbortError") {
//       console.error("Voice generation timed out");
//     } else {
//       console.error("Voice generation failed:", err);
//     }
//     throw err;
//   } finally {
//     clearTimeout(timeoutId);
//     if (started) onEnd?.();
//     if (myToken === playToken) {
//       currentAudio = null;
//       currentResolve = null;
//     }

//     if (myCall === callId && setSpeaking) setSpeaking(false);
//   }
// }

/* ------------------------------------------------------------------ *
 *  STOP (bot ki awaaz + server ka kaam dono band)
 * ------------------------------------------------------------------ */
export function stopVoice() {
  playToken++;
  const id = activeId;
  activeId = null;
  if (id !== null) {
    sendCancel(id);                              // server: LLM/Fish ka kaam band
    listeners.get(id)?.({ type: "cancelled" });  // promise settle karo
    listeners.delete(id);
  }
  killCurrentAudio();
}
