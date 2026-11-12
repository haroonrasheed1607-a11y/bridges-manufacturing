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

test('fixed report rows preserve all piece totals through overflow groups',async()=>{
 const {limitedLog,limitedCodes}=await import('../src/features/timesheets/model.js');
 const entries=Array.from({length:20},(_,i)=>({date:'2026-11-02',code:'PART-'+i,time:'09:00',pieces:i+1}));
 const rows=limitedLog(entries,[],'2026-11-02');assert.equal(rows.length,8);assert.equal(rows.reduce((s,r)=>s+Number(r.pieces||0),0),210);assert.match(rows[7].code,/Other/);
 const cols=limitedCodes(pieceSummary(entries,[]),['2026-11-02']);assert.equal(cols.length,6);assert.equal(cols.reduce((s,c)=>s+Number(c.values['2026-11-02']||0),0),210);
 assert.equal(limitedLog([],[],'2026-11-02').length,8);
});


test('final pieces table groups different work orders by authoritative item code',async()=>{
 const {itemPieceSummary}=await import('../src/features/timesheets/model.js');
 const result=itemPieceSummary([
  {workId:'WO-1',code:'WO-1',itemCode:'4015',date:'2026-11-09',pieces:100},
  {workId:'WO-2',code:'WO-2',itemCode:'4015',date:'2026-11-09',pieces:50},
  {workId:'WO-3',code:'WO-3',itemCode:'3619',date:'2026-11-10',pieces:90},
  {workId:'WO-4',code:'WO-4',date:'2026-11-10',pieces:10}
 ],[],{'WO-1':'old work reference'});
 assert.equal(result['4015']['2026-11-09'],150);assert.equal(result['3619']['2026-11-10'],90);
 assert.equal(result['Uncoded item']['2026-11-10'],10);assert.equal(result['WO-1'],undefined);
 assert.equal(Object.values(result).flatMap(Object.values).reduce((a,b)=>a+b,0),250);
});

test('daily production uses item codes and preserves attendance actions and piece totals',async()=>{
 const {timesheetItemEntries,limitedLog}=await import('../src/features/timesheets/model.js');
 const entries=timesheetItemEntries([
  {workId:'WO-1',code:'WO-1',itemCode:'4015',date:'2026-11-09',time:'09:00',pieces:100},
  {workId:'WO-2',code:'WO-2',itemCode:'4015',date:'2026-11-09',time:'10:00',pieces:50}
 ],{'WO-1':'old reference'});
 const log=limitedLog(entries,[{date:'2026-11-09',code:'AT',time:'08:00',pieces:0}],'2026-11-09');
 assert.equal(log[0].code,'AT');assert.equal(log[1].code,'4015');assert.equal(log[1].pieces,150);
 assert.equal(log[1].first,'09:00');assert.equal(log[1].last,'10:00');
 assert.ok(!log.some(row=>row.code.startsWith('WO-')));
});
