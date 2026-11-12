begin;
do $$declare original text; definition text; hook text;begin
 original:=pg_get_functiondef('manufacturing_private.timesheet(text,date,jsonb,bigint)'::regprocedure);
 hook:='''workId'',w.id,''code''';
 if position(hook in original)=0 then raise exception 'Unexpected timesheet entry projection';end if;
 definition:=replace(original,hook,$item$
 'workId',w.id,'itemCode',coalesce(
  nullif((select o.data->>'catalogCode' from public.orders o where o.id=w.order_id),''),
  (select i.code from public.orders o join public.customer_items i on i.id::text=o.data->>'catalogItemId' where o.id=w.order_id),
  nullif(w.data->>'partCode',''),'Uncoded item'),'code'
 $item$);
 execute definition;
end $$;
commit;
