import { goalOptions, mockContacts, queryPresets, toneOptions } from "./data.js";

const app = document.getElementById("app");

const state = {
  route: "landing",
  profile: {
    name: "",
    school: "",
    major: "",
    gradYear: "",
    email: "",
    interests: "",
    background: "",
    goals: "",
    resume: "",
    opportunities: [],
    industries: "",
    preferredOrgs: "",
  },
  contacts: [...mockContacts],
  swipeIndex: 0,
  saved: [],
  drafts: [],
  sendingDraftIds: [],
  sendErrors: {},
  scheduled: [],
  sent: [],
  responses: [
    {
      contact: "Jordan Lee",
      status: "Replied",
      note: "Available next Tuesday at 3:30 PM for a 20-min chat.",
    },
  ],
  swipeDirection: null,
  swipeAnimating: false,
};

const routes = ["landing", "onboarding", "discovery", "swipe", "drafts", "dashboard"];

function setRoute(route) {
  state.route = routes.includes(route) ? route : "landing";
  render();
}

function initials(name = "Scout User") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((v) => v[0].toUpperCase())
    .join("");
}

function generateDraft(contact, goal, tone = "network") {
  const profile = state.profile;
  const intro = profile.name
    ? `I'm ${profile.name}, a ${profile.major || "student"} at ${profile.school || "my university"}.`
    : "I'm a student exploring opportunities relevant to my goals.";

  const subjectLookup = {
    research: `Research interest in ${contact.organization} work`,
    coffee: `Quick coffee chat request from a student`,
    referral: `Seeking guidance on ${contact.organization} opportunities`,
    network: `Student reaching out — ${contact.organization}`,
  };

  const intentLine = {
    research: `I was impressed by your work on ${contact.tags[0]} and hoped to ask about potential research involvement.`,
    coffee: "I would be grateful for a brief 15–20 minute coffee chat to learn from your path.",
    referral: "If appropriate after learning more, I'd value your advice on positioning myself for relevant roles.",
    network: "I'm reaching out to learn from your experience and explore where I can contribute.",
  };

  return {
    id: `${contact.id}-${Date.now()}`,
    contactId: contact.id,
    contactName: contact.name,
    organization: contact.organization,
    goal,
    tone,
    subject: subjectLookup[tone],
    body: `Hi ${contact.name.split(" ")[0]},\n\n${intro} ${intentLine[tone]}\n\nYour background as ${contact.role} stood out because ${contact.relevance.toLowerCase()}\n\nIf you have availability in the coming weeks, I'd deeply appreciate a short conversation. Happy to adapt to your schedule.\n\nThank you for your time,\n${profile.name || "[Your Name]"}`,
    personalization: `Personalized using your profile (${profile.major || "major"}, ${profile.interests || "interests"}) and ${contact.name}'s ${contact.category.toLowerCase()} relevance score (${contact.confidence}%).`,
    status: "Drafted",
    nextAction: "Review and send",
  };
}

function nav() {
  return `
  <header class="topbar">
    <button class="brand" data-route="landing">
      <span class="brand-mark">S</span>
      <span>Scout</span>
    </button>
    <nav>
      ${routes
        .map(
          (r) =>
            `<button class="nav-link ${state.route === r ? "active" : ""}" data-route="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`
        )
        .join("")}
    </nav>
    <div class="avatar">${initials(state.profile.name)}</div>
  </header>`;
}

function landingView() {
  return `
  <section class="landing-reset">
    <div class="landing-hero">
      <div class="landing-copy">
        <p class="eyebrow">Swipe-powered student outreach</p>
        <h1>Find people worth reaching out to — then swipe them off the deck.</h1>
        <p class="lede">Scout helps you build momentum from profile to contact discovery to personalized draft emails in one focused workflow.</p>
        <div class="actions">
          <button class="btn primary" data-route="onboarding">Create your profile</button>
          <button class="btn ghost" data-route="swipe">Open swipe deck</button>
        </div>
      </div>
      <div class="landing-strip">
        <article class="panel">
          <h3>1. Build your profile</h3>
          <p>Share your goals and background once. Scout reuses it everywhere.</p>
        </article>
        <article class="panel">
          <h3>2. Discover contacts</h3>
          <p>Generate a target list by intent, interest area, and organization fit.</p>
        </article>
        <article class="panel">
          <h3>3. Swipe and draft</h3>
          <p>Swipe left/right, save contacts, and produce personalized outreach drafts quickly.</p>
        </article>
      </div>
    </div>
  </section>`;
}

function onboardingView() {
  const p = state.profile;
  return `
  <section class="asym-grid onboard">
    <div class="panel panel-ink">
      <h2>Build your outreach profile</h2>
      <p>This profile powers recommendations and personalized drafts across Scout.</p>
      <div class="grid two">
        <label>Name<input name="name" value="${p.name}" /></label>
        <label>School<input name="school" value="${p.school}" /></label>
        <label>Major<input name="major" value="${p.major}" /></label>
        <label>Graduation year<input name="gradYear" value="${p.gradYear}" /></label>
        <label>Email<input type="email" name="email" value="${p.email}" placeholder="you@school.edu" /></label>
      </div>
      <label>Interests<textarea name="interests" placeholder="AI, behavioral econ, healthcare systems...">${p.interests}</textarea></label>
      <label>Experience / background<textarea name="background" placeholder="Projects, clubs, internships, coursework...">${p.background}</textarea></label>
      <label>Career goals<textarea name="goals" placeholder="What are you aiming for this year?">${p.goals}</textarea></label>
      <label>Resume (paste text)
        <textarea name="resume" placeholder="Paste resume text or key bullets">${p.resume}</textarea>
      </label>
    </div>
    <div class="panel floated">
      <h3>Opportunity preferences</h3>
      <div class="checklist">
        ${goalOptions
          .map(
            (g) => `<label><input type="checkbox" name="opportunities" value="${g}" ${p.opportunities.includes(g) ? "checked" : ""}/> ${g}</label>`
          )
          .join("")}
      </div>
      <label>Preferred industries / fields<input name="industries" value="${p.industries}" placeholder="Consulting, AI research, biotech..."/></label>
      <label>Preferred companies / schools / departments<textarea name="preferredOrgs" placeholder="OpenAI, UT Austin CS, Bain...">${p.preferredOrgs}</textarea></label>
      <div class="actions split">
        <button class="btn ghost" data-route="landing">Back</button>
        <button class="btn primary" id="save-profile">Save profile</button>
      </div>
    </div>
  </section>`;
}

function discoveryView() {
  return `
  <section class="asym-grid discovery">
    <div class="panel stacky">
      <h2>Contact discovery</h2>
      <p>Browse your contact bank or generate one from specific criteria.</p>
      <label>Generate contact bank
        <input id="query-input" placeholder="e.g., professors in AI at UT Austin" />
      </label>
      <div class="preset-wrap">
      ${queryPresets.map((q) => `<button class="mini" data-query="${q}">${q}</button>`).join("")}
      </div>
      <button class="btn primary" id="generate-bank">Generate contacts</button>
    </div>
    <div class="contact-grid">
      ${state.contacts
        .map(
          (c) => `<article class="contact-card panel">
            <div class="meta-top"><span class="score">${c.confidence}% fit</span><span class="cat">${c.category}</span></div>
            <h3>${c.name}</h3>
            <p class="compact">${c.role} · ${c.organization}</p>
            <p>${c.bio}</p>
            <p class="why"><strong>Why relevant:</strong> ${c.relevance}</p>
            <div class="actions split"><button class="btn tiny" data-save="${c.id}">Save</button><button class="btn tiny primary" data-draft="${c.id}">Draft outreach</button></div>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function swipeView() {
  const current = state.contacts[state.swipeIndex];
  if (!current) {
    return `<section class="panel"><h2>Deck complete</h2><p>You reviewed all current contacts. Generate a new bank or jump to drafts.</p><div class="actions"><button class="btn" data-route="discovery">Generate more</button><button class="btn primary" data-route="drafts">View drafts</button></div></section>`;
  }
  const next = state.contacts[state.swipeIndex + 1];

  return `
  <section class="swipe-stage">
    <div class="swipe-stack">
      ${
        next
          ? `<article class="panel swipe-card-preview">
        <p class="eyebrow swipe-eyebrow">Up next</p>
        <h3>${next.name}</h3>
        <p class="compact">${next.role} · ${next.organization}</p>
        <p class="preview-bio">${next.bio}</p>
      </article>`
          : `<article class="panel swipe-card-preview swipe-card-preview-empty">
        <p class="compact">No more cards after this one.</p>
      </article>`
      }
      <article class="panel swipe-card-full ${state.swipeAnimating ? `swipe-${state.swipeDirection}` : ""}" data-swipe-card>
      <div class="swipe-feedback">
        <span class="swipe-badge swipe-badge-left">Skip</span>
        <span class="swipe-badge swipe-badge-right">Interested</span>
      </div>
      <div class="swipe-head">
        <div>
          <p class="eyebrow swipe-eyebrow">Swipe deck</p>
          <h3>${current.name}</h3>
          <p class="compact">${current.role} · ${current.organization}</p>
        </div>
        <div class="meta-top">
          <span class="score">${current.confidence}% relevance</span>
          <span class="cat">${current.category}</span>
        </div>
      </div>
      <p class="compact">${state.swipeIndex + 1} / ${state.contacts.length} reviewed</p>
      <p>${current.bio}</p>
      <p class="why">${current.relevance}</p>
      <p class="chipline">${current.tags.map((t) => `<span class="chip">${t}</span>`).join("")}</p>
      <div class="swipe-controls">
        <label>Outreach goal
          <select id="swipe-goal">${goalOptions.map((g) => `<option>${g}</option>`).join("")}</select>
        </label>
        <div class="actions split">
          <button class="btn" data-skip="${current.id}" ${state.swipeAnimating ? "disabled" : ""}>Swipe left · Skip</button>
          <button class="btn ghost" data-save="${current.id}" ${state.swipeAnimating ? "disabled" : ""}>Save for later</button>
          <button class="btn primary" data-interest="${current.id}" ${state.swipeAnimating ? "disabled" : ""}>Swipe right · Interested</button>
        </div>
      </div>
    </article>
    </div>
  </section>`;
}

function animateSwipe(direction, onComplete) {
  if (state.swipeAnimating) return;
  state.swipeDirection = direction;
  state.swipeAnimating = true;
  render();
  window.setTimeout(() => {
    onComplete();
    state.swipeAnimating = false;
    state.swipeDirection = null;
    render();
  }, 460);
}

function draftsView() {
  return `
  <section class="asym-grid drafts">
    <div class="panel stacky">
      <h2>Email drafts</h2>
      <p>Review, edit, and choose tone before sending.</p>
      ${state.drafts.length === 0 ? "<p class='empty'>No drafts yet. Swipe right on contacts or draft from discovery.</p>" : ""}
      <div class="list">
        ${state.drafts
          .map(
            (d, i) => `<button class="list-item ${i === 0 ? "active" : ""}" data-draft-index="${i}">${d.contactName} · ${d.goal}</button>`
          )
          .join("")}
      </div>
    </div>
    <div class="panel floated">
      ${renderDraftEditor(0)}
    </div>
  </section>`;
}

function renderDraftEditor(i) {
  const d = state.drafts[i];
  if (!d) {
    return `<h3>No draft selected</h3>`;
  }
  const isSending = state.sendingDraftIds.includes(d.id);
  const sendError = state.sendErrors[d.id];
  return `
    <h3>${d.contactName} · ${d.organization}</h3>
    <label>Tone / intent
      <select data-tone-id="${d.id}">
      ${toneOptions
        .map((t) => `<option value="${t.value}" ${d.tone === t.value ? "selected" : ""}>${t.label}</option>`)
        .join("")}
      </select>
    </label>
    <label>Subject<input data-subject-id="${d.id}" value="${d.subject}" /></label>
    <label>Email body<textarea data-body-id="${d.id}">${d.body}</textarea></label>
    <p class="why"><strong>Why personalized:</strong> ${d.personalization}</p>
    <div class="actions split">
      <button class="btn" data-schedule="${d.id}">Schedule</button>
      <button class="btn primary" data-send="${d.id}" ${isSending ? "disabled" : ""}>${isSending ? "Sending…" : "Send now"}</button>
    </div>
    ${sendError ? `<p class="error-message">${sendError} <button class="btn tiny" data-send="${d.id}">Retry</button></p>` : ""}
  `;
}

function dashboardView() {
  const sentCount = state.sent.length;
  const draftedCount = state.drafts.length;
  const scheduledCount = state.scheduled.length;
  const responses = state.responses.length;
  const responseRate = sentCount ? Math.round((responses / sentCount) * 100) : 0;

  return `
  <section class="dashboard-grid">
    <div class="panel panel-ink big-stat">
      <h2>Outreach command center</h2>
      <p>Keep momentum from first swipe to follow-up.</p>
      <div class="kpis">
        <div><span>${draftedCount}</span><small>Drafted</small></div>
        <div><span>${scheduledCount}</span><small>Scheduled</small></div>
        <div><span>${sentCount}</span><small>Sent</small></div>
        <div><span>${responseRate}%</span><small>Response rate</small></div>
      </div>
    </div>
    <div class="panel stagger">
      <h3>Saved contacts</h3>
      <ul>${state.saved.map((s) => `<li>${s.name} · ${s.organization}</li>`).join("") || "<li>No saved contacts yet.</li>"}</ul>
    </div>
    <div class="panel stagger down">
      <h3>Scheduled queue</h3>
      <ul>${state.scheduled.map((s) => `<li>${s.contactName} · ${s.nextAction}</li>`).join("") || "<li>No scheduled emails.</li>"}</ul>
    </div>
    <div class="panel wide">
      <h3>Outreach activity</h3>
      <table>
        <thead><tr><th>Contact</th><th>Status</th><th>Next action</th></tr></thead>
        <tbody>
          ${[...state.drafts, ...state.scheduled, ...state.sent]
            .map((d) => `<tr><td>${d.contactName}</td><td>${d.status}</td><td>${d.nextAction}</td></tr>`)
            .join("") || "<tr><td colspan='3'>No outreach logged yet.</td></tr>"}
        </tbody>
      </table>
    </div>
    <div class="panel">
      <h3>Responses + follow-up reminders</h3>
      <ul>${state.responses.map((r) => `<li><strong>${r.contact}</strong> — ${r.note}</li>`).join("")}</ul>
      <p class="compact">Suggested follow-up: send a 5-day reminder for non-responders.</p>
    </div>
  </section>`;
}

function render() {
  const viewMap = {
    landing: landingView,
    onboarding: onboardingView,
    discovery: discoveryView,
    swipe: swipeView,
    drafts: draftsView,
    dashboard: dashboardView,
  };

  app.innerHTML = `<main class="shell ${state.route === "landing" ? "shell-landing" : ""}">${nav()}<section class="page">${viewMap[state.route]()}</section></main>`;
  wireEvents();
}


function getContactById(contactId) {
  return state.contacts.find((c) => c.id === contactId) || mockContacts.find((c) => c.id === contactId);
}

function buildRecipient(contact) {
  if (!contact) return null;
  if (contact.email) return `${contact.name} <${contact.email}>`;
  return `${contact.name} <${contact.id}@example.com>`;
}

function buildSender(profile) {
  if (!profile?.email) return null;
  if (profile.name) return `${profile.name} <${profile.email}>`;
  return profile.email;
}

function upsertDraft(newDraft) {
  const exists = state.drafts.some((d) => d.contactId === newDraft.contactId && d.goal === newDraft.goal);
  if (!exists) state.drafts.unshift(newDraft);
}

async function sendDraft(draftId) {
  const d = state.drafts.find((x) => x.id === draftId);
  if (!d || state.sendingDraftIds.includes(draftId)) return;

  state.sendErrors[draftId] = "";
  state.sendingDraftIds = [...state.sendingDraftIds, draftId];
  render();

  try {
    const contact = getContactById(d.contactId);
    const recipient = buildRecipient(contact);

    if (!recipient) {
      throw new Error("Unable to resolve a recipient email address for this contact.");
    }

    const sender = buildSender(state.profile);
    if (!sender) {
      throw new Error("Add your email in onboarding before sending messages.");
    }

    const response = await fetch("/api/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": d.id,
      },
      body: JSON.stringify({
        to: recipient,
        subject: d.subject,
        body: d.body,
        contactId: d.contactId,
        goal: d.goal,
        draftId: d.id,
        from: sender,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || result.details || "Unable to send message.");
    }

    d.status = "Sent";
    d.nextAction = "Set follow-up in 5 days";
    state.sent.push(d);
    state.drafts = state.drafts.filter((x) => x.id !== draftId);
    delete state.sendErrors[draftId];
    setRoute("dashboard");
  } catch (error) {
    state.sendErrors[draftId] = error instanceof Error ? error.message : "Unable to send message.";
    render();
  } finally {
    state.sendingDraftIds = state.sendingDraftIds.filter((id) => id !== draftId);
    render();
  }
}

function wireEvents() {
  document.querySelectorAll("[data-route]").forEach((el) => el.addEventListener("click", (e) => setRoute(e.currentTarget.dataset.route)));

  if (state.route === "onboarding") {
    document.querySelectorAll("input[name], textarea[name]").forEach((el) => {
      el.addEventListener("input", (e) => {
        const key = e.currentTarget.name;
        state.profile[key] = e.currentTarget.value;
      });
    });
    document.querySelectorAll("input[type='checkbox'][name='opportunities']").forEach((el) => {
      el.addEventListener("change", (e) => {
        const value = e.currentTarget.value;
        state.profile.opportunities = e.currentTarget.checked
          ? [...state.profile.opportunities, value]
          : state.profile.opportunities.filter((x) => x !== value);
      });
    });

    document.getElementById("save-profile")?.addEventListener("click", () => {
      setRoute("discovery");
    });
  }

  if (state.route === "discovery") {
    document.querySelectorAll("[data-query]").forEach((el) =>
      el.addEventListener("click", (e) => {
        document.getElementById("query-input").value = e.currentTarget.dataset.query;
      })
    );

    document.getElementById("generate-bank")?.addEventListener("click", () => {
      const query = document.getElementById("query-input").value.toLowerCase();
      state.contacts = [...mockContacts]
        .filter((c) => !query || `${c.role} ${c.organization} ${c.tags.join(" ")}`.toLowerCase().includes(query.split(" ")[0]))
        .sort((a, b) => b.confidence - a.confidence);
      state.swipeIndex = 0;
      render();
    });

    document.querySelectorAll("[data-save]").forEach((el) =>
      el.addEventListener("click", (e) => {
        const c = state.contacts.find((x) => x.id === e.currentTarget.dataset.save);
        if (c && !state.saved.some((s) => s.id === c.id)) state.saved.push(c);
        render();
      })
    );

    document.querySelectorAll("[data-draft]").forEach((el) =>
      el.addEventListener("click", (e) => {
        const c = state.contacts.find((x) => x.id === e.currentTarget.dataset.draft);
        if (c) upsertDraft(generateDraft(c, c.category, "network"));
        setRoute("drafts");
      })
    );
  }

  if (state.route === "swipe") {
    wireSwipeDrag();

    document.querySelector("[data-skip]")?.addEventListener("click", () => {
      animateSwipe("left", () => {
        state.swipeIndex += 1;
      });
    });

    document.querySelector("[data-save]")?.addEventListener("click", (e) => {
      const c = state.contacts.find((x) => x.id === e.currentTarget.dataset.save);
      if (c && !state.saved.some((s) => s.id === c.id)) state.saved.push(c);
      render();
    });

    document.querySelector("[data-interest]")?.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.interest;
      const c = state.contacts.find((x) => x.id === id);
      const goal = document.getElementById("swipe-goal").value;
      animateSwipe("right", () => {
        if (c) upsertDraft(generateDraft(c, goal, "coffee"));
        state.swipeIndex += 1;
      });
    });
  }

  if (state.route === "drafts") {
    document.querySelectorAll("[data-tone-id]").forEach((el) => {
      el.addEventListener("change", (e) => {
        const d = state.drafts.find((x) => x.id === e.currentTarget.dataset.toneId);
        if (!d) return;
        const contact = state.contacts.find((c) => c.id === d.contactId) || mockContacts.find((c) => c.id === d.contactId);
        const refreshed = generateDraft(contact, d.goal, e.currentTarget.value);
        d.tone = refreshed.tone;
        d.subject = refreshed.subject;
        d.body = refreshed.body;
        d.personalization = refreshed.personalization;
        render();
      });
    });

    document.querySelectorAll("[data-subject-id]").forEach((el) => {
      el.addEventListener("input", (e) => {
        const d = state.drafts.find((x) => x.id === e.currentTarget.dataset.subjectId);
        if (d) d.subject = e.currentTarget.value;
      });
    });

    document.querySelectorAll("[data-body-id]").forEach((el) => {
      el.addEventListener("input", (e) => {
        const d = state.drafts.find((x) => x.id === e.currentTarget.dataset.bodyId);
        if (d) d.body = e.currentTarget.value;
      });
    });

    document.querySelectorAll("[data-schedule]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.schedule;
        const d = state.drafts.find((x) => x.id === id);
        if (!d) return;
        d.status = "Scheduled";
        d.nextAction = "Auto-send Monday 8:30 AM";
        state.scheduled.push(d);
        state.drafts = state.drafts.filter((x) => x.id !== id);
        setRoute("dashboard");
      });
    });

    document.querySelectorAll("[data-send]").forEach((el) => {
      el.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.send;
        await sendDraft(id);
      });
    });
  }
}

function wireSwipeDrag() {
  const swipeCard = document.querySelector("[data-swipe-card]");
  if (!swipeCard || state.swipeAnimating) return;

  const stage = document.querySelector(".swipe-stage");
  const leftBadge = swipeCard.querySelector(".swipe-badge-left");
  const rightBadge = swipeCard.querySelector(".swipe-badge-right");
  const threshold = 110;
  const releaseDistance = 130;
  let pointerId = null;
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  const setDragStyle = (offsetX) => {
    const rotation = Math.max(-14, Math.min(14, offsetX * 0.06));
    swipeCard.style.transition = "none";
    swipeCard.style.transform = `translateX(${offsetX}px) rotate(${rotation}deg)`;
    if (stage) {
      const reveal = Math.min(1, Math.abs(offsetX) / threshold);
      stage.style.setProperty("--reveal", reveal.toFixed(3));
    }
    if (leftBadge && rightBadge) {
      leftBadge.style.opacity = offsetX < 0 ? Math.min(1, Math.abs(offsetX) / threshold) : 0;
      rightBadge.style.opacity = offsetX > 0 ? Math.min(1, Math.abs(offsetX) / threshold) : 0;
    }
  };

  const resetCard = () => {
    swipeCard.style.transition = "transform .22s ease";
    swipeCard.style.transform = "";
    if (stage) stage.style.setProperty("--reveal", "0");
    if (leftBadge && rightBadge) {
      leftBadge.style.opacity = 0;
      rightBadge.style.opacity = 0;
    }
  };

  const completeDragSwipe = (direction) => {
    if (state.swipeAnimating) return;
    state.swipeAnimating = true;
    swipeCard.style.transition = "transform .28s cubic-bezier(.19,.95,.31,1)";
    swipeCard.style.transform = `translateX(${direction === "right" ? 135 : -135}vw) rotate(${direction === "right" ? 20 : -20}deg)`;
    swipeCard.style.opacity = "0";
    window.setTimeout(() => {
      if (direction === "right") {
        const c = state.contacts[state.swipeIndex];
        const goal = document.getElementById("swipe-goal")?.value || goalOptions[0];
        if (c) upsertDraft(generateDraft(c, goal, "coffee"));
      }
      state.swipeIndex += 1;
      state.swipeAnimating = false;
      state.swipeDirection = null;
      render();
    }, 280);
  };

  swipeCard.addEventListener("pointerdown", (e) => {
    if (state.swipeAnimating) return;
    if (e.target.closest("button, input, select, textarea, a, label")) return;
    pointerId = e.pointerId;
    dragging = true;
    startX = e.clientX;
    currentX = 0;
    swipeCard.setPointerCapture(pointerId);
  });

  swipeCard.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    currentX = e.clientX - startX;
    setDragStyle(currentX);
  });

  const endDrag = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    swipeCard.releasePointerCapture(pointerId);
    pointerId = null;
    if (Math.abs(currentX) >= releaseDistance) {
      completeDragSwipe(currentX > 0 ? "right" : "left");
      return;
    }
    resetCard();
  };

  swipeCard.addEventListener("pointerup", endDrag);
  swipeCard.addEventListener("pointercancel", endDrag);
}

render();
