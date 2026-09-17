import { AudioLines, Mic, MicOff, Send, X } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { stopVoice } from "../utils/voice";

const MAX_RETRY_ATTEMPTS = 3;
const RESTART_DELAY = 400; // 🔑 mic restart se pehle chhota gap — InvalidStateError avoid karta hai

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [quickListening, setQuickListening] = useState(false);
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [voiceState, setVoiceState] = useState("listening"); // listening | thinking | speaking

  const recognitionRef = useRef(null);
  const voiceModeRef = useRef(false);
  const SpeechRecognitionRef = useRef(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    return () => {
      voiceModeRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      stopVoice();
    };
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, false);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  const handleQuickMicClick = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please try Chrome.");
      return;
    }

    if (quickListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setQuickListening(true);

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(transcript.trim());
    };

    recognition.onerror = () => setQuickListening(false);

    recognition.onend = () => {
      setQuickListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Recognition start error:", error);
      setQuickListening(false);
    }
  };

  // 🔑 YE FUNCTION AB "CONTINUOUS LOOP" KA ENGINE HAI
  const handleVoiceConversationClick = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please try Chrome.");
      return;
    }

    if (voiceModeRef.current) return;

    voiceModeRef.current = true;
    SpeechRecognitionRef.current = SpeechRecognition;
    retryCountRef.current = 0;

    setVoiceModeOn(true);
    setVoiceState("listening");
    startVoiceRecognition();
  };

  const startVoiceRecognition = () => {
    // 🔑 Jab tak "Kikoo Voice" screen open hai (voiceModeRef true hai),
    // tab tak ye function baar-baar khud ko call karta rahega —
    // yahi continuous voice chat ka core hai.
    const SpeechRecognition = SpeechRecognitionRef.current;
    if (!SpeechRecognition || !voiceModeRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState("listening");
      console.log("🎤 Listening...");
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (!transcript) return;

      retryCountRef.current = 0;
      setText(transcript);
      setVoiceState("thinking");

      try {
  
        await onSend(transcript, true, (status) => {
          if (voiceModeRef.current) setVoiceState(status);
        });
      } catch (err) {
        console.error("onSend error in voice mode:", err);
      }

      // 🔑 Bot bol chuka -> agla sawaal sunne ke liye dobara start karo
      // (chhota delay taaki browser ko "already started" error na aaye)
      if (voiceModeRef.current) {
        setVoiceState("listening");
        setTimeout(() => {
          if (voiceModeRef.current) startVoiceRecognition();
        }, RESTART_DELAY);
      }
    };

    recognition.onerror = (event) => {
      console.error("❌ Speech recognition error:", event.error);
      if (!voiceModeRef.current) return;

      retryCountRef.current += 1;

      if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        console.warn("Max retry attempts reached. Stopping voice mode.");
        closeVoiceMode();
        alert("Voice recognition is having trouble. Please try again.");
        return;
      }

      const delay = event.error === "no-speech" ? 500 : 1000;
      setTimeout(() => {
        if (voiceModeRef.current) startVoiceRecognition();
      }, delay);
    };

    recognition.onend = () => {
      console.log("🎤 Recognition ended");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Recognition start error:", error);
      recognitionRef.current = null;

      retryCountRef.current += 1;
      if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        closeVoiceMode();
        return;
      }

      if (voiceModeRef.current) {
        setTimeout(() => startVoiceRecognition(), 1000);
      }
    }
  };

  const closeVoiceMode = () => {
    voiceModeRef.current = false; // 🔑 isse loop turant ruk jaata hai — koi bhi pending restart ye check karke khud rukega
    retryCountRef.current = 0;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    stopVoice();

    setVoiceModeOn(false);
    setVoiceState("listening");
    setText("");
  };

  return (
    <>
      {!voiceModeOn && (
        <div className="flex items-center border-t border-[#eee] p-[10px]">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={quickListening ? "Listening..." : "Type your message..."}
            disabled={disabled}
            className={`min-w-0 flex-1 rounded-[20px] border px-3 py-[10px] text-[14px] outline-none ${
              quickListening ? "border-[#4285F4]" : "border-[#ddd]"
            }`}
          />

          <button
            onClick={handleQuickMicClick}
            disabled={disabled}
            title="Voice to text"
            className={`ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 cursor-pointer transition ${
              quickListening ? "bg-[#4285F4] text-white" : "bg-[#eee] text-[#555]"
            }`}
          >
            {quickListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            onClick={handleVoiceConversationClick}
            disabled={disabled}
            title="Start voice conversation"
            className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0 bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AudioLines size={18} />
          </button>

          <button
            onClick={handleSend}
            disabled={disabled}
            title="Send"
            className="ml-2 flex items-center justify-center gap-2 rounded-[20px] border-0 bg-[#ff4e7d] px-[18px] py-[10px] font-bold text-white cursor-pointer"
          >
            <Send size={16} />
            <span className="text-sm">Send</span>
          </button>
        </div>
      )}

      {voiceModeOn && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#171717] text-white">
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4">
            <div className="text-sm text-gray-300">Kikoo Voice</div>
            <button
              onClick={closeVoiceMode}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-gray-200"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div
              className={`absolute h-40 w-40 rounded-full bg-blue-500 opacity-20 blur-3xl ${
                voiceState !== "listening" ? "animate-ping" : "animate-pulse"
              }`}
            />
            <div className="relative h-28 w-28 rounded-full bg-gradient-to-b from-indigo-500 via-blue-200 to-blue-300 shadow-[0_0_50px_rgba(100,150,255,0.5)] animate-pulse" />
          </div>

          <div className="mt-10 text-lg font-medium">
            {voiceState === "listening" && "Listening..."}
            {voiceState === "thinking" && "Thinking..."}
            {voiceState === "speaking" && "Speaking..."}
          </div>

          <div className="mt-2 text-sm text-gray-400">
            {voiceState === "listening" && "Speak now"}
            {voiceState === "thinking" && "Please wait..."}
            {voiceState === "speaking" && "Kikoo is replying"}
          </div>

          <button
            onClick={closeVoiceMode}
            className="absolute bottom-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#333] text-white hover:bg-[#444]"
          >
            <MicOff size={22} />
          </button>
        </div>
      )}
    </>
  );
}

export default ChatInput;