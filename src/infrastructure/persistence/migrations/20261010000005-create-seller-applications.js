'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.seller_applications (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid not null references public.profiles(id) on delete cascade,
          business_name text not null,
          business_description text not null,
          contact_phone text,
          contact_email text,
          status text not null default 'pending'
            check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
          reviewed_by uuid references public.profiles(id) on delete set null,
          reviewed_at timestamptz,
          rejection_reason text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint seller_applications_business_name_length check (char_length(business_name) between 2 and 120),
          constraint seller_applications_description_length check (char_length(business_description) between 20 and 2000)
        );

        create index if not exists idx_seller_applications_profile_id on public.seller_applications (profile_id);
        create index if not exists idx_seller_applications_status on public.seller_applications (status) where status = 'pending';

        alter table public.seller_applications enable row level security;

        drop policy if exists "Users can view own seller applications" on public.seller_applications;
        create policy "Users can view own seller applications"
        on public.seller_applications for select
        to authenticated
        using (profile_id = (select auth.uid()));

        drop policy if exists "Admins can view all seller applications" on public.seller_applications;
        create policy "Admins can view all seller applications"
        on public.seller_applications for select
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        );

        drop policy if exists "Users can submit own seller application" on public.seller_applications;
        create policy "Users can submit own seller application"
        on public.seller_applications for insert
        to authenticated
        with check (profile_id = (select auth.uid()) and status = 'pending');

        drop policy if exists "Users can withdraw own pending application" on public.seller_applications;
        create policy "Users can withdraw own pending application"
        on public.seller_applications for update
        to authenticated
        using (profile_id = (select auth.uid()) and status = 'pending')
        with check (profile_id = (select auth.uid()) and status in ('pending', 'withdrawn'));

        drop policy if exists "Admins can update seller applications" on public.seller_applications;
        create policy "Admins can update seller applications"
        on public.seller_applications for update
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
        drop policy if exists "Admins can update seller applications" on public.seller_applications;
        drop policy if exists "Users can withdraw own pending application" on public.seller_applications;
        drop policy if exists "Users can submit own seller application" on public.seller_applications;
        drop policy if exists "Admins can view all seller applications" on public.seller_applications;
        drop policy if exists "Users can view own seller applications" on public.seller_applications;
        drop index if exists public.idx_seller_applications_status;
        drop index if exists public.idx_seller_applications_profile_id;
        drop table if exists public.seller_applications cascade;
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
