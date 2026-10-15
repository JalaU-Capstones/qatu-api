# Supabase Team Workflow

This guide explains how team members should work with Supabase for local development.

## What is committed to Git

The following Supabase files are versioned and shared across the team:

| File / Directory       | Purpose                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `supabase/config.toml` | Local Supabase configuration. Safe to commit; secrets must use `env(NAME)` references. |
| `supabase/migrations/` | SQL migrations (schema, RLS policies, functions).                                      |
| `supabase/seed.sql`    | Reproducible seed data for local development.                                          |

## What is NOT committed to Git

The following are ignored via `.gitignore` and must never be committed:

- `supabase/.temp/` — CLI temporary state (runtime secrets, cache).
- `supabase/.branches/` — CLI branch state.
- `.env`, `.env.local`, `.env.*.local` — Environment variables with secrets.

## How to set up your local environment

1. **Clone the repository** (already includes `supabase/config.toml` and migrations).
2. **Copy the environment file:**

   ```bash
   cp .env.example .env
   ```

   Fill in the Supabase local values. You can get them by running `npx supabase start` and copying the output.

3. **Start the local Supabase stack:**

   ```bash
   npx supabase start
   ```

   This launches PostgreSQL, Auth, Storage, and Studio in Docker.

4. **Apply migrations and seed data:**

   ```bash
   npx supabase db reset
   ```

   This applies all migrations from `supabase/migrations/` and runs `supabase/seed.sql`.

5. **Work normally.** The API should point to `http://127.0.0.1:54321`.

## Capturing schema changes

When you modify the database schema (via Studio, SQL, or migrations), always capture it as a migration:

```bash
npx supabase db diff -f my_migration_name
```

Then commit the new migration file in `supabase/migrations/`. This ensures all team members get the change.

## Troubleshooting

- **Docker not running:** Ensure Docker Desktop is running.
- **Port conflicts:** The local stack uses ports 54321–54324. Free them if blocked.
- **Connection refused:** Check that the stack is running with `npx supabase status`.
- **JWT verification errors:** Ensure `JWT_SECRET` in `.env` matches the one from `npx supabase start`.

## References

- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [.docs/supabase/SETUP.md](SETUP.md)
