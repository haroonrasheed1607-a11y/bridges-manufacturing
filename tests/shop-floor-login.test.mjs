import test from 'node:test';
import assert from 'node:assert/strict';
test('public shop floor login accepts only fixed, active restricted accounts',async()=>{
 const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;let handler,active=true,requested=[];
 globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':'server-secret'},serve:fn=>handler=fn};
 globalThis.fetch=async(url,opts)=>{requested.push(url);let data;if(url.endsWith('/rpc/app_system_status'))data={updating:false};else if(url.includes('/admin/users'))data={users:[{id:'scanner-id',email:'boxscan@bridges-manufacturing.local'}]};else if(url.includes('/staff_profiles'))data=[{role:'box_scanner',active}];else if(url.includes('generate_link')){assert.equal(JSON.parse(opts.body).email,'boxscan@bridges-manufacturing.local');data={user:{id:'scanner-id'},hashed_token:'test-hash'};}else data={user:{id:'scanner-id'},access_token:'session-token'};return new Response(JSON.stringify(data));};
 try{await import('../supabase/functions/shop-floor-login/index.ts');
 const call=body=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));
 assert.equal((await call({mode:'admin',email:'admin@example.invalid'})).status,400);assert.equal(requested.length,0);
 active=false;assert.equal((await call({mode:'scanner'})).status,403);assert(!requested.some(url=>url.includes('generate_link')));
 active=true;const result=await call({mode:'scanner',email:'admin@example.invalid',role:'admin'});assert.equal(result.status,200);assert.equal((await result.json()).user.id,'scanner-id');
 }finally{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete globalThis.Deno;else globalThis.Deno=oldDeno;}
});
