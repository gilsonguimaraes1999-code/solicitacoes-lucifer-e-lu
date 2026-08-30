create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  kind text not null check (kind in ('system', 'assignee')),
  system_key text check (system_key in ('pending', 'in_progress', 'completed')),
  assignee_id uuid references public.profiles(id) on delete restrict,
  position numeric not null check (
    position >= 0
    and position <= 9007199254740991
    and position not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_columns_shape check (
    (kind = 'system' and system_key is not null and assignee_id is null)
    or (kind = 'assignee' and system_key is null and assignee_id is not null)
  )
);

create unique index board_columns_system_key_unique on public.board_columns(system_key) where system_key is not null;
create unique index board_columns_assignee_unique on public.board_columns(assignee_id) where assignee_id is not null;
create index board_columns_position_idx on public.board_columns(position, id);

insert into public.board_columns(name, kind, system_key, position)
values ('Pendente', 'system', 'pending', 1024),
       ('Em progresso', 'system', 'in_progress', 2048),
       ('Concluído', 'system', 'completed', 3072)
on conflict do nothing;

alter table public.user_permissions add column can_manage_columns boolean not null default false;
alter table public.requests add column column_id uuid references public.board_columns(id) on delete restrict;

update public.requests r
set column_id = c.id
from public.board_columns c
where c.system_key = r.status;

alter table public.requests alter column column_id set not null;
alter table public.requests alter column status drop not null;
alter table public.requests add constraint requests_position_js_safe check (
  position <= 9007199254740991
  and position not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
);
create index requests_column_position_idx on public.requests(column_id, position);

create or replace function public.sync_request_legacy_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.column_id is null then
      select id into new.column_id
      from public.board_columns
      where system_key = 'pending';
    end if;
  elsif new.column_id is not distinct from old.column_id
    and new.status is distinct from old.status
    and new.status is not null then
    select id into new.column_id
    from public.board_columns
    where kind = 'system' and system_key = new.status;
  end if;

  select system_key into new.status
  from public.board_columns
  where id = new.column_id;

  return new;
end;
$$;

create trigger sync_request_legacy_status
before insert or update of column_id, status on public.requests
for each row execute function public.sync_request_legacy_status();

create trigger board_columns_set_updated_at
before update on public.board_columns
for each row execute function public.set_updated_at();

alter table public.board_columns enable row level security;

create policy board_columns_read_approved on public.board_columns
for select to authenticated using (public.is_approved());

drop policy requests_permission_insert on public.requests;
create policy requests_permission_insert on public.requests
for insert to authenticated
with check (
  public.has_request_permission('create')
  and created_by = auth.uid()
  and public.is_approved(assigned_to)
  and position <= 9007199254740991
  and position not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  and exists (
    select 1
    from public.board_columns target_column
    where target_column.id = column_id
      and target_column.kind = 'system'
      and target_column.system_key = 'pending'
  )
);

grant usage on schema public to authenticated;
grant select on table public.board_columns to authenticated;

alter table public.board_columns replica identity full;

do $$ begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'board_columns'
  ) then
    alter publication supabase_realtime add table public.board_columns;
  end if;
end $$;
