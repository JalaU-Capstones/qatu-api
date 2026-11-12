'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        insert into public.categories (name, slug, description, position, is_active)
        values
          ('Electronics', 'electronics', 'Computers, smartphones, cameras, and audio devices.', 1, true),
          ('Clothing', 'clothing', 'Men, women, and children apparel and accessories.', 2, true),
          ('Home & Garden', 'home-and-garden', 'Furniture, kitchenware, decor, and gardening tools.', 3, true),
          ('Sports', 'sports', 'Sporting goods, fitness equipment, and outdoor apparel.', 4, true),
          ('Books', 'books', 'Fiction, non-fiction, textbooks, and magazines.', 5, true)
        on conflict (slug) do nothing;
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
        delete from public.categories
        where slug in ('electronics', 'clothing', 'home-and-garden', 'sports', 'books');
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
