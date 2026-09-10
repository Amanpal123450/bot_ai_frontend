import React, { useState } from "react";

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div style={{ display: "flex", padding: 10, borderTop: "1px solid #eee" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Apna sawal likhein..."
        disabled={disabled}
        style={{
          flex: 1,
          padding: "10px 12px",
          borderRadius: 20,
          border: "1px solid #ddd",
          outline: "none",
          fontSize: 14,
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled}
        style={{
          marginLeft: 8,
          padding: "10px 18px",
          borderRadius: 20,
          border: "none",
          backgroundColor: "#ff4e7d",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}

export default ChatInput;
