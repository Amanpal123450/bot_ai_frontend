import { AudioLines, Mic, MicOff, Send, X } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { stopVoice } from "../utils/voice";

const MAX_RETRY_ATTEMPTS = 3;
const RESTART_DELAY = 400; // 🔑 mic restart se pehle chhota gap — InvalidStateError avoid karta hai
const suggestions = [
  {
    label: "🎨 Drawing",
    message: "Draw something for me",
  },
  {
    label: "🔢 Math Game",
    message: "Start a math game",
  },
  {
    label: "🎮 Quiz Game",
    message: "Start a quiz game",
  },
  {
    label: "🧩 Riddles",
    message: "Tell me a riddle",
  },
  {
    label: "🐾 Guess the Animal",
    message: "Start a Guess the Animal game",
  },
  {
    label: "🐶 Animal Sounds",
    message: "Start an animal sounds game",
  },
  {
    label: "🌍 Geography Challenge",
    message: "Start a geography challenge",
  },
  {
    label: "🧩 Counting Game",
    message: "Start a counting game",
  },
  {
    label: "🔤 Spelling Challenge",
    message: "Start a spelling challenge",
  },
  {
    label: "🎵 Play a Poem",
    message: "Play a poem",
  },
  {
    label: "😂 Tell Me a Joke",
    message: "Tell me a joke",
  },
  {
    label: "🎮 Learning Games",
    message: "Start a learning game",
  },
  {
    label: "🔗 Word Chain",
    message: "Start a word chain game",
  },
  {
    label: "🎨 Colors & Shapes",
    message: "Start a colors and shapes game",
  },
  {
    label: "🔤 Alphabet",
    message: "Start an alphabet game",
  },
  {
    label: "📚 Vocabulary Builder",
    message: "Start a vocabulary builder game",
  },
];

function ChatInput({ onSend, disabled, onTypingChange, portalTarget }) {
  const [text, setText] = useState("");
  const [quickListening, setQuickListening] = useState(false);
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [voiceState, setVoiceState] = useState("listening"); // listening | thinking | speaking

  const recognitionRef = useRef(null);
  const voiceModeRef = useRef(false);
  const SpeechRecognitionRef = useRef(null);
  const retryCountRef = useRef(0);
  const typingTimerRef = useRef(null);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;          // hamesha latest onSend (purana state na pakde)
  const heardRef = useRef("");         // mic ne jo suna wo yahan

  const notifyTyping = () => {
    onTypingChange?.(true);
    clearTimeout(typingTimerRef.current);
    // 1.5 sec tak kuch type nahi kiya to typing band
    typingTimerRef.current = setTimeout(() => onTypingChange?.(false), 1500);
  };

  const stopTyping = () => {
    clearTimeout(typingTimerRef.current);
    onTypingChange?.(false);
  };

  useEffect(() => {
    return () => {
      voiceModeRef.current = false;
      heardRef.current = "";
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      clearTimeout(typingTimerRef.current);
      stopVoice();
    };
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    stopTyping();
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

    // Mic chal raha ho aur dobara dabaya -> ruk jao (jo suna wo bhej diya jayega)
    if (quickListening) {
      recognitionRef.current?.stop();
      return;
    }

    stopVoice();            // bot ki awaaz band, warna mic wahi sun lega
    heardRef.current = "";

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setQuickListening(true);

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      heardRef.current = transcript.trim();
      setText(heardRef.current); // bolte waqt text box mein dikhta rahega
    };

    recognition.onerror = () => {
      heardRef.current = "";   // error mein adhoora text mat bhejo
      setText("");
      setQuickListening(false);
    };

    // 🔑 Bolna khatam -> AUTO SEND
    recognition.onend = () => {
      setQuickListening(false);
      recognitionRef.current = null;

      const spoken = heardRef.current.trim();
      heardRef.current = "";
      if (spoken) {
        stopTyping();
        setText("");
        onSendRef.current?.(spoken, false);
      }
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

  const handleSuggestionWheel = (e) => {
    const container = e.currentTarget;

    if (e.deltaY !== 0) {
      container.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  // 👇 Suggestions + input row. Component ke ANDAR hai, taaki state/handlers mil sakein.
  const inputBlocks = (
    <>
      {/* Suggestions */}
      {!voiceModeOn && (
        <div className="px-3 pt-2 pb-2">
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x"
            onWheel={handleSuggestionWheel}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x",
            }}
          >
            {suggestions.map((item) => (
              <button
                key={item.message}
                type="button"
                disabled={disabled}
                onClick={() => onSend?.(item.message)}
                className="
  shrink-0 rounded-full border border-[#ff4e7d] bg-white
  px-3 py-1.5 text-[12px] sm:px-2 sm:py-1 sm:text-[10px]
  font-medium text-[#ff4e7d]
  hover:bg-[#fff0f4] transition cursor-pointer
  disabled:opacity-50 disabled:cursor-not-allowed
"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input row */}
      {!voiceModeOn && (
        <div className="flex items-center border-t border-[#eee] p-[10px]">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value) notifyTyping();
              else stopTyping();
            }}
            onBlur={stopTyping}
            onKeyDown={handleKeyDown}
            placeholder={
              quickListening ? "Listening..." : "Type your message..."
            }
            disabled={disabled}
            className={`min-w-0 flex-1 rounded-[20px] border px-3 py-[10px] text-[16px] sm:text-[14px] outline-none ${
  quickListening ? "border-[#4285F4]" : "border-[#ddd]"
}`}
          />

          <button
            onClick={handleQuickMicClick}
            disabled={disabled}
            title="Voice to text"
            className={`ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 cursor-pointer transition ${
              quickListening
                ? "bg-[#4285F4] text-white"
                : "bg-[#eee] text-[#555]"
            }`}
          >
            {quickListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* <button
            onClick={handleVoiceConversationClick}
            disabled={disabled}
            title="Start voice conversation"
            className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0 bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AudioLines size={18} />
          </button> */}

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
    </>
  );

  return (
    <>
      {/* portalTarget mila to model ke neeche, warna chatbot ke andar hi */}
      {portalTarget ? createPortal(inputBlocks, portalTarget) : inputBlocks}

      {/* Voice overlay chatbot ke andar hi rahega */}
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