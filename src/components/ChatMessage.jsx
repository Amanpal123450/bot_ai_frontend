import React from "react";

function ChatMessage({ sender, text }) {
  const isUser = sender === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        margin: "6px 0",
      }}
    >
      <div
        style={{
          maxWidth: "75%",
          padding: "10px 14px",
          borderRadius: 14,
          backgroundColor: isUser ? "#ff4e7d" : "#f1f1f4",
          color: isUser ? "#fff" : "#222",
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export default ChatMessage;
