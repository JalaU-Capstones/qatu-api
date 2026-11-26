'use strict';

/**
 * Harden RLS
 * has_role, is_order_buyer and is_order_seller stop policy recursion
 * profile emails are hidden from the public key
 * orders only allow status updates, no inserts from PostgREST
 * the API connects as table owner and skips RLS
 */

const legacyRoleCheck = (role) => `exists (
  select 1 from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.profile_id = (select auth.uid()) and r.name = '${role}'
)`;

const roleCheck = (role) => `(select public.has_role('${role}'))`;

const OWN_SELLER = 'seller_id = (select auth.uid())';

/** Policies that looked at user_roles and looped on each other */
const ROLE_POLICIES = [
  {
    table: 'conversations',
    name: 'Admins can view all conversations',
    cmd: 'select',
    role: 'admin',
  },
  {
    table: 'seller_applications',
    name: 'Admins can view all seller applications',
    cmd: 'select',
    role: 'admin',
  },
  {
    table: 'seller_applications',
    name: 'Admins can update seller applications',
    cmd: 'update',
    role: 'admin',
    check: true,
  },
  { table: 'products', name: 'Admins can view all products', cmd: 'select', role: 'admin' },
  { table: 'products', name: 'Admins can delete products', cmd: 'delete', role: 'admin' },
  {
    table: 'products',
    name: 'Sellers can create products',
    cmd: 'insert',
    role: 'seller',
    checkPrefix: OWN_SELLER,
  },
  {
    table: 'ratings',
    name: 'Admins can manage all ratings',
    cmd: 'all',
    role: 'admin',
    check: true,
  },
  {
    table: 'categories',
    name: 'Admins can manage categories',
    cmd: 'all',
    role: 'admin',
    check: true,
  },
  { table: 'payments', name: 'Admins can view all payments', cmd: 'select', role: 'admin' },
  { table: 'audit_logs', name: 'Admins can view all audit logs', cmd: 'select', role: 'admin' },
  { table: 'orders', name: 'Admins can view all orders', cmd: 'select', role: 'admin' },
  { table: 'orders', name: 'Admins can manage all orders', cmd: 'all', role: 'admin', check: true },
  { table: 'order_items', name: 'Admins can view all order items', cmd: 'select', role: 'admin' },
  {
    table: 'messages',
    name: 'Admins can manage all messages',
    cmd: 'all',
    role: 'admin',
    check: true,
  },
  { table: 'user_roles', name: 'Admins can read all user_roles', cmd: 'select', role: 'admin' },
  {
    table: 'user_roles',
    name: 'Admins can manage user_roles',
    cmd: 'all',
    role: 'admin',
    check: true,
  },
  { table: 'roles', name: 'Admins can manage roles', cmd: 'all', role: 'admin', check: true },
];

const LEGACY_ORDER_SELLER = `exists (
  select 1 from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = public.orders.id and p.seller_id = (select auth.uid())
)`;

const LEGACY_ORDER_BUYER = `exists (
  select 1 from public.orders o
  where o.id = order_id and o.buyer_id = (select auth.uid())
)`;

/** orders and order_items pointed at each other */
const ORDER_POLICIES = [
  {
    table: 'orders',
    name: 'Sellers can view orders containing their products',
    cmd: 'select',
    up: '(select public.is_order_seller(id))',
    down: LEGACY_ORDER_SELLER,
  },
  {
    table: 'orders',
    name: 'Sellers can update status of own product orders',
    cmd: 'update',
    up: '(select public.is_order_seller(id))',
    down: LEGACY_ORDER_SELLER,
    check: true,
  },
  {
    table: 'order_items',
    name: 'Buyers can view own order items',
    cmd: 'select',
    up: '(select public.is_order_buyer(order_id))',
    down: LEGACY_ORDER_BUYER,
  },
];

function orderPolicySql(policy, direction) {
  const condition = direction === 'up' ? policy.up : policy.down;
  const withCheck = policy.check ? ` with check (${condition})` : '';
  return `drop policy if exists "${policy.name}" on public.${policy.table};
    create policy "${policy.name}" on public.${policy.table} for ${policy.cmd} to authenticated
    using (${condition})${withCheck};`;
}

function policySql(policy, buildCheck) {
  const condition = buildCheck(policy.role);
  const drop = `drop policy if exists "${policy.name}" on public.${policy.table};`;

  if (policy.cmd === 'insert') {
    return `${drop}
      create policy "${policy.name}" on public.${policy.table} for insert to authenticated
      with check (${policy.checkPrefix} and ${condition});`;
  }

  const withCheck = policy.check ? ` with check (${condition})` : '';
  return `${drop}
    create policy "${policy.name}" on public.${policy.table} for ${policy.cmd} to authenticated
    using (${condition})${withCheck};`;
}

const PUBLIC_PROFILE_COLUMNS =
  'id, username, full_name, avatar_path, bio, locale, created_at, updated_at';

const ORDER_LIFECYCLE_COLUMNS =
  'status, cancellation_reason, confirmed_at, shipped_at, delivered_at, cancelled_at, updated_at';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create or replace function public.has_role(role_name text)
        returns boolean
        language sql
        stable
        security definer
        set search_path = ''
        as $$
          select exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid())
              and r.name = role_name
          );
        $$;

        create or replace function public.is_order_buyer(target_order_id uuid)
        returns boolean
        language sql
        stable
        security definer
        set search_path = ''
        as $$
          select exists (
            select 1 from public.orders o
            where o.id = target_order_id and o.buyer_id = (select auth.uid())
          );
        $$;

        create or replace function public.is_order_seller(target_order_id uuid)
        returns boolean
        language sql
        stable
        security definer
        set search_path = ''
        as $$
          select exists (
            select 1 from public.order_items oi
            join public.products p on p.id = oi.product_id
            where oi.order_id = target_order_id and p.seller_id = (select auth.uid())
          );
        $$;

        revoke all on function public.has_role(text) from public;
        revoke all on function public.is_order_buyer(uuid) from public;
        revoke all on function public.is_order_seller(uuid) from public;
        grant execute on function public.has_role(text) to anon, authenticated;
        grant execute on function public.is_order_buyer(uuid) to authenticated;
        grant execute on function public.is_order_seller(uuid) to authenticated;

        ${ROLE_POLICIES.map((policy) => policySql(policy, roleCheck)).join('\n')}

        ${ORDER_POLICIES.map((policy) => orderPolicySql(policy, 'up')).join('\n')}

        revoke select on public.profiles from anon, authenticated;
        grant select (${PUBLIC_PROFILE_COLUMNS}) on public.profiles to anon, authenticated;

        revoke insert, update on public.orders from anon, authenticated;
        grant update (${ORDER_LIFECYCLE_COLUMNS}) on public.orders to authenticated;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        grant insert, update on public.orders to anon, authenticated;
        grant select on public.profiles to anon, authenticated;

        ${ORDER_POLICIES.map((policy) => orderPolicySql(policy, 'down')).join('\n')}

        ${ROLE_POLICIES.map((policy) => policySql(policy, legacyRoleCheck)).join('\n')}

        drop function if exists public.is_order_seller(uuid);
        drop function if exists public.is_order_buyer(uuid);
        drop function if exists public.has_role(text);
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
