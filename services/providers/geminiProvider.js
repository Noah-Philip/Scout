import { logError } from '../logger.js';

function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

export function getGeminiClient() {
  return getGeminiApiKey() ? { configured: true } : null;
}

function fallbackEmail({ contact, profile, request, query }) {
  const firstName = contact.fullName?.split(' ')[0] || 'there';
  const who = profile.whoTheyAre || 'a student and early-career professional';
  const background = profile.background || 'I am actively building relevant experience';
  const why = request.whyReachingOut || 'I admire your career path';
  const ask = request.ask || 'a brief coffee chat';

  const full = `Hi ${firstName},\n\nI'm ${who}. ${background}. I'm reaching out because ${why}.\n\nGiven your work as ${contact.title || 'a professional'} at ${contact.company || 'your organization'}, I would really value ${ask}.\n\nIf helpful, I can work around your schedule.\n\nBest,\n${profile.name || '[Your Name]'}`;
  return {
    subject: 'Quick networking request',
    full,
    shorter: `Hi ${firstName}, I'm ${who}. I'd value ${ask} to learn from your path. Thanks!`,
    casual: `Hey ${firstName} — loved your background. Open to a quick chat?`,
    formal: `Dear ${contact.fullName}, I would be grateful for an opportunity to connect briefly regarding your professional experience.`,
    model: 'fallback-template',
    basedOnQuery: query,
  };
}

function extractTextFromGeminiResponse(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Gemini response missing text');

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate;

  return JSON.parse(jsonText);
}

async function callGeminiJson({ schemaName, schema, prompt }) {
  const model = getGeminiModel();
  const apiKey = getGeminiApiKey();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      systemInstruction: {
        parts: [
          {
            text: `Return valid JSON only. Follow this JSON schema name=${schemaName}: ${JSON.stringify(schema)}`,
          },
        ],
      },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API failed (${response.status})`);
  }

  const payload = await response.json();
  const text = extractTextFromGeminiResponse(payload);
  return extractJson(text);
}

export async function generateEmailDraft({ contact, profile, request, query, editInstruction }) {
  if (!getGeminiApiKey()) return fallbackEmail({ contact, profile, request, query });

  const instruction = editInstruction ? `Apply this refinement request: ${editInstruction}` : 'Generate initial drafts.';

  try {
    const parsed = await callGeminiJson({
      schemaName: 'outreach_email',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          subject: { type: 'string' },
          full: { type: 'string' },
          shorter: { type: 'string' },
          casual: { type: 'string' },
          formal: { type: 'string' },
        },
        required: ['subject', 'full', 'shorter', 'casual', 'formal'],
      },
      prompt: JSON.stringify({
        task: 'You write truthful cold outreach emails for networking. Never fabricate facts.',
        output: 'Return JSON with keys subject, full, shorter, casual, formal.',
        contact,
        profile,
        request,
        query,
        instruction,
      }),
    });

    return {
      ...parsed,
      model: getGeminiModel(),
      basedOnQuery: query,
    };
  } catch (error) {
    logError('Gemini email draft generation failed; using fallback template', {
      errorMessage: error?.message || String(error),
      status: error?.status || error?.response?.status || null,
      selectedModel: getGeminiModel(),
      hasGeminiKey: Boolean(getGeminiApiKey()),
    });
    return fallbackEmail({ contact, profile, request, query });
  }
}

export async function parseWithGemini(query) {
  if (!getGeminiApiKey()) return null;

  try {
    return await callGeminiJson({
      schemaName: 'search_filters',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          industry: { type: 'string' },
          school: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
        required: ['role', 'company', 'location', 'industry', 'school', 'keywords', 'confidence'],
      },
      prompt: `Extract networking search filters into strict JSON with keys role, company, location, industry, school, keywords(array), confidence(0-1). Keep empty string when unknown. Query: ${query}`,
    });
  } catch {
    return null;
  }
}
