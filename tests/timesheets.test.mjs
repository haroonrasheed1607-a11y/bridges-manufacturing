import test from 'node:test';
import assert from 'node:assert/strict';
import {monday,datesForWeek,elapsed,pieceSummary} from '../src/features/timesheets/model.js';
test('timesheet weeks and hours handle Sunday, month boundaries and partial days',()=>{
 assert.equal(monday('2026-11-01'),'2026-10-26');assert.equal(datesForWeek('2026-10-26')[6],'2026-11-01');
 assert.equal(elapsed('09:00','13:45'),4.75);assert.equal(elapsed('14:00','09:00'),'');assert.equal(elapsed('','14:00'),'');
});
test('piece summary groups actual completed counts by job and date, including additional work',()=>{
 const result=pieceSummary([{code:'5001',date:'2026-11-02',pieces:20},{code:'5001',date:'2026-11-02',pieces:5},{code:'4015',date:'2026-11-03',pieces:30}],[{code:'5001',date:'2026-11-02',pieces:'3'},{code:'B',date:'2026-11-02',pieces:''}]);
 assert.equal(result['5001']['2026-11-02'],28);assert.equal(result['4015']['2026-11-03'],30);assert.equal(result.B['2026-11-02'],0);
});
