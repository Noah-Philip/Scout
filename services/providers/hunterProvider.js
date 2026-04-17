import { logWarn } from '../logger.js';

export async function enrichEmailsWithHunter(contacts = []) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || contacts.length === 0) {
    return contacts;
  }

  const byCompany = new Map();
  for (const contact of contacts) {
    if (!contact.company) continue;
    if (!byCompany.has(contact.company.toLowerCase())) byCompany.set(contact.company.toLowerCase(), []);
    byCompany.get(contact.company.toLowerCase()).push(contact);
  }

  for (const [, group] of byCompany.entries()) {
    const first = group[0];
    if (!first.company) continue;

    try {
      const url = new URL('https://api.hunter.io/v2/domain-search');
      url.searchParams.set('company', first.company);
      url.searchParams.set('limit', '10');
      url.searchParams.set('api_key', apiKey);
      const response = await fetch(url);
      if (!response.ok) continue;
      const payload = await response.json();
      const emails = Array.isArray(payload?.data?.emails) ? payload.data.emails : [];

      for (const contact of group) {
        const nameTokens = contact.fullName.toLowerCase().split(/\s+/);
        const matched = emails.find((item) => {
          const firstName = String(item?.first_name || '').toLowerCase();
          const lastName = String(item?.last_name || '').toLowerCase();
          return nameTokens.includes(firstName) && nameTokens.includes(lastName);
        });

        if (matched?.value) {
          contact.email = matched.value;
          contact.metadata.hunter = {
            confidence: matched.confidence,
            sources: matched.sources,
          };
          contact.matchExplanation = `${contact.matchExplanation}. Work email matched by Hunter domain search.`;
        }
      }
    } catch (error) {
      logWarn('Hunter enrichment failed for company', {
        company: first.company,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return contacts;
}
