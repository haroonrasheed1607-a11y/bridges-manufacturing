do $patch$
declare original text; revised text;
begin
 original := pg_get_functiondef('manufacturing_private.qr_attendance(text,text,uuid)'::regprocedure);
 revised := replace(original, 'p_action not in (''in'',''out'')', 'p_action not in (''in'',''out'',''auto'')');
 revised := replace(revised, 'or receipt.action<>p_action', 'or (p_action<>''auto'' and receipt.action<>p_action)');
 if revised=original or position('if entry.person_id is null and p_action=' in revised)=0 then
  raise exception 'Unexpected attendance routine definition';
 end if;
 revised := replace(revised, 'if entry.person_id is null and p_action=', $logic$
 if p_action='auto' then
   if entry.arrival is null then
     p_action:='in';
   else
     p_action:='out';
     if entry.departure is null and attendance_time-entry.arrival<interval '10 minutes' then
       raise exception 'Wait 10 minutes after Time In before scanning out.'
         using errcode='PT409';
     end if;
   end if;
 end if;
 if entry.person_id is null and p_action=$logic$);
 execute revised;
end $patch$;
