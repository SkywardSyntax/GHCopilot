import ReactMarkdown from "react-markdown";
import type { Message } from "../types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  agentStatus?: string | null;
}

export default function MessageBubble({
  message,
  isStreaming,
  agentStatus,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 mb-5 ${isUser ? "flex-row-reverse" : ""} ${
        !isStreaming ? "animate-fade-in-up" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
          isUser
            ? "bg-accent/10 text-accent border border-accent/20"
            : "bg-green/10 text-green border border-green/20"
        }`}
      >
        {isUser ? (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M10.561 8.073a6.005 6.005 0 013.432 5.142.75.75 0 11-1.498.07 4.5 4.5 0 00-8.99 0 .75.75 0 11-1.498-.07 6.005 6.005 0 013.431-5.142 3.999 3.999 0 115.123 0zM10.5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM5.78 5.97a.75.75 0 00-1.06 1.06L6.94 9.25l-2.22 2.22a.75.75 0 101.06 1.06L8 10.31l2.22 2.22a.75.75 0 101.06-1.06l-2.22-2.22 2.22-2.22a.75.75 0 00-1.06-1.06L8 8.19 5.78 5.97z" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted">
            {isUser ? "You" : "Copilot"}
          </span>
          {isStreaming && agentStatus && (
            <span className="inline-flex items-center gap-1.5 text-xs text-accent font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {agentStatus}
            </span>
          )}
        </div>

        <div
          className={`inline-block text-left rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-accent/10 border border-accent/15 text-text"
              : "bg-surface border border-border text-text"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <div className="prose-chat">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : null}

          {/* Streaming cursor */}
          {isStreaming && message.content && (
            <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 -mb-0.5 cursor-blink" />
          )}
        </div>
      </div>
    </div>
  );
}
