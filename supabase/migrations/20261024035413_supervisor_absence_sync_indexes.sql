alter table public.employee_absences alter column employee_id drop not null;
alter table public.employee_absences add column if not exists employee_name text not null default '';

create index if not exists employee_absences_employee_id_idx on public.employee_absences(employee_id);
create index if not exists daily_report_entries_employee_id_idx on public.daily_report_entries(employee_id);
create index if not exists daily_reports_created_by_idx on public.daily_reports(created_by);
create index if not exists daily_reports_updated_by_idx on public.daily_reports(updated_by);
create index if not exists audit_events_actor_user_id_idx on public.audit_events(actor_user_id);

revoke all on public.supervisor_credentials from anon, authenticated;
revoke all on public.supervisor_login_limits from anon, authenticated;
grant all on public.supervisor_credentials to service_role;
grant all on public.supervisor_login_limits to service_role;
