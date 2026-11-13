'use strict';

// ADR-020: This seeder no longer inserts into auth.users. The auth row is
// provisioned by supabase/seed.sql during `npx supabase db reset`. Only
// public.profiles and public.user_roles are managed here.

module.exports = {
  async up(queryInterface, Sequelize) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Skipping seeder in production.');
      return;
    }

    const transaction = await queryInterface.sequelize.transaction();
    try {
      // ADR-020: verify the auth.users row was provisioned by supabase/seed.sql.
      // The public.profiles insert has an FK to auth.users(id), so without it the
      // seeder fails with a cryptic FK error. Fail with an actionable message.
      const [adminAuthRows] = await queryInterface.sequelize.query(
        `select 1 from auth.users where id = '00000000-0000-0000-0000-000000000001'::uuid limit 1`,
        { transaction }
      );
      if (adminAuthRows.length === 0) {
        await transaction.rollback();
        throw new Error(
          'Admin auth.users row is missing. Run `npx supabase db reset` before `pnpm db:seed:all`. ' +
            'See .docs/MIGRATIONS.md for the canonical bootstrap sequence (ADR-020).'
        );
      }

      await queryInterface.sequelize.query(
        `
        insert into public.profiles (id, username, full_name, email)
        values (
          '00000000-0000-0000-0000-000000000001'::uuid,
          'admin',
          'Admin User',
          'admin@example.qatu.pe'
        )
        on conflict (id) do update set
          username = excluded.username,
          full_name = excluded.full_name,
          email = excluded.email;

        insert into public.user_roles (profile_id, role_id)
        select
          '00000000-0000-0000-0000-000000000001'::uuid,
          r.id
        from public.roles r
        where r.name = 'admin'
        on conflict (profile_id, role_id) do nothing;
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
        delete from public.user_roles
        where profile_id = '00000000-0000-0000-0000-000000000001'::uuid;

        delete from public.profiles
        where id = '00000000-0000-0000-0000-000000000001'::uuid;
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
