# Scout

Scout is a swipe-based cold outreach MVP for students. It includes:

- Asymmetric branded landing page
- Student profile onboarding
- Contact discovery / bank generation with realistic mock data
- Swipe deck for outreach decisions
- Personalized email draft generation and editing
- Outreach workflow dashboard with status tracking

## Run

Run the combined web + API server:

```bash
npm start
```

Then open `http://localhost:4173`.

## Email scheduling API + worker

- `POST /api/email/schedule` accepts JSON payload:
  - `sendAt` (ISO timestamp)
  - `to`
  - `subject`
  - `body`
  - `draftId`
- `GET /api/email/scheduled` returns scheduled jobs and execution status.
- Worker loop runs every 5 seconds, picks up due jobs, sends using the shared email provider abstraction, and appends logs/status to `data/scheduled-jobs.json`.
