'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        insert into public.roles (name, description)
        values
          ('buyer', 'Default role for all registered users. Can browse products and make purchases.'),
          ('seller', 'Approved merchant who can list and sell products on the platform.'),
          ('admin', 'Platform administrator with full management and moderation access.')
        on conflict (name) do nothing;
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
        delete from public.roles
        where name in ('buyer', 'seller', 'admin');
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
