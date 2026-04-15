import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JOB_STORE_DIR = path.join(__dirname, "data");
const JOB_STORE_PATH = path.join(JOB_STORE_DIR, "scheduled-jobs.json");
const PORT = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function ensureStore() {
  await fs.mkdir(JOB_STORE_DIR, { recursive: true });
  try {
    await fs.access(JOB_STORE_PATH);
  } catch {
    await fs.writeFile(JOB_STORE_PATH, "[]\n", "utf8");
  }
}

async function readJobs() {
  await ensureStore();
  const raw = await fs.readFile(JOB_STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJobs(jobs) {
  await ensureStore();
  await fs.writeFile(JOB_STORE_PATH, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
}

function buildJobView(job) {
  const logs = Array.isArray(job.logs) ? job.logs : [];
  return {
    id: job.id,
    draftId: job.draftId,
    to: job.to,
    subject: job.subject,
    body: job.body,
    sendAt: job.sendAt,
    contactName: job.contactName,
    organization: job.organization,
    status: job.status,
    attempts: job.attempts || 0,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    executedAt: job.executedAt || null,
    providerMessageId: job.providerMessageId || null,
    lastLog: logs[logs.length - 1]?.message || "",
  };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function createEmailProvider() {
  return {
    name: "mock-provider",
    async send({ to, subject, body }) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!to || !subject || !body) {
        throw new Error("Missing required email fields.");
      }
      return {
        provider: "mock-provider",
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
    },
  };
}

const emailProvider = createEmailProvider();
let workerRunning = false;

async function runSchedulerWorker() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const jobs = await readJobs();
    const now = Date.now();

    for (const job of jobs) {
      const due = new Date(job.sendAt).getTime() <= now;
      if (!due || job.status !== "scheduled") continue;

      job.status = "processing";
      job.updatedAt = new Date().toISOString();
      job.logs = job.logs || [];
      job.logs.push({ at: job.updatedAt, message: "Worker picked up scheduled email." });
      await writeJobs(jobs);

      try {
        const result = await emailProvider.send(job);
        const executedAt = new Date().toISOString();
        job.status = "sent";
        job.executedAt = executedAt;
        job.providerMessageId = result.messageId;
        job.attempts = (job.attempts || 0) + 1;
        job.updatedAt = executedAt;
        job.logs.push({ at: executedAt, message: `Sent via ${result.provider}. Message id ${result.messageId}.` });
      } catch (error) {
        const failedAt = new Date().toISOString();
        job.status = "failed";
        job.updatedAt = failedAt;
        job.attempts = (job.attempts || 0) + 1;
        job.logs.push({ at: failedAt, message: `Delivery failed: ${error.message}` });
      }
      await writeJobs(jobs);
    }
  } finally {
    workerRunning = false;
  }
}

function normalizeStaticPath(urlPathname = "/") {
  const pathname = decodeURIComponent(urlPathname.split("?")[0]);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.normalize(path.join(__dirname, requested));
  if (!fullPath.startsWith(__dirname)) return null;
  return fullPath;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/email/schedule") {
    try {
      const body = await parseBody(req);
      const sendAt = new Date(body.sendAt);
      if (!body.to || !body.subject || !body.body || !body.draftId || Number.isNaN(sendAt.getTime())) {
        json(res, 400, { error: "Invalid payload. Required: to, subject, body, draftId, sendAt." });
        return;
      }

      const jobs = await readJobs();
      const nowIso = new Date().toISOString();
      const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        draftId: body.draftId,
        to: body.to,
        subject: body.subject,
        body: body.body,
        sendAt: sendAt.toISOString(),
        contactName: body.contactName || body.to,
        organization: body.organization || "",
        status: "scheduled",
        attempts: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        logs: [{ at: nowIso, message: `Scheduled for ${sendAt.toISOString()}.` }],
      };
      jobs.unshift(job);
      await writeJobs(jobs);
      json(res, 201, { job: buildJobView(job) });
      return;
    } catch (error) {
      json(res, 500, { error: `Unable to schedule email: ${error.message}` });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/email/scheduled") {
    const jobs = await readJobs();
    const ordered = jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    json(res, 200, { jobs: ordered.map(buildJobView) });
    return;
  }

  const staticPath = normalizeStaticPath(url.pathname);
  if (!staticPath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(staticPath);
    const ext = path.extname(staticPath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await ensureStore();
server.listen(PORT, () => {
  console.log(`Scout app + API running at http://localhost:${PORT}`);
});

setInterval(() => {
  runSchedulerWorker().catch((error) => {
    console.error("Scheduler worker error", error);
  });
}, 5000);
