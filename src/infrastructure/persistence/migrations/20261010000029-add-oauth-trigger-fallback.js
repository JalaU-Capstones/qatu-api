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
          base_username text;
          candidate_username text;
          suffix integer := 0;
          buyer_role_id smallint;
          resolved_avatar text;
          resolved_full_name text;
        begin
          base_username := case
            when new.raw_user_meta_data->>'username' is not null
              and char_length(new.raw_user_meta_data->>'username') > 0
              then new.raw_user_meta_data->>'username'
            when new.email is not null
              and char_length(
                regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
              ) >= 3
              then substr(
                     regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
                     1,
                     20
                   ) || '_' || substr(md5(random()::text), 1, 4)
            else 'user_' || substring(replace(new.id::text, '-', '') from 1 for 10)
          end;
          candidate_username := base_username;

          while exists (select 1 from public.profiles where lower(username) = lower(candidate_username)) loop
            suffix := suffix + 1;
            candidate_username := base_username || '_' || suffix::text;
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
