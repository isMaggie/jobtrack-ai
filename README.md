# JobTrack AI

Next.js App Router, React, TypeScript, Tailwind CSS, and PostgreSQL.
The homepage is a placeholder; application persistence uses plain SQL and `pg`.

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
need PostgreSQL. Server code can use `createApplication` and `getApplicationById`
from `src/lib/application-repository.ts`. No UI or endpoints call them yet.

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
