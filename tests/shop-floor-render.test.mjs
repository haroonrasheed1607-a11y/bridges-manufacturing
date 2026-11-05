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
 assert.match(await render('/src/features/availability/AvailabilityPage.jsx','AvailabilityPage'),/Individual availability/);
 assert.match(await render('/src/features/attendance/AttendancePage.jsx','AttendancePage'),/Daily attendance roster/);
 assert.match(await render('/src/features/dumping/DumpingSetup.jsx','DumpingSetup'),/100/);
 const setup=await render('/src/features/production/ProductionLinePage.js','ManufacturingProductionLine','box_setup');assert.match(setup,/Dumping/);assert.match(setup,/Bulk box labels/);
 const scanner=await render('/src/features/production/ProductionLinePage.js','ManufacturingProductionLine','box_scanner');assert.match(scanner,/Box ID/);assert.doesNotMatch(scanner,/Create reusable QR/);
 }finally{await server.close();}
});
