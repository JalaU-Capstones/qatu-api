'use strict';

/**
 * Migration 29: Update handle_new_user trigger to support OAuth signups.
 *
 * The original trigger (migration 19) reads `raw_user_meta_data->>'username'`
 * and `raw_user_meta_data->>'avatar_path'`. Supabase password signups set both
 * fields. OAuth (Google) signups set NEITHER:
 *   - Google has no concept of "username"
 *   - Google puts the avatar in `avatar_url` (and `picture`), not `avatar_path`
 *   - Google may use `name` instead of `full_name` (defensive fallback)
 *
 * This migration makes the trigger OAuth-compatible without changing password
 * signup behavior (when a username is supplied, it is still used as-is).
 *
 * Behavior matrix:
 *   | raw_user_meta_data contains       | Result                                      |
 *   |-----------------------------------|---------------------------------------------|
 *   | username=...                      | username unchanged                          |
 *   | username=null, email=user@x.com   | username = "user_<4hex>"                    |
 *   | avatar_path=...                   | avatar_path unchanged                       |
 *   | avatar_url=... (Google)           | avatar_path = avatar_url                    |
 *   | picture=... (Google alt key)      | avatar_path = picture                       |
 *   | full_name=...                     | full_name unchanged                         |
 *   | name=... (Google alt key)         | full_name = name                            |
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create or replace function public.handle_new_user()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $$
        declare
          base_username text;
          candidate_username text;
          suffix integer := 0;
          buyer_role_id smallint;
          resolved_avatar text;
          resolved_full_name text;
        begin
          -- Username: prefer explicit, else email prefix + 4 hex chars, else UUID fallback
          base_username := case
            when new.raw_user_meta_data->>'username' is not null
              and char_length(new.raw_user_meta_data->>'username') > 0
              then new.raw_user_meta_data->>'username'
            when new.email is not null
              and char_length(new.email) > 0
              then split_part(new.email, '@', 1) || '_' || substr(md5(random()::text), 1, 4)
            else 'user_' || substring(replace(new.id::text, '-', '') from 1 for 10)
          end;
          candidate_username := base_username;

          while exists (select 1 from public.profiles where lower(username) = lower(candidate_username)) loop
            suffix := suffix + 1;
            candidate_username := base_username || '_' || suffix::text;
          end loop;

          -- Avatar: prefer explicit avatar_path, else OAuth keys (avatar_url / picture)
          resolved_avatar := coalesce(
            new.raw_user_meta_data->>'avatar_path',
            new.raw_user_meta_data->>'avatar_url',
            new.raw_user_meta_data->>'picture'
          );

          -- Full name: prefer explicit full_name, else OAuth key (name)
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
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Restore the original trigger from migration 19
      await queryInterface.sequelize.query(
        `
        create or replace function public.handle_new_user()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $$
        declare
          base_username text;
          candidate_username text;
          suffix integer := 0;
          buyer_role_id smallint;
        begin
          base_username := coalesce(
            new.raw_user_meta_data->>'username',
            'user_' || substring(replace(new.id::text, '-', '') from 1 for 10)
          );
          candidate_username := base_username;

          while exists (select 1 from public.profiles where lower(username) = lower(candidate_username)) loop
            suffix := suffix + 1;
            candidate_username := base_username || '_' || suffix::text;
          end loop;

          insert into public.profiles (id, username, full_name, email, avatar_path)
          values (
            new.id,
            candidate_username,
            new.raw_user_meta_data->>'full_name',
            new.email,
            new.raw_user_meta_data->>'avatar_path'
          );

          select id into buyer_role_id from public.roles where name = 'buyer';
          if buyer_role_id is not null then
            insert into public.user_roles (profile_id, role_id) values (new.id, buyer_role_id);
          end if;

          return new;
        end;
        $$;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
