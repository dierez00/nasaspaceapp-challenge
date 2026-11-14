begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', crypt('Password1', gen_salt('bf')), now(), '{}', '{"full_name":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.test', crypt('Password1', gen_salt('bf')), now(), '{}', '{"full_name":"Other"}', now(), now());

select is((select count(*)::int from public.profiles), 2, 'auth trigger creates profiles');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok($$ select public.create_tenant('Organización Uno', 'organizacion-uno') $$, 'authenticated user creates tenant');
select is((select role::text from public.tenant_memberships limit 1), 'owner', 'creator becomes owner');
select is((select count(*)::int from public.tenants), 1, 'owner can read own tenant');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::int from public.tenants), 0, 'another user cannot read tenant');
select throws_ok($$ insert into public.platform_admins(user_id) values ('10000000-0000-0000-0000-000000000002') $$, '42501', null, 'user cannot self-promote');

reset role;
delete from auth.users where id = '10000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 0, 'deleting auth user removes profile');

select * from finish();
rollback;
