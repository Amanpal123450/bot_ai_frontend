import React, { useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

const API_URL = "https://bot-ai-1-372t.onrender.com/api/chat";

function Chatbot() {
  const [messages, setMessages] = useState([
  {
    sender: "bot",
    text: "Hi! You can ask me anything about the Kikoo contest."
  },
]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (userText) => {
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.answer || "Sorry, something went wrong." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Unable to connect to the server. Please try again later." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: 340,
        height: 480,
        border: "1px solid #ddd",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          backgroundColor: "#ff4e7d",
          color: "#fff",
          padding: "12px 16px",
          fontWeight: "bold",
        }}
      >
        Kikoo Support
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m, i) => (
          <ChatMessage key={i} sender={m.sender} text={m.text} />
        ))}
        {loading && <ChatMessage sender="bot" text="Typing..." />}
      </div>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

export default Chatbot;
