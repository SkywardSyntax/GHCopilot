import { useState } from "react";
import type { useAuth } from "../hooks/useAuth";
import type { useChat } from "../hooks/useChat";
import Sidebar from "./Sidebar";
import ChatView from "./ChatView";

type AuthReturn = ReturnType<typeof useAuth>;
type ChatReturn = ReturnType<typeof useChat>;

export default function ChatLayout({
  auth,
  chat,
}: {
  auth: AuthReturn;
  chat: ChatReturn;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex bg-void overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 ease-in-out overflow-hidden shrink-0`}
      >
        <Sidebar
          user={auth.user!}
          sessions={chat.sessions}
          activeSessionId={chat.activeSession?.id || null}
          onSelectSession={chat.loadSession}
          onCreateSession={() => chat.createSession()}
          onDeleteSession={chat.deleteSession}
          onRenameSession={chat.renameSession}
          onLogout={auth.logout}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-13 shrink-0 border-b border-border bg-abyss/50 flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-elevated text-muted hover:text-text transition-colors"
            title="Toggle sidebar"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {chat.activeSession && (
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-sm font-medium text-text truncate">
                {chat.activeSession.title}
              </h2>
              {chat.agentStatus && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-accent pulse-glow" />
                  <span className="text-xs text-accent font-mono">
                    {chat.agentStatus}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat area */}
        <ChatView
          session={chat.activeSession}
          streamingContent={chat.streamingContent}
          agentStatus={chat.agentStatus}
          isStreaming={chat.isStreaming}
          onSend={chat.sendMessage}
          onStop={chat.stopStreaming}
          onNewChat={() => chat.createSession()}
        />
      </div>
    </div>
  );
}
