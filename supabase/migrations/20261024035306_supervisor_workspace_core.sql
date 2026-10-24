create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.workspaces (
  id text primary key,
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  minimum_staff_per_shift integer not null default 4 check (minimum_staff_per_shift >= 1),
  created_at timestamptz not null default now()
);

create table public.team_config (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  shift_code text not null check (shift_code in ('TM','TT','TN')),
  label text not null,
  leader_slots integer not null default 2 check (leader_slots >= 0),
  leader_names text[] not null default '{}',
  substitute_names text[] not null default '{}',
  primary key (workspace_id, shift_code)
);

create table public.supervisor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('owner','supervisor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.supervisor_credentials (
  username text primary key,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('owner','supervisor')),
  pin_salt text,
  pin_hash text,
  pin_iterations integer not null default 600000 check (pin_iterations between 100000 and 2000000),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  check ((pin_salt is null and pin_hash is null) or (pin_salt is not null and pin_hash is not null))
);

create table public.workspace_states (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  shift_code text not null,
  full_name text not null,
  registration_number text not null default '',
  personal_number text not null default '',
  role text not null default 'employee' check (role in ('leader','substitute','employee')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, shift_code, full_name),
  foreign key (workspace_id, shift_code) references public.team_config(workspace_id, shift_code) on update cascade on delete restrict
);

create table public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  work_date date not null,
  shift_code text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'working' check (status in ('working','off','vacation','absence')),
  source text not null default 'schedule' check (source in ('schedule','manual')),
  created_at timestamptz not null default now(),
  unique (workspace_id, work_date, shift_code, employee_id)
);

create table public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  absence_type text not null default 'leave' check (absence_type in ('vacation','medical','leave','training','other')),
  start_date date not null,
  end_date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  report_date date not null,
  supervisor_name text not null default '',
  shift_condition text not null default '',
  summary text not null default '',
  handoff text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','closed')),
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, report_date)
);

create table public.daily_report_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  position integer not null,
  shift_code text not null default '',
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null default '',
  status text not null default '',
  note text not null default '',
  unique (report_id, position)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  revision bigint not null,
  changed_sections text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.supervisor_login_limits (
  username text not null references public.supervisor_credentials(username) on delete cascade,
  client_key text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (username, client_key)
);

create index employees_workspace_shift_idx on public.employees(workspace_id, shift_code) where is_active;
create index schedule_workspace_date_shift_idx on public.schedule_assignments(workspace_id, work_date, shift_code);
create index schedule_employee_date_idx on public.schedule_assignments(employee_id, work_date);
create index absences_workspace_dates_idx on public.employee_absences(workspace_id, start_date, end_date);
create index reports_workspace_date_idx on public.daily_reports(workspace_id, report_date desc);
create index audit_workspace_created_idx on public.audit_events(workspace_id, created_at desc);

alter table public.workspaces enable row level security;
alter table public.team_config enable row level security;
alter table public.supervisor_profiles enable row level security;
alter table public.supervisor_credentials enable row level security;
alter table public.workspace_states enable row level security;
alter table public.employees enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.employee_absences enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_entries enable row level security;
alter table public.audit_events enable row level security;
alter table public.supervisor_login_limits enable row level security;

create policy "active supervisors can read workspace metadata" on public.workspaces
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can read shift configuration" on public.team_config
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "users can read their own profile" on public.supervisor_profiles
for select to authenticated using (user_id = (select auth.uid()) and is_active);
create policy "active supervisors can read workspace state" on public.workspace_states
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can update workspace state" on public.workspace_states
for update to authenticated
using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active))
with check (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can read employees" on public.employees
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can read schedule" on public.schedule_assignments
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can read absences" on public.employee_absences
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can read reports" on public.daily_reports
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "active supervisors can read report entries" on public.daily_report_entries
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active));
create policy "owners can read audit history" on public.audit_events
for select to authenticated using (exists (select 1 from public.supervisor_profiles p where p.user_id = (select auth.uid()) and p.is_active and p.role = 'owner'));

revoke all on public.workspaces, public.team_config, public.supervisor_profiles, public.supervisor_credentials,
  public.workspace_states, public.employees, public.schedule_assignments, public.employee_absences,
  public.daily_reports, public.daily_report_entries, public.audit_events, public.supervisor_login_limits
from anon;
revoke all on public.supervisor_credentials, public.supervisor_login_limits from authenticated;
grant select on public.workspaces, public.team_config, public.supervisor_profiles, public.employees,
  public.schedule_assignments, public.employee_absences, public.daily_reports, public.daily_report_entries,
  public.audit_events to authenticated;
grant select, update on public.workspace_states to authenticated;
grant all on public.supervisor_credentials, public.supervisor_login_limits to service_role;
grant select, insert on public.audit_events to service_role;

create or replace function private.bump_workspace_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state is distinct from old.state then
    new.revision := old.revision + 1;
    new.updated_at := pg_catalog.now();
    new.updated_by := auth.uid();
  else
    new.revision := old.revision;
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
  end if;
  return new;
end;
$$;
revoke all on function private.bump_workspace_revision() from public, anon, authenticated;

create or replace function private.sync_workspace_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[];
begin
  if tg_op = 'UPDATE' and new.state is not distinct from old.state then
    return new;
  end if;

  delete from public.daily_report_entries x
    using public.daily_reports r
    where x.report_id = r.id and r.workspace_id = new.workspace_id;
  delete from public.daily_reports where workspace_id = new.workspace_id;
  delete from public.schedule_assignments where workspace_id = new.workspace_id;
  delete from public.employee_absences where workspace_id = new.workspace_id;
  delete from public.employees where workspace_id = new.workspace_id;

  insert into public.employees(workspace_id, shift_code, full_name, registration_number, personal_number, role)
  select new.workspace_id, t.key, n.value,
    coalesce(new.state -> 'employeeIds' -> n.value ->> 0, ''),
    coalesce(new.state -> 'employeeIds' -> n.value ->> 1, ''),
    case
      when exists (select 1 from public.team_config tc, unnest(tc.leader_names) leader(name)
                   where tc.workspace_id = new.workspace_id and tc.shift_code = t.key and pg_catalog.lower(leader.name) = pg_catalog.lower(n.value)) then 'leader'
      when exists (select 1 from public.team_config tc, unnest(tc.substitute_names) substitute(name)
                   where tc.workspace_id = new.workspace_id and tc.shift_code = t.key and pg_catalog.lower(substitute.name) = pg_catalog.lower(n.value)) then 'substitute'
      else 'employee'
    end
  from pg_catalog.jsonb_each(coalesce(new.state -> 'teams', '{}'::jsonb)) t
  cross join lateral pg_catalog.jsonb_array_elements_text(t.value) n(value)
  where exists (select 1 from public.team_config tc where tc.workspace_id = new.workspace_id and tc.shift_code = t.key)
  on conflict (workspace_id, shift_code, full_name) do update
  set registration_number = excluded.registration_number,
      personal_number = excluded.personal_number,
      role = excluded.role,
      is_active = true,
      updated_at = pg_catalog.now();

  insert into public.schedule_assignments(workspace_id, work_date, shift_code, employee_id, status)
  select new.workspace_id, d.key::date, s.key, e.id, 'working'
  from pg_catalog.jsonb_each(coalesce(new.state -> 'schedule', '{}'::jsonb)) d
  cross join lateral pg_catalog.jsonb_each(d.value) s
  cross join lateral pg_catalog.jsonb_array_elements_text(s.value) n(name)
  join public.employees e on e.workspace_id = new.workspace_id and e.shift_code = s.key and e.full_name = n.name
  on conflict (workspace_id, work_date, shift_code, employee_id) do nothing;

  insert into public.employee_absences(workspace_id, employee_id, absence_type, start_date, end_date, note)
  select distinct new.workspace_id, e.id,
    case
      when pg_catalog.lower(coalesce(a.value ->> 'note','')) like '%férias%' or pg_catalog.lower(coalesce(a.value ->> 'note','')) like '%ferias%' then 'vacation'
      when pg_catalog.lower(coalesce(a.value ->> 'note','')) like '%atestado%' then 'medical'
      when pg_catalog.lower(coalesce(a.value ->> 'note','')) like '%treinamento%' then 'training'
      else 'leave'
    end,
    (a.value ->> 'start')::date, (a.value ->> 'end')::date, coalesce(a.value ->> 'note','')
  from pg_catalog.jsonb_array_elements(coalesce(new.state -> 'absences','[]'::jsonb)) a
  join public.employees e on e.workspace_id = new.workspace_id and pg_catalog.lower(e.full_name) = pg_catalog.lower(a.value ->> 'name')
  where nullif(a.value ->> 'start','') is not null and nullif(a.value ->> 'end','') is not null;

  insert into public.daily_reports(workspace_id, report_date, supervisor_name, shift_condition, summary, handoff, rows, created_by, updated_by)
  select new.workspace_id, j.key::date, coalesce(j.value ->> 'supervisor',''), coalesce(j.value ->> 'condition',''),
    coalesce(j.value ->> 'summary',''), coalesce(j.value ->> 'handoff',''),
    coalesce(j.value -> 'rows','[]'::jsonb), new.updated_by, new.updated_by
  from pg_catalog.jsonb_each(coalesce(new.state -> 'journals','{}'::jsonb)) j
  on conflict (workspace_id, report_date) do update
  set supervisor_name=excluded.supervisor_name, shift_condition=excluded.shift_condition,
      summary=excluded.summary, handoff=excluded.handoff, rows=excluded.rows,
      updated_by=excluded.updated_by, updated_at=pg_catalog.now();

  insert into public.daily_report_entries(report_id, position, shift_code, employee_id, employee_name, status, note)
  select r.id, row.ordinality::integer, coalesce(row.value ->> 'team',''), e.id,
    coalesce(row.value ->> 'name',''), coalesce(row.value ->> 'status',''), coalesce(row.value ->> 'note','')
  from pg_catalog.jsonb_each(coalesce(new.state -> 'journals','{}'::jsonb)) j
  join public.daily_reports r on r.workspace_id = new.workspace_id and r.report_date = j.key::date
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(j.value -> 'rows','[]'::jsonb)) with ordinality row(value, ordinality)
  left join public.employees e on e.workspace_id = new.workspace_id
    and e.shift_code = coalesce(row.value ->> 'team','')
    and pg_catalog.lower(e.full_name) = pg_catalog.lower(coalesce(row.value ->> 'name',''));

  if tg_op = 'UPDATE' then
    select coalesce(pg_catalog.array_agg(keys.key order by keys.key), array[]::text[])
      into changed
    from (select pg_catalog.jsonb_object_keys(old.state || new.state) as key) keys
    where old.state -> keys.key is distinct from new.state -> keys.key;

    insert into public.audit_events(workspace_id, actor_user_id, revision, changed_sections)
    values (new.workspace_id, new.updated_by, new.revision, changed);
  end if;
  return new;
end;
$$;
revoke all on function private.sync_workspace_snapshot() from public, anon, authenticated;

create trigger workspace_revision_before_update
before update on public.workspace_states
for each row execute function private.bump_workspace_revision();
create trigger workspace_snapshot_after_change
after insert or update of state on public.workspace_states
for each row execute function private.sync_workspace_snapshot();

create or replace function public.record_supervisor_login_attempt(p_username text, p_client_key text, p_succeeded boolean)
returns table(allowed boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_row public.supervisor_login_limits%rowtype;
  v_now timestamptz := pg_catalog.now();
begin
  if p_succeeded then
    delete from public.supervisor_login_limits
    where username = p_username and client_key in ('account', p_client_key);
    return query select true, null::timestamptz;
    return;
  end if;

  foreach v_key in array array['account', p_client_key] loop
    insert into public.supervisor_login_limits(username, client_key, failed_attempts, window_started_at)
    values (p_username, v_key, 0, v_now)
    on conflict (username, client_key) do nothing;

    select * into v_row
    from public.supervisor_login_limits
    where username = p_username and client_key = v_key
    for update;

    if v_row.locked_until is not null and v_row.locked_until > v_now then
      return query select false, v_row.locked_until;
      return;
    end if;

    if v_row.window_started_at < v_now - interval '15 minutes' then
      v_row.failed_attempts := 0;
      v_row.window_started_at := v_now;
      v_row.locked_until := null;
    end if;

    v_row.failed_attempts := v_row.failed_attempts + 1;
    if v_row.failed_attempts >= 5 then
      v_row.locked_until := v_now + interval '15 minutes';
    end if;
    v_row.updated_at := v_now;

    update public.supervisor_login_limits
    set failed_attempts = v_row.failed_attempts,
        window_started_at = v_row.window_started_at,
        locked_until = v_row.locked_until,
        updated_at = v_now
    where username = p_username and client_key = v_key;

    if v_row.locked_until is not null and v_row.locked_until > v_now then
      return query select false, v_row.locked_until;
      return;
    end if;
  end loop;

  return query select true, null::timestamptz;
end;
$$;
revoke all on function public.record_supervisor_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_supervisor_login_attempt(text, text, boolean) to service_role;
