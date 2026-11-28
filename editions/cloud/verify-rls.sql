-- Synthetic isolation/expiry checks. Everything is rolled back; no accounts remain.
begin;
insert into auth.users(id,aud,role,email) values
 ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','ai-accounting-qa-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','ai-accounting-qa-b@example.invalid');
insert into public.accounting_companies(id,owner_id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic B');
insert into public.accounting_ledgers(company_id,content) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic-A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','synthetic-B');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
do $$ declare affected integer; begin
  if (select count(*) from public.accounting_companies) <> 1 then raise exception 'Company isolation failed'; end if;
  if (select count(*) from public.accounting_ledgers) <> 1 then raise exception 'Ledger isolation failed'; end if;
  update public.accounting_ledgers set content='cross-tenant-write' where company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-tenant write was allowed'; end if;
  begin
    update public.accounting_companies set trial_ends_at=now()+interval '3 years';
    raise exception 'Trial renewal was allowed';
  exception when insufficient_privilege then null; end;
  update public.accounting_ledgers set content='own-write' where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revision=0;
  if (select revision from public.accounting_ledgers where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 then raise exception 'Revision did not advance'; end if;
  update public.accounting_ledgers set content='stale-write' where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revision=0;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale update was allowed'; end if;
  insert into public.accounting_operations(company_id,content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"synthetic":true}');
end $$;
reset role;
update public.accounting_companies set trial_ends_at=now()-interval '1 day' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
do $$ declare affected integer; begin
  if (select content from public.accounting_ledgers where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'own-write' then raise exception 'Expired read/export unavailable'; end if;
  update public.accounting_ledgers set content='expired-write' where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Expired ledger write was allowed'; end if;
  update public.accounting_operations set content='{"bad":true}' where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Expired operations write was allowed'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.accounting_ledgers','SELECT') then raise exception 'Anonymous access allowed'; end if;
end $$;
rollback;
select 'PASS: tenant isolation, trial-date protection, stale-write rejection and read/export after expiry; synthetic records rolled back' as verification;
