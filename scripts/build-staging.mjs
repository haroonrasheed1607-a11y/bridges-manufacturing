import { spawnSync } from 'node:child_process';
import { resolveEnvironment } from '../src/config/environment.js';
// Connection details belong in Cloudflare build variables, not public source.
const env={...process.env,VITE_APP_ENV:'staging'};
resolveEnvironment(env); // Fail before deployment if isolation settings are missing.
const result=spawnSync('npm',['run','build'],{env,stdio:'inherit',shell:process.platform==='win32'});
process.exit(result.status??1);
