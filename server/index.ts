import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import { seedSettingsIfEmpty } from "./settings";

const app = express();
// За прокси (Railway/Render) — чтобы express-rate-limit корректно читал клиентский IP.
// При прямом доступе без прокси задайте TRUST_PROXY=0.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "15mb" }));

// --- Глобальный лимитёр ДО auth: защита от брутфорса Basic-auth ---
// Неавторизованные запросы отсекаются auth-промежуткой ниже, не доходя до
// API-лимитёров в routes.ts, поэтому нужен отдельный лимитёр здесь.
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов. Повторите позже." },
});
app.use(authLimiter);

// --- Единый парольный замок на весь сервис (HTTP Basic Auth) ---
// В production креды обязательны и должны быть заданы явно через env.
// Дефолтные значения оставлены только для локальной разработки.
const isProd = process.env.NODE_ENV === "production";
const BASIC_USER = process.env.BASIC_AUTH_USER || (isProd ? "" : "admin");
const BASIC_PASS = process.env.BASIC_AUTH_PASS || (isProd ? "" : "sbshnik");
const BASIC_REALM = "Bot SBshnik - password required";

if (isProd && (!BASIC_USER || !BASIC_PASS)) {
  console.error("FATAL: в production обязательны BASIC_AUTH_USER и BASIC_AUTH_PASS.");
  process.exit(1);
}

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

app.use((req, res, next) => {
  // health пропускаем для uptime-мониторов
  if (req.path === "/api/health") return next();

  const hdr = req.headers.authorization || "";
  if (hdr.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(hdr.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      const u = idx >= 0 ? decoded.slice(0, idx) : decoded;
      const p = idx >= 0 ? decoded.slice(idx + 1) : "";
      if (timingSafeEq(u, BASIC_USER) && timingSafeEq(p, BASIC_PASS)) {
        return next();
      }
    } catch {
      // fallthrough
    }
  }
  res.setHeader("WWW-Authenticate", `Basic realm="${BASIC_REALM}", charset="UTF-8"`);
  return res.status(401).send("Требуется вход. Введите логин и пароль администратора.");
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  seedSettingsIfEmpty();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
