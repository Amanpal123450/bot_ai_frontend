import { Loader2, Volume2 } from "lucide-react";
import React, { useState } from "react";
import { playNaturalVoice } from "../utils/voice";

function renderTextWithLinks(text) {
  if (!text) return null;

  const urlRegex =
    /((?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/[^\s]+|youtube\.com\/[^\s]+|youtu\.be\/[^\s]+|kikoo\.in\/?[^\s]*))/gi;

  return text.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      const cleanUrl = part.replace(/[.,!?;:]+$/, "");
      const punctuation = part.slice(cleanUrl.length);

      const href = cleanUrl.startsWith("http")
        ? cleanUrl
        : `https://${cleanUrl}`;

      return (
        <React.Fragment key={index}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {cleanUrl}
          </a>
          {punctuation}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={index}>
        {part}
      </React.Fragment>
    );
  });
}

function ChatMessage({ sender, text }) {
  const isUser = sender === "user";
  const [speaking, setSpeaking] = useState(false);

  return (
    <div
      className={`
        flex
        items-center
        my-[6px]
        ${isUser ? "justify-end" : "justify-start"}
      `}
    >
      <div
        className={`
          max-w-[75%]
          px-[14px]
          py-[10px]
          rounded-[14px]
          text-[14px]
          leading-[1.4]
          ${isUser
            ? "bg-[#ff4e7d] text-white"
            : "bg-[#f1f1f4] text-[#222]"
          }
        `}
      >
        {renderTextWithLinks(text)}
      </div>

      {!isUser && (
        <button
          onClick={() => playNaturalVoice(text, setSpeaking)}
          disabled={speaking}
          title="Sunein"
          className={`
            ml-[6px]
            border-0
            bg-transparent
            text-base
            ${
              speaking
                ? "cursor-default opacity-50"
                : "cursor-pointer opacity-100"
            }
          `}
        >
          {speaking ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Volume2 size={17} />
          )}
        </button>
      )}
    </div>
  );
}

export default ChatMessage;