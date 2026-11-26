-- Run against the local stack after migrate: npx supabase test db
-- Everything runs in one transaction that is rolled back; each block uses the PostgREST role
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- Test data, inserted as table owner
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-00000000000a', 'authenticated',
   'authenticated', 'rls-buyer-a@example.qatu.pe', '', now(),
   '{"provider":"email","providers":["email"]}', '{"username":"rls_buyer_a"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-00000000000b', 'authenticated',
   'authenticated', 'rls-buyer-b@example.qatu.pe', '', now(),
   '{"provider":"email","providers":["email"]}', '{"username":"rls_buyer_b"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-00000000000c', 'authenticated',
   'authenticated', 'rls-seller-c@example.qatu.pe', '', now(),
   '{"provider":"email","providers":["email"]}', '{"username":"rls_seller_c"}', now(), now(), '', '', '', '');

insert into public.user_roles (profile_id, role_id)
select 'cccccccc-0000-4000-8000-00000000000c', r.id from public.roles r where r.name = 'seller'
on conflict do nothing;

-- Draft product of the seeded seller, hidden from anon and other sellers
insert into public.products (id, seller_id, name, slug, price, state)
values ('eeeeeeee-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000002',
        'RLS draft product', 'rls-draft-product', 10, 'draft');

-- Order of buyer A with one item from the seeded seller
insert into public.orders (id, buyer_id, status, subtotal, total)
values ('dddddddd-0000-4000-8000-00000000000d', 'aaaaaaaa-0000-4000-8000-00000000000a', 'pending', 10, 10);

insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
select 'dddddddd-0000-4000-8000-00000000000d', p.id, p.name, 1, 10
from public.products p
where p.seller_id = '00000000-0000-4000-8000-000000000002' and p.state = 'published'
limit 1;

insert into public.notifications (profile_id, type, title)
values ('aaaaaaaa-0000-4000-8000-00000000000a', 'order_placed', 'For buyer A'),
       ('bbbbbbbb-0000-4000-8000-00000000000b', 'order_placed', 'For buyer B');

-- No session 
set local role anon;

select throws_ok(
  'select email from public.profiles',
  '42501', null,
  'anon cannot read profile emails'
);
select ok(
  (select count(username) from public.profiles) >= 3,
  'anon can still read public profile columns'
);
select is(
  (select count(*) from public.products where state <> 'published')::int, 0,
  'anon sees no unpublished products'
);
select is((select count(*) from public.orders)::int, 0, 'anon sees no orders');
select is((select count(*) from public.notifications)::int, 0, 'anon sees no notifications');

reset role;

-- Buyer A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  'select count(*) from public.user_roles',
  'role policies no longer recurse (user_roles)'
);
select is((select count(*) from public.orders)::int, 1, 'buyer A sees only own order');
select is((select count(*) from public.order_items)::int, 1, 'buyer A sees own order items');
select is(
  (select count(*) from public.notifications)::int, 1,
  'buyer A sees only own notifications'
);
select throws_ok(
  $$update public.orders set total = 0 where id = 'dddddddd-0000-4000-8000-00000000000d'$$,
  '42501', null,
  'buyer cannot rewrite order totals'
);
select throws_ok(
  $$insert into public.orders (buyer_id) values ('aaaaaaaa-0000-4000-8000-00000000000a')$$,
  '42501', null,
  'buyer cannot create orders outside the checkout API'
);

reset role;

-- Buyer B
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.orders)::int, 0, 'buyer B cannot see buyer A order');
select is((select count(*) from public.order_items)::int, 0, 'buyer B cannot see buyer A items');

reset role;

-- Seeded seller, owns the product on the order 
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*) from public.orders)::int, 1,
  'seller sees orders that contain own products'
);
select ok(
  exists (select 1 from public.products where id = 'eeeeeeee-0000-4000-8000-00000000000e'),
  'seller sees own draft product'
);

reset role;

-- Seller C, no products on the order
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-00000000000c","role":"authenticated"}', true);

select is((select count(*) from public.orders)::int, 0, 'seller C cannot see other sellers orders');
select is(
  (select count(*) from public.products where id = 'eeeeeeee-0000-4000-8000-00000000000e')::int, 0,
  'seller C cannot see another seller draft'
);
-- Published products are visible, but the update policy blocks changes
update public.products set name = 'Hijacked product'
where seller_id = '00000000-0000-4000-8000-000000000002';

reset role;

select is(
  (select count(*) from public.products where name = 'Hijacked product')::int, 0,
  'seller C cannot modify another seller products'
);

-- Admin 
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok((select count(*) from public.orders) >= 1, 'admin sees all orders');
select ok(
  exists (select 1 from public.products where id = 'eeeeeeee-0000-4000-8000-00000000000e'),
  'admin sees unpublished products'
);
select ok((select count(*) from public.user_roles) >= 4, 'admin reads every user role');

reset role;

select * from finish();
rollback;
