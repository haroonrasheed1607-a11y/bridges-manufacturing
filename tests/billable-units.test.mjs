import test from 'node:test';import assert from 'node:assert/strict';
import {jobCompletion} from '../src/domain/jobCompletion.js';
import {billableScanQuantity} from '../src/features/dumping/model.js';
test('billable progress is independent from legacy pieces and pack sizes',()=>{
 const order={totalBillableUnits:1000,billableUnitsCompleted:250,quantity:99999,workOrders:[{quantity:50000,jobs:[{quantity:50000,completed:49000}]}]};
 assert.deepEqual(jobCompletion(order),{total:1000,completed:250,percent:25});
 assert.equal(jobCompletion({...order,billableUnitsCompleted:2000}).percent,100);
});
test('unit loads support 1x, 2x and a partial final load without physical conversion',()=>{
 assert.equal(billableScanQuantity(25,1,100),25);assert.equal(billableScanQuantity(25,2,100),50);
 assert.equal(billableScanQuantity(25,2,30),30);assert.equal(billableScanQuantity(25,1,100,'10'),10);
 for(const actual of ['0','-1','1.5','51','oops']) assert.equal(billableScanQuantity(25,2,100,actual),0);
 assert.equal(billableScanQuantity(25,1,0),0);
});

test('mixed timesheets keep units separate from legacy pieces for the same item',async()=>{
 const {createServer}=await import('vite');const {renderToStaticMarkup}=await import('react-dom/server');const React=(await import('react')).default;
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
 try{
  const {TimesheetDocument}=await server.ssrLoadModule('/src/features/timesheets/TimesheetsPage.jsx');
  const html=renderToStaticMarkup(React.createElement(TimesheetDocument,{person:{name:'Test'},week:'2026-11-16',entries:[{date:'2026-11-16',itemCode:'A',code:'A',pieces:500,billableUnits:10},{date:'2026-11-16',itemCode:'A',code:'A',pieces:20}]}));
  assert.match(html,/A \[units\]/);assert.match(html,/A \[pieces\]/);assert.match(html,/TOTAL COMPLETED QUANTITY/);assert.doesNotMatch(html,/>510</);
 }finally{await server.close();}
});
