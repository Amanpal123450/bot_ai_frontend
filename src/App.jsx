import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import KikooModel from "./3D_model/KikooModel";

function App() {
  const [speaking, setSpeaking] = useState(false);
  const [typing, setTyping] = useState(false);

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <h1 style={{ padding: 20 }}>Kikoo Website (example page)</h1>

      <KikooModel speaking={speaking} typing={typing} />

      <div style={{ position: "fixed", bottom: 20, right: 20 }}>
        <Chatbot onSpeakingChange={setSpeaking} onTypingChange={setTyping} />
      </div>
    </div>
  );
}

export default App;