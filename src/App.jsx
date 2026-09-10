// frontend/App.jsx
//
// Example page showing the chatbot in the corner of the screen,
// the way it would sit on the real Kikoo website.

import React from "react";
import Chatbot from "./components/Chatbot";

function App() {
  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <h1 style={{ padding: 20 }}>Kikoo Website (example page)</h1>

      <div style={{ position: "fixed", bottom: 20, right: 20 }}>
        <Chatbot />
      </div>
    </div>
  );
}

export default App;
