# Scout MVP

Scout is a polished full-stack MVP for:
1. Natural-language professional contact discovery.
2. Reviewing and shortlisting contacts.
3. Generating personalized cold outreach emails with multiple variants.

## Chosen APIs and why

### 1) Contact discovery: **SerpAPI (Google Search API)**
- **Why chosen:** fast setup, stable docs, returns real web search results, works well for `site:linkedin.com/in` people discovery.
- **Usage in Scout:** Scout builds a search query from the user prompt + parsed filters and normalizes each LinkedIn hit into a unified contact schema.
- **Key:** `SERPAPI_API_KEY`
- **Get key:** https://serpapi.com/

### 2) Optional contact enrichment: **Hunter Domain Search API**
- **Why chosen:** practical, straightforward, explicitly provides confidence/sources for work emails.
- **Usage in Scout:** optional second-pass enrichment by company to add work emails only when matched by person name and company.
- **Key:** `HUNTER_API_KEY`
- **Get key:** https://hunter.io/api

### 3) AI generation + query parsing: **OpenAI API**
- **Why chosen:** one provider handles structured query parsing and quality outreach generation.
- **Usage in Scout:**
  - parse query into `{ role, company, location, industry, school, keywords }`
  - generate subject + 4 email variants (full, shorter, casual, formal)
  - support refinement instructions (regenerate/shorten/warmer/direct)
- **Key:** `OPENAI_API_KEY` (and optional `OPENAI_MODEL`)
- **Get key:** https://platform.openai.com/api-keys

## Unified Scout contact schema

All provider outputs are normalized to:

```ts
{
  id: string;
  fullName: string;
  title: string;
  company: string;
  location: string;
  summary: string;
  profileUrl: string;
  companyUrl: string;
  email: string;
  source: string;
  confidence: number; // 0..1
  matchExplanation: string;
  metadata: Record<string, unknown>;
}
```

## Environment setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill required keys:
- `SERPAPI_API_KEY` (required for people search)
- `OPENAI_API_KEY` (recommended for best parsing + email quality)
- `HUNTER_API_KEY` (optional for work-email enrichment)

3. Run app:

```bash
npm install
npm start
```

Open: `http://localhost:4173`

## Local integration tests

### Provider health test route

```bash
curl http://localhost:4173/api/debug/providers
```

### People search test

```bash
curl -X POST http://localhost:4173/api/search/people \
  -H 'content-type: application/json' \
  -d '{"query":"software engineers at Google","limit":10}'
```

### Email generation test

```bash
curl -X POST http://localhost:4173/api/email/generate \
  -H 'content-type: application/json' \
  -d '{
    "query":"software engineers at Google",
    "contact":{"fullName":"Jane Doe","title":"Software Engineer","company":"Google","location":"Mountain View","summary":"...","profileUrl":"https://linkedin.com/in/janedoe","companyUrl":"","email":"","source":"serpapi","confidence":0.79,"matchExplanation":"","metadata":{}},
    "profile":{"whoTheyAre":"Alex, CS student","background":"I build ML apps"},
    "request":{"whyReachingOut":"I admire your infra work","ask":"a short coffee chat","tone":"professional"}
  }'
```

## Search pipeline architecture

1. **Input query** from user.
2. **Query parser** (`services/queryParser.js`): OpenAI JSON extraction, heuristic fallback if unavailable.
3. **Primary provider** (`services/providers/serpApiProvider.js`): Google results scoped to LinkedIn profiles.
4. **Normalization** into unified schema.
5. **Optional enrichment** (`services/providers/hunterProvider.js`) for ethically available work email.
6. **UI review layer**: list, detail panel, favorites.
7. **Email generation** (`services/providers/openaiProvider.js`) with variants and refinement controls.

## Error handling + resiliency

- Missing API keys: explicit configuration errors and status visibility via `/api/debug/providers`.
- Invalid keys/quota/rate limits: provider-specific errors surfaced as clear user + developer messages.
- Partial outages: optional enrichment fails gracefully; core search still returns results when possible.
- Empty results: user gets a clear “try broader query” message.

## Extensibility notes

Provider code is separated by purpose:
- `services/providers/serpApiProvider.js`
- `services/providers/hunterProvider.js`
- `services/providers/openaiProvider.js`

This makes it straightforward to add or swap future people-data providers without changing UI contracts.
