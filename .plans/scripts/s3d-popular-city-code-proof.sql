-- S3d proof harness — does the code-keyed get_popular_offerings stop pooling
-- two municipalities that share a name?
--
-- ⚠️ NON-DESTRUCTIVE BY CONSTRUCTION: everything runs inside BEGIN … ROLLBACK, so the
-- fixture never persists. It also does NOT insert bookings — the booking placement
-- trigger (20260803000005) validates against schedules, capacity and occurrences, so
-- synthesising a booking is a fight. Instead it RELABELS two existing vendors that
-- already have bookings, which is all this test is about: the city filter.
--
-- Safe to relabel: both BEFORE UPDATE triggers on `vendors` short-circuit when
-- status_id is unchanged (prevent_vendor_status_self_update,
-- validate_vendor_status_transition), and the KYC guard is `OF status_id` only.

\set ON_ERROR_STOP on
\set A 10000000-0000-0000-0000-000000000001
\set B 10000000-0000-0000-0000-000000000003
\set CODE_A 030811000
\set CODE_B 166716000
\set SINCE 2026-04-01
\set UNTIL 2026-10-16

begin;

\echo ''
\echo '=== 0. before: two vendors in genuinely different cities ==='
select id, city, city_code from vendors where id in (:'A', :'B') order by city_code;

-- Build the collision: the same NAME, two different PSGC codes, 13 regions apart
-- (03 = Central Luzon, 16 = Caraga).
update vendors set city = 'Pilar', city_code = :'CODE_A' where id = :'A';
update vendors set city = 'Pilar', city_code = :'CODE_B' where id = :'B';

\echo ''
\echo '=== 1. the fixture: one name, two codes ==='
select id, city, city_code from vendors where id in (:'A', :'B') order by city_code;

\echo ''
\echo '=== 2. the OLD predicate pools them (this is the bug, reproduced) ==='
select lower(v.city) = lower('Pilar') as old_name_predicate_matches,
       count(*)                       as vendors_matched
from vendors v
where v.id in (:'A', :'B')
group by 1;

-- The function gates on is_active(), which resolves auth.uid() from the JWT claims,
-- so the call has to come from a real active profile or it raises 42501.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

\echo ''
\echo '=== 3. the NEW function, per code ==='
select 'code ' || :'CODE_A' || ' (Central Luzon)' as arm,
       count(*) as offerings, coalesce(sum(r.booking_count), 0) as bookings
from get_popular_offerings(:'SINCE', :'UNTIL', :'CODE_A', 20) r;

select 'code ' || :'CODE_B' || ' (Caraga)' as arm,
       count(*) as offerings, coalesce(sum(r.booking_count), 0) as bookings
from get_popular_offerings(:'SINCE', :'UNTIL', :'CODE_B', 20) r;

select 'null (platform-wide)' as arm,
       count(*) as offerings, coalesce(sum(r.booking_count), 0) as bookings
from get_popular_offerings(:'SINCE', :'UNTIL', null, 20) r;

\echo ''
\echo '=== 4. ASSERTIONS ==='
with arm_a as (select offering_id from get_popular_offerings(:'SINCE', :'UNTIL', :'CODE_A', 20)),
     arm_b as (select offering_id from get_popular_offerings(:'SINCE', :'UNTIL', :'CODE_B', 20)),
     own   as (select id, vendor_id from offerings)
select
  case when (select count(*) from arm_a join own on own.id = arm_a.offering_id
             where own.vendor_id <> :'A') = 0
       then 'PASS' else 'FAIL' end as a1_arm_a_only_vendor_a,
  case when (select count(*) from arm_b join own on own.id = arm_b.offering_id
             where own.vendor_id <> :'B') = 0
       then 'PASS' else 'FAIL' end as a2_arm_b_only_vendor_b,
  -- ⚠️ `select 1 from arm_a intersect select 1 from arm_b` was the first version of this
  -- line and it ALWAYS fails when both arms are non-empty: it intersects the literal 1
  -- with itself. Intersect the offering_ids.
  case when not exists (select offering_id from arm_a
                        intersect
                        select offering_id from arm_b)
       then 'PASS' else 'FAIL' end as a3_arms_are_disjoint,
  case when (select count(*) from arm_a) > 0 and (select count(*) from arm_b) > 0
       then 'PASS' else 'FAIL' end as a4_both_arms_nonempty;

reset role;

\echo ''
\echo '=== 5. a blank code must RAISE, not mean everywhere ==='
do $$
declare v_sqlstate text; v_msg text;
begin
  perform public.get_popular_offerings('2026-04-01', '2026-10-16', '', 20);
  raise notice 'a5_blank_code_raises: FAIL — it returned instead of raising';
exception when others then
  v_sqlstate := sqlstate; v_msg := sqlerrm;
  if v_sqlstate = '22023' then
    raise notice 'a5_blank_code_raises: PASS (%) %', v_sqlstate, v_msg;
  else
    raise notice 'a5_blank_code_raises: FAIL — wrong sqlstate % (%)', v_sqlstate, v_msg;
  end if;
end $$;

rollback;

\echo ''
\echo '=== 6. after ROLLBACK — the fixture is gone ==='
select id, city, city_code from vendors where id in (:'A', :'B') order by city_code;
