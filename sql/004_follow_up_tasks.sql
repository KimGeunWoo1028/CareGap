-- Follow-up work after analysis review (roadmap P1 / hardening).
-- Apply AFTER 001–003 on the synthetic CareGap Test project only.
-- Not re-runnable: second apply fails on existing table/index/policy.
-- Do NOT run on production or non-CareGap projects.

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

-- One open auto/manual task per analysis+kind (needs_followup idempotency).
create unique index follow_up_tasks_one_open_per_analysis_kind
  on public.follow_up_tasks(analysis_id, kind)
  where status = 'open' and analysis_id is not null;

create index follow_up_tasks_owner_status
  on public.follow_up_tasks(owner_id, status, created_at desc);
create index follow_up_tasks_case
  on public.follow_up_tasks(case_id, created_at desc);

alter table public.follow_up_tasks enable row level security;

revoke all on public.follow_up_tasks from anon, authenticated;
grant select, insert, update on public.follow_up_tasks to authenticated;
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
  with check (owner_id = (select auth.uid()));
