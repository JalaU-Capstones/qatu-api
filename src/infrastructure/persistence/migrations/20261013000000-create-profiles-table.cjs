'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('profiles', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true,
      },
      full_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'buyer',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Enable Row Level Security (RLS) on PostgreSQL
    await queryInterface.sequelize.query('ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;');
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can read own profile'
        ) THEN
          CREATE POLICY "Users can read own profile" ON profiles
            FOR SELECT USING (auth.uid() = id);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can read all profiles'
        ) THEN
          CREATE POLICY "Admins can read all profiles" ON profiles
            FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
        END IF;
      END
      $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('profiles');
  },
};
