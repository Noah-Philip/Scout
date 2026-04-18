import { logWarn } from '../logger.js';

function toLinkedInUrl(link = '') {
  if (!link) return null;
  return link.includes('linkedin.com/in/') ? link : null;
}

function parseTitle(title = '') {
  const cleanTitle = String(title || '').replace(/\s*\|\s*LinkedIn.*/i, '').trim();
  const parts = cleanTitle.split(' - ');
  const fullName = parts[0]?.trim() || '';
  const titlePart = parts[1]?.trim() || '';
  const titleAndCompany = titlePart.split(' at ');

  return {
    fullName,
    title: titleAndCompany[0] || '',
    company: titleAndCompany[1] || '',
  };
}

function cleanSnippet(snippet = '') {
  return String(snippet || '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d+\s+connections\b/gi, '')
    .replace(/\b(on LinkedIn|LinkedIn profile)\b/gi, '')
    .replace(/\.\s*\.\s*\./g, '…')
    .trim();
}

function scoreContact(contact, filters) {
  const haystack = `${contact.fullName} ${contact.title} ${contact.company} ${contact.location} ${contact.summary}`.toLowerCase();
  const terms = [filters.role, filters.company, filters.location, filters.industry, filters.school, ...(filters.keywords || [])]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  if (terms.length === 0) return 0.55;

  const hits = terms.filter((term) => haystack.includes(term)).length;
  return Math.max(0.2, Math.min(0.95, hits / terms.length));
}

function normalizeOrganicResult(result, filters) {
  const { fullName, title, company } = parseTitle(result?.title || '');
  const snippet = cleanSnippet(result?.snippet || '');
  const locationMatch = snippet.match(/([A-Z][a-z]+(?:,\s*[A-Z]{2})?)/);
  const profileUrl = toLinkedInUrl(result?.link || '');

  if (!fullName || !profileUrl) return null;

  const contact = {
    id: `serp-${Buffer.from(profileUrl).toString('base64url').slice(0, 16)}`,
    fullName,
    title,
    company,
    location: locationMatch?.[1] || '',
    summary: snippet,
    profileUrl,
    companyUrl: '',
    source: 'serpapi_google_linkedin',
    confidence: scoreContact({ fullName, title, company, location: locationMatch?.[1] || '', summary: snippet }, filters),
    metadata: {
      position: result?.position,
      displayedLink: result?.displayed_link,
    },
  };

  return contact;
}

export async function searchWithSerpApi({ query, filters, limit = 15 }) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is missing.');
  }

  const fullQuery = [query, filters.school ? `${filters.school} alumni` : '', 'site:linkedin.com/in'].filter(Boolean).join(' ');
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', fullQuery);
  url.searchParams.set('num', String(Math.min(20, Math.max(10, limit))));
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpAPI request failed (${response.status}).`);
  }

  const payload = await response.json();
  const organicResults = Array.isArray(payload?.organic_results) ? payload.organic_results : [];

  const normalized = organicResults
    .map((result) => normalizeOrganicResult(result, filters))
    .filter(Boolean)
    .slice(0, limit);

  if (normalized.length === 0) {
    logWarn('SerpAPI returned zero normalizable contacts', { query });
  }

  return {
    provider: 'serpapi',
    queryUsed: fullQuery,
    contacts: normalized,
    fetchedAt: new Date().toISOString(),
  };
}
