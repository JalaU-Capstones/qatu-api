'use strict';

// Fixed development seed mapping (UUID v4 literals; stable across re-seeds):
// admin user -> 00000000-0000-4000-8000-000000000001
// seller user -> 00000000-0000-4000-8000-000000000002
/**
 * ADR-020: Creates public.profiles and public.user_roles for the two users
 * seeded by supabase/seed.sql (admin and sample_seller).
 *
 * This runs after `pnpm db:migrate` has provisioned public.profiles and public.roles.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Skipping seeder in production.');
      return;
    }

    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        insert into public.profiles (id, username, full_name, email)
        values
          ('00000000-0000-4000-8000-000000000001'::uuid, 'admin', 'Admin User', 'admin@example.qatu.pe'),
          ('00000000-0000-4000-8000-000000000002'::uuid, 'sample_seller', 'Sample Seller', 'seller@example.qatu.pe')
        on conflict (id) do nothing;

        insert into public.user_roles (profile_id, role_id)
        select '00000000-0000-4000-8000-000000000001'::uuid, r.id
        from public.roles r
        where r.name = 'admin'
        on conflict (profile_id, role_id) do nothing;

        insert into public.user_roles (profile_id, role_id)
        select '00000000-0000-4000-8000-000000000002'::uuid, r.id
        from public.roles r
        where r.name = 'seller'
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
        where profile_id in (
          '00000000-0000-4000-8000-000000000001'::uuid,
          '00000000-0000-4000-8000-000000000002'::uuid
        );

        delete from public.profiles
        where id in (
          '00000000-0000-4000-8000-000000000001'::uuid,
          '00000000-0000-4000-8000-000000000002'::uuid
        );
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
