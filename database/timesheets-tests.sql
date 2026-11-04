begin;
select set_config('request.jwt.claim.sub',(select id::text from public.staff_profiles where role='admin' and active limit 1),true);
set local role authenticated;
do $$declare a jsonb;begin
 a:=public.app_individual_timesheet('DEMO-PERSON-1','2099-01-05','{"notes":"Rollback test","days":{},"manual":[]}',0);
 if a->>'revision'<>'1' then raise exception 'First revision failed';end if;
 a:=public.app_individual_timesheet('DEMO-PERSON-1','2099-01-05','{"notes":"Updated","days":{},"manual":[]}',1);
 if a->>'revision'<>'2' or a#>>'{data,notes}'<>'Updated' then raise exception 'Save failed';end if;
 begin perform public.app_individual_timesheet('DEMO-PERSON-1','2099-01-05','{}',1);raise exception 'Stale write accepted';exception when serialization_failure then null;end;
 begin perform public.app_individual_timesheet('DEMO-PERSON-1','2099-01-06');raise exception 'Non Monday accepted';exception when raise_exception then if sqlerrm='Non Monday accepted' then raise;end if;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.staff_profiles where role='box_scanner' and active limit 1),true);
set local role authenticated;
do $$begin begin perform public.app_individual_timesheet('DEMO-PERSON-1','2099-01-05');raise exception 'Scanner read accepted';exception when insufficient_privilege then null;end;
begin perform public.app_individual_timesheet('DEMO-PERSON-1','2099-01-05','{}',0);raise exception 'Scanner save accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
