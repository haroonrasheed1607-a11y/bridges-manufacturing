begin;
do $$
declare
 user_id uuid;
 pid text:='TEST-ACCOUNTS-'||gen_random_uuid()::text;
 week_start date:='2026-11-09';
 result jsonb;
begin
 select id into strict user_id from public.staff_profiles where active and role='box_scanner' limit 1;
 update public.staff_profiles set role='accounts' where id=user_id;
 perform set_config('request.jwt.claim.sub',user_id::text,true);
 insert into public.people(id,name,kind,data)
 values(pid,'Rollback Accounts fixture','individual','{"role":"Private fixture role"}');
 insert into public.individual_timesheets(person_id,week_start,data,updated_by)
 values(pid,week_start,'{"notes":"Private note","funding":"Private source","days":{"2026-11-09":{"workHours":5,"private":"Private day field"}}}',user_id);
 result:=public.app_accounts_people();
 if not exists(select 1 from jsonb_array_elements(result) x where x->>'id'=pid and not (x ? 'role')) then
   raise exception 'Accounts list did not return the restricted individual record';
 end if;
 result:=public.app_individual_timesheet(pid,week_start);
 if result#>>'{data,days,2026-11-09,workHours}' is distinct from '5'
   or result->'data' ? 'notes' or result->'data' ? 'funding'
   or (result#>'{data,days,2026-11-09}') ? 'private'
 then raise exception 'Accounts timesheet was not properly scoped'; end if;
 begin
   perform public.app_individual_timesheet(pid,week_start,'{}',1);
   raise exception 'Accounts modified a timesheet';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.app_get_workspace();
   raise exception 'Accounts accessed Manufacturing workspace';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.app_attendance(week_start);
   raise exception 'Accounts accessed the editable attendance roster';
 exception when insufficient_privilege then null;
 end;
end
$$;
rollback;
