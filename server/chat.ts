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
  const session: ChatSession = {
    id: uuidv4(),
    title: req.body.title || "New Chat",
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
  if (req.body.title) session.title = req.body.title;
  res.json(session);
});

// Delete a chat session
chatRouter.delete("/sessions/:id", (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  chats.delete(req.params.id);
  res.json({ ok: true });
});

// Copilot token cache
const copilotTokenCache = new Map<string, { token: string; expires_at: number }>();

async function getCopilotToken(githubToken: string): Promise<string> {
  const cached = copilotTokenCache.get(githubToken);
  if (cached && cached.expires_at > Date.now() / 1000 + 60) {
    return cached.token;
  }

  const res = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Authorization: `token ${githubToken}`,
      "User-Agent": "GHCopilot/1.0",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Copilot token: ${res.status} ${text}`);
  }

  const data = await res.json();
  copilotTokenCache.set(githubToken, {
    token: data.token,
    expires_at: data.expires_at,
  });
  return data.token;
}

// Send a message and stream the response
chatRouter.post("/sessions/:id/messages", async (req: Request, res: Response) => {
  const chats = getUserChats(req.session.githubUser!.login);
  const session = chats.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: "Message content required" });
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
    session.title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const copilotToken = await getCopilotToken(req.session.githubToken!);

    // Build messages array for the API
    const apiMessages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    session.agentStatus = "Generating response...";
    res.write(`data: ${JSON.stringify({ type: "status", status: session.agentStatus })}\n\n`);

    const apiRes = await fetch("https://api.githubcopilot.com/chat/completions", {
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
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      session.agentStatus = null;
      res.write(`data: ${JSON.stringify({ type: "error", error: `Copilot API error: ${apiRes.status} - ${errText}` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    session.agentStatus = "Writing...";
    res.write(`data: ${JSON.stringify({ type: "status", status: session.agentStatus })}\n\n`);

    const reader = apiRes.body!.getReader();
    const decoder = new TextDecoder();
    let assistantContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
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
            res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    // Save assistant message
    const assistantMsg: Message = {
      id: uuidv4(),
      role: "assistant",
      content: assistantContent,
      timestamp: Date.now(),
    };
    session.messages.push(assistantMsg);
    session.agentStatus = null;

    res.write(`data: ${JSON.stringify({ type: "done", messageId: assistantMsg.id })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("Chat error:", err);
    session.agentStatus = null;
    res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

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
