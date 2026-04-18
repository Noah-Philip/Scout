const app = document.getElementById('app');

const PROFILE_STORAGE_KEY = 'scout-network-profile-v1';

function readSavedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : null;
  } catch {
    return null;
  }
}

const savedProfile = readSavedProfile();

const state = {
  query: '',
  loading: false,
  error: '',
  contacts: [],
  selected: null,
  shortlisted: [],
  drafts: [],
  emailLoading: false,
  emailError: '',
  profileLocked: Boolean(savedProfile),
  emailForm: {
    name: savedProfile?.name || '',
    whoTheyAre: savedProfile?.whoTheyAre || '',
    background: savedProfile?.background || '',
    whyReachingOut: savedProfile?.whyReachingOut || '',
    ask: savedProfile?.ask || '',
    tone: savedProfile?.tone || 'professional',
    extraNotes: savedProfile?.extraNotes || '',
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

function saveProfile() {
  const profile = {
    name: state.emailForm.name,
    whoTheyAre: state.emailForm.whoTheyAre,
    background: state.emailForm.background,
    whyReachingOut: state.emailForm.whyReachingOut,
    ask: state.emailForm.ask,
    tone: state.emailForm.tone,
    extraNotes: state.emailForm.extraNotes,
  };

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function renderProfileSummary() {
  return `
    <div class="saved-profile">
      <p><strong>Saved profile:</strong> ${esc(state.emailForm.name || 'Unnamed user')} · ${esc(state.emailForm.whoTheyAre || 'No role yet')}</p>
      <p class="muted">Your profile defaults are reused for every email draft.</p>
      <button class="btn" id="edit-profile">Edit profile</button>
    </div>
  `;
}

function renderProfileForm() {
  return `
    <div class="profile-builder">
      <h3>Build your one-time profile</h3>
      <p class="muted">Set this once so you do not need to re-enter it for each new outreach email.</p>
      <div class="grid">
        <label>Your name<input name="name" value="${esc(state.emailForm.name)}" placeholder="Jane Student" /></label>
        <label>Who you are<input name="whoTheyAre" value="${esc(state.emailForm.whoTheyAre)}" placeholder="CS student at UT Austin" /></label>
        <label>Your background<textarea name="background">${esc(state.emailForm.background)}</textarea></label>
        <label>Default reason for reaching out<textarea name="whyReachingOut">${esc(state.emailForm.whyReachingOut)}</textarea></label>
        <label>Default ask<textarea name="ask">${esc(state.emailForm.ask)}</textarea></label>
        <label>Tone
          <select name="tone">
            ${['professional', 'warm', 'casual', 'formal', 'direct'].map((t) => `<option ${state.emailForm.tone === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label>Extra notes<textarea name="extraNotes">${esc(state.emailForm.extraNotes)}</textarea></label>
      </div>
      <div class="actions"><button class="btn" id="save-profile">Save profile defaults</button></div>
    </div>
  `;
}

function render() {
  app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <h1>Scout</h1>
        <p class="subtitle">Networking copilot: search → review → select → generate outreach.</p>
      </div>
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
                <span>${Math.round((c.confidence || 0) * 100)}% fit</span>
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
              <p>${esc(state.selected.summary || 'No public profile summary available.')}</p>
              ${state.selected.profileUrl ? `<p><a target="_blank" rel="noopener" href="${esc(state.selected.profileUrl)}">LinkedIn profile</a></p>` : ''}
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
      ${state.profileLocked ? renderProfileSummary() : renderProfileForm()}
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
          name: state.emailForm.name,
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

document.addEventListener('click', async (event) => {
  const target = event.target;

  const presetButton = target.closest('[data-preset]');
  if (presetButton) {
    state.query = presetButton.getAttribute('data-preset') || '';
    render();
    return;
  }

  if (target.id === 'run-search') {
    await runSearch();
    return;
  }

  const contactButton = target.closest('[data-contact]');
  if (contactButton) {
    const contactId = contactButton.getAttribute('data-contact');
    state.selected = state.contacts.find((c) => c.id === contactId) || null;
    render();
    return;
  }

  const shortlistButton = target.closest('[data-shortlist]');
  if (shortlistButton) {
    const c = state.contacts.find((item) => item.id === shortlistButton.getAttribute('data-shortlist'));
    if (c && !state.shortlisted.some((item) => item.id === c.id)) state.shortlisted.unshift(c);
    render();
    return;
  }

  const copyButton = target.closest('[data-copy-contact]');
  if (copyButton) {
    const c = state.contacts.find((item) => item.id === copyButton.getAttribute('data-copy-contact'));
    if (c?.profileUrl) await navigator.clipboard.writeText(c.profileUrl);
    return;
  }

  if (target.id === 'save-profile') {
    saveProfile();
    state.profileLocked = true;
    render();
    return;
  }

  if (target.id === 'edit-profile') {
    state.profileLocked = false;
    render();
    return;
  }

  if (target.id === 'generate-email') {
    await generateEmail('');
    return;
  }

  const editButton = target.closest('[data-edit]');
  if (editButton) {
    const cmd = editButton.getAttribute('data-edit') || '';
    await generateEmail(cmd);
    return;
  }

  if (target.id === 'copy-email' && state.generated?.full) {
    await navigator.clipboard.writeText(`Subject: ${state.generated.subject}\n\n${state.generated.full}`);
  }
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
