begin;
create function manufacturing_private.present_workers()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(statement_timestamp() at time zone 'America/Chicago')::date;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
  raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 return jsonb_build_object('date',today,'people',coalesce((
  select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.data->>'sourceNumber','timeIn',to_char(a.arrival,'HH24:MI')) order by p.name,p.id)
  from public.daily_attendance a join public.people p on p.id=a.person_id
  where a.date=today and a.status='present' and a.arrival is not null and a.departure is null and p.kind='individual'
 ),'[]'::jsonb));
end $$;
create function public.app_present_workers()
returns jsonb language sql stable security invoker set search_path='' as $$
 select manufacturing_private.present_workers();
$$;
revoke all on function manufacturing_private.present_workers(),public.app_present_workers() from public,anon;
grant execute on function manufacturing_private.present_workers(),public.app_present_workers() to authenticated;
commit;
