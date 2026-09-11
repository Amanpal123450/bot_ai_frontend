import { Mic, MicOff, Send } from "lucide-react";
import React, { useState, useRef } from "react";

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();

    if (!trimmed) return;

    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  const handleMicClick = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
       "Your browser does not support voice input. Please try Chrome."
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "hi-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="flex items-center border-t border-[#eee] p-[10px]">
      
      {/* Input */}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          listening
            ? "Listening..."
            : "Type your message..."
        }
        disabled={disabled}
        className={`
          min-w-0
          flex-1
          rounded-[20px]
          border
          px-3
          py-[10px]
          text-[14px]
          outline-none
          ${
            listening
              ? "border-[#ff4e7d]"
              : "border-[#ddd]"
          }
        `}
      />

       <button
        onClick={handleMicClick}
        disabled={disabled}
        title={listening ? "Listening..." : "Voice input"}
        className={`
          ml-2
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-full
          border-0
          transition
          ${
            listening
              ? "bg-[#ff4e7d] text-white"
              : "bg-[#eee] text-[#555]"
          }
          ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:opacity-80"
          }
        `}
      >
        {listening ? (
          <MicOff size={18} />
        ) : (
          <Mic size={18} />
        )}
      </button>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={disabled}
        title="Send"
        className="
          ml-2
          flex
          items-center
          justify-center
          gap-2
          rounded-[20px]
          border-0
          bg-[#ff4e7d]
          px-[18px]
          py-[10px]
          font-bold
          text-white
          cursor-pointer
          transition
          hover:opacity-90
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        <Send size={16} />
        <span className="text-sm">Send</span>
      </button>
    </div>
  );
}

export default ChatInput;