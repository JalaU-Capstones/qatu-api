'use strict';

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
        insert into auth.users (id, email, raw_user_meta_data)
        values (
          '00000000-0000-0000-0000-000000000001'::uuid,
          'admin@qatu.local',
          '{"username": "admin", "full_name": "Admin User"}'::jsonb
        )
        on conflict (id) do nothing;

        insert into public.profiles (id, username, full_name, email)
        values (
          '00000000-0000-0000-0000-000000000001'::uuid,
          'admin',
          'Admin User',
          'admin@qatu.local'
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

        delete from auth.users
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
