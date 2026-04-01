export default function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-void relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-accent) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-accent/3 rounded-full blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center gap-10 animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-lg shadow-accent/5">
            <svg viewBox="0 0 32 32" fill="none" className="w-12 h-12">
              <path
                d="M16 6C10.477 6 6 10.477 6 16c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0116 11.28c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C23.138 24.163 26 20.418 26 16c0-5.523-4.477-10-10-10z"
                fill="currentColor"
                className="text-accent"
              />
            </svg>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-bright font-display">
              GHCopilot
            </h1>
            <p className="text-muted mt-2 text-sm font-mono">
              AI-powered chat with GitHub Copilot
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-2xl p-8 w-[380px] shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-5">
            <div className="text-center space-y-2">
              <p className="text-subtle text-sm leading-relaxed">
                Sign in with your GitHub account to start chatting with Copilot.
                Requires an active Copilot subscription.
              </p>
            </div>

            <button
              onClick={onLogin}
              className="group relative flex items-center justify-center gap-3 w-full py-3.5 px-6 bg-bright text-void font-semibold rounded-xl hover:bg-white transition-all duration-200 hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 7.28c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              Sign in with GitHub
              <span className="absolute inset-0 rounded-xl ring-2 ring-transparent group-hover:ring-accent/20 transition-all duration-200" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-muted text-xs font-mono uppercase tracking-widest">
                features
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 text-sm">
              {[
                ["Parallel chats", "Run multiple conversations at once"],
                ["Live agent view", "Watch Copilot think in real time"],
                ["Streaming", "Responses appear token by token"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 text-left"
                >
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <div>
                    <span className="text-text font-medium">{title}</span>
                    <span className="text-muted ml-1.5">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-muted/50 text-xs font-mono">
          Powered by GitHub Copilot API
        </p>
      </div>
    </div>
  );
}
