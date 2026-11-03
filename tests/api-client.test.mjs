import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api/supabaseClient.js';
function memory(){const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
function response(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});}

test('staff login, authenticated RPC and sign out use the correct protocol',async()=>{
 const calls=[],client=createApiClient({url:'https://example.invalid',key:'public-test-key',storage:memory(),transport:async(url,options)=>{calls.push({url,options});if(url.includes('/auth/v1/token'))return response({access_token:'test-token',refresh_token:'refresh',expires_in:3600});if(url.endsWith('/auth/v1/logout'))return response(null);return response({orders:[],customers:[],workforce:{people:[],bookings:[]}});}});
 await assert.rejects(client.rpc('app_get_workspace'),/Sign in/);
 await client.login(' admin@example.invalid ','password');await client.rpc('app_get_workspace');
 assert.equal(JSON.parse(calls[0].options.body).email,'admin@example.invalid');assert.equal(calls[1].options.headers.Authorization,'Bearer test-token');assert.equal(calls[1].options.headers.apikey,'public-test-key');
 await client.logout();assert.equal(client.hasSession(),false);
});

test('expired sessions share a refresh request and server errors are preserved',async()=>{
 const store=memory();store.setItem('bridges-manufacturing-session-v1',JSON.stringify({access_token:'old',refresh_token:'refresh',expires_at:0}));let refreshes=0;
 const client=createApiClient({url:'https://example.invalid',key:'key',storage:store,transport:async(url)=>{if(url.includes('refresh_token')){refreshes++;return response({access_token:'new',refresh_token:'refresh',expires_in:3600});}return response({message:'Refresh and retry',code:'40001'},409);}});
 const results=await Promise.allSettled([client.rpc('app_get_workspace'),client.rpc('app_get_workspace')]);assert.equal(refreshes,1);assert.equal(results[0].reason.code,'40001');assert.equal(results[1].reason.message,'Refresh and retry');
});

test('private picture references hydrate, cache and serialize back to stable paths',async()=>{
 let signs=0;const store=memory();store.setItem('bridges-manufacturing-session-v1',JSON.stringify({access_token:'token',expires_at:Date.now()/1000+3600}));
 const client=createApiClient({url:'https://example.invalid',key:'key',storage:store,transport:async()=>{signs++;return response({signedURL:'/object/sign/manufacturing-files/orders/O/photo.png?token=test'});}});
 const hydrated=await client.resolveFiles({pictures:[{src:'storage://orders/O/photo.png'}]});assert.match(hydrated.pictures[0].src,/storage\/v1\/object\/sign/);await client.resolveFiles({src:'storage://orders/O/photo.png'});assert.equal(signs,1);
 const normalized=await client.prepareFiles(hydrated,'O');assert.equal(normalized.pictures[0].src,'storage://orders/O/photo.png');
});

test('restricted browser storage still allows a memory-only sign-in session',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
 try{const client=createApiClient({url:'https://example.invalid',key:'key',transport:async()=>response({access_token:'token',expires_in:3600})});await client.login('staff@example.invalid','password');assert.equal(client.hasSession(),true);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
