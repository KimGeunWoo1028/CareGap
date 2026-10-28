-- Immutable snapshot of CareGap Test migration: 004a_follow_up_terminal_immutable
-- Applied version: 20261028084843
-- Apply AFTER 004_follow_up_tasks only. Idempotent CREATE OR REPLACE of the protect function.
-- Do not re-apply on CareGap Test if already present in migration history.

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
  if old.status in ('done', 'cancelled')
     and (
       new.status is distinct from old.status
       or new.completed_at is distinct from old.completed_at
     )
  then
    raise exception 'follow_up_tasks terminal status is immutable'
      using errcode = 'check_violation';
  end if;
  if old.status = 'open' and new.status not in ('open', 'done', 'cancelled') then
    raise exception 'follow_up_tasks invalid status transition'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
