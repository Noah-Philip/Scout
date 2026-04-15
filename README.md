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

Set SMTP credentials in your environment (or `.env` loaded by your shell):

```bash
export SMTP_HOST="smtp.your-provider.com"
export SMTP_PORT="587"
export SMTP_USER="your-user"
export SMTP_PASS="your-password"
```

Scout now sends each message using the onboarded user's email/name as the `From` address.
Your SMTP provider must allow that sender identity for successful delivery.

Start the app + API server:

```bash
npm start
```

Then open `http://localhost:4173`.
