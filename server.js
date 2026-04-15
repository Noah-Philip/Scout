import express from "express";
import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4173;

app.use(express.json());
app.use(express.static(__dirname));

const requiredEnv = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];

function getMissingConfig() {
  return requiredEnv.filter((name) => !process.env[name]);
}

function createTransporter() {
  const missing = getMissingConfig();
  if (missing.length > 0) {
    throw new Error(`Missing email environment configuration: ${missing.join(", ")}`);
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const deliveryByIdempotencyKey = new Map();

app.post("/api/email/send", async (req, res) => {
  const { to, subject, body, contactId, goal, draftId, from } = req.body || {};
  const idempotencyKey = req.get("Idempotency-Key") || draftId;

  if (!to || !subject || !body || !contactId || !goal || !draftId || !from) {
    return res.status(400).json({ error: "to, subject, body, contactId, goal, draftId, and from are required." });
  }

  if (!idempotencyKey) {
    return res.status(400).json({ error: "An idempotency key is required." });
  }

  const emailAddressRegex = /<([^>]+)>$/;
  const extractedTo = typeof to === "string" ? (to.match(emailAddressRegex)?.[1] || to).trim() : "";
  const extractedFrom = typeof from === "string" ? (from.match(emailAddressRegex)?.[1] || from).trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedTo)) {
    return res.status(400).json({ error: "Recipient email address is invalid." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedFrom)) {
    return res.status(400).json({ error: "Sender email address is invalid." });
  }

  const existingDelivery = deliveryByIdempotencyKey.get(idempotencyKey);
  if (existingDelivery) {
    return res.status(200).json({
      ok: true,
      duplicate: true,
      messageId: existingDelivery.messageId,
      sentAt: existingDelivery.sentAt,
    });
  }

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: body,
      headers: {
        "X-Contact-Id": String(contactId),
        "X-Outreach-Goal": String(goal),
        "X-Draft-Id": String(draftId),
        "Idempotency-Key": String(idempotencyKey),
      },
    });

    const delivery = {
      messageId: info.messageId || idempotencyKey,
      sentAt: new Date().toISOString(),
    };

    deliveryByIdempotencyKey.set(idempotencyKey, delivery);

    return res.status(200).json({ ok: true, duplicate: false, ...delivery });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to send email via SMTP provider.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Scout running on http://localhost:${port}`);
});
