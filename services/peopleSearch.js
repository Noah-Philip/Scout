import { parseQueryWithLlm } from './queryParser.js';
import { logInfo } from './logger.js';
import { searchWithSerpApi } from './providers/serpApiProvider.js';
import { enrichEmailsWithHunter } from './providers/hunterProvider.js';

const MAX_LIMIT = 25;
const MIN_LIMIT = 1;

function normalizeLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(parsed)));
}

function dedupeContacts(contacts = []) {
  const seen = new Set();
  return contacts.filter((contact) => {
    const key = contact.profileUrl || `${contact.fullName}-${contact.company}`.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getPeopleSearchMode() {
  return process.env.SERPAPI_API_KEY ? 'live' : 'unconfigured';
}

export async function searchPeople({ query, limit }) {
  const normalizedLimit = normalizeLimit(limit);
  const parsedFilters = await parseQueryWithLlm({ query });

  const providerResult = await searchWithSerpApi({ query, filters: parsedFilters, limit: normalizedLimit });

  const deduped = dedupeContacts(providerResult.contacts);
  const enriched = await enrichEmailsWithHunter(deduped);

  logInfo('People search completed', {
    query,
    resultCount: enriched.length,
    provider: providerResult.provider,
    parser: parsedFilters.parser,
  });

  return {
    query,
    parsedFilters,
    provider: providerResult.provider,
    fetchedAt: providerResult.fetchedAt,
    contacts: enriched,
  };
}
