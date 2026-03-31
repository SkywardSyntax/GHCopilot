import { Router, Request, Response } from "express";
import crypto from "crypto";

declare module "express-session" {
  interface SessionData {
    githubToken?: string;
    githubUser?: { login: string; avatar_url: string; name: string };
    oauthState?: string;
  }
}

export const authRouter = Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const CALLBACK_URL =
  process.env.OAUTH_CALLBACK_URL || "http://localhost:5173/api/auth/callback";

authRouter.get("/login", (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: "copilot read:user",
    redirect_uri: CALLBACK_URL,
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRouter.get("/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || typeof code !== "string") {
    res.redirect("/?error=no_code");
    return;
  }

  // Validate OAuth state to prevent CSRF
  if (!state || state !== req.session.oauthState) {
    res.redirect("/?error=invalid_state");
    return;
  }
  delete req.session.oauthState;

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
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
      }
    );

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenRes.status);
      res.redirect("/?error=token_exchange_failed");
      return;
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("OAuth error:", tokenData.error);
      res.redirect("/?error=auth_denied");
      return;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "GHCopilot/1.0",
      },
    });

    if (!userRes.ok) {
      console.error("Failed to fetch user:", userRes.status);
      res.redirect("/?error=user_fetch_failed");
      return;
    }

    const user = await userRes.json();

    if (!user.login || typeof user.login !== "string") {
      res.redirect("/?error=invalid_user");
      return;
    }

    req.session.githubToken = tokenData.access_token;
    req.session.githubUser = {
      login: String(user.login),
      avatar_url: String(user.avatar_url || ""),
      name: String(user.name || user.login),
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
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.json({ ok: true });
  });
});
