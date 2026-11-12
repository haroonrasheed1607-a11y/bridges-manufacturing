import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/api/supabaseClient.js';
import {setSystemUpdating,subscribeSystemUpdating} from '../src/features/system/systemAvailability.js';
import {systemUpdateResponse} from '../supabase/functions/_shared/system-update.ts';
test('maintenance rejects business calls locally, allows status polling and resumes safely',async()=>{
 const events=[];const unsubscribe=subscribeSystemUpdating(value=>events.push(value));let calls=0;
 const storage={getItem:()=>JSON.stringify({access_token:'test',expires_at:9999999999}),setItem(){},removeItem(){}};
 const client=createApiClient({url:'https://test.invalid',key:'public-key',storage,transport:async url=>{
  calls++;return new Response(JSON.stringify(url.endsWith('app_system_status')?{updating:false}:{message:'System under update, please wait',code:'PT503'}),{status:url.endsWith('app_system_status')?200:503});
 }});
 try {
  setSystemUpdating(false);
  await assert.rejects(client.rpc('app_get_workspace'),{code:'PT503',status:503});assert.equal(calls,1);
  await assert.rejects(client.rpc('app_get_workspace'),{code:'PT503'});assert.equal(calls,1);
  await assert.rejects(client.login('admin','password'),{code:'PT503'});assert.equal(calls,1);
  assert.deepEqual(await client.systemStatus(),{updating:false});assert.equal(calls,2);
  setSystemUpdating(false);await assert.rejects(client.rpc('app_get_workspace'),{code:'PT503'});assert.equal(calls,3);
  assert.ok(events.includes(true));
 }finally{unsubscribe();setSystemUpdating(false);}
});
test('edge maintenance check returns 503 before account work and fails closed if status is unavailable',async()=>{
 const previous=globalThis.fetch;const reply=(value,status=200)=>new Response(JSON.stringify(value),{status});
 try {
  globalThis.fetch=async()=>reply({updating:true});const blocked=await systemUpdateResponse('https://test.invalid','server-key',reply);
  assert.equal(blocked.status,503);assert.equal((await blocked.json()).code,'PT503');
  globalThis.fetch=async()=>reply({updating:false});assert.equal(await systemUpdateResponse('https://test.invalid','server-key',reply),null);
  globalThis.fetch=async()=>{throw Error('offline');};assert.equal((await systemUpdateResponse('https://test.invalid','server-key',reply)).status,503);
 }finally{globalThis.fetch=previous;}
});
