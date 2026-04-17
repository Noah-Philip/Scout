import express from "express";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4173;

app.use(express.json());
app.use(express.static(__dirname));

const oauthEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];

function getMissingOauthConfig() {
  return oauthEnv.filter((name) => !process.env[name]);
}

function getOauthConfig() {
  const missing = getMissingOauthConfig();
  if (missing.length > 0) {
    throw new Error(`Missing Google OAuth configuration: ${missing.join(", ")}`);
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  };
}

const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

const deliveryByIdempotencyKey = new Map();
const gmailTokensByEmail = new Map();
const pendingOauthStates = new Map();

function cleanupExpiredOauthStates() {
  const now = Date.now();
  for (const [state, startedAt] of pendingOauthStates.entries()) {
    if (now - startedAt > 10 * 60 * 1000) pendingOauthStates.delete(state);
  }
}

function createGoogleAuthUrl({ state, emailHint }) {
  const { clientId, redirectUri } = getOauthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", gmailScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  if (emailHint) url.searchParams.set("login_hint", emailHint);
  return url.toString();
}

async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getOauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error_description || result.error || "Failed to exchange Google OAuth code.");
  }
  return result;
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error?.message || "Failed to fetch Google account identity.");
  }
  return result;
}

function parseAddress(address) {
  if (typeof address !== "string") return "";
  const emailAddressRegex = /<([^>]+)>$/;
  return (address.match(emailAddressRegex)?.[1] || address).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildUserTransporter(senderEmail) {
  const tokenRecord = gmailTokensByEmail.get(senderEmail);
  if (!tokenRecord) {
    throw new Error("This Gmail account has not been connected yet. Connect Gmail before sending.");
  }

  if (!tokenRecord.refresh_token) {
    throw new Error("Missing refresh token for this Gmail account. Reconnect Gmail and try again.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: senderEmail,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: tokenRecord.refresh_token,
      accessToken: tokenRecord.access_token,
      expires: tokenRecord.expiry_date,
    },
  });
}

app.get("/api/gmail/status", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email query parameter is required." });
  }

  return res.status(200).json({ connected: gmailTokensByEmail.has(email), email });
});

app.post("/api/gmail/oauth/start", (req, res) => {
  try {
    getOauthConfig();
    cleanupExpiredOauthStates();

    const emailHint = parseAddress(req.body?.email || "");
    const state = crypto.randomBytes(16).toString("hex");
    pendingOauthStates.set(state, Date.now());

    const authUrl = createGoogleAuthUrl({ state, emailHint });

    return res.status(200).json({ authUrl });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to initialize Google OAuth.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/gmail/disconnect", (req, res) => {
  const email = parseAddress(req.body?.email || "");
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  gmailTokensByEmail.delete(email);
  return res.status(200).json({ ok: true, disconnected: true, email });
});

app.get("/api/gmail/oauth/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !state || !pendingOauthStates.has(state)) {
    return res.status(400).send("<h1>OAuth failed</h1><p>Invalid or expired OAuth state.</p>");
  }

  pendingOauthStates.delete(state);

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    const email = parseAddress(userInfo.email || "");

    if (!email || !isValidEmail(email)) {
      throw new Error("Google account email could not be resolved from OAuth response.");
    }

    const existing = gmailTokensByEmail.get(email);
    gmailTokensByEmail.set(email, {
      ...existing,
      ...tokens,
      refresh_token: tokens.refresh_token || existing?.refresh_token,
      connectedAt: new Date().toISOString(),
    });

    return res.status(200).send(`<!doctype html>
<html>
  <body>
    <p>Gmail connected for ${email}. You can close this window.</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "gmail-oauth-success", email: ${JSON.stringify(email)} }, window.location.origin);
      }
      window.close();
    </script>
  </body>
</html>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).send(`<!doctype html>
<html>
  <body>
    <h1>Gmail connection failed</h1>
    <p>${message}</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "gmail-oauth-error", error: ${JSON.stringify(message)} }, window.location.origin);
      }
    </script>
  </body>
</html>`);
  }
});

app.post("/api/email/send", async (req, res) => {
  const { to, subject, body, contactId, goal, draftId, from } = req.body || {};
  const idempotencyKey = req.get("Idempotency-Key") || draftId;

  if (!to || !subject || !body || !contactId || !goal || !draftId || !from) {
    return res.status(400).json({ error: "to, subject, body, contactId, goal, draftId, and from are required." });
  }

  if (!idempotencyKey) {
    return res.status(400).json({ error: "An idempotency key is required." });
  }

  const extractedTo = parseAddress(to);
  const extractedFrom = parseAddress(from);

  if (!isValidEmail(extractedTo)) {
    return res.status(400).json({ error: "Recipient email address is invalid." });
  }

  if (!isValidEmail(extractedFrom)) {
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
    const transporter = buildUserTransporter(extractedFrom);
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
      error: "Failed to send email via Gmail OAuth.",
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
