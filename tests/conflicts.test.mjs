import test from 'node:test';
import assert from 'node:assert/strict';
import { isConflictError } from '../src/api/conflicts.js';
test('business conflicts refresh data while other errors retain their handling',()=>{
 assert.equal(isConflictError({code:'PT409'}),true);
 assert.equal(isConflictError({code:'40001'}),true);
 for(const error of [null,{}, {code:'PT503'},{code:'42501'}]) assert.equal(isConflictError(error),false);
});
