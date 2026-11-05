import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturingPrintBox} from '../src/domain/boxLabels.js';
test('labels print in an embedded frame after load and remove it after printing',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document,oldTimeout=globalThis.setTimeout;globalThis.window={};
 let load,after,html='',printed=0,removed=0;
 const frame={style:{},setAttribute(){},remove(){removed++;},addEventListener(name,fn){if(name==='load')load=fn;},contentWindow:{document:{querySelector(){return null;},open(){},write(v){html=v;},close(){}},addEventListener(name,fn){if(name==='afterprint')after=fn;},focus(){},print(){printed++;}}};
 globalThis.document={createElement(tag){assert.equal(tag,'iframe');return frame;},body:{appendChild(){}}};globalThis.setTimeout=()=>0;
 try{
 assert.equal(manufacturingPrintBox({title:'A & B',id:'O1'},{id:'W1'},{name:'Sub 1'},{id:'BOX-1',quantity:25},{name:'Alex'}),'');
 assert.equal(printed,0);assert.match(html,/62mm 40.64mm/);assert.match(html,/A &amp; B/);
 load();assert.equal(printed,1);after();assert.equal(removed,1);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;globalThis.setTimeout=oldTimeout;}
});
test('desktop labels go to the native printer bridge without creating a print frame',()=>{
 const old=globalThis.window;let sent;
 globalThis.window={bridgesDesktop:{version:1},chrome:{webview:{postMessage:m=>sent=m}}};
 try{
 assert.equal(manufacturingPrintBox({title:'Assembly',id:'O1'},{id:'W1'},{name:'Sub 1'},{id:'BOX-2',quantity:25},{name:'Alex'}),'');
 assert.equal(sent.type,'bridges.print-box');assert.equal(sent.boxId,'BOX-2');assert.equal(sent.person,'Alex');assert.equal(sent.matrix.length,25);
 }finally{globalThis.window=old;}
});
test('native bulk printing sends a single batch with reusable saved box IDs',async()=>{
 const {manufacturingPrintBoxBatch}=await import('../src/domain/boxLabels.js');const old=globalThis.window;let sent;
 globalThis.window={bridgesDesktop:{version:1},chrome:{webview:{postMessage:m=>sent=m}}};
 try{const label={order:{id:'O1',title:'Assembly'},work:{id:'W1'},job:{name:'Sub1'},box:{id:'BOX-3',quantity:10},person:{name:'Sam'}};
 assert.equal(manufacturingPrintBoxBatch([label]),'');assert.equal(sent.type,'bridges.print-boxes');assert.equal(sent.labels[0].boxId,'BOX-3');assert.match(manufacturingPrintBoxBatch([]),/1 and 100/);
 }finally{globalThis.window=old;}
});
