export interface User {
  login: string;
  avatar_url: string;
  name: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  agentStatus: string | null;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  messageCount: number;
  agentStatus: string | null;
  lastMessage: string | null;
}
