const API_BASE = "http://localhost:3001";

export async function playNaturalVoice(text, setSpeaking = null) {
  try {
    if (setSpeaking) {
      setSpeaking(true);
    }

    const res = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error("Voice generation failed");
    }

    const data = await res.json();

    if (!data.audio) {
      throw new Error("No audio received");
    }

    const audio = new Audio(
      `data:audio/wav;base64,${data.audio}`
    );

    audio.onended = () => {
      if (setSpeaking) {
        setSpeaking(false);
      }
    };

    audio.onerror = () => {
      if (setSpeaking) {
        setSpeaking(false);
      }
    };

    await audio.play();

    return audio;
  } catch (err) {
    if (setSpeaking) {
      setSpeaking(false);
    }

    console.error("Voice generation failed:", err);

    throw err;
  }
}