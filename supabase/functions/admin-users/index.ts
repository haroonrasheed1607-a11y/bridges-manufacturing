const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
function reply(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});}
async function request(path:string,method='GET',body?:unknown,token=secret){
 const response=await fetch(base+path,{method,headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.msg||data?.message||'Account operation failed.');
 return data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({message:'Method not allowed'},405);
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return reply({message:'Sign in required'},401);
 let actor;
 try{actor=await request('/auth/v1/user','GET',undefined,token);}catch{return reply({message:'Sign in required'},401);}
 try{
 const profiles=await request('/rest/v1/staff_profiles?select=id,display_name,role,active');
 if(!profiles.some((p:any)=>p.id===actor.id&&p.active&&p.role==='admin'))return reply({message:'Administrator access required'},403);
 const input=await req.json();
 if(input.action==='reset'){
  if(typeof input.userId!=='string'||! /^[0-9a-f-]{36}$/i.test(input.userId))return reply({message:'Select a valid user'},400);
  const minimum=profiles.some((p:any)=>p.id===input.userId&&p.role==='accounts')?6:8;
  if(typeof input.password!=='string'||input.password.length<minimum||input.password.length>72||new TextEncoder().encode(input.password).length>72)return reply({message:'Use at least '+minimum+' characters and at most 72 bytes.'},400);
  await request('/auth/v1/admin/users/'+encodeURIComponent(input.userId),'PUT',{password:input.password});
  return reply({success:true});
 }
 if(input.action==='create_accounts'){
  const username=typeof input.username==='string'?input.username.trim().toLowerCase():'';
  if(!/^[a-z][a-z0-9_-]{2,31}$/.test(username))return reply({message:'Use 3–32 letters, numbers, hyphens or underscores, starting with a letter.'},400);
  if(typeof input.password!=='string'||input.password.length<6||new TextEncoder().encode(input.password).length>72)return reply({message:'Use a password of at least 6 characters and at most 72 bytes.'},400);
  const email=username+'@bridges-accounts.local';
  const user=await request('/auth/v1/admin/users','POST',{email,password:input.password,email_confirm:true});
  try {
   await request('/rest/v1/staff_profiles','POST',{id:user.id,display_name:username,role:'accounts',active:true});
  }catch{
   try{await request('/auth/v1/admin/users/'+encodeURIComponent(user.id),'DELETE');}catch{}
   return reply({message:'Could not activate this Accounts login.'},400);
  }
  return reply({username});
 }
 if(input.action!=='list')return reply({message:'Unknown action'},400);
 const page=Number(input.page||1);if(!Number.isInteger(page)||page<1)return reply({message:'Invalid page'},400);
 const result=await request('/auth/v1/admin/users?page='+page+'&per_page=50');
 const users=(result.users||[]).map((u:any)=>{const p=profiles.find((p:any)=>p.id===u.id);return {id:u.id,email:u.email,name:p?.display_name||'',role:p?.role||'Unassigned',active:!!p?.active,lastSignIn:u.last_sign_in_at||null};});
 return reply({users,hasMore:users.length===50,page});
 }catch(e){return reply({message:e instanceof Error?e.message:'Account operation failed'},400);}
});
