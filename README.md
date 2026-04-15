# Scout

Scout is a swipe-based cold outreach MVP for students. It includes:

- Asymmetric branded landing page
- Student profile onboarding
- Contact discovery / bank generation with realistic mock data
- Swipe deck for outreach decisions
- Personalized email draft generation and editing
- Outreach workflow dashboard with status tracking

## Run

Use the included Node server so the app can call API endpoints for send status:

```bash
FROM_EMAIL=student@example.edu REPLY_TO=student@example.edu npm start
```

`REPLY_TO` is optional. `FROM_EMAIL` is required and must be valid or `/api/send` will reject sends.

Then open `http://localhost:4173`.

## Delivery status API

- `POST /api/send` validates sender identity and records a send attempt/result.
- `GET /api/send-attempts` returns persisted send attempts.
- Attempts are persisted to `send-attempts.json` with fields:
  - `draftId`
  - `contactEmail`
  - `providerMessageId`
  - `status`
  - `error`
  - `sentAt`
