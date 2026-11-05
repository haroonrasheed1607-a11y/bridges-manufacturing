import test from 'node:test';import assert from 'node:assert/strict';
import {isDumpingCode,dumpingLabel,scanRequestKey} from '../src/features/dumping/model.js';
import {availabilityDates,availabilitySummary} from '../src/features/availability/model.js';
test('reusable identifiers are distinct from one-time boxes and preserve person/job identity',()=>{
 assert.equal(isDumpingCode('dump-0123456789abcdef'),true);assert.equal(isDumpingCode('BOX-0123456789ABCDEF'),false);
 const a={id:'DUMP-0123456789ABCDEF',orderId:'O',workId:'W',jobId:'J',personId:'P',batchQuantity:100};
 const label=dumpingLabel(a,[{id:'O',workOrders:[{id:'W',jobs:[{id:'J',name:'Assembly'}]}]}],[{id:'P',name:'Alex'}]);assert.equal(label.box.id,a.id);assert.equal(label.box.quantity,100);assert.match(label.job.name,/REUSE/);assert.notEqual(scanRequestKey('user1',a.id),scanRequestKey('user2',a.id));
});
test('availability keeps unreported days unknown and crosses months correctly',()=>{
 const dates=availabilityDates('2026-11-30',3);assert.deepEqual(dates,['2026-11-30','2026-12-01','2026-12-02']);
 assert.deepEqual(availabilitySummary([{personId:'P',date:dates[0],status:'available',hours:6},{personId:'P',date:dates[1],status:'unavailable',hours:0}],'P',dates),{available:1,unavailable:1,unknown:1,hours:6});
});
test('attendance action log replaces legacy arrival/departure without changing production pieces',async()=>{
 const {attendanceActionLog,pieceSummary}=await import('../src/features/timesheets/model.js');
 const data={days:{'2026-11-04':{attendanceStatus:'present',arrival:'09:00',departure:'14:00'}},manual:[{date:'2026-11-04',code:'AT',time:'08:00'},{date:'2026-11-04',code:'5001',pieces:25}]};
 const log=attendanceActionLog(data);assert.equal(log.filter(r=>r.code==='AT').length,1);assert.equal(log.find(r=>r.code==='AT').time,'09:00');assert.equal(pieceSummary([],log)['5001']['2026-11-04'],25);
});
