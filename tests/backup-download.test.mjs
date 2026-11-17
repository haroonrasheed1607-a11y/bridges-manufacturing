import assert from 'node:assert/strict';
import test from 'node:test';
import { backupFilename, downloadBackup } from '../src/features/backups/backupDownload.js';
const backup={kind:'data',environment:'staging',createdAt:'2026-11-17T12:00:00Z',sql:'-- Bridges Manufacturing\n-- Unicode: é',bytes:new TextEncoder().encode('-- Bridges Manufacturing\n-- Unicode: é').length};
test('backup filename identifies source and type without path characters',()=>{
 assert.equal(backupFilename(backup),'bridges-staging-data-2026-11-17T12-00-00-000Z.sql');
 for(const invalid of [{kind:'../private'},{environment:'unknown'},{createdAt:'bad'},{sql:''}])assert.throws(()=>backupFilename({...backup,...invalid}));
});
test('download rejects a byte-length mismatch before touching the document',()=>{
 assert.throws(()=>downloadBackup({...backup,bytes:backup.bytes-1}),/size validation/);
});
