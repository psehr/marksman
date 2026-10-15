# Marksman

An osu! bounty application built with Next.js, Express, PostgreSQL, and shared TypeScript contracts. Work in progress.

## Local development

1. Run `npm ci` from the repository root.
2. Copy `marksman-api/.env.example` to `marksman-api/.env` and fill in your local database, osu! OAuth, and session credentials.
3. In `marksman-api`, run `docker compose up -d` and `npm run db:migrate`.
4. Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `marksman-web/.env.local`.
5. From the root, run `npm run dev:api` and `npm run dev:web` in separate terminals.

Run `npm run typecheck` to check application types.
