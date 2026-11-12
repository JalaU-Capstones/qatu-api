'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.ratings (
          id uuid primary key default gen_random_uuid(),
          buyer_id uuid not null references public.profiles(id) on delete cascade,
          order_id uuid not null references public.orders(id) on delete cascade,
          product_id uuid references public.products(id) on delete cascade,
          seller_id uuid references public.profiles(id) on delete cascade,
          rating smallint not null check (rating between 1 and 5),
          title text,
          comment text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint ratings_target_check check (product_id is not null or seller_id is not null),
          constraint ratings_title_length check (title is null or char_length(title) <= 120),
          constraint ratings_comment_length check (comment is null or char_length(comment) <= 2000)
        );

        create unique index if not exists idx_ratings_unique_product on public.ratings (buyer_id, product_id) where product_id is not null;
        create unique index if not exists idx_ratings_unique_seller on public.ratings (buyer_id, seller_id) where seller_id is not null;
        create index if not exists idx_ratings_product_id on public.ratings (product_id);
        create index if not exists idx_ratings_seller_id on public.ratings (seller_id);
        create index if not exists idx_ratings_buyer_id on public.ratings (buyer_id);

        alter table public.ratings enable row level security;

        drop policy if exists "Ratings are publicly readable" on public.ratings;
        create policy "Ratings are publicly readable"
        on public.ratings for select
        using (true);

        drop policy if exists "Buyers can insert ratings for delivered orders" on public.ratings;
        create policy "Buyers can insert ratings for delivered orders"
        on public.ratings for insert
        to authenticated
        with check (
          buyer_id = (select auth.uid())
          and exists (
            select 1 from public.orders o
            where o.id = order_id
              and o.buyer_id = (select auth.uid())
              and o.status = 'delivered'
          )
          and (
            (product_id is not null and exists (
              select 1 from public.order_items oi
              where oi.order_id = ratings.order_id and oi.product_id = ratings.product_id
            ))
            or
            (seller_id is not null and exists (
              select 1
              from public.order_items oi
              join public.products p on p.id = oi.product_id
              where oi.order_id = ratings.order_id and p.seller_id = ratings.seller_id
            ))
          )
        );

        drop policy if exists "Buyers can update own ratings" on public.ratings;
        create policy "Buyers can update own ratings"
        on public.ratings for update
        to authenticated
        using (buyer_id = (select auth.uid()))
        with check (buyer_id = (select auth.uid()));

        drop policy if exists "Buyers can delete own ratings" on public.ratings;
        create policy "Buyers can delete own ratings"
        on public.ratings for delete
        to authenticated
        using (buyer_id = (select auth.uid()));

        drop policy if exists "Admins can manage all ratings" on public.ratings;
        create policy "Admins can manage all ratings"
        on public.ratings for all
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        )
        with check (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
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
        drop policy if exists "Admins can manage all ratings" on public.ratings;
        drop policy if exists "Buyers can delete own ratings" on public.ratings;
        drop policy if exists "Buyers can update own ratings" on public.ratings;
        drop policy if exists "Buyers can insert ratings for delivered orders" on public.ratings;
        drop policy if exists "Ratings are publicly readable" on public.ratings;
        drop index if exists public.idx_ratings_buyer_id;
        drop index if exists public.idx_ratings_seller_id;
        drop index if exists public.idx_ratings_product_id;
        drop index if exists public.idx_ratings_unique_seller;
        drop index if exists public.idx_ratings_unique_product;
        drop table if exists public.ratings cascade;
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
