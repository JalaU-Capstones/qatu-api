'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.product_images (
          id uuid primary key default gen_random_uuid(),
          product_id uuid not null references public.products(id) on delete cascade,
          path text not null,
          alt_text text,
          position integer not null default 0,
          created_at timestamptz not null default now(),
          constraint product_images_alt_text_length check (char_length(alt_text) <= 200)
        );

        create index if not exists idx_product_images_product_id on public.product_images (product_id, position);

        alter table public.product_images enable row level security;

        drop policy if exists "Product images of published products are publicly readable" on public.product_images;
        create policy "Product images of published products are publicly readable"
        on public.product_images for select
        using (
          exists (
            select 1 from public.products p
            where p.id = product_id and p.state = 'published' and p.deleted_at is null
          )
        );

        drop policy if exists "Sellers can view own product images" on public.product_images;
        create policy "Sellers can view own product images"
        on public.product_images for select
        to authenticated
        using (
          exists (
            select 1 from public.products p
            where p.id = product_id and p.seller_id = (select auth.uid())
          )
        );

        drop policy if exists "Sellers can manage own product images" on public.product_images;
        create policy "Sellers can manage own product images"
        on public.product_images for all
        to authenticated
        using (
          exists (
            select 1 from public.products p
            where p.id = product_id and p.seller_id = (select auth.uid())
          )
        )
        with check (
          exists (
            select 1 from public.products p
            where p.id = product_id and p.seller_id = (select auth.uid())
          )
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

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop policy if exists "Sellers can manage own product images" on public.product_images;
        drop policy if exists "Sellers can view own product images" on public.product_images;
        drop policy if exists "Product images of published products are publicly readable" on public.product_images;
        drop index if exists public.idx_product_images_product_id;
        drop table if exists public.product_images cascade;
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
