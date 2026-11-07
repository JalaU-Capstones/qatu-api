'use strict';

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
          raw_username text;
          base_username text;
          candidate_username text;
          email_prefix text;
          suffix integer := 0;
          buyer_role_id smallint;
          resolved_avatar text;
          resolved_full_name text;
        begin
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

        drop trigger if exists on_auth_user_created on auth.users;
        create trigger on_auth_user_created
          after insert on auth.users
          for each row execute function public.handle_new_user();
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
