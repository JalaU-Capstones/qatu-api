# Supabase Setup Guide

## 3.1 Overview

Supabase is used as the Authentication Provider and database foundation for Qatu Marketplace (see ADR-003).

The free tier is sufficient for development: 2 active projects, 500 MB database per project, 50,000 monthly active users, unlimited API requests, 1 GB file storage, and 2 GB bandwidth.

**Note:** Free projects automatically pause after 7 days of inactivity. Visit the dashboard to restore them instantly.

## 3.2 Prerequisites

- A Supabase account (free) — sign up at [Supabase Dashboard](https://supabase.com/dashboard) with GitHub or GitLab.
- Docker Desktop installed (for local development with Supabase CLI).
- Node.js v26 and pnpm v11 installed.
- Supabase CLI installed as a local project dependency:
  ```bash
  pnpm add -D supabase
  ```

## 3.3 Option A: Local Development with Supabase CLI (Recommended)

This option runs the full Supabase stack locally using Docker. It does not consume your cloud project's quota.

**Steps:**

1. Install the Supabase CLI as a dev dependency (if not already done):
   ```bash
   pnpm add -D supabase
   ```
2. Initialize the local Supabase project:
   ```bash
   npx supabase init
   ```
   This creates a `supabase/` folder with `config.toml`.
3. Start the local Supabase stack:
   ```bash
   npx supabase start
   ```
   This launches PostgreSQL, Auth, Storage, and Edge Functions in Docker containers. (The first run may take a few minutes as it downloads Docker images).
4. Note the output URLs and keys:
   - API URL: `http://localhost:54321`
   - DB URL: `postgresql://postgres:postgres@localhost:54322/postgres`
   - Studio URL: `http://localhost:54323`
   - Inbucket (email testing): `http://localhost:54324`
   - Anon key and service_role key
5. Update your `.env` file:
   ```env
   SUPABASE_URL=http://localhost:54321
   SUPABASE_ANON_KEY=<local-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
   JWT_SECRET=<local-jwt-secret>
   ```
6. To stop the local stack:
   ```bash
   npx supabase stop
   ```
7. To reset the local database (delete data and re-run migrations):
   ```bash
   npx supabase db reset
   ```

**Advantages:** Completely free, works offline, fast iteration, zero quota consumption, and gives you full control.

## 3.4 Option B: Remote Development with Supabase Cloud (Free Tier)

This option uses a hosted Supabase project.

**Steps:**

1. Sign up at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Create a new project:
   - Name: `qatu-dev`
   - Database password: use a strong password and save it securely.
   - Region: choose the closest to your location.
   - Pricing plan: Free tier.
3. Wait for provisioning (approx. 60 seconds).
4. Navigate to **Project Settings > API** and copy:
   - Project URL (`https://<project-ref>.supabase.co`)
   - Anon public key
   - Service role key (keep this secret)
5. Navigate to **Project Settings > Database** and copy the connection string (URI format).
6. Update your `.env` file:
   ```env
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   JWT_SECRET=<jwt-secret-from-settings>
   ```
7. Configure authentication providers (if needed):
   - Navigate to **Authentication > Providers**.
   - Enable your desired providers (e.g., Google, GitHub).
   - Set the redirect URL to `http://localhost:5173` for local frontend development.

**Advantages:** No Docker required, accessible anywhere, mirrors production more closely.
**Limitations:** Projects pause after 7 days of inactivity, 500 MB database limit, max 2 active projects.

## 3.5 Row Level Security (RLS) Setup

RLS is enabled on all application tables to restrict access securely.

Example SQL for enabling RLS and creating policies:

```sql
-- Enable RLS on the profiles table
alter table profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile"
on profiles for select
using (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id);
```

For a full list of policies, refer to `Architecture/Security` in the Wiki and the [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 3.6 JWT Verification

The backend verifies JWTs issued by Supabase Auth using the `JWT_SECRET` (from **Project Settings > API > JWT Secret**).
A middleware in the Presentation layer verifies the token on every protected request. The decoded token contains claims such as `sub` (user ID) and `role`.

## 3.7 Environment Variables Reference

| Variable                    | Description               | Local Value              | Remote Value                             |
| --------------------------- | ------------------------- | ------------------------ | ---------------------------------------- |
| `SUPABASE_URL`              | Supabase API URL          | `http://localhost:54321` | `https://<project-ref>.supabase.co`      |
| `SUPABASE_ANON_KEY`         | Public anonymous key      | From `supabase start`    | From Project Settings > API              |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secret) | From `supabase start`    | From Project Settings > API              |
| `JWT_SECRET`                | JWT verification secret   | From `supabase start`    | From Project Settings > API > JWT Secret |

**Warning:** Never commit the `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET` to the repository. Use `.env` and `.gitignore`.

## 3.8 Troubleshooting

- **Docker not running:** Supabase CLI requires Docker. Ensure Docker Desktop is running.
- **Port conflicts:** The local stack uses ports 54321–54324. Free these ports if blocked.
- **JWT verification errors:** Ensure the `JWT_SECRET` precisely matches your Supabase instance.
- **RLS blocking access:** Verify policies are correctly defined and that the authenticated user matches the policy conditions.
- **Connection refused:** Check that the Supabase stack is running using `npx supabase status`.

## 3.9 Switching Between Local and Remote

To switch between environments, simply swap out the variables in your `.env` file. We recommend creating separate `.env.development` and `.env.production` templates if needed.

## 3.10 References

- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Pricing](https://supabase.com/pricing)
- ADR-003: Authentication Provider
