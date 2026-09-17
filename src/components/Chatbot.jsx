import React, { useState, useRef } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { playNaturalVoice } from "../utils/voice";

const API_URL = `${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/chat`;

let idCounter = 0;
const genId = () => ++idCounter;

function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: genId(),
      sender: "bot",
      text: "Hi! You can ask me anything about the Kikoo contest.",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  // 🔑 Teesra param onStatusChange — voice mode se hi aata hai
  const handleSend = async (userText, voiceMode = false, onStatusChange) => {
    setMessages((prev) => [
      ...prev,
      { id: genId(), sender: "user", text: userText },
    ]);

    setLoading(true);
    onStatusChange?.("thinking");

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Chat API failed: ${res.status}`);

      const data = await res.json();
      const answer = data.answer || "Sorry, something went wrong.";

      setMessages((prev) => [
        ...prev,
        { id: genId(), sender: "bot", text: answer },
      ]);

      setLoading(false);

      if (voiceMode) {
        onStatusChange?.("speaking");
        try {
          // 🔑 IMPORTANT: ye await hone tak function return nahi hoga,
          // isliye ChatInput.jsx ka mic tabhi dobara start hoga jab awaaz poori baj chuki ho.
          await playNaturalVoice(answer);
        } catch {
          // voice fail ho jaye to bhi conversation aage badhe
        }
      }
    } catch (err) {
      const message =
        err.name === "AbortError"
          ? "Server is taking too long to respond. Please try again."
          : "Unable to connect to the server. Please try again later.";

      console.error("Chat Error:", err);

      setMessages((prev) => [
        ...prev,
        { id: genId(), sender: "bot", text: message },
      ]);

      setLoading(false);

      if (voiceMode) {
        onStatusChange?.("speaking");
        try {
          await playNaturalVoice(message);
        } catch {
          // ignore
        }
      }
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="w-[340px] h-[480px] border border-[#ddd] rounded-[16px] flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.1)] font-sans overflow-hidden">
      <div className="bg-[#ff4e7d] text-white px-4 py-3 font-bold">
        Kikoo Support
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} sender={m.sender} text={m.text} />
        ))}
        {loading && <ChatMessage sender="bot" text="Typing..." />}
      </div>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

export default Chatbot;