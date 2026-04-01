import { useState, useCallback, useRef } from "react";
import type { ChatSession, ChatSessionSummary, Message } from "../types";

export function useChat() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  // Keep ref in sync for use inside streaming callback
  const updateActiveSession = (session: ChatSession | null) => {
    setActiveSession(session);
    activeSessionIdRef.current = session?.id ?? null;
  };

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // Network error — sessions will stay stale
    }
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        updateActiveSession(data);
        setAgentStatus(data.agentStatus);
      }
    } catch {
      // Network error
    }
  }, []);

  const createSession = useCallback(
    async (title?: string) => {
      try {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          const session = await res.json();
          updateActiveSession(session);
          setAgentStatus(null);
          await fetchSessions();
          return session;
        }
      } catch {
        // Network error
      }
    },
    [fetchSessions]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/chat/sessions/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {
        // Network error
      }
      // Clear active session if it was the deleted one
      if (activeSessionIdRef.current === id) {
        updateActiveSession(null);
        setAgentStatus(null);
      }
      await fetchSessions();
    },
    [fetchSessions]
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await fetch(`/api/chat/sessions/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch {
        // Network error
      }
      await fetchSessions();
      if (activeSessionIdRef.current === id) {
        setActiveSession((prev) => (prev ? { ...prev, title } : null));
      }
    },
    [fetchSessions]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSession || isStreaming) return;

      const sessionId = activeSession.id;

      // Optimistically add user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      setActiveSession((prev) =>
        prev ? { ...prev, messages: [...prev.messages, userMsg] } : null
      );
      setIsStreaming(true);
      setStreamingContent("");
      setAgentStatus("Thinking...");

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const res = await fetch(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
            signal: abort.signal,
          }
        );

        if (!res.body) {
          throw new Error("No response body");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const raw = trimmed.slice(6);
            if (raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw);
              if (event.type === "delta") {
                accumulated += event.content;
                setStreamingContent(accumulated);
              } else if (event.type === "status") {
                setAgentStatus(event.status);
              } else if (event.type === "done") {
                const assistantMsg: Message = {
                  id: event.messageId,
                  role: "assistant",
                  content: accumulated,
                  timestamp: Date.now(),
                };
                // Only update if still on the same session
                setActiveSession((prev) =>
                  prev?.id === sessionId
                    ? {
                        ...prev,
                        messages: [...prev.messages, assistantMsg],
                      }
                    : prev
                );
                setStreamingContent("");
              } else if (event.type === "error") {
                const errMsg: Message = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `Error: ${event.error}`,
                  timestamp: Date.now(),
                };
                setActiveSession((prev) =>
                  prev?.id === sessionId
                    ? {
                        ...prev,
                        messages: [...prev.messages, errMsg],
                      }
                    : prev
                );
                setStreamingContent("");
              }
            } catch {
              // skip unparseable SSE chunks
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Send error:", err);
          // Show error to user
          const errMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Error: Failed to connect to server",
            timestamp: Date.now(),
          };
          setActiveSession((prev) =>
            prev?.id === sessionId
              ? { ...prev, messages: [...prev.messages, errMsg] }
              : prev
          );
        }
      } finally {
        setIsStreaming(false);
        setAgentStatus(null);
        setStreamingContent("");
        abortRef.current = null;
        fetchSessions();
      }
    },
    [activeSession, isStreaming, fetchSessions]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setAgentStatus(null);
    setStreamingContent("");
  }, []);

  return {
    sessions,
    activeSession,
    streamingContent,
    agentStatus,
    isStreaming,
    fetchSessions,
    loadSession,
    createSession,
    deleteSession,
    renameSession,
    sendMessage,
    stopStreaming,
  };
}
