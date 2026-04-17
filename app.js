const app = document.getElementById('app');

const state = {
  query: '',
  loading: false,
  error: '',
  contacts: [],
  selected: null,
  shortlisted: [],
  drafts: [],
  providerDebug: null,
  emailLoading: false,
  emailError: '',
  emailForm: {
    whoTheyAre: '',
    background: '',
    whyReachingOut: '',
    ask: '',
    tone: 'professional',
    extraNotes: '',
  },
  generated: null,
};

const presets = ['AI researchers', 'software engineers at Google', 'ML founders in Austin', 'UT alumni in product at Stripe'];

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render() {
  app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <h1>Scout</h1>
        <p class="subtitle">Networking copilot: search → review → select → generate outreach.</p>
      </div>
      <button class="btn" id="provider-check">Provider status</button>
    </header>

    <section class="panel search-panel">
      <label>Search professional contacts</label>
      <div class="search-row">
        <input id="query" placeholder="e.g. software engineers at Google" value="${esc(state.query)}" />
        <button class="btn primary" id="run-search" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Searching…' : 'Search'}</button>
      </div>
      <div class="chips">${presets.map((p) => `<button class="chip" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      ${state.error ? `<p class="error">${esc(state.error)}</p>` : ''}
    </section>

    <section class="layout">
      <section class="panel list-panel">
        <h2>Results (${state.contacts.length})</h2>
        ${state.loading ? '<p>Loading contacts…</p>' : ''}
        ${!state.loading && !state.contacts.length ? '<p>No results yet. Try a broad networking query.</p>' : ''}
        <div class="table-wrap">
          ${state.contacts
            .map(
              (c) => `
              <button class="contact-row ${state.selected?.id === c.id ? 'active' : ''}" data-contact="${c.id}">
                <div><strong>${esc(c.fullName)}</strong><p>${esc(c.title || 'Unknown role')} · ${esc(c.company || 'Unknown company')}</p></div>
                <span>${Math.round((c.confidence || 0) * 100)}%</span>
              </button>
            `,
            )
            .join('')}
        </div>
      </section>

      <section class="panel detail-panel">
        <h2>Contact detail</h2>
        ${
          state.selected
            ? `
              <h3>${esc(state.selected.fullName)}</h3>
              <p>${esc(state.selected.title || '')} ${state.selected.company ? `at ${esc(state.selected.company)}` : ''}</p>
              <p>${esc(state.selected.location || 'Location unavailable')}</p>
              <p>${esc(state.selected.summary || 'No summary available.')}</p>
              <p><strong>Source:</strong> ${esc(state.selected.source)}</p>
              <p><strong>Match:</strong> ${esc(state.selected.matchExplanation || '')}</p>
              ${state.selected.profileUrl ? `<p><a target="_blank" rel="noopener" href="${esc(state.selected.profileUrl)}">Profile URL</a></p>` : ''}
              ${state.selected.email ? `<p><strong>Email:</strong> ${esc(state.selected.email)}</p>` : '<p><strong>Email:</strong> Not ethically available from configured providers.</p>'}
              <div class="actions">
                <button class="btn" data-shortlist="${state.selected.id}">Favorite</button>
                <button class="btn" data-copy-contact="${state.selected.id}">Copy profile link</button>
              </div>
            `
            : '<p>Select a contact to open details.</p>'
        }
      </section>
    </section>

    <section class="panel email-panel">
      <h2>Generate outreach email</h2>
      <div class="grid">
        <label>Who you are<input name="whoTheyAre" value="${esc(state.emailForm.whoTheyAre)}" /></label>
        <label>Your background<textarea name="background">${esc(state.emailForm.background)}</textarea></label>
        <label>Why you are reaching out<textarea name="whyReachingOut">${esc(state.emailForm.whyReachingOut)}</textarea></label>
        <label>What you are asking for<textarea name="ask">${esc(state.emailForm.ask)}</textarea></label>
        <label>Tone
          <select name="tone">
            ${['professional', 'warm', 'casual', 'formal', 'direct'].map((t) => `<option ${state.emailForm.tone === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label>Extra notes<textarea name="extraNotes">${esc(state.emailForm.extraNotes)}</textarea></label>
      </div>
      <div class="actions">
        <button class="btn primary" id="generate-email" ${state.emailLoading || !state.selected ? 'disabled' : ''}>${state.emailLoading ? 'Generating…' : 'Generate'}</button>
        <button class="btn" data-edit="regenerate" ${!state.generated ? 'disabled' : ''}>Regenerate</button>
        <button class="btn" data-edit="shorten" ${!state.generated ? 'disabled' : ''}>Shorten</button>
        <button class="btn" data-edit="make warmer" ${!state.generated ? 'disabled' : ''}>Make warmer</button>
        <button class="btn" data-edit="make more direct" ${!state.generated ? 'disabled' : ''}>Make more direct</button>
      </div>
      ${state.emailError ? `<p class="error">${esc(state.emailError)}</p>` : ''}
      ${
        state.generated
          ? `<article class="draft">
              <h3>Subject</h3><p>${esc(state.generated.subject)}</p>
              <h3>Full cold email</h3><pre>${esc(state.generated.full)}</pre>
              <h3>Shorter version</h3><pre>${esc(state.generated.shorter)}</pre>
              <h3>More casual version</h3><pre>${esc(state.generated.casual)}</pre>
              <h3>More formal version</h3><pre>${esc(state.generated.formal)}</pre>
              <button class="btn" id="copy-email">Copy full email</button>
            </article>`
          : ''
      }
    </section>

    <section class="panel utility-panel">
      <h2>Saved / recent</h2>
      <p><strong>Favorites:</strong> ${state.shortlisted.map((c) => esc(c.fullName)).join(', ') || 'None yet'}</p>
      <p><strong>Recent drafts:</strong> ${state.drafts.slice(0, 3).map((d) => esc(d.subject)).join(' | ') || 'None yet'}</p>
      ${
        state.providerDebug
          ? `<pre>${esc(JSON.stringify(state.providerDebug, null, 2))}</pre>`
          : '<p>Use “Provider status” to verify key setup and provider health.</p>'
      }
    </section>
  </main>`;
}

async function runSearch() {
  state.loading = true;
  state.error = '';
  state.contacts = [];
  state.selected = null;
  render();

  try {
    const response = await fetch('/api/search/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: state.query, limit: 15 }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || payload.error || 'Search failed');
    state.contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
    state.selected = state.contacts[0] || null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Search failed';
  } finally {
    state.loading = false;
    render();
  }
}

async function generateEmail(editInstruction = '') {
  if (!state.selected) return;

  state.emailLoading = true;
  state.emailError = '';
  render();

  try {
    const response = await fetch('/api/email/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: state.query,
        editInstruction,
        contact: state.selected,
        profile: {
          name: state.emailForm.whoTheyAre,
          whoTheyAre: state.emailForm.whoTheyAre,
          background: state.emailForm.background,
        },
        request: {
          whyReachingOut: state.emailForm.whyReachingOut,
          ask: state.emailForm.ask,
          tone: state.emailForm.tone,
          extraNotes: state.emailForm.extraNotes,
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || payload.error || 'Email generation failed');
    state.generated = payload.draft;
    state.drafts.unshift(payload.draft);
  } catch (error) {
    state.emailError = error instanceof Error ? error.message : 'Email generation failed';
  } finally {
    state.emailLoading = false;
    render();
  }
}

async function checkProviders() {
  const response = await fetch('/api/debug/providers');
  state.providerDebug = await response.json();
  render();
}

document.addEventListener('click', async (event) => {
  const target = event.target;

  if (target.matches('[data-preset]')) {
    state.query = target.getAttribute('data-preset') || '';
    render();
  }

  if (target.id === 'run-search') await runSearch();

  if (target.matches('[data-contact]')) {
    const contactId = target.getAttribute('data-contact');
    state.selected = state.contacts.find((c) => c.id === contactId) || null;
    render();
  }

  if (target.matches('[data-shortlist]')) {
    const c = state.contacts.find((item) => item.id === target.getAttribute('data-shortlist'));
    if (c && !state.shortlisted.some((item) => item.id === c.id)) state.shortlisted.unshift(c);
    render();
  }

  if (target.matches('[data-copy-contact]')) {
    const c = state.contacts.find((item) => item.id === target.getAttribute('data-copy-contact'));
    if (c?.profileUrl) await navigator.clipboard.writeText(c.profileUrl);
  }

  if (target.id === 'generate-email') await generateEmail('');

  if (target.matches('[data-edit]')) {
    const cmd = target.getAttribute('data-edit') || '';
    await generateEmail(cmd);
  }

  if (target.id === 'copy-email' && state.generated?.full) {
    await navigator.clipboard.writeText(`Subject: ${state.generated.subject}\n\n${state.generated.full}`);
  }

  if (target.id === 'provider-check') await checkProviders();
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'query') {
    state.query = target.value;
    return;
  }

  if (target.name && Object.hasOwn(state.emailForm, target.name)) {
    state.emailForm[target.name] = target.value;
  }
});

render();
