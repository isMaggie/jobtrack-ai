# JobTrack AI

Next.js App Router, React, TypeScript, Tailwind CSS, and PostgreSQL.
Application persistence uses plain SQL and `pg`.

## Getting started

Use Node.js 24 (specified in `.nvmrc`):

```sh
nvm use
npm ci
```

## Local PostgreSQL

On macOS, install [Postgres.app](https://postgresapp.com/documentation/install.html),
open it, initialize the server, and configure its command-line tools as documented.
Keep it running while using the application or integration tests.

Connect with `psql postgres` using your local administrative account, then create
an application role and two databases (choose your own local password):

```sql
CREATE ROLE jobtrack LOGIN PASSWORD 'replace-with-your-local-password';
CREATE DATABASE jobtrack_ai OWNER jobtrack;
CREATE DATABASE jobtrack_ai_test OWNER jobtrack;
```

Copy `.env.example` to `.env.local` for development and `.env.test.local` for tests.
Set `DATABASE_URL` in `.env.local` and `TEST_DATABASE_URL` in `.env.test.local`
using your role/password. URL-encode special characters in passwords. These files
are ignored by Git; never commit real credentials or use `NEXT_PUBLIC_` for them.

Apply migrations, then start Next.js:

```sh
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Database connections are created lazily; builds do not
need PostgreSQL. Use the dashboard to create applications, view details, and update
their status. New applications start with APPLIED status.

`appliedDate` is a calendar day stored as PostgreSQL `DATE`. With the existing
JavaScript `Date` model, writes use its UTC year/month/day and reads return midnight
UTC. Construct calendar inputs using `new Date("2026-10-07T00:00:00Z")`; format them
using UTC rather than local-time getters. Creation timestamps retain their time.
Future update queries must explicitly set `updated_at = CURRENT_TIMESTAMP`.

## Migrations

Add numbered SQL files under `db/migrations`, then run `npm run db:migrate`.
The runner records applied filenames in `schema_migrations` and runs each new file
in a transaction. Re-running skips applied files. Do not edit applied migrations;
add another file for changes. Run only one migration runner at a time. Database
creation is a separate one-time setup step.

## Checks

```sh
npm test
npm run test:integration
npm run lint
npm run build
npm run typecheck
```

Unit tests require no database. Integration tests require the existing
`jobtrack_ai_test` database and `TEST_DATABASE_URL`; they never fall back to the
development URL. The runner verifies the connected database name before migrating,
and the tests verify it again before clearing application rows between tests.
Do not store anything valuable in the test database. Tests run sequentially.
Database failures cause the integration command to fail rather than skip tests.

`npm start` serves the production build.

## Import a confirmation email

Set `OPENAI_API_KEY` in `.env.local` and restart the development server. The only
AI dependency is the official `openai` SDK. The model is defined once as
`EMAIL_EXTRACTION_MODEL` in `src/lib/email-extraction.ts` (currently `gpt-6.1-sol`).
No key is needed for builds or tests; without one, import reports a configuration
error and manual creation remains available.

Choose **Import from email**, paste plain text, and select **Extract draft**. This
sends the text to OpenAI; remove personal information you do not want to share.
JobTrack does not persist emails or drafts, and requests use `store: false` to
avoid storing Responses API response state. Provider data handling still applies.
Review and edit every field, supply missing required facts, then explicitly select
**Confirm and save application**. Only this step writes to PostgreSQL. Cancel or
navigate away to discard a draft. Saved applications start with APPLIED status.

Extraction uses a 30-second timeout and no automatic retries. Errors preserve the
pasted text; save failures preserve edited values. No links are fetched. Unit and
integration tests mock AI requests and need no API credentials. Browser workflows are covered by the Playwright suite below; no feature flags or
rate-limit infrastructure are included.

Email import supports pasted application confirmations, interview invitations,
offers, and rejections. Analyze email classifies the message and proposes a change;
it never writes to the database. Confirmations open an editable new application
starting as Applied. Other supported events match existing applications by company
and position, ignoring case and repeated whitespace. Correct these fields and use
Find matches if needed. When several records match, select one using the radio list.
Review the current and proposed statuses, then explicitly confirm the update.
Unrelated or ambiguous messages propose no change. Stale status proposals require
matching and review again. Emails and pending proposals are not stored by JobTrack.
Critical browser workflows are covered by Playwright.

## Browser E2E tests

The five Playwright tests cover manual creation, manual status updates, confirmation
email review and save, status email review and confirmation, and combined discard/back
safeguards. They use Chromium, one worker, and real Next.js Server Actions and SQL.
The Playwright version is pinned to 1.56.1 for this project's macOS 13 development
machine. Revisit the pin when upgrading the operating system.

After `npm ci`, install the browser once:

```sh
npx playwright install chromium
npm run test:e2e
```

Keep PostgreSQL running and configure `TEST_DATABASE_URL` in `.env.test.local`.
The runner verifies that the actual connected database is `jobtrack_ai_test` before
migrating. Database helpers repeat that check before clearing or seeding data.
**The suite deletes application rows in the test database.** Do not run it alongside
integration tests or another E2E run, and never store valuable data there.

Use `npm run test:e2e`, rather than invoking Playwright directly: the runner sets the
app's database URL explicitly and overrides AI credentials with a dummy key and
`OPENAI_BASE_URL=http://127.0.0.1:3101/v1`. The existing OpenAI SDK supports this
variable, so application code needs no testing abstraction. A small local HTTP
server returns fixed structured responses for the two test email fixtures and
rejects unexpected requests. No real OpenAI API is called and no real key is needed.

Playwright starts a fresh Webpack development server on port 3100 and the fake
provider on 3101; both ports must be free. It refuses to reuse an existing app
server, and shuts down its servers after the run. Each test starts with an empty
test database and seeds any prerequisites independently. Existing development
servers should be stopped to avoid sharing Next.js build output.

Failed tests retain screenshots and traces under the ignored `test-results/`
directory. To inspect a trace, run `npx playwright show-trace` with its `trace.zip`
path. To run one test, pass a title filter through the guarded runner:

```sh
npm run test:e2e -- --grep "review confirmation email"
```

Run checks sequentially (the database suites share the test database):

```sh
npm test
npm run test:integration
npm run test:e2e
npm run lint
npm run build -- --webpack
npm run typecheck
```
