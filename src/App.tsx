import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useChat } from "./hooks/useChat";
import Login from "./components/Login";
import ChatLayout from "./components/ChatLayout";

export default function App() {
  const auth = useAuth();
  const chat = useChat();

  useEffect(() => {
    if (auth.authenticated) {
      chat.fetchSessions();
    }
  }, [auth.authenticated]);

  if (auth.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-void">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-muted font-mono text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return <Login onLogin={auth.login} />;
  }

  return <ChatLayout auth={auth} chat={chat} />;
}
