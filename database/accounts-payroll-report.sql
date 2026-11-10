create or replace function manufacturing_private.accounts_payroll_report(p_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  cutoff timestamptz;
  starts_at timestamptz;
  ends_at timestamptz;
begin
  if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'accounts' then
    raise exception 'Accounts access required' using errcode='42501';
  end if;
  if p_start is null or not isfinite(p_start) or extract(isodow from p_start)<>1 then
    raise exception 'Choose a Monday for the start of Week 1' using errcode='22023';
  end if;
  starts_at:=p_start::timestamp at time zone 'America/Chicago';
  cutoff:=(p_start+7)::timestamp at time zone 'America/Chicago';
  ends_at:=(p_start+14)::timestamp at time zone 'America/Chicago';

  return (
    with scans as (
      select b.person_id,b.completed_at,b.completed_pieces as pieces
      from public.boxes b
      where b.completed_at>=starts_at and b.completed_at<ends_at
      union all
      select a.person_id,c.completed_at,c.pieces
      from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
      where c.completed_at>=starts_at and c.completed_at<ends_at
    ), piece_totals as (
      select person_id,
        sum(pieces) filter(where completed_at<cutoff) as week1,
        sum(pieces) filter(where completed_at>=cutoff) as week2
      from scans group by person_id
    ), daily_hours as (
      select person_id,date,work_hours from public.daily_attendance
      where date>=p_start and date<p_start+14
      union all
      select t.person_id,t.week_start+d.day_offset,
        case when jsonb_typeof(t.data#>array['days',(t.week_start+d.day_offset)::text,'workHours'])='number'
          then (t.data#>>array['days',(t.week_start+d.day_offset)::text,'workHours'])::numeric end
      from public.individual_timesheets t cross join generate_series(0,6) d(day_offset)
      where t.week_start in (p_start,p_start+7)
        and not exists (
          select 1 from public.daily_attendance a
          where a.person_id=t.person_id and a.date=t.week_start+d.day_offset
        )
    ), hour_totals as (
      select person_id,
        sum(work_hours) filter(where date<p_start+7) as week1,
        sum(work_hours) filter(where date>=p_start+7) as week2
      from daily_hours group by person_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'number',p.data->>'sourceNumber',
      'week1Pieces',coalesce(s.week1,0),'week2Pieces',coalesce(s.week2,0),
      'week1Hours',h.week1,'week2Hours',h.week2
    ) order by p.name,p.id),'[]'::jsonb)
    from public.people p
    left join piece_totals s on s.person_id=p.id
    left join hour_totals h on h.person_id=p.id
    where p.kind='individual' and (s.person_id is not null or h.person_id is not null)
  );
end;
$$;

create or replace function public.app_accounts_payroll_report(p_start date)
returns jsonb language sql stable security invoker set search_path='' as $$
  select manufacturing_private.accounts_payroll_report(p_start);
$$;

revoke all on function manufacturing_private.accounts_payroll_report(date),
  public.app_accounts_payroll_report(date) from public,anon;
grant execute on function manufacturing_private.accounts_payroll_report(date),
  public.app_accounts_payroll_report(date) to authenticated;
