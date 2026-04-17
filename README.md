# Scout

Scout is a swipe-based cold outreach MVP for students. It includes:

- Asymmetric branded landing page
- Student profile onboarding
- Contact discovery / bank generation with realistic mock data
- Swipe deck for outreach decisions
- Personalized email draft generation and editing
- Outreach workflow dashboard with status tracking

## Run

Install dependencies:

```bash
npm install
```

Set Google OAuth credentials in your environment (or `.env` loaded by your shell):

```bash
export GOOGLE_CLIENT_ID="your-google-oauth-client-id"
export GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:4173/api/gmail/oauth/callback"
```

Scout now supports per-user Gmail authorization:

- Each user enters their email in onboarding.
- They click **Connect Gmail** and complete Google OAuth consent.
- Scout stores the user's OAuth tokens server-side (in-memory for this MVP).
- Sending uses that specific user's Gmail OAuth identity (no shared SMTP credential).

For local development, configure your Google OAuth app redirect URI to match
`GOOGLE_REDIRECT_URI`.

Start the app + API server:

```bash
npm start
```

Then open `http://localhost:4173`.
