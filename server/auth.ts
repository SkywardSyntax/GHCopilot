import { Router, Request, Response } from "express";

declare module "express-session" {
  interface SessionData {
    githubToken?: string;
    githubUser?: { login: string; avatar_url: string; name: string };
  }
}

export const authRouter = Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

authRouter.get("/login", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: "copilot read:user",
    redirect_uri: `http://localhost:5173/api/auth/callback`,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRouter.get("/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) {
    res.redirect("/?error=no_code");
    return;
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      res.redirect(`/?error=${tokenData.error}`);
      return;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    req.session.githubToken = tokenData.access_token;
    req.session.githubUser = {
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name || user.login,
    };

    res.redirect("/");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/?error=auth_failed");
  }
});

authRouter.get("/status", (req: Request, res: Response) => {
  if (req.session.githubToken && req.session.githubUser) {
    res.json({ authenticated: true, user: req.session.githubUser });
  } else {
    res.json({ authenticated: false });
  }
});

authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
