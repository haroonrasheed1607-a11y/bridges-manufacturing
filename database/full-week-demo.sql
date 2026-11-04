-- Additive sample week: no existing records are overwritten. Safe to rerun.
begin;
do $$
declare i integer;r integer;board integer;day_index integer;qty integer;oid text;wid text;jid text;bid text;coach text;pid text;customer text;work_type text;part_code text;created timestamptz;stamp timestamptz;day date;due date;od jsonb;wd jsonb;j integer;b integer;done boolean;pieces integer;coach_name text;
begin
 for i in 1..30 loop
  r:=(i-1)/10;board:=(i-1)%10;day_index:=(r+board)%5;day:='2026-11-02'::date+day_index;due:='2026-11-06';
  created:=(day::text||' 08:00:00 America/Chicago')::timestamptz;stamp:=(day::text||' 13:00:00 America/Chicago')::timestamptz;
  oid:='DEMO-WEEK1102-ORD-'||lpad(i::text,3,'0');wid:='DEMO-WEEK1102-WO-'||lpad(i::text,3,'0');qty:=300+r*100;
  if exists(select 1 from public.orders where id=oid) then continue;end if;
  coach:='DEMO-COACH-'||(1+i%2);select name into coach_name from public.people where id=coach and is_demo;
  customer:='DEMO-CUSTOMER-'||(i%5);work_type:=case when i%2=0 then 'Packaging' else 'Assembly' end;part_code:=(array['5001','4015','4001','3601'])[1+i%4];
  od:=jsonb_build_object('demo',true,'demoWeek','2026-11-02','title','Demo Week · '||work_type||' · '||part_code||' · '||lpad(i::text,3,'0'),'quantity',qty,'perPack',25,'packCount',qty/25,'frequency',case when i%3=0 then 'weekly' else 'one-time' end,'repeatEveryDays',case when i%3=0 then 7 else null end,'expected',due,'required',due,'description','Fictional sample activity for 2–6 November 2026. Not a real customer order.');
  if board>=2 then od:=od||jsonb_build_object('workOrderApprovedAt',created+interval '15 minutes');end if;
  if board>=3 then od:=od||jsonb_build_object('assignmentConfirmedAt',created+interval '30 minutes');end if;
  if board>=4 then od:=od||jsonb_build_object('productionStartedAt',created+interval '1 hour');end if;
  if board>=8 then od:=od||jsonb_build_object('warehouse',jsonb_build_object('sentAt',stamp+interval '30 minutes','receivedAt',stamp+interval '45 minutes','location','Demo warehouse · Rack '||r,'receiver','Demo warehouse team'));end if;
  if board=9 then od:=od||jsonb_build_object('delivery',jsonb_build_object('approved',true,'approvedAt',stamp+interval '1 hour','approver',coach_name,'method',case when i%2=0 then 'Customer Pickup' else 'Drop Off' end,'details','SAMPLE DELIVERY — no goods dispatched.','dispatchedAt',stamp+interval '75 minutes','signatory','DEMO CUSTOMER — SAMPLE ONLY','signedAt',stamp+interval '90 minutes','signature','data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="80"%3E%3Ctext x="10" y="50" font-size="24"%3ESAMPLE ONLY%3C/text%3E%3C/svg%3E'));end if;
  insert into public.orders(id,customer_id,stage,data,is_demo,created_at,updated_at) values(oid,customer,case when board<=3 then 0 else board-3 end,od,true,created,stamp);
  insert into public.order_events(order_id,message,occurred_at) values(oid,'SAMPLE WEEK · Order created.',created);
  if board=0 then continue;end if;
  wd:=jsonb_build_object('id',wid,'type',work_type,'description','Sample part '||part_code||' · '||work_type,'partCode',part_code,'instructions','1. Check the sample parts. 2. Assemble or pack 25 pieces per box. 3. Scan each completed box. DEMO ONLY.','quantity',qty,'perPack',25,'people',2,'seconds',30,'packSeconds',45,'packageSeconds',795,'timingVersion',2,'hoursPerDay',6,'startDate',day,'expected',due,'required',due,'packsPerSubJob',4,'totalSeconds',qty*30+(qty/25)*45,'parts',jsonb_build_array(jsonb_build_object('id','bolt','name','Bolt','kind','bolt','image',''),jsonb_build_object('id','washer','name','Washer','kind','washer','image',''),jsonb_build_object('id','nut','name','Nut','kind','nut','image','')));
  if board>=3 then wd:=wd||jsonb_build_object('coachId',coach,'coachName',coach_name);end if;
  insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,data) values(wid,oid,case when board>=3 then coach else null end,qty,25,wd);
  insert into public.order_events(order_id,message,occurred_at) values(oid,'SAMPLE WEEK · Work order prepared.',created+interval '10 minutes');
  if board>=3 then insert into public.order_events(order_id,message,occurred_at) values(oid,'SAMPLE WEEK · Assigned to '||coach_name,created+interval '30 minutes');end if;
  for j in 1..qty/100 loop
   jid:=wid||'-SJ-'||lpad(j::text,2,'0');pieces:=case when board>=5 then 100 when board=4 then 50 else 0 end;
   insert into public.sub_jobs(id,work_order_id,quantity,completed,data) values(jid,wid,100,pieces,jsonb_build_object('id',jid,'name','Sub-job '||j,'quantity',100,'completed',pieces,'packType','Box','targetSeconds',10800,'estimatedSeconds',3180));
   if board>=4 then
    for b in 1..(case when board=4 then 3 else 4 end) loop
     bid:='DW1102-'||lpad(i::text,2,'0')||'-'||j||'-'||b;pid:='DEMO-PERSON-'||(1+(i+j+b)%6);done:=board>=5 or b<=2;
     insert into public.boxes(id,sub_job_id,person_id,quantity,completed_pieces,completed_at,data,created_at) values(bid,jid,pid,25,case when done then 25 else null end,case when done then stamp+make_interval(mins=>j*3+b) else null end,jsonb_build_object('id',bid,'jobId',jid,'personId',pid,'quantity',25,'date',day,'coachId',coach,'createdAt',created+interval '1 hour','demo',true),created+interval '1 hour');
     insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,status,data) values(bid,pid,oid,wid,day,day,795.0/3600,case when done then 'completed' else 'booked' end,jsonb_build_object('notes','SAMPLE WEEK · Box assignment'));
     if done then insert into public.production_records(box_id,completed_pieces,completed_at) values(bid,25,stamp+make_interval(mins=>j*3+b));end if;
    end loop;
   end if;
  end loop;
  if board=3 then
   pid:='DEMO-PERSON-'||(1+i%6);
   insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,data) values(wid||'-PLAN',pid,oid,wid,day,day,2,jsonb_build_object('notes','SAMPLE WEEK · Planned production booking'));
  end if;
  if board>=5 then insert into public.order_events(order_id,message,occurred_at) values(oid,'SAMPLE WEEK · All boxes completed.',stamp+interval '20 minutes');end if;
  if board>=6 then insert into public.quality_checks(id,work_order_id,data) values(wid||'-QC',wid,jsonb_build_object('id',wid||'-QC','mode','100% Check','inspected',qty,'failed',0,'inspector',coach_name,'notes','SAMPLE passing inspection.','at',stamp+interval '25 minutes'));end if;
  if board>=7 then insert into public.packing_checks(id,work_order_id,data) values(wid||'-PACK',wid,jsonb_build_object('id',wid||'-PACK','correct',true,'result','correct','checker',coach_name,'notes','SAMPLE labels and quantities verified.','at',stamp+interval '30 minutes'));end if;
  if board>=8 then insert into public.order_events(order_id,message,occurred_at) values(oid,'SAMPLE WEEK · Warehouse received.',stamp+interval '45 minutes');end if;
  if board=9 then insert into public.order_events(order_id,message,occurred_at) values(oid,'SAMPLE WEEK · Delivery and sample signature recorded.',stamp+interval '90 minutes');end if;
 end loop;
 -- Attendance only for demo individuals whose week has not already been filled.
 insert into public.individual_timesheets(person_id,week_start,data)
 select p.id,'2026-11-02',jsonb_build_object('coach','Demo · Job Coach','funding','SAMPLE','location','TBFS · SAMPLE','clientNumber',p.id,'manual','[]'::jsonb,'codes','{}'::jsonb,'notes','SAMPLE WEEK — fictional attendance; completed pieces come from demo boxes. Not approved for payroll or billing.','days',(select jsonb_object_agg(d::date::text,jsonb_build_object('arrival','09:00','departure','14:00','workHours','3.5','comHours','0','serviceCommunity','0')) from generate_series('2026-11-02'::date,'2026-11-06'::date,'1 day') d)) from public.people p where p.is_demo and p.kind='individual' on conflict(person_id,week_start) do nothing;
end$$;
-- A held QC example, plus recurring-order schedule fixtures.
insert into public.quality_checks(id,work_order_id,data) values('DEMO-WEEK1102-WO-006-QC-HOLD','DEMO-WEEK1102-WO-006','{"id":"DEMO-WEEK1102-WO-006-QC-HOLD","mode":"Random Audit","inspected":30,"failed":2,"inspector":"Demo · Maya Chen","notes":"SAMPLE HOLD — two pieces need rework; inspect again before advancing.","at":"2026-11-02T19:25:00Z"}'::jsonb) on conflict(id) do nothing;
insert into public.order_schedules(customer_id,interval_days,next_due_date,data,active)
select o.customer_id,7,'2026-11-09',jsonb_build_object('demo',true,'demoWeek','2026-11-02','sourceOrderId',o.id,'title',o.data->>'title'),true from public.orders o where o.id like 'DEMO-WEEK1102-%' and o.data->>'frequency'='weekly' and not exists(select 1 from public.order_schedules s where s.data->>'sourceOrderId'=o.id);
commit;
