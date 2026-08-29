create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role text not null default 'member' check (role in ('owner', 'member')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  can_create_requests boolean not null default false,
  can_edit_requests boolean not null default false,
  can_move_requests boolean not null default false,
  can_delete_requests boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text check (description is null or char_length(description) <= 5000),
  requester_name text not null check (char_length(trim(requester_name)) between 2 and 160),
  assigned_to uuid not null references public.profiles(id) on delete restrict,
  external_url text check (external_url is null or (external_url ~* '^https?://[^[:space:]]+$' and char_length(external_url) <= 2048)),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  position numeric not null default 1024 check (position >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_approval_status_idx on public.profiles (approval_status);
create index requests_status_position_idx on public.requests (status, position);
create index requests_assigned_to_idx on public.requests (assigned_to);
create index requests_created_by_idx on public.requests (created_by);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger permissions_set_updated_at before update on public.user_permissions for each row execute function public.set_updated_at();
create trigger requests_set_updated_at before update on public.requests for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)));
  insert into public.user_permissions (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
