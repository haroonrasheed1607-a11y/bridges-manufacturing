import test from 'node:test';import assert from 'node:assert/strict';
import {cameraErrorMessage} from '../src/features/production/cameraErrors.js';
test('camera denial points Windows users to OS privacy controls and web users to browser settings',()=>{
 assert.match(cameraErrorMessage({name:'NotAllowedError'},true),/Windows Settings/);
 assert.doesNotMatch(cameraErrorMessage({name:'NotAllowedError'},true),/browser settings/);
 assert.match(cameraErrorMessage({name:'NotAllowedError'},false),/browser settings/);
 assert.match(cameraErrorMessage({name:'NotReadableError'},true),/in use/);
});
