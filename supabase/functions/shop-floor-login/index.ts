import { systemUpdateResponse } from "../_shared/system-update.ts";
// Public, fixed-role access explicitly enabled for shared shop-floor devices.
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers});}
async function api(path:string,body?:unknown){const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!res.ok)throw Error('Shop Floor login unavailable. Please contact the administrator.');return res.json();}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({message:'Method not allowed'},405);
 try{
 const {mode}=await req.json();
 const account=mode==='scanner'?{email:'boxscan@bridges-manufacturing.local',role:'box_scanner'}:mode==='boxer'?{email:'boxsetup@bridges-manufacturing.local',role:'box_setup'}:null;
 if(!account)return reply({message:'Choose scanner or boxer'},400);
 const maintenance=await systemUpdateResponse(base,key,reply);if(maintenance)return maintenance;
 // Resolve only fixed accounts, never a caller-supplied email, ID or role.
 const users=await api('/auth/v1/admin/users?page=1&per_page=1000');
 const user=users.users.find((u:any)=>u.email===account.email);
 if(!user)return reply({message:'Shop Floor account unavailable'},403);
 const profiles=await api('/rest/v1/staff_profiles?id=eq.'+encodeURIComponent(user.id)+'&select=role,active');
 if(!profiles.some((p:any)=>p.active&&p.role===account.role))return reply({message:'Shop Floor account disabled'},403);
 const link=await api('/auth/v1/admin/generate_link',{type:'magiclink',email:account.email});
 if((link.user?.id||link.id)!==user.id)throw Error('Account mismatch');
 const session=await api('/auth/v1/verify',{type:'magiclink',token_hash:link.hashed_token});
 if(session.user?.id!==user.id)throw Error('Account mismatch');
 return reply(session);
 }catch{return reply({message:'Shop Floor login unavailable. Please contact the administrator.'},400);}
});
