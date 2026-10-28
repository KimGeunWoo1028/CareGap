-- Immutable snapshot of CareGap Test migration: 004_follow_up_tasks
-- Applied version: 20261028084642
-- Apply AFTER 001–003 on a synthetic test project only. Not re-runnable as a whole.
-- Does not alter cases, consultations, analyses, reviews, or welfare_programs.
-- Terminal-status immutability is added by 004a (do not fold into this file).

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  kind text not null check (kind in (
    'next_consultation',
    'eligibility_check',
    'referral_outcome'
  )),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  due_on date,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'open' and completed_at is null)
    or (status in ('done', 'cancelled') and completed_at is not null)
  )
);

create unique index follow_up_tasks_one_open_per_analysis_kind
  on public.follow_up_tasks(analysis_id, kind)
  where status = 'open' and analysis_id is not null;

create index follow_up_tasks_owner_status
  on public.follow_up_tasks(owner_id, status, created_at desc);
create index follow_up_tasks_case
  on public.follow_up_tasks(case_id, created_at desc);

create or replace function public.follow_up_tasks_protect_keys()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.case_id is distinct from old.case_id
     or new.analysis_id is distinct from old.analysis_id
     or new.kind is distinct from old.kind
     or new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'follow_up_tasks identity and relationship columns are immutable'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger follow_up_tasks_protect_keys
  before update on public.follow_up_tasks
  for each row
  execute function public.follow_up_tasks_protect_keys();

alter table public.follow_up_tasks enable row level security;

revoke all on public.follow_up_tasks from anon, authenticated;
grant select, insert on public.follow_up_tasks to authenticated;
grant update (status, note, due_on, completed_at) on public.follow_up_tasks to authenticated;
grant all on public.follow_up_tasks to service_role;

create policy follow_up_tasks_read on public.follow_up_tasks
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy follow_up_tasks_insert on public.follow_up_tasks
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.owner_id = (select auth.uid())
    )
    and (
      analysis_id is null
      or exists (
        select 1 from public.analyses a
        where a.id = analysis_id
          and a.owner_id = (select auth.uid())
          and a.case_id = case_id
      )
    )
  );

create policy follow_up_tasks_update on public.follow_up_tasks
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.owner_id = (select auth.uid())
    )
    and (
      analysis_id is null
      or exists (
        select 1 from public.analyses a
        where a.id = analysis_id
          and a.owner_id = (select auth.uid())
          and a.case_id = case_id
      )
    )
  );
