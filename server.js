import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchPeople, getPeopleSearchMode } from './services/peopleSearch.js';
import { generateEmailDraft, getOpenAIClient } from './services/providers/openaiProvider.js';
import { logError, logInfo } from './services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4173);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function providerStatus() {
  return {
    peopleSearch: {
      provider: 'SerpAPI Google + LinkedIn result parsing',
      configured: Boolean(process.env.SERPAPI_API_KEY),
      envVar: 'SERPAPI_API_KEY',
    },
    emailEnrichment: {
      provider: 'Hunter domain search (optional)',
      configured: Boolean(process.env.HUNTER_API_KEY),
      envVar: 'HUNTER_API_KEY',
    },
    llm: {
      provider: 'OpenAI',
      configured: Boolean(process.env.OPENAI_API_KEY),
      envVar: 'OPENAI_API_KEY',
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      fallback: !process.env.OPENAI_API_KEY,
    },
  };
}

app.get('/api/debug/providers', (_req, res) => {
  res.status(200).json({
    mode: getPeopleSearchMode(),
    status: providerStatus(),
    checkedAt: new Date().toISOString(),
  });
});

app.post('/api/search/people', async (req, res) => {
  const { query, limit } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'query (string) is required',
      developerMessage: 'Send JSON body: { "query": "software engineers at Google", "limit": 12 }',
    });
  }

  try {
    const result = await searchPeople({ query, limit });
    if (!result.contacts.length) {
      return res.status(200).json({
        ...result,
        userMessage: 'No matching contacts were found. Try a broader search query.',
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logError('People search failed', { query, error: msg });

    const statusCode = msg.includes('missing') ? 503 : msg.includes('(429)') ? 429 : 502;
    return res.status(statusCode).json({
      error: 'People search is currently unavailable.',
      userMessage: 'Search provider is unavailable right now. Please try again shortly.',
      developerMessage: msg,
    });
  }
});

app.post('/api/email/generate', async (req, res) => {
  const { contact, profile, request, query, editInstruction } = req.body || {};

  if (!contact || !contact.fullName) {
    return res.status(400).json({
      error: 'contact with fullName is required',
      developerMessage: 'Send body with contact object from search results.',
    });
  }

  if (!profile || !request) {
    return res.status(400).json({
      error: 'profile and request objects are required',
      developerMessage: 'profile: who they are/background, request: why/ask/tone',
    });
  }

  try {
    const draft = await generateEmailDraft({ contact, profile, request, query: query || '', editInstruction });
    return res.status(200).json({ draft, generatedAt: new Date().toISOString() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logError('Email generation failed', { contact: contact.fullName, error: msg });
    return res.status(502).json({
      error: 'Could not generate email draft',
      userMessage: 'Email generation failed. Please retry.',
      developerMessage: msg,
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  logInfo('Scout server started', { port, hasOpenAI: Boolean(getOpenAIClient()) });
});
