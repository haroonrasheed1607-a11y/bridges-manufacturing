import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const commit=process.env.WORKERS_CI_COMMIT_SHA||process.env.CF_PAGES_COMMIT_SHA||process.env.COMMIT_REF;
let built=false;
try{const release=JSON.parse(await readFile('.netlify/build-version.json','utf8'));await access('dist/index.html');await access('dist/version.json');built=!!commit&&release.commit===commit;}catch{}
if(!built){const result=spawnSync('npm',['run','build'],{stdio:'inherit',shell:process.platform==='win32'});if(result.status!==0)process.exit(result.status||1);}
