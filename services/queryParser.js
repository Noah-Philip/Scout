import { parseWithGemini } from './providers/geminiProvider.js';

const STOPWORDS = new Set([
  'in', 'at', 'from', 'for', 'the', 'a', 'an', 'and', 'or', 'with', 'to', 'of', 'near', 'based', 'on', 'who',
]);

function clean(value) {
  return String(value || '').trim();
}

export function heuristicParse(query = '') {
  const q = clean(query);
  const lowered = q.toLowerCase();

  const roleMatch = lowered.match(/^(.*?)\s+(?:at|in)\s+/);
  const companyMatch = lowered.match(/(?:at)\s+([a-z0-9 .&-]+)(?:\s+in|$)/i);
  const locationMatch = lowered.match(/(?:in|based in)\s+([a-z0-9 .,&-]+)$/i);
  const schoolMatch = lowered.match(/([a-z0-9 .&-]+)\s+alumni/i);

  const role = roleMatch ? clean(roleMatch[1]) : '';
  const company = companyMatch ? clean(companyMatch[1]) : '';
  const location = locationMatch ? clean(locationMatch[1]) : '';
  const school = schoolMatch ? clean(schoolMatch[1]) : '';

  const keywords = lowered
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w && !STOPWORDS.has(w));

  return {
    role,
    company,
    location,
    industry: '',
    school,
    keywords: [...new Set(keywords)].slice(0, 12),
    confidence: role || company || location || school ? 0.6 : 0.3,
    parser: 'heuristic',
  };
}

export async function parseQueryWithLlm({ query }) {
  const parsed = await parseWithGemini(query);
  if (!parsed) return heuristicParse(query);

  return {
    role: clean(parsed.role),
    company: clean(parsed.company),
    location: clean(parsed.location),
    industry: clean(parsed.industry),
    school: clean(parsed.school),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(clean).filter(Boolean) : [],
    confidence: Number(parsed.confidence) || 0.5,
    parser: 'gemini',
  };
}
