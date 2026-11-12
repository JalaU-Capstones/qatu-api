'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.products (
          id uuid primary key default gen_random_uuid(),
          seller_id uuid not null references public.profiles(id) on delete cascade,
          category_id uuid references public.categories(id) on delete set null,
          name text not null,
          slug text not null,
          description text,
          price numeric(12, 2) not null check (price >= 0),
          currency text not null default 'USD',
          stock integer not null default 0 check (stock >= 0),
          attributes jsonb not null default '{}'::jsonb,
          primary_image_path text,
          state text not null default 'draft'
            check (state in ('draft', 'published', 'unpublished', 'archived')),
          average_rating numeric(3, 2) not null default 0 check (average_rating between 0 and 5),
          ratings_count integer not null default 0 check (ratings_count >= 0),
          published_at timestamptz,
          deleted_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          search_vector tsvector generated always as (
            setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(description, '')), 'B')
          ) stored,
          constraint products_name_length check (char_length(name) between 3 and 200),
          constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
          constraint products_currency_check check (currency in ('USD', 'EUR', 'BOB', 'PEN', 'ARS', 'COP', 'MXN', 'BRL')),
          constraint products_published_state check (
            (state = 'published' and published_at is not null) or state <> 'published'
          ),
          unique (seller_id, slug)
        );

        create index if not exists idx_products_seller_id on public.products (seller_id);
        create index if not exists idx_products_category_id on public.products (category_id);
        create index if not exists idx_products_state on public.products (state) where deleted_at is null;
        create index if not exists idx_products_attributes on public.products using gin (attributes);
        create index if not exists idx_products_search on public.products using gin (search_vector);
        create index if not exists idx_products_price on public.products (price) where state = 'published' and deleted_at is null;
        create index if not exists idx_products_created_at on public.products (created_at desc) where state = 'published' and deleted_at is null;

        alter table public.products enable row level security;

        drop policy if exists "Published products are publicly readable" on public.products;
        create policy "Published products are publicly readable"
        on public.products for select
        using (state = 'published' and deleted_at is null);

        drop policy if exists "Sellers can view own products" on public.products;
        create policy "Sellers can view own products"
        on public.products for select
        to authenticated
        using (seller_id = (select auth.uid()));

        drop policy if exists "Admins can view all products" on public.products;
        create policy "Admins can view all products"
        on public.products for select
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        );

        drop policy if exists "Sellers can create products" on public.products;
        create policy "Sellers can create products"
        on public.products for insert
        to authenticated
        with check (
          seller_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'seller'
          )
        );

        drop policy if exists "Sellers can update own products" on public.products;
        create policy "Sellers can update own products"
        on public.products for update
        to authenticated
        using (seller_id = (select auth.uid()))
        with check (seller_id = (select auth.uid()));

        drop policy if exists "Sellers can soft-delete own products" on public.products;
        create policy "Sellers can soft-delete own products"
        on public.products for update
        to authenticated
        using (seller_id = (select auth.uid()))
        with check (seller_id = (select auth.uid()));

        drop policy if exists "Admins can delete products" on public.products;
        create policy "Admins can delete products"
        on public.products for delete
        to authenticated
        using (
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
        drop policy if exists "Admins can delete products" on public.products;
        drop policy if exists "Sellers can soft-delete own products" on public.products;
        drop policy if exists "Sellers can update own products" on public.products;
        drop policy if exists "Sellers can create products" on public.products;
        drop policy if exists "Admins can view all products" on public.products;
        drop policy if exists "Sellers can view own products" on public.products;
        drop policy if exists "Published products are publicly readable" on public.products;
        drop index if exists public.idx_products_created_at;
        drop index if exists public.idx_products_price;
        drop index if exists public.idx_products_search;
        drop index if exists public.idx_products_attributes;
        drop index if exists public.idx_products_state;
        drop index if exists public.idx_products_category_id;
        drop index if exists public.idx_products_seller_id;
        drop table if exists public.products cascade;
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
