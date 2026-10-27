-- First create ONE test user with Supabase Auth. Replace only the email below.
-- Run in Supabase SQL Editor as administrator, not through the application.
-- Never use a real person's details. This script is re-runnable for the same user.
do $$
declare
 demo_email text := 'CHANGE_TO_YOUR_TEST_ACCOUNT@example.invalid';
 demo_owner uuid;
 demo_case uuid;
 user_count integer;
begin
 select count(*) into user_count from auth.users where email=demo_email;
 if user_count<>1 then raise exception 'Set demo_email to exactly one existing test Auth user'; end if;
 select id into demo_owner from auth.users where email=demo_email;
 insert into public.cases(owner_id,alias) values(demo_owner,'합성-001')
 on conflict(owner_id,alias) do update set alias=excluded.alias returning id into demo_case;
 insert into public.consultations(case_id,occurred_on,channel,body) values
 (demo_case,'2026-09-10','phone','혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.'),
 (demo_case,'2026-10-10','phone','최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.')
 on conflict(case_id,occurred_on) do nothing;
end;
$$;
