create or replace function manufacturing_private.dashboard_production(p_end date,p_days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 start_day date;
 trend_start date;
 result jsonb;
begin
 perform manufacturing_private.require_manager();
 if p_end is null or not isfinite(p_end) or p_days is null or p_days not in (1,7,30) then
   raise exception 'Select a valid dashboard date and period';
 end if;
 start_day:=p_end-p_days+1;
 trend_start:=p_end-greatest(p_days,7)+1;

 with events as (
   select b.person_id,r.completed_at,r.completed_pieces pieces,
     exists(select 1 from public.barcode_approval_batches a
       where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids)) approved
   from public.production_records r join public.boxes b on b.id=r.box_id
   where r.completed_at>=trend_start::timestamp at time zone 'America/Chicago'
     and r.completed_at<(p_end+1)::timestamp at time zone 'America/Chicago'
   union all
   select a.person_id,c.completed_at,c.pieces,false
   from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
   where c.completed_at>=trend_start::timestamp at time zone 'America/Chicago'
     and c.completed_at<(p_end+1)::timestamp at time zone 'America/Chicago'
 ), period as (
   select * from events where completed_at>=start_day::timestamp at time zone 'America/Chicago'
 ), performers as (
   select p.id,p.name,sum(e.pieces) pieces,count(*) scans
   from period e join public.people p on p.id=e.person_id where not e.approved
   group by p.id,p.name
   order by pieces desc,scans desc,p.name,p.id limit 8
 ), daily as (
   select (completed_at at time zone 'America/Chicago')::date as scan_date,sum(pieces) pieces
   from events where not approved group by 1
 )
 select jsonb_build_object(
   'pieces',coalesce(sum(pieces) filter(where not approved),0),
   'scans',count(*) filter(where not approved),
   'individuals',count(distinct person_id) filter(where not approved),
   'approvedPieces',coalesce(sum(pieces) filter(where approved),0),
   'latestScan',max(completed_at) filter(where not approved),
   'performers',coalesce((select jsonb_agg(to_jsonb(p) order by p.pieces desc,p.scans desc,p.name,p.id) from performers p),'[]'),
   'daily',(select jsonb_agg(jsonb_build_object('date',trend_start+i,'pieces',coalesce(d.pieces,0)) order by i)
     from generate_series(0,p_end-trend_start) i left join daily d on d.scan_date=trend_start+i)
 ) into result from period;
 return result;
end;
$$;

create or replace function public.app_dashboard_production(p_end date,p_days integer)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.dashboard_production(p_end,p_days);
$$;
revoke all on function manufacturing_private.dashboard_production(date,integer),
 public.app_dashboard_production(date,integer) from public,anon;
grant execute on function manufacturing_private.dashboard_production(date,integer),
 public.app_dashboard_production(date,integer) to authenticated;
