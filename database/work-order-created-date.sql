begin;
alter table public.work_orders add column created_at timestamptz;
alter table public.work_orders alter column created_at set default now();

-- Only a single recorded creation and a single surviving work order establish
-- an unambiguous match. Multiple creations or discarded work need manual review.
with creation_events as (
 select order_id,min(occurred_at) as created_at
 from public.order_events where message in ('Work order added.','Work order created and approved.')
 group by order_id having count(*)=1
), single_work_order as (
 select order_id from public.work_orders group by order_id having count(*)=1
)
update public.work_orders w set created_at=e.created_at
from creation_events e join single_work_order s on s.order_id=e.order_id
where w.order_id=e.order_id and w.created_at is null
 and not exists(select 1 from public.order_events h where h.order_id=e.order_id and h.message like 'Discarded unstarted work order%');

do $$
declare definition text:=pg_get_functiondef('manufacturing_private.read_order(text)'::regprocedure);
 hook text:='''id'',w.id,''coachId''';
begin
 if position(hook in definition)=0 then raise exception 'Unexpected work order projection'; end if;
 execute replace(definition,hook,'''id'',w.id,''createdAt'',w.created_at,''coachId''');
end $$;
commit;
