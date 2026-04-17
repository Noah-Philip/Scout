import { mockContacts } from "../data.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function toNumberLimit(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function buildQueryTerms(query, intent) {
  const terms = [];
  if (typeof query === "string") {
    terms.push(...query.toLowerCase().split(/\s+/).filter(Boolean));
  }
  if (typeof intent === "string") {
    terms.push(...intent.toLowerCase().split(/\s+/).filter(Boolean));
  }

  return [...new Set(terms)];
}

function scoreContact(contact, terms) {
  if (terms.length === 0) {
    return Number(contact.confidence || 0);
  }

  const haystack = [
    contact.name,
    contact.role,
    contact.organization,
    contact.bio,
    contact.category,
    ...(Array.isArray(contact.tags) ? contact.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let termHits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      termHits += 1;
    }
  }

  const lexicalScore = (termHits / terms.length) * 100;
  const baseConfidence = Number(contact.confidence || 0);

  return Math.round((baseConfidence * 0.6) + (lexicalScore * 0.4));
}

function normalizeContact(contact, score) {
  return {
    name: contact.name || "",
    role: contact.role || "",
    organization: contact.organization || "",
    bio: contact.bio || "",
    category: contact.category || "",
    tags: Array.isArray(contact.tags) ? contact.tags : [],
    ...(contact.email ? { email: contact.email } : {}),
    sourceUrl: contact.sourceUrl || null,
    confidence: score,
  };
}

function runMockProvider({ query, intent, limit }) {
  const terms = buildQueryTerms(query, intent);
  const scored = mockContacts
    .map((contact) => ({ contact, score: scoreContact(contact, terms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ contact, score }) => normalizeContact(contact, score));

  return {
    provider: "mock",
    queryUsed: query,
    fetchedAt: new Date().toISOString(),
    results: scored,
  };
}

async function runConfiguredProvider({ query, intent, limit }) {
  const providerBaseUrl = process.env.PEOPLE_SEARCH_BASE_URL;
  const providerApiKey = process.env.PEOPLE_SEARCH_API_KEY;

  const response = await fetch(`${providerBaseUrl.replace(/\/$/, "")}/search/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerApiKey}`,
    },
    body: JSON.stringify({ query, intent, limit }),
  });

  if (!response.ok) {
    throw new Error(`People provider request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const rawHits = Array.isArray(payload?.results) ? payload.results : [];

  const normalizedResults = rawHits
    .map((hit) => normalizeContact(hit, Number(hit?.confidence || 0)))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, limit);

  return {
    provider: "configured",
    queryUsed: payload?.queryUsed || query,
    fetchedAt: payload?.fetchedAt || new Date().toISOString(),
    results: normalizedResults,
  };
}

function hasConfiguredProvider() {
  return Boolean(process.env.PEOPLE_SEARCH_BASE_URL && process.env.PEOPLE_SEARCH_API_KEY);
}

export function getPeopleSearchMode() {
  return hasConfiguredProvider() ? "configured" : "mock";
}

export async function searchPeople({ query, intent, limit }) {
  const normalizedLimit = toNumberLimit(limit);

  if (hasConfiguredProvider()) {
    return runConfiguredProvider({ query, intent, limit: normalizedLimit });
  }

  return runMockProvider({ query, intent, limit: normalizedLimit });
}
