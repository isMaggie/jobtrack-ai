# JobTrack AI

A full-stack job application tracker that turns pasted recruiting emails into editable application drafts and reviewed status updates.

JobTrack AI keeps company details, job descriptions, and application progress in one place. AI helps extract information; users review and explicitly confirm every application creation or status change. The app is designed for personal deployment with shared-password access.

## Key features

- **Application dashboard:** View saved applications and their current status.
- **Manual application entry:** Store company, position, application date, job URL, and job description.
- **Application details and progress:** View individual records and update their status to Applied, Interview, Offer, Rejected, or Withdrawn.
- **Email-assisted tracking:** Paste confirmations, interview invitations, offers, or rejections to prepare a new application or propose an update to an existing one.
- **Review before saving:** Edit extracted fields, resolve matching applications, and explicitly confirm changes.
- **Persistent storage and personal access:** PostgreSQL stores application records; a shared password protects the deployed app.

## Architecture

```text
React UI / Next.js App Router
          |
          v
Next.js Server Actions
          |
          v
Input validation and business logic
          |
          +-- Email analysis --> OpenAI --> Validated review draft
          |
          +-- Confirmed write --> SQL repository --> PostgreSQL
```

React components handle forms and review screens. Server Actions validate input, enforce access checks, and coordinate database operations. Business rules and persistence live in `src/lib`, separate from UI components in `src/components`.

The repository uses plain SQL through `pg`, with numbered SQL migrations under `db/migrations`. This keeps the data model and queries explicit without adding an ORM. Server-side database connections are pooled and created lazily, so builds do not require a running database.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Next.js App Router, TypeScript, Tailwind CSS |
| Server and validation | Next.js Server Actions, Zod |
| Persistence | PostgreSQL, `pg`, SQL migrations |
| AI | OpenAI Responses API, official OpenAI SDK, structured outputs |
| Testing | Vitest, Playwright, PostgreSQL integration tests |
| Deployment | Vercel, Neon, OpenAI |

## AI workflow

1. **Paste an email.** The server validates the input and sends its text to OpenAI.
2. **Classify and extract.** Structured output identifies the email event and available application facts. Zod validates the result against application rules.
3. **Review the proposal.** Confirmations produce an editable application draft. Interview, offer, and rejection emails propose a status update after matching an existing application by company and position, ignoring case and repeated whitespace.
4. **Confirm the write.** Supply missing fields, correct extracted values, or select among matching records before explicitly saving or confirming an update. New applications start as Applied.

Analysis alone never writes application records. Unrelated or ambiguous emails propose no change, and stale status proposals require matching and review again. Canceling or navigating away discards the pending draft.

JobTrack does not persist pasted emails or their pending proposals. Gmail imports retain extracted proposals for later review, but never raw email bodies. Requests use `store: false` to avoid storing Responses API response state; OpenAI's data-handling policies still apply. Remove personal information you do not want to send. No links in the email are fetched.

The extraction request has a 30-second timeout and no automatic retries. Errors preserve pasted text or edited form values. Manual entry remains available without an API key. The model is configured in `src/lib/email-extraction.ts`.

## Gmail manual sync

On **Import from email**, connect one Gmail mailbox using Google OAuth with only `gmail.readonly`, then click **Sync Gmail**. Sync searches the last 14 days for application-related candidates, lists at most 20 messages, and analyzes at most 5 unseen messages per click. It does not paginate or modify Gmail read/unread state. Older messages and messages outside this bounded candidate window may not be imported; pasted email remains available.

OAuth uses a short-lived HttpOnly state/PKCE cookie. Server-side access and refresh tokens use AES-256-GCM encryption. `gmail_connection` stores the single mailbox and encrypted tokens; `gmail_imports` stores mailbox/message IDs and validated extracted drafts. No raw body, subject, attachment, or sender is stored. Plain-text MIME parts are supported; HTML-only messages and attachments are skipped. Sync serializes overlapping operations with one PostgreSQL advisory lock, with no jobs, webhooks, or leases. Failed analyses are retried on the next manual sync; completed messages are deduplicated by mailbox and Gmail message ID.

Open a saved Gmail draft to reuse the editable application form or matching/status confirmation screen. Sync never creates applications or changes statuses. Drafts remain available after confirmation; matching records are shown to help avoid accidental duplicate applications. Disconnect removes local tokens; retained drafts reappear when the same mailbox reconnects. To revoke Google's authorization too, remove the app in your Google account permissions.

To enable live Gmail:

1. Enable the Gmail API in Google Cloud and create a Web application OAuth client. Configure its consent screen and your personal account as a test user when applicable.
2. Register the exact callback URL, e.g. `http://localhost:3000/gmail/callback` locally or `https://your-host/gmail/callback` in deployment.
3. Set server-only `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REDIRECT_URI`. Generate `GMAIL_TOKEN_KEY` with `openssl rand -base64 32`; keep it stable and separate from the database. Losing or changing it requires reconnecting Gmail.
4. Set `OPENAI_API_KEY`, run migrations, restart the app, and connect Gmail. Production requires HTTPS and `APP_ACCESS_PASSWORD` as before.

The Gmail readonly permission is a restricted Google scope; deployment beyond personal testing may require Google's verification process. See [Google's scope documentation](https://developers.google.com/workspace/gmail/api/auth/scopes) and [OAuth server flow](https://developers.google.com/workspace/gmail/api/auth/web-server).

## Testing

- **Unit tests:** Validation, form parsing, application rules, email proposal handling, and access protection.
- **Integration tests:** Repository behavior against real PostgreSQL.
- **Browser E2E tests:** Manual creation and status updates, email draft review and save, confirmed email status updates, discard/back safeguards, and unauthenticated request rejection.

Gmail and AI requests are mocked in unit and integration tests. Playwright uses real Server Actions and SQL with a local HTTP provider stub, so no tests require real Gmail/OpenAI credentials or call live providers. The E2E-only Gmail origin override is restricted to the pinned local stub with matching test database configuration and is rejected in production.

After installing dependencies, install Chromium once:

```sh
npx playwright install chromium
```

Run checks sequentially:

```sh
npm test
npm run test:integration
npm run test:e2e
npm run lint
npm run build -- --webpack
npm run typecheck
```

Unit tests need no database. Integration and E2E tests require `TEST_DATABASE_URL` in `.env.test.local` and verify that the connected database is named `jobtrack_ai_test` before migrating. **Both suites clear application and Gmail rows in that database.** Keep it dedicated to tests, and never run the database suites concurrently.

Use `npm run test:e2e` rather than invoking Playwright directly: the runner supplies the test database and dummy AI credentials. Ports 3100 and 3101 must be free. Stop existing development servers before running E2E tests to avoid sharing Next.js build output. Failed browser tests retain screenshots and traces in `test-results/`.

Playwright is pinned to 1.56.1 for the project's macOS 13 development environment; revisit the pin when upgrading the operating system.

## Local setup

### 1. Install dependencies

Use Node.js 24, as specified in `.nvmrc`:

```sh
nvm use
npm ci
```

### 2. Create local databases

Install and start PostgreSQL. On macOS, Postgres.app is one option; enable its command-line tools during setup. Connect with `psql postgres` using your local administrative account, then run the following with your own local password:

```sql
CREATE ROLE jobtrack LOGIN PASSWORD 'replace-with-your-local-password';
CREATE DATABASE jobtrack_ai OWNER jobtrack;
CREATE DATABASE jobtrack_ai_test OWNER jobtrack;
```

### 3. Configure environment variables

```sh
cp .env.example .env.local
cp .env.example .env.test.local
```

Set the development connection in `.env.local` and the test connection in `.env.test.local` using your PostgreSQL role and password. URL-encode special characters in connection-string passwords.

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection for the app and migrations | To run the app |
| `TEST_DATABASE_URL` | Connection to the dedicated `jobtrack_ai_test` database | For integration and E2E tests |
| `OPENAI_API_KEY` | Server-side email analysis | Only for live AI features |
| `APP_ACCESS_PASSWORD` | Shared access password; browser username is `jobtrack` | In production; optional locally |

Environment files are ignored by Git. Keep these values server-only; never prefix them with `NEXT_PUBLIC_` or commit real credentials.

### 4. Migrate and start

```sh
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Keep PostgreSQL running while using the app or database tests. Restart the development server after changing environment variables.

For schema changes, add a new numbered SQL file under `db/migrations` and run `npm run db:migrate`. The runner records applied filenames and executes each new migration in a transaction. Do not edit applied migrations or run multiple migration runners concurrently.

## Deployment

The deployment stack is **Vercel + Neon + OpenAI**: Vercel hosts the Next.js app, Neon provides PostgreSQL, and OpenAI handles email analysis. Database access depends only on PostgreSQL through `DATABASE_URL`; the application does not require a Neon-specific SDK.

1. Create the production PostgreSQL database in Neon and configure its connection string, including the provider's required TLS settings, as `DATABASE_URL` in Vercel.
2. Set `APP_ACCESS_PASSWORD` to a long random secret. Set `OPENAI_API_KEY` to enable email analysis. Keep all values server-only, and do not deploy E2E dummy credentials or the local provider URL.
3. Run `npm run db:migrate` once against the intended production database from an environment with its `DATABASE_URL` configured. The script also loads `.env.local` when present; verify the target before running it.
4. Deploy the Next.js app to Vercel using `npm run build -- --webpack` as the build command. For a self-hosted Node.js deployment, the same build is served with `npm start`.

Production requires HTTPS because the access gate uses HTTP Basic Auth. Sign in through the browser prompt with username `jobtrack` and the configured password. A missing or blank production password returns HTTP 503; missing or incorrect credentials return HTTP 401. This is a single-user access gate with no accounts or sessions. Browsers remember credentials; close the browser session to clear them.

The database pool allows five connections per process with a five-second connection timeout. Production email failure logs use fixed operation names and allowlisted diagnostic categories, excluding email text, extracted values, credentials, and raw provider errors.

## Future improvements

Planned directions beyond the current MVP:

- Deeper AI-powered job description analysis.
- Follow-up reminders for applications awaiting a response.

These features are not currently implemented.
