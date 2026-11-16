do $patch$
declare definition text; original text;
begin
 original:=pg_get_functiondef('manufacturing_private.configuration_history(text,date,date,text,integer)'::regprocedure);
 definition:=replace(original,$old$'Source', 'Pieces'$old$,$new$'Source', 'Legacy pieces', 'Billable units', 'Unit'$new$);
 definition:=replace(definition,'e.qr,e.kind,e.source,e.pieces)','e.qr,e.kind,e.source,case when e.billable_units is null then e.pieces end,e.billable_units,e.billable_unit_label)');
 definition:=replace(definition,'b.id qr,r.completed_pieces pieces,','b.id qr,r.completed_pieces pieces,r.billable_units,r.billable_unit_label,');
 definition:=replace(definition,'a.id,c.pieces,''Scan'',''Reusable''','a.id,c.pieces,c.billable_units,c.billable_unit_label,''Scan'',''Reusable''');
 if definition=original then raise exception 'Unexpected history definition';end if;execute definition;
end $patch$;
