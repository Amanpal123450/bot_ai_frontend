import React, { useState, useRef } from "react";
// import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { chatWithVoice } from "../utils/voice";

let idCounter = 0;
const genId = () => ++idCounter;
function Chatbot({ onSpeakingChange, onTypingChange, onThinkingChange, inputTarget }) {
  const [messages, setMessages] = useState([
    {
      id: genId(),
      sender: "bot",
      text: "Hi! You can ask me anything about the Kikoo contest.",
    },
  ]);
  const reqRef = useRef(0);
  const [gameState, setGameState] = useState({});
  const [loading, setLoading] = useState(false);
  const HISTORY_LIMIT = 8;

  const handleSend = async (userText, voiceMode = false, onStatusChange) => {
    const myReq = ++reqRef.current;
    const stopThinking = () => {
      if (reqRef.current === myReq) onThinkingChange?.(false);
    };

    setMessages((prev) => [...prev, { id: genId(), sender: "user", text: userText }]);
    setLoading(true);
    onThinkingChange?.(true);      
    onStatusChange?.("thinking");

    try {
      const { data, playback } = await chatWithVoice({
        message: userText,
        history: messages.slice(-HISTORY_LIMIT).map((m) => ({
          id: m.id, sender: m.sender, text: m.text,
        })),
        gameState,
        onStart: () => {
          stopThinking();          
          onSpeakingChange?.(true);
          onStatusChange?.("speaking");
        },
        onEnd: () => onSpeakingChange?.(false),
      });

      const answer = data.answer || "Sorry, something went wrong.";
      setGameState(data.gameState || {});
      setMessages((prev) => [
        ...prev,
        { id: genId(), sender: "bot", text: answer, image: data.image || null },
      ]);
      setLoading(false);

      playback.then(stopThinking);  
      if (voiceMode) await playback;
    } catch (err) {
      stopThinking();            
      if (err.name === "CancelledError") return;

      const message =
        err.name === "AbortError"
          ? "Server is taking too long to respond. Please try again."
          : "Unable to connect to the server. Please try again later.";
      console.error("Chat Error:", err);
      setMessages((prev) => [...prev, { id: genId(), sender: "bot", text: message }]);
      setLoading(false);
    }
  };

  return (
   
<div
  style={{ display: "none" }}
  className="relative flex h-[480px] max-h-[70dvh] w-full max-w-full flex-col overflow-hidden rounded-[16px] border border-[#ddd] font-sans shadow-[0_4px_20px_rgba(0,0,0,0.1)] sm:w-[340px]"
>
      <div className="bg-[#ff4e7d] text-white px-4 py-3 font-bold">
        Kikoo Support
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* {messages.map((m) => (
          <ChatMessage
            key={m.id}
            sender={m.sender}
            text={m.text}
            image={m.image}
            onSend={handleSend}
            onSpeakingChange={onSpeakingChange}
          />
        ))}
        {loading && <ChatMessage sender="bot" text="Typing..." />} */}
        {/* Tap "Talk to Kikoo" and start speaking 🎤 */}
      </div>

      <ChatInput onSend={handleSend} disabled={loading} onTypingChange={onTypingChange} portalTarget={inputTarget} />
    </div>
  );
}

export default Chatbot;