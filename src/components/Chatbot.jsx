import React, { useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

const API_URL = "https://bot-ai-1-372t.onrender.com/api/chat";
const SPEAK_URL = "https://bot-ai-1-372t.onrender.com/api/speak";

async function playNaturalVoice(text) {
  try {
    const res = await fetch(SPEAK_URL, {
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

    await audio.play();
  } catch (err) {
    console.error("Auto-speak failed:", err);
  }
}

function Chatbot() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hi! You can ask me anything about the Kikoo contest.",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const handleSend = async (userText, voiceMode = false) => {
    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: userText,
      },
    ]);

    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat API failed");
      }

      const data = await res.json();

      const answer =
        data.answer || "Sorry, something went wrong.";

      // Show AI text response
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: answer,
        },
      ]);

      // 🔊 Only speak if question came from microphone
      if (voiceMode) {
        await playNaturalVoice(answer);
      }

    } catch (err) {
      console.error("Chat Error:", err);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Unable to connect to the server. Please try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        w-[340px]
        h-[480px]
        border
        border-[#ddd]
        rounded-[16px]
        flex
        flex-col
        shadow-[0_4px_20px_rgba(0,0,0,0.1)]
        font-sans
        overflow-hidden
      "
    >
      <div
        className="
          bg-[#ff4e7d]
          text-white
          px-4
          py-3
          font-bold
        "
      >
        Kikoo Support
      </div>

      <div
        className="
          flex-1
          overflow-y-auto
          p-3
        "
      >
        {messages.map((m, i) => (
          <ChatMessage
            key={i}
            sender={m.sender}
            text={m.text}
          />
        ))}

        {loading && (
          <ChatMessage
            sender="bot"
            text="Typing..."
          />
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={loading}
      />
    </div>
  );
}

export default Chatbot;