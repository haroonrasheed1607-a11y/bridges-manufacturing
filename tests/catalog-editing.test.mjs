import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogDraft,catalogItemChanges,saveConfirmedCatalogItem} from '../src/features/customers/catalogEditing.js';
const item={id:'I1',code:'PART-1',name:'Parts',rate:.12,unit:'Box',piecesPerUnit:100,revision:4};
test('catalog edits require confirmation before saving and retain the expected revision',async()=>{
 const draft={...catalogDraft(item),rate:'.15',piecesPerUnit:'50'};let payload;let message;
 const result=await saveConfirmedCatalogItem(item,draft,{confirm:text=>{message=text;return true;},save:async value=>{payload=value;return '';}});
 assert.equal(result.saved,true);assert.equal(payload.p_revision,4);assert.equal(payload.p_rate,.15);assert.equal(payload.p_pieces_per_unit,50);
 assert.match(message,/Rate: 0.12 → 0.15/);assert.match(message,/Pieces per unit: 100 → 50/);
});
test('cancelled, unchanged and invalid edits never save',async()=>{
 let calls=0;const save=async()=>{calls++;};
 const cancelled=await saveConfirmedCatalogItem(item,{...catalogDraft(item),name:'New name'},{confirm:()=>false,save});assert.equal(cancelled.saved,false);
 await saveConfirmedCatalogItem(item,{...catalogDraft(item),code:' PART-1 '},{confirm:()=>{throw Error('Unchanged edit asked for confirmation');},save});
 const invalid=await saveConfirmedCatalogItem(item,{...catalogDraft(item),piecesPerUnit:0},{confirm:()=>{throw Error('Invalid edit asked for confirmation');},save});assert.ok(invalid.error);assert.equal(calls,0);
});
test('Item unit confirmation includes normalization to one piece and save errors stay visible',async()=>{
 const draft={...catalogDraft(item),unit:'Item'};const changes=catalogItemChanges(item,draft);
 assert.deepEqual(changes.map(x=>x.label),['Unit','Pieces per unit']);
 const result=await saveConfirmedCatalogItem(item,draft,{confirm:()=>true,save:async value=>{assert.equal(value.p_pieces_per_unit,1);return 'This item changed';}});
 assert.equal(result.error,'This item changed');assert.equal(result.saved,undefined);
});
