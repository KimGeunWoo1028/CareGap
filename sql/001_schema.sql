-- CareGap AI MVP, Supabase SQL Editor; run in a new dedicated project only.
-- auth.uid(), auth.users, anon/authenticated/service_role are supplied by Supabase.
begin;
create extension if not exists pgcrypto;

create table public.cases (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 alias text not null check (alias ~ '^합성-[0-9]{3}$'),
 created_at timestamptz not null default now(),
 unique(owner_id, alias)
);

create table public.consultations (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 occurred_on date not null check (occurred_on <= (now() at time zone 'Asia/Seoul')::date),
 channel text not null check (channel in ('phone','visit','other')),
 body text not null check (char_length(body) between 1 and 2000 and length(btrim(body)) > 0),
 created_at timestamptz not null default now(),
 unique(case_id, occurred_on), unique(id, case_id)
);
create index consultations_order on public.consultations(case_id, occurred_on desc);

create table public.welfare_programs (
 id text primary key check (id in ('senior_care','daegu_integrated')),
 name text not null,
 tags text[] not null check (tags <@ array['meal','mobility','health','environment']::text[]),
 summary text not null,
 eligibility_checks text[] not null,
 region text not null check (region in ('national','daegu')),
 source_url text not null check (source_url like 'https://%'),
 source_checked_on date not null,
 catalog_version text not null,
 active boolean not null default true
);

create table public.analyses (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 previous_note_id uuid not null,
 current_note_id uuid not null,
 idempotency_key uuid not null,
 mode text not null check (mode in ('live','replay')),
 status text not null default 'processing' check (status in ('processing','succeeded','failed')),
 schema_version text not null default '1.0' check (schema_version='1.0'),
 model text,
 result jsonb,
 failure_code text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(owner_id,idempotency_key),
 foreign key (previous_note_id,case_id) references public.consultations(id,case_id),
 foreign key (current_note_id,case_id) references public.consultations(id,case_id),
 check (previous_note_id <> current_note_id),
 check ((status='processing' and result is null and failure_code is null and completed_at is null)
     or (status='succeeded' and result is not null and failure_code is null and completed_at is not null)
     or (status='failed' and result is null and failure_code is not null and completed_at is not null))
);
create unique index analyses_one_processing on public.analyses(case_id) where status='processing';
create index analyses_case_time on public.analyses(case_id,created_at desc);
create index analyses_owner_time on public.analyses(owner_id,created_at desc);

create table public.reviews (
 id uuid primary key default gen_random_uuid(),
 analysis_id uuid not null unique references public.analyses(id) on delete cascade,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 decision text not null check (decision in ('confirmed','needs_followup','rejected')),
 note text not null default '' check (char_length(note) <= 500),
 created_at timestamptz not null default now(),
 check (decision <> 'rejected' or length(btrim(note)) > 0)
);

alter table public.cases enable row level security;
alter table public.consultations enable row level security;
alter table public.welfare_programs enable row level security;
alter table public.analyses enable row level security;
alter table public.reviews enable row level security;

-- Reset API-facing access before granting the minimum. RLS is not a substitute for grants.
revoke all on public.cases, public.consultations, public.welfare_programs, public.analyses, public.reviews from anon, authenticated;
grant select, insert on public.cases, public.consultations, public.reviews to authenticated;
grant select on public.welfare_programs, public.analyses to authenticated;
grant all on public.cases, public.consultations, public.welfare_programs, public.analyses, public.reviews to service_role;

create policy cases_read on public.cases for select to authenticated using (owner_id=(select auth.uid()));
create policy cases_insert on public.cases for insert to authenticated with check (owner_id=(select auth.uid()));
create policy notes_read on public.consultations for select to authenticated using
 (exists (select 1 from public.cases c where c.id=case_id and c.owner_id=(select auth.uid())));
create policy notes_insert on public.consultations for insert to authenticated with check
 (exists (select 1 from public.cases c where c.id=case_id and c.owner_id=(select auth.uid())));
create policy programs_read on public.welfare_programs for select to authenticated using (active=true);
create policy analyses_read on public.analyses for select to authenticated using
 (owner_id=(select auth.uid()) and exists (select 1 from public.cases c where c.id=case_id and c.owner_id=(select auth.uid())));
create policy reviews_read on public.reviews for select to authenticated using (owner_id=(select auth.uid()));
create policy reviews_insert on public.reviews for insert to authenticated with check
 (owner_id=(select auth.uid()) and exists (select 1 from public.analyses a
   where a.id=analysis_id and a.owner_id=(select auth.uid()) and a.status='succeeded'));

-- Only reservation is exposed to authenticated users. The function does not call AI or finalize results.
create or replace function public.start_analysis(p_case_id uuid, p_key uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 actor uuid := auth.uid();
 found_row public.analyses%rowtype;
 prev_id uuid;
 curr_id uuid;
 note_ids uuid[];
 new_id uuid;
 minute_count integer;
 day_count integer;
begin
 if actor is null then raise exception using message='UNAUTHENTICATED',errcode='P0001'; end if;
 if p_case_id is null or p_key is null or p_mode not in ('live','replay') or p_mode is null then
   raise exception using message='VALIDATION_ERROR',errcode='P0001';
 end if;
 -- Serializes all this owner's reservations, including cases and quota checks.
 perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
 perform 1 from public.cases where id=p_case_id and owner_id=actor for update;
 if not found then raise exception using message='NOT_FOUND',errcode='P0001'; end if;

 -- Terminalize stale work on this case before any idempotent return.
 update public.analyses set status='failed',failure_code='TIMEOUT',completed_at=now()
 where case_id=p_case_id and owner_id=actor and status='processing' and created_at < now()-interval '60 seconds';
 select * into found_row from public.analyses where owner_id=actor and idempotency_key=p_key;
 if found then
   if found_row.case_id<>p_case_id or found_row.mode<>p_mode then
     return jsonb_build_object('error_code','IDEMPOTENCY_CONFLICT');
   end if;
   return jsonb_build_object('created',false,'analysis_id',found_row.id,'status',found_row.status);
 end if;
 if exists(select 1 from public.analyses where case_id=p_case_id and status='processing') then
   return jsonb_build_object('error_code','ANALYSIS_IN_PROGRESS');
 end if;
 select array_agg(id order by occurred_on desc) into note_ids from
   (select id,occurred_on from public.consultations where case_id=p_case_id order by occurred_on desc limit 2) recent;
 curr_id := note_ids[1]; prev_id := note_ids[2];
 if curr_id is null or prev_id is null then return jsonb_build_object('error_code','NOT_ENOUGH_RECORDS'); end if;
 if p_mode='live' then
   select count(*) filter (where created_at > now()-interval '1 minute'), count(*)
     into minute_count, day_count from public.analyses
     where owner_id=actor and mode='live' and created_at > now()-interval '24 hours';
   if minute_count>=5 or day_count>=30 then return jsonb_build_object('error_code','RATE_LIMITED'); end if;
 end if;
 insert into public.analyses(case_id,owner_id,previous_note_id,current_note_id,idempotency_key,mode)
 values(p_case_id,actor,prev_id,curr_id,p_key,p_mode) returning id into new_id;
 return jsonb_build_object('created',true,'analysis_id',new_id,'status','processing');
end;
$$;
revoke all on function public.start_analysis(uuid,uuid,text) from public, anon;
grant execute on function public.start_analysis(uuid,uuid,text) to authenticated;
commit;
