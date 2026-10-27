-- Small hand-curated demo catalog, as checked on 2026-10-27; not eligibility rules.
insert into public.welfare_programs
(id,name,tags,summary,eligibility_checks,region,source_url,source_checked_on,catalog_version,active)
values
('senior_care','노인맞춤돌봄서비스',array['meal','mobility'],
 '생활 유지에 도움이 필요한 노인을 위한 안전·일상생활 지원 등의 사업',
 array['만 65세 이상 여부와 관련 수급 자격','돌봄 필요도와 선정 조사','유사 서비스 중복 이용 여부와 지역 수행기관'],
 'national','https://www.mohw.go.kr/menu.es?mid=a10712010400','2026-10-27','2026-10-27',true),
('daegu_integrated','대구형 통합돌봄 단디돌봄',array['meal','mobility','health','environment'],
 '대구 지역의 의료·요양·돌봄 연계 상담 후보',
 array['대구 거주 및 돌봄 필요 여부','주소지 구·군별 제공 서비스와 비용','신청 후 조사 및 기존 서비스 이용 상황'],
 'daegu','https://info.daegu.go.kr/newshome/mtnmain.php?mtnkey=articleview&mkey=scatelist&mkey2=1&aid=276466','2026-10-27','2026-10-27',true)
on conflict (id) do update set name=excluded.name,tags=excluded.tags,summary=excluded.summary,
 eligibility_checks=excluded.eligibility_checks,region=excluded.region,source_url=excluded.source_url,
 source_checked_on=excluded.source_checked_on,catalog_version=excluded.catalog_version,active=excluded.active;
