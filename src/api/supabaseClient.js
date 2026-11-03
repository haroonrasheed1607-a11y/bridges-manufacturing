import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase.js';

function normalizeLogin(value){const login=String(value||'').trim();if(['admin','boxsetup','boxscan'].includes(login.toLowerCase()))return login.toLowerCase()+'@bridges-manufacturing.local';if(!login.includes('@'))throw new Error('Enter your staff username or staff email address.');return login;}

function createApiClient({ url=SUPABASE_URL, key=SUPABASE_PUBLISHABLE_KEY, transport=(...args)=>fetch(...args), storage }={}) {
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const sessionKey='bridges-manufacturing-session-v1';
  let session=null,refreshing=null;
  try {session=JSON.parse(storage?.getItem(sessionKey)||'null');}catch{}
  function remember(value){session=value?{...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+value.expires_in}:null;try{if(session)storage?.setItem(sessionKey,JSON.stringify(session));else storage?.removeItem(sessionKey);}catch{}return session;}
  async function send(path,{method='POST',body,token,raw=false}={}){
    const headers={apikey:key};if(token)headers.Authorization='Bearer '+token;if(!raw&&body!==undefined)headers['Content-Type']='application/json';
    const response=await transport(url+path,{method,headers,body:body===undefined?undefined:raw?body:JSON.stringify(body)});
    const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{data=text;}
    if(!response.ok){const error=new Error(data?.message||data?.error_description||data?.msg||data?.error||'The server could not complete this request.');error.status=response.status;error.code=data?.code;throw error;}return data;
  }
  async function accessToken(){if(!session?.access_token)throw new Error('Sign in to use shared data.');if(session.expires_at<Date.now()/1000+60){if(!refreshing)refreshing=send('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.refresh_token}}).then(remember).catch(error=>{remember(null);throw error;}).finally(()=>refreshing=null);await refreshing;}return session.access_token;}
  async function rpc(name,args={}){return send('/rest/v1/rpc/'+name,{body:args,token:await accessToken()});}
  async function login(email,password){return remember(await send('/auth/v1/token?grant_type=password',{body:{email:normalizeLogin(email),password}}));}
  async function logout(){try{if(session)await send('/auth/v1/logout',{token:await accessToken()});}finally{remember(null);references.clear();fileCache.clear();}}
  const references=new Map(),fileCache=new Map();
  async function resolveFiles(value){if(typeof value==='string'&&value.startsWith('storage://')){const path=value.slice('storage://'.length);const cached=fileCache.get(path);if(cached&&cached.until>Date.now()){references.set(cached.src,value);return cached.src;}const result=await send('/storage/v1/object/sign/manufacturing-files/'+path,{body:{expiresIn:3600},token:await accessToken()});const signed=result.signedURL||result.signedUrl;const src=signed.startsWith('http')?signed:url+'/storage/v1'+signed;references.set(src,value);fileCache.set(path,{src,until:Date.now()+3000000});return src;}if(Array.isArray(value))return Promise.all(value.map(resolveFiles));if(value&&typeof value==='object'){const entries=await Promise.all(Object.entries(value).map(async([k,v])=>[k,await resolveFiles(v)]));return Object.fromEntries(entries);}return value;}
  async function prepareFiles(value,orderId){if(typeof value==='string'){if(references.has(value))return references.get(value);if(value.startsWith('data:image/')){const match=value.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);if(!match)throw new Error('Only PNG, JPG and WebP pictures can be saved.');const data=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));const extension=match[1].split('/')[1],path='orders/'+orderId+'/'+crypto.randomUUID()+'.'+extension;const response=await transport(url+'/storage/v1/object/manufacturing-files/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+await accessToken(),'Content-Type':match[1]},body:data});if(!response.ok)throw new Error('The picture upload failed. Please retry.');return 'storage://'+path;}return value;}if(Array.isArray(value))return Promise.all(value.map(v=>prepareFiles(v,orderId)));if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await prepareFiles(v,orderId)])));return value;}
  async function adminUsers(args){return send('/functions/v1/admin-users',{body:args,token:await accessToken()});}
  return {adminUsers,rpc,login,logout,resolveFiles,prepareFiles,hasSession:()=>!!session?.access_token};
}
const manufacturingApi=createApiClient();
export { createApiClient, manufacturingApi, normalizeLogin };
