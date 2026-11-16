-- ─────────────────────────────────────────────────────────────────────────────
-- Defensive handle_new_user trigger on auth.users (ADR-020 / SP-19).
--
-- Runs against supabase_db_api via `npx supabase start` and `npx supabase db reset`.
-- This migration replaces Sequelize migrations 20261010000019 and
-- 20261010000029 (both now deprecated no-ops).
--
-- Idempotent:
--   - CREATE OR REPLACE FUNCTION for public.handle_new_user().
--   - DROP TRIGGER IF EXISTS before CREATE TRIGGER.
--
-- Defensive:
--   - No-op if public.profiles does not exist yet. `npx supabase db reset`
--     runs before `pnpm db:migrate`, so during seed insertion of the seller
--     and admin rows, public.profiles may not exist. A Sequelize seeder
--     provisions those profiles after `pnpm db:migrate`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  base_username text;
  candidate_username text;
  email_prefix text;
  suffix integer := 0;
  buyer_role_id smallint;
  resolved_avatar text;
  resolved_full_name text;
begin
  -- Defensive: if public.profiles is not yet created (during `supabase db reset`
  -- and before `pnpm db:migrate`), return without inserting. A Sequelize seeder
  -- provisions the profile for seeded users after `pnpm db:migrate`.
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    return new;
  end if;

  raw_username := new.raw_user_meta_data->>'username';
  email_prefix := null;
  if new.email is not null then
    email_prefix := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g');
  end if;

  base_username := null;
  if raw_username is not null then
    raw_username := substr(regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g'), 1, 30);
    if raw_username ~ '^[a-zA-Z0-9_]{3,30}$' then
      base_username := raw_username;
    end if;
  end if;

  if base_username is null then
    if email_prefix is not null and char_length(email_prefix) >= 3 then
      base_username := substr(email_prefix, 1, 20) || '_' || substr(md5(random()::text), 1, 4);
    else
      base_username := 'user_' || substring(replace(new.id::text, '-', '') from 1 for 10);
    end if;
  end if;
  candidate_username := base_username;

  while exists (select 1 from public.profiles where lower(username) = lower(candidate_username)) loop
    suffix := suffix + 1;
    exit when suffix > 9999;
    candidate_username := substr(base_username, 1, 30 - char_length(suffix::text) - 1)
      || '_' || suffix::text;
  end loop;

  resolved_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_path',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  resolved_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  );

  insert into public.profiles (id, username, full_name, email, avatar_path)
  values (
    new.id,
    candidate_username,
    resolved_full_name,
    new.email,
    resolved_avatar
  );

  select id into buyer_role_id from public.roles where name = 'buyer';
  if buyer_role_id is not null then
    insert into public.user_roles (profile_id, role_id) values (new.id, buyer_role_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
