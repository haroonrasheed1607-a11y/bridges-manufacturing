begin;
alter table public.work_orders alter column scan_cooldown_seconds set default 120;
update public.work_orders set scan_cooldown_seconds=120 where scan_cooldown_seconds is null;

do $$
declare definition text; hook text; finish integer; start_at integer;
begin
 definition:=pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer,boolean)'::regprocedure);
 hook:=' fill_seconds:=greatest(1,ceil(';
 start_at:=position(hook in definition);
 finish:=position(' if a.last_scan_at is not null then' in definition);
 if start_at=0 or finish<=start_at then raise exception 'Unexpected scan timing function'; end if;
 execute substring(definition from 1 for start_at-1)||
   ' fill_seconds:=ceil(coalesce(w.scan_cooldown_seconds,120) * fill_pieces::numeric / a.batch_quantity);'||chr(10)||
   substring(definition from finish);

 definition:=pg_get_functiondef('manufacturing_private.save_order(jsonb,bigint,text)'::regprocedure);
 hook:='insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,data)';
 if position(hook in definition)=0 then raise exception 'Unexpected work order insert'; end if;
 definition:=replace(definition,hook,'insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,scan_cooldown_seconds,data)');
 hook:='(w->>''perPack'')::integer,w-';
 if position(hook in definition)=0 then raise exception 'Unexpected work order values'; end if;
 definition:=replace(definition,hook,'(w->>''perPack'')::integer,coalesce((w->>''scanCooldownSeconds'')::integer,120),w-');
 hook:='pieces_per_pack=excluded.pieces_per_pack,data=excluded.data;';
 if position(hook in definition)=0 then raise exception 'Unexpected work order update'; end if;
 execute replace(definition,hook,
   'pieces_per_pack=excluded.pieces_per_pack,scan_cooldown_seconds=coalesce((w->>''scanCooldownSeconds'')::integer,work_orders.scan_cooldown_seconds),data=excluded.data;');

 definition:=pg_get_functiondef('manufacturing_private.read_order(text)'::regprocedure);
 hook:='''scanCooldownSeconds'',case when r=''admin'' then w.scan_cooldown_seconds end';
 if position(hook in definition)=0 then raise exception 'Unexpected scan setting projection'; end if;
 execute replace(definition,hook,'''scanCooldownSeconds'',case when r in (''admin'',''manager'') then coalesce(w.scan_cooldown_seconds,120) end');
end $$;
commit;
