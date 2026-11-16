import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

test('desktop scan entry uses USB input while web and phone retain camera UI',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 const previous=globalThis.window;
 try {
  const { QrCamera }=await server.ssrLoadModule('/src/features/production/QrCamera.jsx');
  globalThis.window={bridgesDesktop:{version:1},chrome:{webview:{}}};
  const desktop=renderToStaticMarkup(React.createElement(QrCamera,{onScan(){},onClose(){},description:'Record attendance'}));
  assert.match(desktop,/USB QR scanner/);
  assert.match(desktop,/<form/);
  assert.match(desktop,/<input[^>]*autofocus/);
  assert.match(desktop,/Use scanned code/);
  assert.match(desktop,/Record attendance/);
  assert.doesNotMatch(desktop,/<video|Opening camera/);
  globalThis.window={};
  const browser=renderToStaticMarkup(React.createElement(QrCamera,{onScan(){},onClose(){}}));
  assert.match(browser,/<video/);
  assert.match(browser,/Opening camera/);
  assert.doesNotMatch(browser,/USB QR scanner/);
 } finally {
  if(previous===undefined)delete globalThis.window;else globalThis.window=previous;
  await server.close();
 }
});
