import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEnvironment, PRODUCTION_CONFIG } from '../src/config/environment.js';
const staging={VITE_APP_ENV:'staging',VITE_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
test('production remains pinned to its existing database',()=>{
 assert.deepEqual(resolveEnvironment({}),PRODUCTION_CONFIG);
 assert.deepEqual(resolveEnvironment({WORKERS_CI_BRANCH:'main'}),PRODUCTION_CONFIG);
 assert.throws(()=>resolveEnvironment({...staging,VITE_APP_ENV:'production'}),/pinned/);
});
test('staging fails closed without isolated public credentials',()=>{
 assert.deepEqual(resolveEnvironment(staging),{environment:'staging',url:staging.VITE_SUPABASE_URL,key:staging.VITE_SUPABASE_PUBLISHABLE_KEY});
 for(const env of [{VITE_APP_ENV:'staging'},{WORKERS_CI_BRANCH:'change-in-billing-units'}, {...staging,VITE_SUPABASE_URL:PRODUCTION_CONFIG.url},{...staging,VITE_SUPABASE_URL:'https://fhjaxywcholkmavipyjq.supabase.co'},{...staging,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_unsafe'},{...staging,VITE_SUPABASE_URL:'http://abcdefghijklmnopqrst.supabase.co'}]) assert.throws(()=>resolveEnvironment(env));
 assert.throws(()=>resolveEnvironment({WORKERS_CI_BRANCH:'change-in-billing-units',VITE_APP_ENV:'production'}),/Non-main/);
});
