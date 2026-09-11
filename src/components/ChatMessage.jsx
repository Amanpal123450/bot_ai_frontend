import { Loader2, Volume2 } from "lucide-react";
import React, { useState } from "react";

const API_BASE = "https://bot-ai-oygp.onrender.com";

async function playNaturalVoice(text, setSpeaking) {
  try {
    setSpeaking(true);

    const res = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);

    audio.onended = () => setSpeaking(false);

    audio.play();
  } catch (err) {
    setSpeaking(false) ;

    alert("Voice generate nahi ho paayi. Baad mein try karein.")
  }
}

function ChatMessage({ sender, text }) {
  const isUser = sender === "user";
  const [speaking, setSpeaking] = useState(false);

  return (
    <div
      className={`
        flex
        items-center
        my-[6px]
        ${isUser ? "justify-end" : "justify-start"}
      `}
    >
      {/* Message Bubble */}
      <div
        className={`
          max-w-[75%]
          px-[14px]
          py-[10px]
          rounded-[14px]
          text-[14px]
          leading-[1.4]
          ${isUser ? "bg-[#ff4e7d] text-white" : "bg-[#f1f1f4] text-[#222]"}
        `}
      >
        {text}
      </div>

      {/* Speaker Button - Bot only */}
      {!isUser && (
        <button
          onClick={() => playNaturalVoice(text, setSpeaking)}
          disabled={speaking}
          title="Sunein"
          className={`
            ml-[6px]
            border-0
            bg-transparent
            text-base
            ${
              speaking
                ? "cursor-default opacity-50"
                : "cursor-pointer opacity-100"
            }
          `}
        >
          {speaking ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Volume2 size={17} />
          )}
        </button>
      )}
    </div>
  );
}

export default ChatMessage;
