# Marksman

An osu! bounty application built with Next.js, Express, PostgreSQL, and shared TypeScript contracts. Work in progress.

## Local development

1. Run `npm ci` from the repository root.
2. Copy `marksman-api/.env.example` to `marksman-api/.env` and fill in your local database, osu! OAuth, and session credentials.
3. In `marksman-api`, run `docker compose up -d` and `npm run db:migrate`.
4. Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `marksman-web/.env.local`.
5. From the root, run `npm run dev:api` and `npm run dev:web` in separate terminals.

Run `npm run typecheck` to check application types.

## Backfill beatmap metadata

After applying migrations, run from the repository root:

```sh
npm run db:backfill:beatmaps --workspace=marksman-api
```

Uses the API's configured environment (`marksman-api/.env` for local development)
and makes live osu! API requests. The target database must already be running.
It fills missing metadata for distinct beatmap IDs across all bounty statuses,
processing one map at a time. Existing metadata, bounty checksums and balances
are unchanged. Successes are saved independently; rerunning skips saved rows and
retries missing maps. Failed IDs are printed and cause exit status 1. Deleted or
unavailable maps may continue to fail; review those IDs before switching reads
entirely to stored metadata. The script closes its database pool when finished.

## Database backup and restore

With deployment PostgreSQL running and `.env.deploy` configured, save a backup:

```sh
bash scripts/database.sh backup
```

The command prints the new file's path under `backups/`. It uses PostgreSQL's
custom archive format, restricts file permissions, and publishes the file only
after the dump succeeds and its archive listing can be read. Failed partial
files are removed. Backups are excluded from Git and Docker builds.

Copy the file off the VPS to your computer or other secure storage. A file only
on the VPS does not protect against losing the server. Backups include private
account/session data; keep them private. Keep environment secrets separately.

Restore into a **new** database using the printed backup path:

```sh
bash scripts/database.sh restore backups/FILE.dump marksman_restore_check
```

Replace `backups/FILE.dump` with the path printed by the backup command.
The target name must begin with `marksman_restore_`. Existing databases are
refused. Restore runs in one transaction and stops on errors. If restore fails
after creating the database, that new database remains for inspection; use a new
name on retry. The application continues using its original database.

For the local rehearsal, use `--rehearsal` immediately after the action:

```sh
bash scripts/database.sh backup --rehearsal
bash scripts/database.sh restore --rehearsal backups/FILE.dump marksman_restore_check
```

These commands require Bash, Docker Compose, and the complete corresponding
environment file; they do not start services. Before using restored data for the
application, check its contents, use compatible application code, and stop the
API/workers before changing the database connection. An archive listing alone
does not prove recovery: periodically restore and verify records and balances.
