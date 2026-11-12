import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogDraft,catalogItemChanges,saveConfirmedCatalogItem} from '../src/features/customers/catalogEditing.js';
const item={id:'I1',code:'PART-1',name:'Parts',rate:.12,unit:'Box',piecesPerUnit:100,revision:4};
test('catalog edits require confirmation before saving and retain the expected revision',async()=>{
 const draft={...catalogDraft(item),piecesPerUnit:'50'};let payload;let message;
 const result=await saveConfirmedCatalogItem(item,draft,{confirm:text=>{message=text;return true;},save:async value=>{payload=value;return '';}});
 assert.equal(result.saved,true);assert.equal(payload.p_revision,4);assert.equal(payload.p_rate,.12);assert.equal(payload.p_pieces_per_unit,50);
 assert.doesNotMatch(message,/Rate:/);assert.match(message,/Pieces per unit: 100 → 50/);
});
test('cancelled, unchanged and invalid edits never save',async()=>{
 let calls=0;const save=async()=>{calls++;};
 const cancelled=await saveConfirmedCatalogItem(item,{...catalogDraft(item),piecesPerUnit:50},{confirm:()=>false,save});assert.equal(cancelled.saved,false);
 await saveConfirmedCatalogItem(item,{...catalogDraft(item),code:' PART-1 '},{confirm:()=>{throw Error('Unchanged edit asked for confirmation');},save});
 const invalid=await saveConfirmedCatalogItem(item,{...catalogDraft(item),piecesPerUnit:0},{confirm:()=>{throw Error('Invalid edit asked for confirmation');},save});assert.ok(invalid.error);assert.equal(calls,0);
});
test('Item unit confirmation includes normalization to one piece and save errors stay visible',async()=>{
 const draft={...catalogDraft(item),unit:'Item'};const changes=catalogItemChanges(item,draft);
 assert.deepEqual(changes.map(x=>x.label),['Unit','Pieces per unit']);
 const result=await saveConfirmedCatalogItem(item,draft,{confirm:()=>true,save:async value=>{assert.equal(value.p_pieces_per_unit,1);return 'This item changed';}});
 assert.equal(result.error,'This item changed');assert.equal(result.saved,undefined);
});

test('Manufacturing rate edits cannot reach confirmation or persistence',async()=>{const result=await saveConfirmedCatalogItem(item,{...catalogDraft(item),rate:1},{confirm:()=>{throw Error('Rate change confirmation should not open');},save:()=>{throw Error('Rate change should not save');}});assert.match(result.error,/Only Accounts/);});

test('Manufacturing cannot change code or name even with a crafted draft',async()=>{for(const edit of [{code:'OTHER'},{name:'Other name'}]){const result=await saveConfirmedCatalogItem(item,{...catalogDraft(item),...edit},{confirm:()=>{throw Error('No confirmation for forbidden fields');},save:()=>{throw Error('No save for forbidden fields');}});assert.match(result.error,/Only Accounts/);}});
test('Accounts confirms metadata changes before saving',async()=>{let saved;const result=await saveConfirmedCatalogItem(item,{...catalogDraft(item),name:'Updated',rate:.5},{allowDetails:true,confirm:message=>{assert.match(message,/Item name: Parts → Updated/);return true;},save:async value=>{saved=value;}});assert.equal(result.saved,true);assert.equal(saved.p_name,'Updated');assert.equal(saved.p_rate,.5);});
