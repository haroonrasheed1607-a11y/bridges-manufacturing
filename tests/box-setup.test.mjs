import test from 'node:test';
import assert from 'node:assert/strict';
import {nextBoxJob,remainingBoxPieces} from '../src/features/production/boxSetupModel.js';
test('box setup prefers ongoing work and advances after all remaining pieces are allocated',()=>{
 const work={jobs:[{id:'new',quantity:100,completed:0},{id:'ongoing',quantity:100,completed:25}],boxes:[{jobId:'ongoing',quantity:25,completedPieces:25,status:'completed'},{jobId:'ongoing',quantity:50}]};
 assert.equal(nextBoxJob(work).id,'ongoing');
 assert.equal(remainingBoxPieces(work,work.jobs[1]),25);
 work.boxes.push({jobId:'ongoing',quantity:25});
 assert.equal(nextBoxJob(work).id,'new');
 work.jobs[0].completed=100;
 assert.equal(nextBoxJob(work),undefined);
});
test('partial completion releases uncompleted pieces without counting completed pieces twice',()=>{
 const work={jobs:[{id:'a',quantity:100,completed:60}],boxes:[{jobId:'a',quantity:80,completedPieces:60,status:'completed'}]};
 assert.equal(remainingBoxPieces(work,work.jobs[0]),40);
});
