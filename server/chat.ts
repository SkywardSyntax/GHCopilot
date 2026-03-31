import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  agentStatus: string | null;
}

const MAX_SESSIONS_PER_USER = 50;
const MAX_MESSAGE_LENGTH = 32_000;
const MAX_TITLE_LENGTH = 100;
const COPILOT_API_TIMEOUT_MS = 60_000;

// In-memory store keyed by GitHub username
const chatStore = new Map<string, Map<string, ChatSession>>();

function getUserChats(login: string): Map<string, ChatSession> {
  if (!chatStore.has(login)) chatStore.set(login, new Map());
  return chatStore.get(login)!;
}

export const chatRouter = Router();

// Auth middleware
chatRouter.use((req: Request, res: Response, next) => {
  if (!req.session.githubToken || !req.session.githubUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
});

// List all chat sessions
chatRouter.get("/sessions", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  const sessions = Array.from(chats.values())
    .map(({ id, title, createdAt, messages, agentStatus }) => ({
      id,
      title,
      createdAt,
      messageCount: messages.length,
      agentStatus,
      lastMessage: messages[messages.length - 1]?.content?.slice(0, 80) || null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(sessions);
});

// Create a new chat session
chatRouter.post("/sessions", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);

  if (chats.size >= MAX_SESSIONS_PER_USER) {
    res.status(400).json({ error: "Too many sessions. Delete some first." });
    return;
  }

  const rawTitle = req.body.title;
  const title =
    typeof rawTitle === "string"
      ? rawTitle.slice(0, MAX_TITLE_LENGTH).trim() || "New Chat"
      : "New Chat";

  const session: ChatSession = {
    id: uuidv4(),
    title,
    messages: [],
    createdAt: Date.now(),
    agentStatus: null,
  };
  chats.set(session.id, session);
  res.json(session);
});

// Get a specific chat session
chatRouter.get("/sessions/:id", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  const session = chats.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

// Update chat title
chatRouter.patch("/sessions/:id", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  const session = chats.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const rawTitle = req.body.title;
  if (typeof rawTitle === "string" && rawTitle.trim()) {
    session.title = rawTitle.slice(0, MAX_TITLE_LENGTH).trim();
  }
  res.json(session);
});

// Delete a chat session
chatRouter.delete("/sessions/:id", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  chats.delete(req.params.id);
  res.json({ ok: true });
});

// Copilot token cache keyed by a hash of the GitHub token
const copilotTokenCache = new Map<
  string,
  { token: string; expires_at: number }
>();
const pendingTokenRequests = new Map<string, Promise<string>>();

function cacheKey(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

async function getCopilotToken(githubToken: string): Promise<string> {
  const key = cacheKey(githubToken);

  const cached = copilotTokenCache.get(key);
  if (cached && cached.expires_at > Date.now() / 1000 + 60) {
    return cached.token;
  }

  // Deduplicate concurrent requests for the same token
  const pending = pendingTokenRequests.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch(
        "https://api.github.com/copilot_internal/v2/token",
        {
          headers: {
            Authorization: `token ${githubToken}`,
            "User-Agent": "GHCopilot/1.0",
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to get Copilot token: ${res.status} ${text}`);
      }

      const data = await res.json();

      if (!data.token || typeof data.expires_at !== "number") {
        throw new Error("Invalid Copilot token response");
      }

      copilotTokenCache.set(key, {
        token: data.token,
        expires_at: data.expires_at,
      });
      return data.token as string;
    } finally {
      pendingTokenRequests.delete(key);
    }
  })();

  pendingTokenRequests.set(key, promise);
  return promise;
}

// Send a message and stream the response
chatRouter.post(
  "/sessions/:id/messages",
  async (req: Request, res: Response) => {
    const chats = getUserChats(req.session.githubUser!.login);
    const session = chats.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Message content required" });
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      res
        .status(400)
        .json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` });
      return;
    }

    // Add user message
    const userMsg: Message = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    session.messages.push(userMsg);
    session.agentStatus = "Thinking...";

    // Auto-title from first message
    if (session.messages.length === 1) {
      session.title =
        content.slice(0, 50) + (content.length > 50 ? "..." : "");
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let clientDisconnected = false;
    let apiReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    res.on("close", () => {
      clientDisconnected = true;
      // Cancel the upstream reader if client disconnects
      apiReader?.cancel().catch(() => {});
    });

    try {
      const copilotToken = await getCopilotToken(req.session.githubToken!);

      // Build messages array for the API
      const apiMessages = session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      session.agentStatus = "Generating response...";
      res.write(
        `data: ${JSON.stringify({ type: "status", status: session.agentStatus })}\n\n`
      );

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        COPILOT_API_TIMEOUT_MS
      );

      // Also abort if client disconnects
      res.on("close", () => controller.abort());

      let apiRes: globalThis.Response;
      try {
        apiRes = await fetch(
          "https://api.githubcopilot.com/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${copilotToken}`,
              "Content-Type": "application/json",
              "Copilot-Integration-Id": "vscode-chat",
              "Editor-Version": "vscode/1.96.0",
              "Editor-Plugin-Version": "copilot-chat/0.24.2",
              "Openai-Intent": "conversation-panel",
              "User-Agent": "GHCopilot/1.0",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful AI assistant powered by GitHub Copilot. You help with coding questions, debugging, and general software development tasks. Be concise and helpful.",
                },
                ...apiMessages,
              ],
              stream: true,
              temperature: 0.3,
              top_p: 1,
              n: 1,
            }),
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        session.agentStatus = null;
        res.write(
          `data: ${JSON.stringify({ type: "error", error: `Copilot API error: ${apiRes.status}` })}\n\n`
        );
        console.error("Copilot API error:", apiRes.status, errText);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      if (!apiRes.body) {
        session.agentStatus = null;
        res.write(
          `data: ${JSON.stringify({ type: "error", error: "No response body from Copilot API" })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      session.agentStatus = "Writing...";
      res.write(
        `data: ${JSON.stringify({ type: "status", status: session.agentStatus })}\n\n`
      );

      apiReader = apiRes.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      while (!clientDisconnected) {
        const { done, value } = await apiReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              if (!clientDisconnected) {
                res.write(
                  `data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`
                );
              }
            }
          } catch {
            // skip unparseable chunks
          }
        }
      }

      // Always save the assistant message (even partial on disconnect)
      if (assistantContent) {
        const assistantMsg: Message = {
          id: uuidv4(),
          role: "assistant",
          content: assistantContent,
          timestamp: Date.now(),
        };
        session.messages.push(assistantMsg);
      }
      session.agentStatus = null;

      if (!clientDisconnected) {
        res.write(
          `data: ${JSON.stringify({ type: "done", messageId: session.messages[session.messages.length - 1]?.id })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      session.agentStatus = null;

      if (!clientDisconnected) {
        const errorMsg =
          err.name === "AbortError"
            ? "Request timed out"
            : "An error occurred";
        res.write(
          `data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } finally {
      apiReader?.cancel().catch(() => {});
    }
  }
);

// Get agent status for a session
chatRouter.get("/sessions/:id/status", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  const session = chats.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ agentStatus: session.agentStatus });
});
