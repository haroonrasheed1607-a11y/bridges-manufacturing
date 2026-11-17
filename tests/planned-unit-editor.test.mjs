import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'vite';import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
test('daily BU field distinguishes save, confirmed reset, locked threshold and non-admin views',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
 try{
  const {PlannedJobUnitEditor}=await server.ssrLoadModule('/src/features/plan/PlannedJobUnitEditor.jsx');
  const base={jobId:'J',title:'Example',quantity:1000,billableMode:true,billableUnitsPerScan:25,unitEditState:{canEditUnits:true,requiresDayReset:false,billableUnitsPerScan:25,totalBillableUnits:1000,dayBillableUnits:0,revision:1}};
  const render=(row,extra={})=>renderToStaticMarkup(React.createElement(PlannedJobUnitEditor,{row,isAdmin:true,busy:false,onSave(){},...extra}));
  const empty=render(base);assert.doesNotMatch(empty,/<input[^>]+disabled/);assert.match(empty,/No scans on this day/);
  const partial=render({...base,unitEditState:{...base.unitEditState,requiresDayReset:true,dayBillableUnits:99}});assert.match(partial,/Reset day &amp; save/);assert.doesNotMatch(partial,/<button[^>]+disabled/);
  const locked=render({...base,unitEditState:{...base.unitEditState,canEditUnits:false,unitEditReason:'At least 10% of total BU has been scanned on this day'}});assert.match(locked,/<input[^>]+disabled/);assert.match(locked,/At least 10%/);
  const coach=render(base,{isAdmin:false});assert.match(coach,/<input[^>]+disabled/);assert.doesNotMatch(coach,/<button/);
  const unknown=render({...base,unitEditState:undefined});assert.match(unknown,/<input[^>]+disabled/);assert.match(unknown,/Refresh this plan/);
 }finally{await server.close();}
});
