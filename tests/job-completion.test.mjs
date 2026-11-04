import test from 'node:test';
import assert from 'node:assert/strict';
import {jobCompletion} from '../src/domain/jobCompletion.js';
test('completion weights work orders by pieces and includes unstarted work',()=>{
 assert.deepEqual(jobCompletion({workOrders:[{quantity:100,jobs:[{quantity:100,completed:50}]},{quantity:900,jobs:[]}]}),{total:1000,completed:50,percent:5});
});
test('completion handles new orders, invalid counts and does not round unfinished work to 100%',()=>{
 assert.equal(jobCompletion({quantity:1000}).percent,0);
 assert.equal(jobCompletion({workOrders:[{quantity:1000,jobs:[{quantity:1000,completed:999}]}]}).percent,99);
 assert.equal(jobCompletion({workOrders:[{quantity:10,jobs:[{quantity:10,completed:15}]}]}).percent,100);
 assert.equal(jobCompletion({}).percent,0);
});
