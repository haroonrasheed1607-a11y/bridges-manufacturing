import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {manufacturingQrPath} from '../src/domain/boxLabels.js';
test('camera decoder reads existing box label QR codes',()=>{
 for(const id of ['DEMO-BOX-001','BOX-ABC123']){
  const width=330,pixels=new Uint8ClampedArray(width*width*4).fill(255);
  for(const m of manufacturingQrPath(id).matchAll(/M(\d+) (\d+)h1v1h-1z/g)){
   for(let y=Number(m[2])*10;y<(Number(m[2])+1)*10;y++)for(let x=Number(m[1])*10;x<(Number(m[1])+1)*10;x++){let i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  }
  assert.equal(jsQR(pixels,width,width)?.data,id);
 }
});
