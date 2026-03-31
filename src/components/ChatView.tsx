import { useState, useRef, useEffect } from "react";
import type { ChatSession } from "../types";
import MessageBubble from "./MessageBubble";

interface ChatViewProps {
  session: ChatSession | null;
  streamingContent: string;
  agentStatus: string | null;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  onNewChat: () => void;
}

export default function ChatView({
  session,
  streamingContent,
  agentStatus,
  isStreaming,
  onSend,
  onStop,
  onNewChat,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamingContent]);

  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus();
  }, [isStreaming, session?.id]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Empty state
  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-surface border border-border flex items-center justify-center">
              <svg viewBox="0 0 32 32" className="w-14 h-14 text-accent/30">
                <path
                  d="M16 6C10.477 6 6 10.477 6 16c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0116 11.28c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C23.138 24.163 26 20.418 26 16c0-5.523-4.477-10-10-10z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span className="text-accent text-sm">AI</span>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-bright mb-2">
            Start a conversation
          </h2>
          <p className="text-muted text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            Create a new chat to start talking with GitHub Copilot.
            You can run multiple chats in parallel.
          </p>
          <button
            onClick={onNewChat}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-dim text-white rounded-xl font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {session.messages.length === 0 && !isStreaming && (
            <div className="text-center py-20 animate-fade-in-up">
              <p className="text-muted text-sm font-mono mb-6">
                What can I help you with?
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Explain how async/await works",
                  "Debug this error message",
                  "Write a React component",
                  "Optimize my SQL query",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="px-3.5 py-2 bg-surface border border-border rounded-xl text-sm text-subtle hover:text-text hover:border-border-bright transition-all duration-150 hover:bg-elevated"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {session.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="animate-fade-in-up">
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingContent,
                  timestamp: Date.now(),
                }}
                isStreaming
                agentStatus={agentStatus}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-abyss/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Copilot anything..."
              rows={1}
              disabled={isStreaming}
              className="w-full resize-none rounded-xl bg-surface border border-border px-4 py-3 pr-24 text-sm text-text placeholder-muted/60 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200 disabled:opacity-50 max-h-40"
              style={{
                height: "auto",
                minHeight: "48px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height =
                  Math.min(target.scrollHeight, 160) + "px";
              }}
            />

            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose/10 hover:bg-rose/20 text-rose border border-rose/20 rounded-lg text-xs font-medium transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <rect x="3" y="3" width="10" height="10" rx="2" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-dim disabled:bg-border disabled:text-muted text-white rounded-lg text-xs font-medium transition-all duration-150 disabled:cursor-not-allowed"
                >
                  Send
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M.5 1.163A1 1 0 011.97.28l12.868 6.837a1 1 0 010 1.766L1.969 15.72A1 1 0 01.5 14.836V10.33a1 1 0 01.816-.983L8.5 8 1.316 6.653A1 1 0 01.5 5.67V1.163z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-muted/40 text-xs mt-2 font-mono">
            Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
