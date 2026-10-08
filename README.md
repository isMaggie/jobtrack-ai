# JobTrack AI

Project foundation using Next.js App Router, React, TypeScript, Tailwind CSS,
and ESLint. Application features and database setup are not implemented yet.

## Getting started

Use Node.js 24 (specified in `.nvmrc`):

```sh
nvm use
npm ci
npm run dev
```

Open http://localhost:3000. The placeholder homepage is in
`src/app/page.tsx`; the shared layout and global styles are alongside it.

## Checks and production

```sh
npm run lint
npm run build
npm run typecheck
npm start
```

The build generates Next.js type declarations before the TypeScript check.
`npm start` serves the production build. No test libraries are installed yet.
