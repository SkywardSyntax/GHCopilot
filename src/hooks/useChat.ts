import { useState, useCallback, useRef } from "react";
import type { ChatSession, ChatSessionSummary, Message } from "../types";

export function useChat() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/chat/sessions", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setSessions(data);
    }
  }, []);

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/sessions/${id}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setActiveSession(data);
      setAgentStatus(data.agentStatus);
    }
  }, []);

  const createSession = useCallback(async (title?: string) => {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const session = await res.json();
      setActiveSession(session);
      setAgentStatus(null);
      await fetchSessions();
      return session;
    }
  }, [fetchSessions]);

  const deleteSession = useCallback(
    async (id: string) => {
      await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (activeSession?.id === id) {
        setActiveSession(null);
        setAgentStatus(null);
      }
      await fetchSessions();
    },
    [activeSession, fetchSessions]
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      await fetchSessions();
      if (activeSession?.id === id) {
        setActiveSession((prev) => (prev ? { ...prev, title } : null));
      }
    },
    [activeSession, fetchSessions]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSession || isStreaming) return;

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
          `/api/chat/sessions/${activeSession.id}/messages`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
            signal: abort.signal,
          }
        );

        const reader = res.body!.getReader();
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
                // Add the complete assistant message
                const assistantMsg: Message = {
                  id: event.messageId,
                  role: "assistant",
                  content: accumulated,
                  timestamp: Date.now(),
                };
                setActiveSession((prev) =>
                  prev
                    ? { ...prev, messages: [...prev.messages, assistantMsg] }
                    : null
                );
                setStreamingContent("");
              } else if (event.type === "error") {
                console.error("Stream error:", event.error);
                // Add error as assistant message
                const errMsg: Message = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `Error: ${event.error}`,
                  timestamp: Date.now(),
                };
                setActiveSession((prev) =>
                  prev
                    ? { ...prev, messages: [...prev.messages, errMsg] }
                    : null
                );
                setStreamingContent("");
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Send error:", err);
        }
      } finally {
        setIsStreaming(false);
        setAgentStatus(null);
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
