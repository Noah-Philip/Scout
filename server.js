import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);
const LOG_PATH = path.join(__dirname, "send-attempts.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return Boolean(value) && EMAIL_PATTERN.test(value);
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readLog() {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeLog(entries) {
  await fs.writeFile(LOG_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function createProviderMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function parseJSONBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

async function handleApi(req, res, parsedUrl) {
  const fromEmail = process.env.FROM_EMAIL;
  const replyTo = process.env.REPLY_TO;

  if (parsedUrl.pathname === "/api/send-attempts" && req.method === "GET") {
    const entries = await readLog();
    return json(res, 200, { sendAttempts: entries });
  }

  if (parsedUrl.pathname === "/api/send" && req.method === "POST") {
    if (!isValidEmail(fromEmail)) {
      return json(res, 500, {
        error: "Server sender identity is not configured. Set a valid FROM_EMAIL before sending.",
      });
    }

    if (replyTo && !isValidEmail(replyTo)) {
      return json(res, 500, {
        error: "REPLY_TO must be a valid email address when provided.",
      });
    }

    let body;
    try {
      body = await parseJSONBody(req);
    } catch (_error) {
      return json(res, 400, { error: "Invalid JSON payload." });
    }

    const { draftId, contactEmail } = body;
    if (!draftId || typeof draftId !== "string") {
      return json(res, 400, { error: "draftId is required." });
    }

    if (!isValidEmail(contactEmail)) {
      return json(res, 400, { error: "contactEmail must be a valid email address." });
    }

    const attempt = {
      draftId,
      contactEmail,
      providerMessageId: createProviderMessageId(),
      status: "sent",
      error: null,
      sentAt: new Date().toISOString(),
    };

    const entries = await readLog();
    const withoutCurrentDraft = entries.filter((entry) => entry.draftId !== draftId);
    await writeLog([attempt, ...withoutCurrentDraft]);

    return json(res, 200, {
      attempt,
      fromEmail,
      replyTo: replyTo || null,
    });
  }

  return false;
}

async function serveStatic(req, res, parsedUrl) {
  const requestPath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const safePath = path.normalize(requestPath).replace(/^\.\.(\/|\\|$)/, "");
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain; charset=utf-8" });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (parsedUrl.pathname.startsWith("/api/")) {
    try {
      const handled = await handleApi(req, res, parsedUrl);
      if (handled !== false) return;
      return json(res, 404, { error: "API route not found." });
    } catch (error) {
      return json(res, 500, { error: error.message || "Unexpected server error." });
    }
  }

  return serveStatic(req, res, parsedUrl);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Scout server listening on http://localhost:${PORT}`);
});
