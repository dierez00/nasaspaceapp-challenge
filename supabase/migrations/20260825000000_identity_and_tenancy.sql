-- Identity and tenancy are the reusable core of this starter.
-- Supabase owns migrations; Prisma mirrors these public tables for server queries.

create type public.tenant_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  -- Mirrored from auth.users through triggers so Prisma never introspects auth.
  id uuid primary key,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.tenant_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_memberships_user_id_idx on public.tenant_memberships (user_id);

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.handle_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
after delete on auth.users
for each row execute procedure public.handle_deleted_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  )
$$;

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id and user_id = auth.uid()
  )
$$;

create or replace function public.can_manage_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

create or replace function public.create_tenant(tenant_name text, tenant_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tenant_id uuid;
  clean_name text := trim(tenant_name);
  clean_slug text := lower(trim(tenant_slug));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(clean_name) not between 3 and 80 then
    raise exception 'Tenant name must contain between 3 and 80 characters' using errcode = '22023';
  end if;

  if clean_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$' then
    raise exception 'Invalid tenant slug' using errcode = '22023';
  end if;

  insert into public.tenants (name, slug)
  values (clean_name, clean_slug)
  returning id into new_tenant_id;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new_tenant_id, auth.uid(), 'owner');

  return new_tenant_id;
end;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.can_manage_tenant(uuid) from public;
revoke all on function public.create_tenant(text, text) from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.can_manage_tenant(uuid) to authenticated;
grant execute on function public.create_tenant(text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.platform_admins enable row level security;

grant select on public.profiles, public.tenants, public.tenant_memberships, public.platform_admins to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name, slug) on public.tenants to authenticated;
grant insert, update, delete on public.tenant_memberships to authenticated;

create policy "profiles_read_self_or_platform_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_platform_admin());

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "tenants_read_membership"
on public.tenants for select to authenticated
using (public.is_tenant_member(id) or public.is_platform_admin());

create policy "tenants_update_managers"
on public.tenants for update to authenticated
using (public.can_manage_tenant(id))
with check (public.can_manage_tenant(id));

create policy "memberships_read_tenant"
on public.tenant_memberships for select to authenticated
using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

create policy "memberships_insert_managers"
on public.tenant_memberships for insert to authenticated
with check (public.can_manage_tenant(tenant_id));

create policy "memberships_update_managers"
on public.tenant_memberships for update to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

create policy "memberships_delete_managers"
on public.tenant_memberships for delete to authenticated
using (public.can_manage_tenant(tenant_id));

create policy "platform_admins_read_self"
on public.platform_admins for select to authenticated
using (user_id = auth.uid());
