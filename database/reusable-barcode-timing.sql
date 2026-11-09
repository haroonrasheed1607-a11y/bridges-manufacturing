begin;
-- Accept newly printed REUSE codes without invalidating existing DUMP labels.
alter table public.dumping_assignments drop constraint if exists dumping_assignments_id_check;
alter table public.dumping_assignments add constraint dumping_assignments_id_check
 check(id ~ '^(DUMP|REUSE)-[A-F0-9]{16}$');

-- Preserve the existing authorization, row locks, request idempotency and capacity checks.
do $migration$
declare
 definition text:=pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer)'::regprocedure);
 old_check text:=$old$if a.last_scan_at>clock_timestamp()-interval '5 seconds' then raise exception 'Duplicate scan blocked. Remove the QR and wait before scanning the next batch.';end if;$old$;
 new_check text:=$new$
 qty:=coalesce(p_pieces,a.batch_quantity);
 -- One full load is the minimum. A double load must have time for both loads.
 fill_pieces:=greatest(a.batch_quantity,least(qty,2*a.batch_quantity));
 fill_seconds:=greatest(1,ceil(
   fill_pieces * greatest(0,coalesce((w.data->>'seconds')::numeric,30))
   + case when w.data->>'timingVersion'='2' then
       ceil(fill_pieces::numeric / w.pieces_per_pack) * greatest(0,coalesce((w.data->>'packSeconds')::numeric,0))
     else
       fill_pieces * greatest(0,coalesce((w.data->>'packSeconds')::numeric,0))
       + ceil(fill_pieces::numeric / w.pieces_per_pack) * greatest(0,coalesce((w.data->>'packageSeconds')::numeric,0))
     end
 ));
 if a.last_scan_at is not null then
   wait_seconds:=ceil(extract(epoch from a.last_scan_at-clock_timestamp())+fill_seconds);
   if wait_seconds>0 then
     raise exception 'Too soon to scan this reusable barcode. Try again in % min % sec.',floor(wait_seconds/60),mod(wait_seconds,60);
   end if;
 end if;
$new$;
begin
 if position('fill_seconds numeric' in definition)>0 then return; end if;
 if position(old_check in definition)=0 or position('pending integer;begin' in definition)=0 then
  raise exception 'Unexpected reusable scan function definition';
 end if;
 definition:=replace(definition,'pending integer;begin','pending integer;fill_pieces integer;fill_seconds numeric;wait_seconds numeric;begin');
 definition:=replace(definition,old_check||chr(10)||' qty:=coalesce(p_pieces,a.batch_quantity);',new_check);
 if position(new_check in definition)=0 then raise exception 'Reusable scan timing check was not installed';end if;
 definition:=replace(definition,'''Dumping ''','''Reusable barcode ''');
 execute definition;
end
$migration$;
commit;
