import test from 'node:test';import assert from 'node:assert/strict';
import {bulkBoxPlan} from '../src/features/production/bulkPlan.js';
test('bulk plan allocates one box per individual and preserves partial final quantity',()=>{
 const w={perPack:25,boxes:[]},j={id:'a',quantity:60,completed:0};
 assert.deepEqual(bulkBoxPlan(w,j,['A','B','C','C']).map(x=>x.quantity),[25,25,10]);
 assert.throws(()=>bulkBoxPlan(w,j,['A','B','C','D']),/Not enough/);
});
test('bulk excludes already allocated and completed pieces',()=>{
 const w={perPack:25,boxes:[{jobId:'a',quantity:25}]},j={id:'a',quantity:60,completed:25};
 assert.deepEqual(bulkBoxPlan(w,j,['A']),[{personId:'A',quantity:10}]);
 assert.throws(()=>bulkBoxPlan(w,j,[]),/Select/);
});
