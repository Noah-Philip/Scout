const app = document.getElementById('app');

const PROFILE_STORAGE_KEY = 'scout-network-profile-v2';
const APP_STORAGE_KEY = 'scout-app-state-v2';

const routes = ['landing', 'search', 'swipe', 'dashboard', 'profile', 'draft'];

const defaultProfile = {
  name: '',
  school: '',
  major: '',
  gradYear: '',
  interests: '',
  goals: '',
  background: '',
  resumeSummary: '',
  preferredCategories: '',
  tone: 'professional',
};

const presets = ['AI professors at UT Austin', 'software engineers at startups', 'alumni in consulting', 'recruiters at OpenAI'];

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeContacts(contacts = []) {
  const usedIds = new Set();

  return contacts
    .filter(Boolean)
    .map((contact, index) => {
      const safeContact = { ...contact };
      const fallbackIdSource = safeContact.profileUrl || `${safeContact.fullName || 'contact'}-${safeContact.company || ''}-${index}`;
      const fallbackId = `contact_${String(fallbackIdSource)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 42) || uid('contact')}`;
      const baseId = String(safeContact.id || fallbackId);

      let finalId = baseId;
      let suffix = 1;
      while (usedIds.has(finalId)) {
        finalId = `${baseId}_${suffix}`;
        suffix += 1;
      }

      usedIds.add(finalId);
      safeContact.id = finalId;
      return safeContact;
    });
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const savedProfile = readJson(PROFILE_STORAGE_KEY, null);
const savedApp = readJson(APP_STORAGE_KEY, null);

const state = {
  route: 'landing',
  query: savedApp?.query || '',
  loading: false,
  error: '',
  contacts: normalizeContacts(Array.isArray(savedApp?.contacts) ? savedApp.contacts : []),
  selectedContactId: savedApp?.selectedContactId || null,
  profile: { ...defaultProfile, ...(savedProfile || {}) },
  profileSavedAt: savedApp?.profileSavedAt || null,
  drafts: Array.isArray(savedApp?.drafts) ? savedApp.drafts : [],
  sentEmails: Array.isArray(savedApp?.sentEmails) ? savedApp.sentEmails : [],
  reachedOut: Array.isArray(savedApp?.reachedOut) ? savedApp.reachedOut : [],
  swipeDecisions: savedApp?.swipeDecisions || {},
  emailLoading: false,
  emailError: '',
  generated: savedApp?.generated || null,
  activeDraftId: savedApp?.activeDraftId || null,
};

const hasHashRoute = window.location.hash && routes.includes(window.location.hash.replace('#/', ''));
if (hasHashRoute) state.route = window.location.hash.replace('#/', '');
if (!state.selectedContactId && state.contacts[0]) state.selectedContactId = state.contacts[0].id;
if (state.selectedContactId && !state.contacts.some((contact) => contact.id === state.selectedContactId)) {
  state.selectedContactId = state.contacts[0]?.id || null;
}

function persistState() {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));
  localStorage.setItem(
    APP_STORAGE_KEY,
    JSON.stringify({
      query: state.query,
      contacts: state.contacts,
      selectedContactId: state.selectedContactId,
      drafts: state.drafts,
      sentEmails: state.sentEmails,
      reachedOut: state.reachedOut,
      swipeDecisions: state.swipeDecisions,
      generated: state.generated,
      activeDraftId: state.activeDraftId,
      profileSavedAt: state.profileSavedAt,
    }),
  );
}

function navigate(route) {
  if (!routes.includes(route)) return;
  state.route = route;
  window.location.hash = `/${route}`;
  render();
}

function getContactById(contactId) {
  return state.contacts.find((contact) => contact.id === contactId) || null;
}

function getSelectedContact() {
  return getContactById(state.selectedContactId);
}

function ensureDraftForContact(contact, source = 'swipe') {
  if (!contact) return;
  if (state.drafts.some((draft) => draft.contactId === contact.id && draft.status !== 'sent')) return;
  state.drafts.unshift({
    id: uid('draft'),
    contactId: contact.id,
    contactName: contact.fullName,
    subject: `Intro request from ${state.profile.name || 'a student'}`,
    full: '',
    opener: '',
    middle: '',
    close: '',
    company: contact.company,
    source,
    status: 'interested',
    updatedAt: new Date().toISOString(),
  });
  persistState();
}

function markReachedOut(contact, draft) {
  const existing = state.reachedOut.find((item) => item.contactId === contact.id);
  if (existing) {
    existing.lastDraftId = draft.id;
    existing.lastSubject = draft.subject;
    existing.status = 'sent';
    existing.followUpState = 'follow-up due in 5 days';
    existing.updatedAt = new Date().toISOString();
  } else {
    state.reachedOut.unshift({
      id: uid('reach'),
      contactId: contact.id,
      name: contact.fullName,
      company: contact.company,
      role: contact.title,
      status: 'sent',
      followUpState: 'follow-up due in 5 days',
      lastDraftId: draft.id,
      lastSubject: draft.subject,
      updatedAt: new Date().toISOString(),
    });
  }
}

function buildProfilePayload() {
  const whoTheyAre = [state.profile.major ? `${state.profile.major} student` : 'student', state.profile.school ? `at ${state.profile.school}` : '', state.profile.gradYear ? `(${state.profile.gradYear})` : '']
    .filter(Boolean)
    .join(' ')
    .trim();

  const background = [state.profile.background, state.profile.resumeSummary ? `Resume summary: ${state.profile.resumeSummary}` : '', state.profile.interests ? `Interests: ${state.profile.interests}` : '']
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    profile: {
      name: state.profile.name,
      whoTheyAre,
      background,
    },
    request: {
      whyReachingOut: state.profile.goals || 'I am hoping to learn from your path and ask for brief guidance.',
      ask: 'a 15-minute coffee chat or quick advice over email',
      tone: state.profile.tone,
      extraNotes: state.profile.preferredCategories || '',
    },
  };
}

function renderTopNav() {
  const links = [
    ['landing', 'Landing'],
    ['search', 'Search'],
    ['swipe', 'Swipe'],
    ['dashboard', 'Dashboard'],
    ['profile', 'Profile'],
  ];

  return `
    <nav class="top-nav">
      <a class="brand" href="#/landing">Scout</a>
      <div class="nav-links">
        ${links
          .map(([route, label]) => `<button class="nav-link ${state.route === route ? 'active' : ''}" data-route="${route}">${label}</button>`)
          .join('')}
      </div>
      <button class="btn primary" data-route="search">Start networking</button>
    </nav>
  `;
}

function renderLanding() {
  return `
    <section class="landing-hero">
      <p class="eyebrow">Student networking, reimagined</p>
      <h1>Scout is Tinder for networking.</h1>
      <p class="hero-copy">Discover professors, alumni, recruiters, and engineers, swipe through relevant people, and generate personalized outreach drafts in seconds.</p>
      <div class="hero-actions">
        <button class="btn primary lg" data-route="search">Launch Scout</button>
        <button class="btn ghost lg" data-route="profile">Set up your profile</button>
      </div>
      <div class="hero-stats">
        <div><strong>Search live</strong><span>Find relevant people from real web results</span></div>
        <div><strong>Swipe flow</strong><span>Quickly shortlist who to contact next</span></div>
        <div><strong>AI drafts</strong><span>Generate outreach personalized to your story</span></div>
      </div>
    </section>

    <section class="marketing-grid">
      <article class="mkt-card">
        <h3>How Scout works</h3>
        <ol>
          <li>Search for people by role, school, company, or industry.</li>
          <li>Browse results and swipe right on your best-fit contacts.</li>
          <li>Generate tailored outreach and manage follow-ups from one dashboard.</li>
        </ol>
      </article>
      <article class="mkt-card">
        <h3>Built for students</h3>
        <p>Use Scout for research outreach, internship referrals, coffee chats, alumni networking, and mentor discovery—without writing every cold email from scratch.</p>
      </article>
      <article class="mkt-card highlight">
        <h3>Why it stands out</h3>
        <p>Most networking tools are CRM-heavy. Scout gives you momentum: discover, decide, and draft inside one intentional flow.</p>
      </article>
    </section>
  `;
}

function contactCard(contact) {
  const isSelected = state.selectedContactId === contact.id;

  return `
    <article class="result-card ${isSelected ? 'selected' : ''}">
      <button class="result-select" data-contact="${contact.id}">
        <h3>${esc(contact.fullName || 'Unknown')}</h3>
        <p>${esc(contact.title || 'Role unavailable')} · ${esc(contact.company || 'Organization unavailable')}</p>
        <p class="muted small">${esc(contact.summary || contact.matchExplanation || 'No summary available')}</p>
      </button>
      <div class="result-meta">
        <span>${Math.round((contact.confidence || 0) * 100)}% fit</span>
        <span>${esc(contact.source || 'web')}</span>
      </div>
      <div class="actions">
        <button class="btn" data-mark-interested="${contact.id}">Interested</button>
        <button class="btn" data-open-draft="${contact.id}">Draft</button>
        ${contact.profileUrl ? `<a class="btn link-btn" href="${esc(contact.profileUrl)}" target="_blank" rel="noopener">Source</a>` : ''}
      </div>
    </article>
  `;
}

function renderSearch() {
  const selected = getSelectedContact();

  return `
    <section class="page-head">
      <h1>Discover people</h1>
      <p>Search for professors, alumni, recruiters, and professionals relevant to your goals.</p>
    </section>

    <section class="search-shell panel premium">
      <div class="search-row">
        <input id="query" placeholder="e.g. AI professors at UT Austin" value="${esc(state.query)}" />
        <button id="run-search" class="btn primary" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Searching…' : 'Search'}</button>
      </div>
      <div class="chips">${presets.map((preset) => `<button class="chip" data-preset="${esc(preset)}">${esc(preset)}</button>`).join('')}</div>
      ${state.error ? `<p class="error">${esc(state.error)}</p>` : ''}
    </section>

    <section class="results-layout">
      <section class="panel">
        <div class="section-title-row"><h2>Results (${state.contacts.length})</h2><button class="btn" data-route="swipe" ${state.contacts.length ? '' : 'disabled'}>Open swipe deck</button></div>
        ${state.loading ? '<p>Loading results…</p>' : ''}
        ${!state.loading && !state.contacts.length ? '<p class="muted">Run a search to load people you can swipe, mark interested, and draft outreach for.</p>' : ''}
        <div class="result-list">${state.contacts.map(contactCard).join('')}</div>
      </section>

      <aside class="panel detail-panel">
        <h2>Selected profile</h2>
        ${
          selected
            ? `
            <h3>${esc(selected.fullName)}</h3>
            <p>${esc(selected.title || '')} ${selected.company ? `at ${esc(selected.company)}` : ''}</p>
            <p class="muted">${esc(selected.location || 'Location unavailable')}</p>
            <p>${esc(selected.summary || selected.matchExplanation || 'No detailed summary available')}</p>
            <div class="kv-stack">
              <div><strong>Relevance:</strong> ${Math.round((selected.confidence || 0) * 100)}%</div>
              <div><strong>Source:</strong> ${esc(selected.source || 'web')}</div>
              ${selected.companyUrl ? `<div><strong>Company:</strong> <a href="${esc(selected.companyUrl)}" target="_blank" rel="noopener">${esc(selected.companyUrl)}</a></div>` : ''}
            </div>
            <div class="actions">
              <button class="btn primary" data-open-draft="${selected.id}">Generate draft</button>
              <button class="btn" data-mark-interested="${selected.id}">Mark interested</button>
            </div>
          `
            : '<p class="muted">Select a search result to preview details and generate outreach.</p>'
        }
      </aside>
    </section>
  `;
}

function renderProfile() {
  return `
    <section class="page-head">
      <h1>Your Scout profile</h1>
      <p>This profile powers personalization across search, swipe, and email drafting.</p>
    </section>

    <section class="panel profile-panel premium">
      <div class="grid two">
        <label>Name<input name="name" value="${esc(state.profile.name)}" placeholder="Jane Student" /></label>
        <label>School<input name="school" value="${esc(state.profile.school)}" placeholder="UT Austin" /></label>
        <label>Major<input name="major" value="${esc(state.profile.major)}" placeholder="Computer Science" /></label>
        <label>Grad year<input name="gradYear" value="${esc(state.profile.gradYear)}" placeholder="2027" /></label>
        <label>Interests<textarea name="interests" placeholder="AI research, fintech, product strategy">${esc(state.profile.interests)}</textarea></label>
        <label>Goals<textarea name="goals" placeholder="Find mentors and internship referrals">${esc(state.profile.goals)}</textarea></label>
        <label>Background / experience<textarea name="background" placeholder="Projects, clubs, internships">${esc(state.profile.background)}</textarea></label>
        <label>Resume summary<textarea name="resumeSummary" placeholder="Paste key resume highlights">${esc(state.profile.resumeSummary)}</textarea></label>
        <label>Preferred outreach categories<textarea name="preferredCategories" placeholder="Professors, alumni, startup engineers">${esc(state.profile.preferredCategories)}</textarea></label>
        <label>Preferred tone
          <select name="tone">
            ${['professional', 'warm', 'casual', 'formal', 'direct'].map((tone) => `<option ${state.profile.tone === tone ? 'selected' : ''}>${tone}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="actions">
        <button class="btn primary" id="save-profile">Save profile</button>
        <button class="btn" data-route="search">Go to search</button>
      </div>
      ${state.profileSavedAt ? `<p class="muted">Saved ${new Date(state.profileSavedAt).toLocaleString()}.</p>` : ''}
    </section>
  `;
}

function renderSwipe() {
  const queue = state.contacts.filter((contact) => !state.swipeDecisions[contact.id] || state.swipeDecisions[contact.id] === 'queued');
  const top = queue[0] || null;

  return `
    <section class="page-head">
      <h1>Swipe prospects</h1>
      <p>Right = interested, left = skip. Interested contacts go straight into your current drafts queue.</p>
    </section>

    <section class="swipe-layout">
      <div class="panel swipe-panel premium">
        <div class="swipe-stage" id="swipe-stage">
          ${
            top
              ? queue
                  .slice(0, 3)
                  .reverse()
                  .map((contact, idx, list) => {
                    const isTop = idx === list.length - 1;
                    return `
                    <article class="swipe-card ${isTop ? 'top-card' : ''}" data-swipe-card="${contact.id}" style="--stack:${list.length - idx};">
                      <p class="eyebrow">${esc(contact.source || 'web result')}</p>
                      <h2>${esc(contact.fullName)}</h2>
                      <p>${esc(contact.title || 'Role unavailable')} · ${esc(contact.company || 'Organization unavailable')}</p>
                      <p class="muted">${esc(contact.summary || contact.matchExplanation || 'No summary available')}</p>
                      <div class="card-footer">
                        <span>${Math.round((contact.confidence || 0) * 100)}% fit</span>
                        ${contact.profileUrl ? `<a href="${esc(contact.profileUrl)}" target="_blank" rel="noopener">Source ↗</a>` : ''}
                      </div>
                    </article>
                  `;
                  })
                  .join('')
              : '<div class="empty-swipe"><h3>No cards in your deck.</h3><p>Run a search first, then come back to swipe.</p><button class="btn primary" data-route="search">Go to search</button></div>'
          }
        </div>

        <div class="swipe-actions">
          <button class="btn danger" data-swipe-action="left" ${top ? '' : 'disabled'}>Skip</button>
          <button class="btn primary" data-swipe-action="right" ${top ? '' : 'disabled'}>Interested</button>
          <button class="btn" data-open-draft="${top?.id || ''}" ${top ? '' : 'disabled'}>Quick draft</button>
        </div>
      </div>

      <aside class="panel">
        <h3>Swipe outcomes</h3>
        <p><strong>Interested:</strong> ${Object.values(state.swipeDecisions).filter((v) => v === 'interested').length}</p>
        <p><strong>Skipped:</strong> ${Object.values(state.swipeDecisions).filter((v) => v === 'skipped').length}</p>
        <button class="btn" data-route="dashboard">View outreach dashboard</button>
      </aside>
    </section>
  `;
}

function renderDraftPage() {
  const selected = getSelectedContact();
  const activeDraft = state.activeDraftId ? state.drafts.find((draft) => draft.id === state.activeDraftId) : null;

  return `
    <section class="page-head">
      <h1>Draft outreach</h1>
      <p>Generate and edit personalized cold email drafts using contact + profile context.</p>
    </section>

    <section class="results-layout">
      <section class="panel premium">
        <h2>Context</h2>
        ${
          selected
            ? `
            <p><strong>To:</strong> ${esc(selected.fullName)} — ${esc(selected.title || '')} ${selected.company ? `at ${esc(selected.company)}` : ''}</p>
            <p class="muted">${esc(selected.summary || selected.matchExplanation || 'No summary available')}</p>
            <div class="actions">
              <button id="generate-email" class="btn primary" ${state.emailLoading ? 'disabled' : ''}>${state.emailLoading ? 'Generating…' : 'Generate AI draft'}</button>
              <button class="btn" data-edit="shorten" ${activeDraft ? '' : 'disabled'}>Shorten</button>
              <button class="btn" data-edit="make warmer" ${activeDraft ? '' : 'disabled'}>Warmer</button>
              <button class="btn" data-edit="make more direct" ${activeDraft ? '' : 'disabled'}>More direct</button>
            </div>
          `
            : '<p>Select someone from Search or Swipe first.</p>'
        }
        ${state.emailError ? `<p class="error">${esc(state.emailError)}</p>` : ''}
      </section>

      <section class="panel draft-editor">
        <h2>Draft editor</h2>
        ${
          activeDraft
            ? `
            <label>Subject<input id="draft-subject" value="${esc(activeDraft.subject)}" /></label>
            <label>Email body<textarea id="draft-body">${esc(activeDraft.full)}</textarea></label>
            ${activeDraft.reasoning ? `<p class="muted"><strong>Personalization reasoning:</strong> ${esc(activeDraft.reasoning)}</p>` : ''}
            <div class="actions">
              <button class="btn" id="copy-email">Copy draft</button>
              <button class="btn primary" id="mark-sent">Mark sent</button>
              <button class="btn" id="save-draft">Save edits</button>
            </div>
          `
            : '<p class="muted">Generate a draft to start editing.</p>'
        }
      </section>
    </section>
  `;
}

function renderDashboard() {
  const draftRows = state.drafts
    .map(
      (draft) => `
      <article class="dash-item" role="button" tabindex="0" data-open-draft="${draft.contactId}">
        <div>
          <h4>${esc(draft.subject)}</h4>
          <p class="muted small">${esc(draft.contactName)} · ${esc(draft.company || 'Unknown')}</p>
        </div>
        <span class="pill">${esc(draft.status)}</span>
      </article>
    `,
    )
    .join('');

  const sentRows = state.sentEmails
    .map(
      (email) => `
      <article class="dash-item">
        <div>
          <h4>${esc(email.subject)}</h4>
          <p class="muted small">${esc(email.contactName)} · sent ${new Date(email.sentAt).toLocaleDateString()}</p>
        </div>
        <span class="pill success">sent</span>
      </article>
    `,
    )
    .join('');

  const outreachRows = state.reachedOut
    .map(
      (item) => `
      <article class="dash-item">
        <div>
          <h4>${esc(item.name)}</h4>
          <p class="muted small">${esc(item.status)} · ${esc(item.followUpState)}</p>
        </div>
        <span class="pill">${esc(item.company || 'Unknown')}</span>
      </article>
    `,
    )
    .join('');

  return `
    <section class="page-head">
      <h1>Outreach dashboard</h1>
      <p>Your control center for interested contacts, draft outreach, and follow-ups.</p>
    </section>

    <section class="dashboard-grid">
      <section class="panel">
        <div class="section-title-row"><h3>Current drafts</h3><button class="btn" data-route="draft">Open draft flow</button></div>
        ${draftRows || '<p class="muted">No drafts yet.</p>'}
      </section>
      <section class="panel">
        <h3>Sent emails</h3>
        ${sentRows || '<p class="muted">No sent emails tracked yet.</p>'}
      </section>
      <section class="panel">
        <h3>Contacts reached out to</h3>
        ${outreachRows || '<p class="muted">No outreach activity yet.</p>'}
      </section>
    </section>
  `;
}

function renderPage() {
  if (state.route === 'landing') return renderLanding();
  if (state.route === 'search') return renderSearch();
  if (state.route === 'swipe') return renderSwipe();
  if (state.route === 'dashboard') return renderDashboard();
  if (state.route === 'profile') return renderProfile();
  return renderDraftPage();
}

function render() {
  app.innerHTML = `
    <main class="shell">
      ${renderTopNav()}
      ${renderPage()}
    </main>
  `;
  attachSwipeDrag();
}

function updateSwipeDecision(contactId, decision) {
  state.swipeDecisions[contactId] = decision;
  const selected = getSelectedContact();
  if (selected?.id === contactId) {
    const next = state.contacts.find((contact) => !state.swipeDecisions[contact.id] || state.swipeDecisions[contact.id] === 'queued');
    state.selectedContactId = next?.id || state.selectedContactId;
  }
  persistState();
  render();
}

function attachSwipeDrag() {
  const topCard = app.querySelector('.top-card');
  if (!topCard) return;

  const contactId = topCard.getAttribute('data-swipe-card');
  let active = false;
  let startX = 0;
  let currentX = 0;

  const onMove = (event) => {
    if (!active) return;
    const point = event.touches ? event.touches[0] : event;
    currentX = point.clientX - startX;
    const rotate = currentX * 0.06;
    topCard.style.transform = `translateX(${currentX}px) rotate(${rotate}deg)`;
    topCard.style.opacity = `${Math.max(0.3, 1 - Math.abs(currentX) / 420)}`;
  };

  const endGesture = () => {
    if (!active) return;
    active = false;

    if (currentX > 120) {
      updateSwipeDecision(contactId, 'interested');
      ensureDraftForContact(getContactById(contactId), 'swipe');
      return;
    }

    if (currentX < -120) {
      updateSwipeDecision(contactId, 'skipped');
      return;
    }

    topCard.style.transform = '';
    topCard.style.opacity = '';
    currentX = 0;
  };

  const startGesture = (event) => {
    const point = event.touches ? event.touches[0] : event;
    active = true;
    startX = point.clientX;
  };

  topCard.addEventListener('mousedown', startGesture);
  topCard.addEventListener('touchstart', startGesture, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', endGesture);
  window.addEventListener('touchend', endGesture);
}

async function runSearch() {
  if (!state.query.trim()) {
    state.error = 'Enter a search query first.';
    render();
    return;
  }

  state.loading = true;
  state.error = '';
  state.contacts = [];
  render();

  try {
    const response = await fetch('/api/search/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: state.query, limit: 20 }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || payload.error || 'Search failed');

    state.contacts = normalizeContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
    state.selectedContactId = state.contacts[0]?.id || null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Search failed';
  } finally {
    state.loading = false;
    persistState();
    render();
  }
}

async function generateEmail(editInstruction = '') {
  const selected = getSelectedContact();
  if (!selected) return;

  state.emailLoading = true;
  state.emailError = '';
  render();

  try {
    const { profile, request } = buildProfilePayload();

    const response = await fetch('/api/email/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: state.query,
        editInstruction,
        contact: selected,
        profile,
        request,
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || payload.error || 'Email generation failed');

    const draft = {
      id: uid('draft'),
      ...payload.draft,
      contactId: selected.id,
      contactName: selected.fullName,
      company: selected.company,
      status: 'draft',
      reasoning: `Personalized for ${selected.fullName} based on your profile (${state.profile.school || 'student profile'}) and query: ${state.query || 'manual selection'}.`,
      updatedAt: new Date().toISOString(),
    };

    state.generated = draft;
    state.activeDraftId = draft.id;
    const existingDraftIndex = state.drafts.findIndex((item) => item.contactId === selected.id && item.status !== 'sent');
    if (existingDraftIndex >= 0) {
      state.drafts.splice(existingDraftIndex, 1);
    }
    state.drafts.unshift(draft);
  } catch (error) {
    state.emailError = error instanceof Error ? error.message : 'Email generation failed';
  } finally {
    state.emailLoading = false;
    persistState();
    render();
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target;

  const navButton = target.closest('[data-route]');
  if (navButton) {
    navigate(navButton.getAttribute('data-route'));
    return;
  }

  const preset = target.closest('[data-preset]');
  if (preset) {
    state.query = preset.getAttribute('data-preset') || '';
    render();
    return;
  }

  if (target.id === 'run-search') {
    await runSearch();
    return;
  }

  const result = target.closest('[data-contact]');
  if (result) {
    state.selectedContactId = result.getAttribute('data-contact');
    persistState();
    render();
    return;
  }

  const interestedBtn = target.closest('[data-mark-interested]');
  if (interestedBtn) {
    const contact = getContactById(interestedBtn.getAttribute('data-mark-interested'));
    if (contact) {
      state.swipeDecisions[contact.id] = 'interested';
      ensureDraftForContact(contact, 'search');
      persistState();
    }
    render();
    return;
  }

  const draftBtn = target.closest('[data-open-draft]');
  if (draftBtn) {
    const contactId = draftBtn.getAttribute('data-open-draft');
    if (contactId) {
      state.selectedContactId = contactId;
      const draftForContact = state.drafts.find((draft) => draft.contactId === contactId && draft.status !== 'sent');
      state.activeDraftId = draftForContact?.id || null;
      persistState();
    }
    navigate('draft');
    return;
  }

  if (target.id === 'save-profile') {
    state.profileSavedAt = new Date().toISOString();
    persistState();
    render();
    return;
  }

  if (target.id === 'generate-email') {
    await generateEmail('');
    return;
  }

  const editBtn = target.closest('[data-edit]');
  if (editBtn) {
    await generateEmail(editBtn.getAttribute('data-edit') || '');
    return;
  }

  const swipeAction = target.closest('[data-swipe-action]');
  if (swipeAction) {
    const queue = state.contacts.filter((contact) => !state.swipeDecisions[contact.id] || state.swipeDecisions[contact.id] === 'queued');
    const top = queue[0];
    if (!top) return;
    const action = swipeAction.getAttribute('data-swipe-action');

    if (action === 'right') {
      updateSwipeDecision(top.id, 'interested');
      ensureDraftForContact(top, 'swipe');
      return;
    }

    if (action === 'left') {
      updateSwipeDecision(top.id, 'skipped');
      return;
    }

  }

  const activeDraft = state.activeDraftId ? state.drafts.find((draft) => draft.id === state.activeDraftId) : null;

  if (target.id === 'save-draft' && activeDraft) {
    const subject = app.querySelector('#draft-subject')?.value || activeDraft.subject;
    const full = app.querySelector('#draft-body')?.value || activeDraft.full;
    activeDraft.subject = subject;
    activeDraft.full = full;
    activeDraft.updatedAt = new Date().toISOString();
    persistState();
    render();
    return;
  }

  if (target.id === 'copy-email' && activeDraft) {
    await navigator.clipboard.writeText(`Subject: ${activeDraft.subject}\n\n${activeDraft.full}`);
    return;
  }

  if (target.id === 'mark-sent' && activeDraft) {
    activeDraft.status = 'sent';
    activeDraft.sentAt = new Date().toISOString();
    const contact = getContactById(activeDraft.contactId);
    if (contact) markReachedOut(contact, activeDraft);

    state.sentEmails.unshift({
      id: uid('sent'),
      draftId: activeDraft.id,
      subject: activeDraft.subject,
      contactName: activeDraft.contactName,
      sentAt: activeDraft.sentAt,
    });

    persistState();
    navigate('dashboard');
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;

  if (target.id === 'query') {
    state.query = target.value;
    return;
  }

  if (target.name && Object.hasOwn(state.profile, target.name)) {
    state.profile[target.name] = target.value;
  }
});

window.addEventListener('hashchange', () => {
  const route = window.location.hash.replace('#/', '');
  if (routes.includes(route)) {
    state.route = route;
    render();
  }
});

render();
