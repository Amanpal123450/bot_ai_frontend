import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import KikooModel from "./3D_model/KikooModel";

function App() {
  const [speaking, setSpeaking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [inputTarget, setInputTarget] = useState(null);
  const [thinking, setThinking] = useState(false);

  return (
    <div className="font-sans">
      {/* <h1 className="p-5 text-2xl font-bold">Kikoo Website (example page)</h1> */}

      {/* Mobile: full width bottom sheet | Desktop: bottom-right floating */}
      <div className="fixed inset-x-0 bottom-0 z-[1000] flex items-stretch pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:pb-0">
        {/* Left column: upar model, neeche suggestions + input */}
        <div className="flex w-full flex-col sm:w-[380px]">
        <div className="relative h-[400px] max-h-[580px] overflow-hidden rounded-t-2xl sm:h-[520px] sm:max-h-none sm:rounded-2xl md:h-[320px]">
  <KikooModel speaking={speaking} typing={typing} thinking={thinking} />
</div>

          {/* ChatInput ke blocks yahan aayenge */}
          <div
            ref={setInputTarget}
            className="mt-0  overflow-hidden rounded-t-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)] sm:rounded-2xl"
          />
        </div>

       <Chatbot
  onSpeakingChange={setSpeaking}
  onTypingChange={setTyping}
  onThinkingChange={setThinking}
  inputTarget={inputTarget}
/>
      </div>
    </div>
  );
}

export default App;