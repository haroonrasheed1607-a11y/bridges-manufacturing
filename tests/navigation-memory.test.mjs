import test from 'node:test';import assert from 'node:assert/strict';
import {readNavigation,writeNavigation,validView} from '../src/state/navigationMemory.js';
test('navigation survives reload and stays separate for each account',()=>{const old=globalThis.localStorage;const map=new Map();globalThis.localStorage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};try{writeNavigation({id:'admin'},{view:'detail',orderId:'O-1'});assert.deepEqual(readNavigation({id:'admin'}),{view:'detail',orderId:'O-1'});assert.deepEqual(readNavigation({id:'scanner'}),{});assert.equal(validView('box_scanner','users'),'productionline');assert.equal(validView('manager','users'),'dashboard');assert.equal(validView('admin','detail'),'detail');}finally{globalThis.localStorage=old;}});
test('broken browser storage falls back without crashing navigation',()=>{const old=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};try{assert.deepEqual(readNavigation({id:'a'}),{});assert.doesNotThrow(()=>writeNavigation({id:'a'},{view:'board'}));}finally{globalThis.localStorage=old;}});

test('Plan persists for setup roles and is unavailable to scanner-only accounts',()=>{for(const role of ['admin','manager','coach','station','box_setup'])assert.equal(validView(role,'plan'),'plan');assert.equal(validView('box_scanner','plan'),'productionline');});

test('Print navigation persists for permitted roles',()=>{
 for(const role of ['admin','manager','coach','station','box_setup'])
  assert.equal(validView(role,'shopfloorprint'),'shopfloorprint');
 assert.equal(validView('box_scanner','shopfloorprint'),'productionline');
});

test('Shop Floor menu features persist for permitted roles',()=>{
 for(const role of ['admin','manager','coach','station','box_setup','box_scanner'])
  for(const view of ['shopfloordashboard','shopfloorattendance']) assert.equal(validView(role,view),view);
 assert.notEqual(validView('accounts','shopfloorattendance'),'shopfloorattendance');
});
