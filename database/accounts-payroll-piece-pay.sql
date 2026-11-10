-- Calculate WS pay using each order’s saved per-piece rate.
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
      select b.person_id,b.sub_job_id,b.completed_at,b.completed_pieces as pieces
      from public.boxes b
      where b.completed_at>=starts_at and b.completed_at<ends_at
      union all
      select a.person_id,a.sub_job_id,c.completed_at,c.pieces
      from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
      where c.completed_at>=starts_at and c.completed_at<ends_at
    ), rated_scans as (
      select s.person_id,s.completed_at,s.pieces,
        case when jsonb_typeof(o.data->'catalogRate')='number'
          then (o.data->>'catalogRate')::numeric end as rate
      from scans s
      join public.sub_jobs j on j.id=s.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
    ), scan_totals as (
      select person_id,
        sum(pieces) filter(where completed_at<cutoff) as pieces1,
        sum(pieces) filter(where completed_at>=cutoff) as pieces2,
        round(sum(pieces*rate) filter(where completed_at<cutoff),2) as pay1,
        round(sum(pieces*rate) filter(where completed_at>=cutoff),2) as pay2,
        count(*) filter(where completed_at<cutoff and pieces>0 and rate is null) as missing1,
        count(*) filter(where completed_at>=cutoff and pieces>0 and rate is null) as missing2
      from rated_scans group by person_id
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
      'week1Pieces',coalesce(s.pieces1,0),'week2Pieces',coalesce(s.pieces2,0),
      'week1WsPay',case when coalesce(s.missing1,0)=0 then coalesce(s.pay1,0) end,
      'week2WsPay',case when coalesce(s.missing2,0)=0 then coalesce(s.pay2,0) end,
      'week1MissingRate',coalesce(s.missing1,0)>0,
      'week2MissingRate',coalesce(s.missing2,0)>0,
      'week1Hours',h.week1,'week2Hours',h.week2
    ) order by p.name,p.id),'[]'::jsonb)
    from public.people p
    left join scan_totals s on s.person_id=p.id
    left join hour_totals h on h.person_id=p.id
    where p.kind='individual' and (s.person_id is not null or h.person_id is not null)
  );
end;
$$;
