import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'vite';import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
test('availability, attendance, reusable setup and restricted Shop Floor screens render with shared workspace data',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 try{
 const {ManufacturingContext}=await server.ssrLoadModule('/src/state/ManufacturingContext.jsx');
 const orders=[{id:'O1',title:'Assembly order',stage:1,workOrders:[{id:'W1',description:'Parts assembly',quantity:250,perPack:25,jobs:[{id:'J1',name:'Sub-job 1',quantity:250,completed:0}],boxes:[]}]}];
 const workforce={people:[{id:'P1',name:'Alex',kind:'individual',hoursPerDay:6}],bookings:[]};
 const base={orders,workforce,profile:{id:'u1',role:'admin'},change(){},refresh(){}};
 async function render(file,name,role='admin'){
 const mod=await server.ssrLoadModule(file);return renderToStaticMarkup(React.createElement(ManufacturingContext.Provider,{value:{...base,profile:{id:'u1',role}}},React.createElement(mod[name])));
 }
 const {prepareIndividualRows}=await server.ssrLoadModule('/src/features/individuals/IndividualImport.jsx');
 const rows=prepareIndividualRows([['Name','Role','Hours per day'],[' alex ','Assembly',4],['Alex','Packing',5],['Jordan','Packing',6]],workforce.people);
 assert.equal(rows[0].decision,'');assert.equal(rows[0].matches[0].id,'P1');
 assert.equal(rows[1].decision,'skip');assert.equal(rows[2].decision,'add');
 const individuals=await render('/src/features/individuals/IndividualsPage.js','ManufacturingIndividuals');
 assert.match(individuals,/Import Excel/);assert.match(individuals,/Disable/);
 const {CurrentWorkPanel}=await server.ssrLoadModule('/src/features/production/CurrentWorkPanel.jsx');
 const panel=renderToStaticMarkup(React.createElement(CurrentWorkPanel,{person:workforce.people[0],current:{busy:true,items:[{id:'BOX-0123456789ABCDEF',orderId:'O1',orderTitle:'Assembly order',workId:'W1',description:'Parts assembly',jobName:'Sub-job 1',quantity:25}]},onError(){}}));
 assert.match(panel,/A new barcode cannot be created/);assert.match(panel,/BOX-0123456789ABCDEF/);assert.match(panel,/Reprint current barcode/);
 const adminApprovals=await render('/src/features/admin-approvals/BarcodeApprovals.jsx','BarcodeApprovals');assert.match(adminApprovals,/QR code approvals/);
 const managerApprovals=await render('/src/features/admin-approvals/BarcodeApprovals.jsx','BarcodeApprovals','manager');assert.match(managerApprovals,/Administrator access required/);assert.doesNotMatch(managerApprovals,/Approval reason/);
 assert.match(await render('/src/features/availability/AvailabilityPage.jsx','AvailabilityPage'),/Individual availability/);
 assert.match(await render('/src/features/attendance/AttendancePage.jsx','AttendancePage'),/Daily attendance roster/);
 assert.match(await render('/src/features/dumping/DumpingSetup.jsx','DumpingSetup'),/100/);
 const setup=await render('/src/features/production/ProductionLinePage.js','ManufacturingProductionLine','box_setup');assert.match(setup,/Reusable barcode/);assert.match(setup,/Bulk box labels/);assert.match(setup,/>Plan</);
 const plan=await render('/src/features/plan/PlanPage.jsx','PlanPage','box_setup');assert.match(plan,/Sub-job 1/);assert.match(plan,/Print all/);
 const scanner=await render('/src/features/production/ProductionLinePage.js','ManufacturingProductionLine','box_scanner');assert.match(scanner,/Completed work/);assert.match(scanner,/type="date"/);assert.match(scanner,/Scan QR code/);assert.doesNotMatch(scanner,/production-box-scan|Box ID/);assert.doesNotMatch(scanner,/Create reusable QR/);
 }finally{await server.close();}
});
