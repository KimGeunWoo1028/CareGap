-- NEW migration (not yet applied to CareGap Test — requires explicit approval).
-- Apply AFTER 004 + 004a. Do not re-run 001–004a.
--
-- Design choice: AFTER INSERT trigger on public.reviews (SECURITY INVOKER)
-- vs SECURITY DEFINER RPC.
-- Selected: trigger — keeps POST /reviews as a single user-scoped INSERT,
-- shares the review transaction, uses JWT/RLS (no service role), and matches
-- existing insertReview API. RPC would duplicate ownership checks already in RLS.
--
-- Behavior:
-- - needs_followup → insert open next_consultation in the same transaction
-- - confirmed/rejected → no follow-up row
-- - trigger failure rolls back the review insert
-- - existing open follow-up for analysis+kind is left as-is (idempotent skip)
--
-- Orphan recovery (pre-005 reviews without follow-up): POST /follow-ups or
-- createFollowUpFromReview application helper — not automatic rewrite of history.

create or replace function public.reviews_enqueue_follow_up()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_case_id uuid;
  v_note text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.decision is distinct from 'needs_followup' then
    return new;
  end if;

  if new.owner_id is distinct from (select auth.uid()) then
    raise exception 'reviews follow-up: owner_id must match auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  select a.case_id
    into v_case_id
  from public.analyses a
  where a.id = new.analysis_id
    and a.owner_id = new.owner_id
    and a.status = 'succeeded';

  if v_case_id is null then
    raise exception 'reviews follow-up: succeeded analysis not found for owner'
      using errcode = 'foreign_key_violation';
  end if;

  if exists (
    select 1
    from public.follow_up_tasks t
    where t.analysis_id = new.analysis_id
      and t.kind = 'next_consultation'
      and t.status = 'open'
  ) then
    return new;
  end if;

  v_note := btrim(coalesce(new.note, ''));
  if v_note = '' then
    v_note := '추가 상담·확인이 필요합니다.';
  end if;

  insert into public.follow_up_tasks (
    owner_id,
    case_id,
    analysis_id,
    kind,
    note,
    status
  ) values (
    new.owner_id,
    v_case_id,
    new.analysis_id,
    'next_consultation',
    v_note,
    'open'
  );

  return new;
end;
$$;

drop trigger if exists reviews_enqueue_follow_up on public.reviews;

create trigger reviews_enqueue_follow_up
  after insert on public.reviews
  for each row
  execute function public.reviews_enqueue_follow_up();

revoke all on function public.reviews_enqueue_follow_up() from public, anon, authenticated;
-- Trigger execution does not require EXECUTE for roles; keep locked down.
