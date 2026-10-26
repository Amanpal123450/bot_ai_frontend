import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import KikooModel from "./3D_model/KikooModel";

function App() {
  const [speaking, setSpeaking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [inputTarget, setInputTarget] = useState(null); // model ke neeche wali jagah

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <h1 style={{ padding: 20 }}>Kikoo Website (example page)</h1>

      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          display: "flex",
          alignItems: "stretch",
        }}
      >
        {/* Left column: upar model, neeche suggestions + input */}
        <div style={{ width: 380, display: "flex", flexDirection: "column" }}>
         <div style={{ position: "relative", height: 420 }}>
  <KikooModel speaking={speaking} typing={typing} />
</div>

          {/* ChatInput ke blocks yahan aayenge */}
          <div
            ref={setInputTarget}
            style={{
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              marginTop: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            }}
          />
        </div>

        <Chatbot
          onSpeakingChange={setSpeaking}
          onTypingChange={setTyping}
          inputTarget={inputTarget}
        />
      </div>
    </div>
  );
}

export default App;