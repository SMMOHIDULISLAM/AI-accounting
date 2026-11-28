-- Private owner workspaces for a bounded 30-day learning trial.
-- Company/member roles beyond the owner require a later migration.
create schema if not exists accounting_private;
revoke all on schema accounting_private from public, anon, authenticated;

create table public.accounting_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  trial_started_at timestamptz not null default statement_timestamp(),
  trial_ends_at timestamptz not null default (statement_timestamp() + interval '30 days')
);
create table public.accounting_ledgers (
  company_id uuid primary key references public.accounting_companies(id),
  content text not null check (octet_length(content) <= 5500000),
  revision bigint not null default 0,
  updated_at timestamptz not null default statement_timestamp()
);
create table public.accounting_operations (
  company_id uuid primary key references public.accounting_companies(id),
  content jsonb not null check (octet_length(content::text) <= 1000000),
  revision bigint not null default 0,
  updated_at timestamptz not null default statement_timestamp()
);

alter table public.accounting_companies enable row level security;
alter table public.accounting_ledgers enable row level security;
alter table public.accounting_operations enable row level security;
revoke all on public.accounting_companies, public.accounting_ledgers, public.accounting_operations from anon, authenticated;
grant select on public.accounting_companies, public.accounting_ledgers, public.accounting_operations to authenticated;
-- The browser cannot choose owner IDs, start dates, expiry dates, revisions or timestamps.
grant insert (name), update (name) on public.accounting_companies to authenticated;
grant insert (company_id,content), update (content) on public.accounting_ledgers, public.accounting_operations to authenticated;

create policy company_owner_read on public.accounting_companies for select to authenticated
  using (owner_id = (select auth.uid()));
create policy company_owner_create on public.accounting_companies for insert to authenticated
  with check (owner_id = (select auth.uid()) and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) = false);
create policy company_owner_rename on public.accounting_companies for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy ledger_owner_read on public.accounting_ledgers for select to authenticated
  using (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid())));
create policy ledger_owner_create on public.accounting_ledgers for insert to authenticated
  with check (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid()) and c.trial_ends_at > statement_timestamp()));
create policy ledger_owner_update on public.accounting_ledgers for update to authenticated
  using (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid()) and c.trial_ends_at > statement_timestamp()))
  with check (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid()) and c.trial_ends_at > statement_timestamp()));
create policy operations_owner_read on public.accounting_operations for select to authenticated
  using (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid())));
create policy operations_owner_create on public.accounting_operations for insert to authenticated
  with check (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid()) and c.trial_ends_at > statement_timestamp()));
create policy operations_owner_update on public.accounting_operations for update to authenticated
  using (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid()) and c.trial_ends_at > statement_timestamp()))
  with check (exists (select 1 from public.accounting_companies c where c.id = company_id and c.owner_id = (select auth.uid()) and c.trial_ends_at > statement_timestamp()));

create function accounting_private.bump_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.company_id <> old.company_id then raise exception 'Company identity is immutable'; end if;
  new.revision := old.revision + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function accounting_private.bump_revision() from public,anon,authenticated;
create trigger ledger_revision before update on public.accounting_ledgers for each row execute function accounting_private.bump_revision();
create trigger operations_revision before update on public.accounting_operations for each row execute function accounting_private.bump_revision();
comment on table public.accounting_companies is 'Trial duration is assigned by the server. After expiry, owner read/export remains available. No automatic billing.';
