-- Run only in this project's SQL editor with the chosen staff email.
-- This file is not run by the frontend, the Netlify build or migrations.
do $$
declare target_email text := 'REPLACE_WITH_STAFF_EMAIL'; staff_id uuid;
begin
 if target_email='REPLACE_WITH_STAFF_EMAIL' then raise exception 'Replace the email placeholder first';end if;
 select id into staff_id from auth.users where lower(email)=lower(target_email);
 if staff_id is null then raise exception 'Create and confirm this staff user in Supabase Authentication first';end if;
 insert into public.staff_profiles(id,display_name,role,active)
 values(staff_id,target_email,'admin',true)
 on conflict(id) do update set role='admin',active=true;
end$$;
