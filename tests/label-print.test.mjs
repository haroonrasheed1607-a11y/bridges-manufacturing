import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturingPrintBox} from '../src/domain/boxLabels.js';
test('labels print in an embedded frame after load and remove it after printing',()=>{
 const oldDocument=globalThis.document,oldTimeout=globalThis.setTimeout;
 let load,after,html='',printed=0,removed=0;
 const frame={style:{},setAttribute(){},remove(){removed++;},addEventListener(name,fn){if(name==='load')load=fn;},contentWindow:{document:{open(){},write(v){html=v;},close(){}},addEventListener(name,fn){if(name==='afterprint')after=fn;},focus(){},print(){printed++;}};
 globalThis.document={createElement(tag){assert.equal(tag,'iframe');return frame;},body:{appendChild(){}}};globalThis.setTimeout=()=>0;
 try{
 assert.equal(manufacturingPrintBox({title:'A & B',id:'O1'},{id:'W1'},{name:'Sub 1'},{id:'BOX-1',quantity:25},{name:'Alex'}),'');
 assert.equal(printed,0);assert.match(html,/62mm 20.32mm/);assert.match(html,/A &amp; B/);
 load();assert.equal(printed,1);after();assert.equal(removed,1);
 }finally{globalThis.document=oldDocument;globalThis.setTimeout=oldTimeout;}
});
