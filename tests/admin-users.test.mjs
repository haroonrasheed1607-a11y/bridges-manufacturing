import test from 'node:test';
import assert from 'node:assert/strict';
test('account API restricts access and never returns password data',async()=>{
 const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;let handler,writes=[];
 globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':'server-secret'},serve:fn=>handler=fn};
 globalThis.fetch=async(url,opts)=>{let data;if(url.endsWith('/auth/v1/user'))data={id:opts.headers.Authorization==='Bearer admin'?'admin-id':'scanner-id'};else if(url.includes('/staff_profiles'))data=[{id:'admin-id',role:'admin',active:true}];else if(opts.method==='PUT'){writes.push(JSON.parse(opts.body));data={id:'target'};}else data={users:[{id:'target',email:'target@example.invalid',encrypted_password:'DO-NOT-RETURN',user_metadata:{password:'DO-NOT-RETURN'}}]};return new Response(JSON.stringify(data));};
 try{await import('../supabase/functions/admin-users/index.ts');
 const call=(token,body)=>handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await call('scanner',{action:'list'})).status,403);
 assert.equal((await call('scanner',{action:'reset',userId:'target',password:'Secret-Test-123'})).status,403);
 const listed=await call('admin',{action:'list'});assert.equal(listed.status,200);assert(!JSON.stringify(await listed.json()).includes('DO-NOT-RETURN'));
 const id='00000000-0000-4000-8000-000000000001';
 assert.equal((await call('admin',{action:'reset',userId:id,password:'short'})).status,400);
 const saved=await call('admin',{action:'reset',userId:id,password:'Secret-Test-123'});assert.deepEqual(await saved.json(),{success:true});assert.equal(writes.length,1);assert.deepEqual(writes[0],{password:'Secret-Test-123'});
 }finally{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete globalThis.Deno;else globalThis.Deno=oldDeno;}
});
