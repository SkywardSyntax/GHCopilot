import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth.js";
import { chatRouter } from "./chat.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
