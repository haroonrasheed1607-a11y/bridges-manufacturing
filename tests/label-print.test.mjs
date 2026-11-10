import { printBrowser } from '../src/services/printing/browserPrinter.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturingPrintBox,manufacturingPrintBoxBatch,manufacturingPreviewLabels} from '../src/domain/boxLabels.js';
const label={order:{title:'A & B',id:'O1'},work:{id:'W1'},job:{name:'Sub 1'},box:{id:'BOX-1',quantity:25},person:{name:'Alex'}};
test('browser labels print in a same-page frame; preview does not print automatically',()=>{
 const originals={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout};let scheduled,after,printed=0,removed=0;const values=[];
 const element=()=>({style:{},setAttribute(){},appendChild(){},getBoundingClientRect(){return {height:130};},remove(){removed++;},set textContent(v){values.push(v);},get textContent(){return '';}});
 const doc={head:element(),body:element(),createElement:()=>element(),createElementNS:()=>element()};
 const popup={document:doc,requestAnimationFrame:f=>scheduled=f,addEventListener:(n,f)=>{if(n==='afterprint')after=f;},focus(){},print(){printed++;}};
 globalThis.window={};globalThis.document={body:element(),createElement:tag=>{assert.equal(tag,'iframe');return {...element(),contentWindow:popup};}};globalThis.setTimeout=()=>0;
 try{
 assert.equal(manufacturingPrintBox(label.order,label.work,label.job,label.box,label.person),'');assert.equal(printed,0);scheduled();assert.equal(printed,1);assert.ok(values.includes('A & B'));assert.ok(!values.includes('O1 / W1'));assert.ok(values.some(v=>typeof v==='string'&&v.includes('font:6.75pt Arial')&&v.includes('.line:first-child{text-overflow:clip}')));assert.ok(values.some(v=>typeof v==='string'&&v.includes('width:16.5mm;height:16.5mm')));after();assert.equal(removed,1);
 assert.equal(manufacturingPreviewLabels([label]),'');scheduled();assert.equal(printed,1);
 values.length=0;
 assert.equal(printBrowser([{matrix:[],person:'Alex',orderTitle:'Individual Job QR',boxId:'IND-0123456789ABCDEF'}]),'');
 assert.ok(values.includes('Individual Job QR'));assert.ok(values.includes('IND-0123456789ABCDEF'));
 assert.ok(!values.some(v=>typeof v==='string'&&v.endsWith(' pcs')));
 }finally{Object.assign(globalThis,originals);}
});
test('native bridge preserves label IDs and supports batches and preview',()=>{
 const old=globalThis.window;let sent;
 globalThis.window={bridgesDesktop:{version:1,bulkPrinting:true},chrome:{webview:{postMessage:m=>sent=m}}};
 try{
 assert.equal(manufacturingPrintBox(label.order,label.work,label.job,label.box,label.person),'');assert.equal(sent.type,'bridges.print-box');assert.equal(sent.boxId,'BOX-1');assert.equal(sent.matrix.length,25);
 assert.equal(manufacturingPrintBoxBatch([label,label]),'');assert.equal(sent.type,'bridges.print-boxes');assert.equal(sent.labels.length,2);
 manufacturingPreviewLabels([label]);assert.equal(sent.preview,true);assert.match(manufacturingPrintBoxBatch([]),/1 and 100/);
 }finally{globalThis.window=old;}
});
