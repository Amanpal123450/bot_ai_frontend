import { AudioLines, Mic, MicOff, Send, X } from "lucide-react";
import React, { useState, useRef } from "react";

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [quickListening, setQuickListening] = useState(false); // gray mic button
  const [voiceModeOn, setVoiceModeOn] = useState(false); // blue AudioLines button

  const recognitionRef = useRef(null);

  // Normal text send
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, false); // false = text mode
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  // Close / stop voice conversation mode
  // const closeVoiceMode = () => {
  //   recognitionRef.current?.stop();
  //   recognitionRef.current = null;
  //   setVoiceModeOn(false);
  // };

  // ============================
  // GRAY MIC BUTTON — quick voice-to-text only.
  // Fills the input box, does NOT auto-send, does NOT trigger voice reply.
  // ============================
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
    recognition.lang = "hi-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setQuickListening(true);

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(transcript.trim()); // just fills the box, user can edit + send manually
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

  // ============================
  // BLUE AUDIOLINES BUTTON — full Gemini-style voice conversation.
  // Auto-sends the transcript and asks the bot to reply back in voice.
  // ============================
  const handleVoiceConversationClick = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("🎤 Voice mode started");
      setVoiceModeOn(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      transcript = transcript.trim();

      if (transcript && event.results[event.results.length - 1].isFinal) {
        console.log("✅ Final voice:", transcript);
        setText(transcript);

        // 🔥 true = voice mode → bot will reply back in voice too
        onSend(transcript, true);

        setVoiceModeOn(false);
        recognition.stop();
      }
    };

    recognition.onerror = (event) => {
      console.error("❌ Speech error:", event.error);
      setVoiceModeOn(false);
      if (event.error === "no-speech") {
        console.log("Kuch suna nahi. Dobara try karein.");
      }
    };

    recognition.onend = () => {
      console.log("🎤 Recognition ended");
      setVoiceModeOn(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Recognition start error:", error);
      setVoiceModeOn(false);
    }
  };

  return (
    <>
      {/* ============================= */}
      {/* NORMAL CHAT INPUT */}
      {/* ============================= */}

      {!voiceModeOn && (
        <div className="flex items-center border-t border-[#eee] p-[10px]">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              quickListening ? "Listening..." : "Type your message..."
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
              ${quickListening ? "border-[#4285F4]" : "border-[#ddd]"}
            `}
          />

          {/* GRAY MIC — quick voice-to-text, no auto-send, no voice reply */}
          <button
            onClick={handleQuickMicClick}
            disabled={disabled}
            title="Voice to text"
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
              cursor-pointer
              transition
              ${quickListening ? "bg-[#4285F4] text-white" : "bg-[#eee] text-[#555]"}
            `}
          >
            {quickListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* BLUE AUDIOLINES — full Gemini-style voice conversation */}
          {/* <button
            onClick={handleVoiceConversationClick}
            disabled={disabled}
            title="Start voice conversation"
            className="
              ml-2 flex h-10 w-10 shrink-0 items-center justify-center
              rounded-xl border-0 bg-blue-500 text-white cursor-pointer
              hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <AudioLines size={18} />
          </button> */}

          {/* SEND */}
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
            "
          >
            <Send size={16} />
            <span className="text-sm">Send</span>
          </button>
        </div>
      )}

      {/* ============================= */}
      {/* GEMINI STYLE VOICE MODE (only from blue button) */}
      {/* ============================= */}

      {voiceModeOn && (
        <div
          className="
            absolute
            inset-0
            z-50
            flex
            flex-col
            items-center
            justify-center
            bg-[#171717]
            text-white
          "
        >
          {/* TOP BAR */}
          <div
            className="
              absolute
              top-0
              left-0
              right-0
              flex
              items-center
              justify-between
              px-4
              py-4
            "
          >
            <div className="text-sm text-gray-300">Kikoo Voice</div>

            <button
              onClick={closeVoiceMode}
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                bg-white
                text-black
                hover:bg-gray-200
              "
            >
              <X size={20} />
            </button>
          </div>

          {/* AI ORB */}
          <div className="relative flex items-center justify-center">
            <div
              className="
                absolute
                h-40
                w-40
                rounded-full
                bg-blue-500
                opacity-20
                blur-3xl
                animate-pulse
              "
            />
            <div
              className="
                relative
                h-28
                w-28
                rounded-full
                bg-gradient-to-b
                from-indigo-500
                via-blue-200
                to-blue-300
                shadow-[0_0_50px_rgba(100,150,255,0.5)]
                animate-pulse
              "
            />
          </div>

          {/* STATUS */}
          <div className="mt-10 text-lg font-medium">Listening...</div>

          <div className="mt-2 text-sm text-gray-400">Speak now</div>

          {/* MIC BUTTON */}
          <button
            onClick={closeVoiceMode}
            className="
              absolute
              bottom-7
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-full
              bg-[#333]
              text-white
              hover:bg-[#444]
            "
          >
            <MicOff size={22} />
          </button>
        </div>
      )} 
    </>
  );
}

export default ChatInput;
