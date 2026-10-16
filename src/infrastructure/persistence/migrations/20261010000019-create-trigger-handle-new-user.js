'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop trigger if exists on_auth_user_created on auth.users;
        drop function if exists public.handle_new_user();
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
