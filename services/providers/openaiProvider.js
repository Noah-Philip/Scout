function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
}

export function getOpenAIClient() {
  return process.env.OPENAI_API_KEY ? { configured: true } : null;
}

function fallbackEmail({ contact, profile, request, query }) {
  const firstName = contact.fullName?.split(' ')[0] || 'there';
  const who = profile.whoTheyAre || 'a student and early-career professional';
  const background = profile.background || 'I am actively building relevant experience';
  const why = request.whyReachingOut || 'I admire your career path';
  const ask = request.ask || 'a brief coffee chat';

  const full = `Hi ${firstName},\n\nI'm ${who}. ${background}. I'm reaching out because ${why}.\n\nGiven your work as ${contact.title || 'a professional'} at ${contact.company || 'your organization'}, I would really value ${ask}.\n\nIf helpful, I can work around your schedule.\n\nBest,\n${profile.name || '[Your Name]'}`;
  return {
    subject: `Quick networking request`,
    full,
    shorter: `Hi ${firstName}, I'm ${who}. I'd value ${ask} to learn from your path. Thanks!`,
    casual: `Hey ${firstName} — loved your background. Open to a quick chat?`,
    formal: `Dear ${contact.fullName}, I would be grateful for an opportunity to connect briefly regarding your professional experience.`,
    model: 'fallback-template',
    basedOnQuery: query,
  };
}

async function callOpenAIJson({ schemaName, schema, input }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload.output_text) {
    throw new Error('OpenAI response missing output_text');
  }
  return JSON.parse(payload.output_text);
}

export async function generateEmailDraft({ contact, profile, request, query, editInstruction }) {
  if (!process.env.OPENAI_API_KEY) return fallbackEmail({ contact, profile, request, query });

  const instruction = editInstruction ? `Apply this refinement request: ${editInstruction}` : 'Generate initial drafts.';

  try {
    const parsed = await callOpenAIJson({
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
      input: [
        {
          role: 'system',
          content:
            'You write truthful cold outreach emails for networking. Never fabricate facts. Return JSON with keys subject, full, shorter, casual, formal.',
        },
        { role: 'user', content: JSON.stringify({ contact, profile, request, query, instruction }) },
      ],
    });

    return {
      ...parsed,
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      basedOnQuery: query,
    };
  } catch {
    return fallbackEmail({ contact, profile, request, query });
  }
}

export async function parseWithOpenAI(query) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    return await callOpenAIJson({
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
      input: [
        {
          role: 'system',
          content:
            'Extract networking search filters into strict JSON with keys role, company, location, industry, school, keywords(array), confidence(0-1). Keep empty string when unknown.',
        },
        { role: 'user', content: query },
      ],
    });
  } catch {
    return null;
  }
}
