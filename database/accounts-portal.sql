alter table public.staff_profiles drop constraint staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check
 check(role in ('admin','manager','coach','station','box_setup','box_scanner','accounts'));

create or replace function manufacturing_private.accounts_people()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'accounts' then
   raise exception 'Accounts access required' using errcode='42501';
 end if;
 return coalesce((
   select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'kind',p.kind) order by p.name,p.id)
   from public.people p where p.kind='individual'
 ),'[]'::jsonb);
end;
$$;

create or replace function public.app_accounts_people()
returns jsonb language sql stable security invoker set search_path='' as $$
 select manufacturing_private.accounts_people();
$$;
revoke all on function manufacturing_private.accounts_people(), public.app_accounts_people() from public,anon;
grant execute on function manufacturing_private.accounts_people(), public.app_accounts_people() to authenticated;

do $patch$
declare
 definition text;
 hook text;
begin
 definition:=pg_get_functiondef('manufacturing_private.workspace()'::regprocedure);
 if position('Accounts cannot open the manufacturing workspace' in definition)=0 then
   hook:='return jsonb_build_object(''orders'',';
   if position(hook in definition)=0 then raise exception 'Unexpected workspace definition'; end if;
   definition:=replace(definition,hook,
     'if r=''accounts'' then raise exception ''Accounts cannot open the manufacturing workspace'' using errcode=''42501''; end if;'||
     chr(10)||' '||hook);
   execute definition;
 end if;

 definition:=pg_get_functiondef('manufacturing_private.timesheet(text,date,jsonb,bigint)'::regprocedure);
 if position('Accounts timesheets are read-only' in definition)=0 then
   hook:='perform manufacturing_private.require_manager();';
   if position(hook in definition)=0 or position('return jsonb_build_object(''data'',report,' in definition)=0 then
     raise exception 'Unexpected timesheet definition';
   end if;
   definition:=replace(definition,hook,$guard$
     if manufacturing_private.actor_role()='accounts' then
       if p_data is not null then raise exception 'Accounts timesheets are read-only' using errcode='42501'; end if;
     else
       perform manufacturing_private.require_manager();
     end if;
   $guard$);
   hook:='return jsonb_build_object(''data'',report,';
   definition:=replace(definition,hook,$redact$
     if manufacturing_private.actor_role()='accounts' then
       report:=jsonb_build_object('days',coalesce((
         select jsonb_object_agg(d.key,jsonb_build_object(
           'arrival',d.value->'arrival','departure',d.value->'departure',
           'workHours',d.value->'workHours','comHours',d.value->'comHours',
           'serviceCommunity',d.value->'serviceCommunity','attendanceStatus',d.value->'attendanceStatus'))
         from jsonb_each(coalesce(report->'days','{}')) d
       ),'{}'));
     end if;
   $redact$||hook);
   execute definition;
 end if;
end
$patch$;
