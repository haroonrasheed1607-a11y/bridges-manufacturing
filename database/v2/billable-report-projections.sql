do $patch$
declare original text; definition text;
begin
 original:=pg_get_functiondef('manufacturing_private.dashboard_production(date,integer)'::regprocedure);
 definition:=replace(original,'r.completed_pieces pieces,','r.completed_pieces pieces,r.billable_units,');
 definition:=replace(definition,'c.completed_at,c.pieces,false','c.completed_at,c.pieces,c.billable_units,false');
 definition:=replace(definition,'''pieces'',coalesce(sum(pieces) filter(where not approved),0),','''billableUnits'',coalesce(sum(billable_units),0),''pieces'',coalesce(sum(pieces) filter(where not approved),0),');
 definition:=replace(definition,'sum(e.pieces) pieces,count(*) scans','sum(e.pieces) pieces,coalesce(sum(e.billable_units),0) billable_units,count(*) scans');
 if definition=original then raise exception 'Unexpected dashboard definition';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.shop_floor_dashboard(date)'::regprocedure);
 definition:=replace(original,'''code'',o.data->>''catalogCode'',''pieces''','''billableMode'',o.total_billable_units is not null,''code'',o.data->>''catalogCode'',''pieces''');
 if definition=original then raise exception 'Unexpected mobile dashboard definition';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.scanner_daily_work(date)'::regprocedure);
 definition:=replace(original,'''pieces'',pieces,''completions''','''billableUnits'',billable_units,''pieces'',pieces,''completions''');
 definition:=replace(definition,'sum(e.pieces) pieces,count(*) completions','sum(e.pieces) pieces,coalesce(sum(e.billable_units),0) billable_units,count(*) completions');
 definition:=replace(definition,'b.completed_pieces pieces,w.order_id','b.completed_pieces pieces,(select coalesce(sum(r.billable_units),0) from public.production_records r where r.box_id=b.id) billable_units,w.order_id');
 definition:=replace(definition,'a.person_id,c.pieces,w.order_id','a.person_id,c.pieces,c.billable_units,w.order_id');
 if definition=original then raise exception 'Unexpected completed work definition';end if;execute definition;
end $patch$;
