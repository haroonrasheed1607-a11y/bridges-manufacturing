begin;
create table public.individual_timesheets(person_id text not null references public.people(id),week_start date not null check(extract(isodow from week_start)=1),data jsonb not null default '{}',revision bigint not null default 1,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),primary key(person_id,week_start));
alter table public.individual_timesheets enable row level security;
revoke all on public.individual_timesheets from public,anon,authenticated;
create function manufacturing_private.timesheet(p_person text,p_week date,p_data jsonb default null,p_revision bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sheet public.individual_timesheets;entries jsonb;
begin
 perform manufacturing_private.require_manager();
 if extract(isodow from p_week)<>1 or p_week is null then raise exception 'Select a Monday';end if;
 if not exists(select 1 from public.people where id=p_person and kind='individual') then raise exception 'Select an individual';end if;
 if p_data is not null then
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>100000 then raise exception 'Invalid timesheet';end if;
  insert into public.individual_timesheets(person_id,week_start,data,updated_by) values(p_person,p_week,p_data,auth.uid())
  on conflict(person_id,week_start) do update set data=excluded.data,revision=individual_timesheets.revision+1,updated_at=now(),updated_by=auth.uid() where individual_timesheets.revision=p_revision;
  if not found then raise exception 'Timesheet changed elsewhere. Reload before saving.' using errcode='40001';end if;
 end if;
 select * into sheet from public.individual_timesheets where person_id=p_person and week_start=p_week;
 select coalesce(jsonb_agg(jsonb_build_object('boxId',b.id,'workId',w.id,'code',coalesce(nullif(w.data->>'partCode',''),w.id),'description',w.data->>'description','date',(b.completed_at at time zone 'America/Chicago')::date,'time',to_char(b.completed_at at time zone 'America/Chicago','HH24:MI'),'pieces',b.completed_pieces) order by b.completed_at,b.id),'[]'::jsonb) into entries from public.boxes b join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id where b.completed_at is not null and b.person_id=p_person and (b.completed_at at time zone 'America/Chicago')::date>=p_week and (b.completed_at at time zone 'America/Chicago')::date<p_week+7;
 return jsonb_build_object('data',coalesce(sheet.data,'{}'::jsonb),'revision',coalesce(sheet.revision,0),'entries',entries);
end$$;
revoke all on function manufacturing_private.timesheet(text,date,jsonb,bigint) from public,anon;
grant execute on function manufacturing_private.timesheet(text,date,jsonb,bigint) to authenticated;
create function public.app_individual_timesheet(p_person text,p_week date,p_data jsonb default null,p_revision bigint default null) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.timesheet(p_person,p_week,p_data,p_revision);$$;
revoke all on function public.app_individual_timesheet(text,date,jsonb,bigint) from public,anon;
grant execute on function public.app_individual_timesheet(text,date,jsonb,bigint) to authenticated;
commit;
