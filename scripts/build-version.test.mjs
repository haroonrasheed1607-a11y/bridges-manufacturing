import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { nextVersion, stampVersion, build } from './build-version.mjs';
const page = '<meta name="application-version" content="0.1"><span class="splash-version">Version 0.1</span><footer><span>Version 0.1</span></footer>';
const fixture = async fn => {
 const root = await mkdtemp(path.join(os.tmpdir(), 'bridges-version-'));
 try { await writeFile(path.join(root,'index.html'),page); await fn(root); }
 finally { await rm(root,{recursive:true,force:true}); }
};
test('exact increments including decimal rollover',()=>{
 assert.equal(nextVersion('0.1'),'0.2'); assert.equal(nextVersion('0.9'),'1.0'); assert.equal(nextVersion('1.0'),'1.1'); assert.throws(()=>nextVersion('bad'));
});
test('stamps all three version locations',()=>{
 const html=stampVersion(page,'0.2'); assert.match(html,/content="0.2"/); assert.equal((html.match(/Version 0.2/g)||[]).length,2);
});
test('blocked website and missing website URL cannot prevent a build',()=>fixture(async root=>{
 const before=globalThis.fetch; globalThis.fetch=()=>{throw Error('HTTP 401');};
 try { const r=await build({root,env:{NETLIFY:'true',CONTEXT:'production',URL:'https://protected.example'}});assert.equal(r.version,'0.2'); }
 finally {globalThis.fetch=before;}
 assert.equal((await build({root,env:{NETLIFY:'true'}})).version,'0.3');
 assert.equal(await readFile(path.join(root,'index.html'),'utf8'),page);
}));
test('production and preview counters are isolated',()=>fixture(async root=>{
 assert.equal((await build({root,env:{CONTEXT:'production'}})).version,'0.2');
 assert.equal((await build({root,env:{CONTEXT:'deploy-preview',BRANCH:'feature'}})).version,'0.2');
 assert.equal((await build({root,env:{CONTEXT:'production'}})).version,'0.3');
}));
test('corrupt state is rejected',()=>fixture(async root=>{
 const folder=path.join(root,'.netlify/version-state');await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'production.json'),'{"version":"broken"}');
 await assert.rejects(build({root,env:{}}),/Invalid version/);
}));
test('plugin restores state between clean checkouts and same-commit redeploys advance',()=>fixture(async root=>{
 const plugin=createRequire(import.meta.url)('../plugins/version-cache/index.js');
 const cache=path.join(root,'cache');
 const utils={cache:{restore:async p=>{try{await cp(cache,path.join(root,p),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}},save:async p=>cp(path.join(root,p),cache,{recursive:true})}};
 await plugin.onPreBuild({utils});assert.equal((await build({root,env:{}})).version,'0.2');await plugin.onPostBuild({utils});
 await rm(path.join(root,'.netlify'),{recursive:true,force:true});await rm(path.join(root,'dist'),{recursive:true,force:true});
 await plugin.onPreBuild({utils});assert.equal((await build({root,env:{}})).version,'0.3');await plugin.onPostBuild({utils});
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/version.json'),'utf8')).version,'0.3');
}));

test('React entry point shares one version with the Vite release metadata', () => fixture(async root => {
  await writeFile(path.join(root, 'index.html'), '<meta name="application-version" content="0.1"><div id="root"></div>');
  const release = await build({ root, env: { COMMIT_REF: 'react-refactor' } });
  assert.equal(release.version, '0.2');
  const metadata = JSON.parse(await readFile(path.join(root, '.netlify/build-version.json'), 'utf8'));
  assert.equal(metadata.version, '0.2');
  assert.equal(metadata.commit, 'react-refactor');
  assert.match(await readFile(path.join(root, 'dist/index.html'), 'utf8'), /content="0.2"/);
}));

test('the 1.0 milestone is applied once and the next deploy becomes 1.1', () => fixture(async root => {
  const folder = path.join(root, '.netlify/version-state');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'production.json'), JSON.stringify({ version: '0.5' }));
  await writeFile(path.join(root, 'release.json'), JSON.stringify({ minimumVersion: '1.0', notes: ['A new release.'] }));
  assert.equal((await build({ root, env: {} })).version, '1.0');
  assert.equal((await build({ root, env: {} })).version, '1.1');
}));

test('release notes cannot exceed three sentences', () => fixture(async root => {
  await writeFile(path.join(root, 'release.json'), JSON.stringify({ minimumVersion: '1.0', notes: ['First sentence. Second sentence. Third sentence. Fourth sentence.'] }));
  await assert.rejects(build({ root, env: {} }), /three sentences/);
}));
