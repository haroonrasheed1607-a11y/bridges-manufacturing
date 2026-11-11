create function manufacturing_private.qr_attendance_count()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(statement_timestamp() at time zone 'America/Chicago')::date;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in
   ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 return (select jsonb_build_object('date',today,'timedIn',count(*))
   from public.daily_attendance a join public.people p on p.id=a.person_id
   where a.date=today and a.status='present' and a.arrival is not null and p.kind='individual');
end $$;

create function public.app_qr_attendance_count()
returns jsonb language sql stable security invoker set search_path='' as $$
 select manufacturing_private.qr_attendance_count();
$$;
revoke all on function manufacturing_private.qr_attendance_count(),public.app_qr_attendance_count() from public,anon;
grant execute on function manufacturing_private.qr_attendance_count(),public.app_qr_attendance_count() to authenticated;
