import { Loader2, Volume2 } from "lucide-react";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { playNaturalVoice } from "../utils/voice";

function ChatMessage({ sender, text, onSend }) {
  const isUser = sender === "user";
  const [speaking, setSpeaking] = useState(false);

  const formattedText = String(text || "")
  // literal "\n" ko actual newline mein convert karo
  .replace(/\\n/g, "\n")
  // Windows newline
  .replace(/\r\n/g, "\n")
  // A), B), C) ko new line
  .replace(/\s+(?=[ABC]\)\s)/gi, "\n");

  const parts = formattedText.split("\n");

  return (
    <div
      className={`
        flex items-start my-[8px]
        ${isUser ? "justify-end" : "justify-start"}
      `}
    >
      <div
        className={`
          max-w-[80%]
          px-[14px]
          py-[11px]
          rounded-[14px]
          text-[14px]
          leading-[1.5]
          break-words
          ${
            isUser
              ? "bg-[#ff4e7d] text-white"
              : "bg-[#f1f1f4] text-[#222]"
          }
        `}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">
            {text}
          </span>
        ) : (
          <div className="flex flex-col">
            {parts.map((line, index) => {
              const trimmedLine = line.trim();

              // Empty line
              if (!trimmedLine) {
                return (
                  <div
                    key={index}
                    className="h-[6px]"
                  />
                );
              }

              // =====================================
              // A / B / C QUIZ OPTION
              // =====================================

              const optionMatch = trimmedLine.match(
                /^([ABC])[\).]\s*(.+)$/i
              );

              if (optionMatch) {
                const option =
                  optionMatch[1].toUpperCase();

                const optionText =
                  optionMatch[2];

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
  onSend?.(`${option}) ${optionText}`)
}
                    className="
                      w-full
                      text-left
                      flex
                      items-center
                      gap-2
                      mt-2
                      px-3
                      py-2.5
                      rounded-xl
                      bg-white
                      border
                      border-[#e2e2e2]
                      font-medium
                      cursor-pointer
                      hover:bg-[#fff0f4]
                      hover:border-[#ff4e7d]
                      transition
                    "
                  >
                    <span
                      className="
                        font-bold
                        text-[#ff4e7d]
                        min-w-[22px]
                      "
                    >
                      {option})
                    </span>

                    <span>
                      {optionText}
                    </span>
                  </button>
                );
              }

              // =====================================
              // NORMAL MESSAGE
              // =====================================

              return (
                <ReactMarkdown
                  key={index}
                  remarkPlugins={[remarkBreaks]}
                  components={{
                    p: ({ children }) => (
                      <p className="m-0 mb-1">
                        {children}
                      </p>
                    ),

                    strong: ({ children }) => (
                      <strong className="font-bold text-[#111]">
                        {children}
                      </strong>
                    ),

                    em: ({ children }) => (
                      <em className="italic">
                        {children}
                      </em>
                    ),

                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
                          text-blue-600
                          underline
                          break-all
                        "
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {trimmedLine}
                </ReactMarkdown>
              );
            })}
          </div>
        )}
      </div>

      {/* Voice button */}
      {!isUser && (
        <button
          onClick={() =>
            playNaturalVoice(
              text,
              setSpeaking
            )
          }
          disabled={speaking}
          title="Sunein"
          className={`
            ml-[6px]
            mt-[4px]
            border-0
            bg-transparent
            ${
              speaking
                ? "cursor-default opacity-50"
                : "cursor-pointer opacity-100"
            }
          `}
        >
          {speaking ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <Volume2 size={17} />
          )}
        </button>
      )}
    </div>
  );
}

export default ChatMessage;