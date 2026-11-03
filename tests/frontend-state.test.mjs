import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src');
async function harness({session=false}={}){
 let index=0,refIndex=0,state=[],refs=[],effects=[],requests=[],workspace={orders:[],customers:[],workforce:{people:[],bookings:[]}};
 const store=new Map();if(session)store.set('bridges-manufacturing-session-v1',JSON.stringify({access_token:'mock-token',expires_at:Date.now()/1000+3600}));
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.length?children:props?.children}}),createContext:value=>({Provider:Symbol('provider'),value}),useContext:context=>context.value,useState:initial=>{const i=index++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next}]},useRef:initial=>{const i=refIndex++;return refs[i]||(refs[i]={current:initial})},useEffect:fn=>{effects.push(fn)}};
 const context=vm.createContext({console,JSON,Map,Date,Math,Promise,Uint8Array,structuredClone,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},crypto:globalThis.crypto,atob,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},window:{addEventListener(){},removeEventListener(){}},document:{visibilityState:'visible'},fetch:async(url,options)=>{requests.push({url,options});let data;const body=JSON.parse(options.body||'{}');if(url.includes('/auth/v1/token'))data={access_token:'mock-token',expires_in:3600};else if(url.endsWith('app_my_profile'))data={active:true,name:'Mock manager',role:'manager'};else if(url.endsWith('app_save_order')){const record={...body.p_order,_revision:body.p_revision+1};workspace={...workspace,orders:[record,...workspace.orders.filter(o=>o.id!==record.id)]};data=workspace;}else data=workspace;return {ok:true,text:async()=>JSON.stringify(data)};}});
 const cache=new Map();const runtime=new vm.SyntheticModule(['React','createBundle'],function(){this.setExport('React',React);this.setExport('createBundle',fn=>{let value;return()=>{if(!value){value={exports:{}};fn(value.exports,value);}return value.exports;}})},{context});cache.set(path.join(root,'vendor/react-runtime.js'),runtime);
 const jsxRuntime=new vm.SyntheticModule(['jsx','jsxs','Fragment'],function(){const create=(type,props)=>({type,props});this.setExport('jsx',create);this.setExport('jsxs',create);this.setExport('Fragment',Symbol('fragment'));},{context});cache.set(path.join(root,'vendor/react-jsx-stub.js'),jsxRuntime);
 function load(file){if(file==='react/jsx-runtime')return jsxRuntime;file=path.resolve(file);if(!cache.has(file))cache.set(file,new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file}));return cache.get(file);}
 const module=load(path.join(root,'state/ManufacturingProvider.js'));await module.link((name,parent)=>load(name==='react/jsx-runtime'?name:path.resolve(path.dirname(parent.identifier),name)));await module.evaluate();
 const auth=cache.get(path.join(root,'features/auth/AuthGate.js')).namespace;auth.ManufacturingSession.value={role:'manager',name:'Mock manager'};
 function render(component,props){index=0;refIndex=0;effects=[];return component(props);}
 async function runEffects(){for(const effect of effects)effect();await new Promise(resolve=>setTimeout(resolve,0));}
 return {render,runEffects,auth,provider:module.namespace,requests,reset(){index=0;refIndex=0;state=[];refs=[];effects=[];}};
}
function nodes(node){if(!node||typeof node!=='object')return[];const children=node.props?.children;return[node,...(Array.isArray(children)?children:[children]).flatMap(nodes)];}

test('sign-in gate hides workspace until the server approves staff access',async()=>{
 const app=await harness();let tree=app.render(app.auth.AuthGate,{children:'WORKSPACE'});await app.runEffects();tree=app.render(app.auth.AuthGate,{children:'WORKSPACE'});
 assert(nodes(tree).some(n=>n.type==='form'));assert(!nodes(tree).some(n=>n.props.children==='WORKSPACE'));
 await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});tree=app.render(app.auth.AuthGate,{children:'WORKSPACE'});assert(nodes(tree).some(n=>n.type===app.auth.ManufacturingSession.Provider));assert(app.requests.some(r=>r.url.endsWith('app_my_profile')));
});

test('shared provider waits for the API and sends the current order revision',async()=>{
 const app=await harness({session:true});app.render(app.provider.ManufacturingProvider,{children:'SCREEN'});await app.runEffects();let tree=app.render(app.provider.ManufacturingProvider,{children:'SCREEN'}),value=tree.props.value;assert.equal(value.orders.length,0);
 const pending=value.create({title:'Shared order',customer:'Customer',quantity:100,perPack:25});assert.equal(value.orders.length,0);const id=await pending;
 tree=app.render(app.provider.ManufacturingProvider,{children:'SCREEN'});value=tree.props.value;assert.equal(value.orders[0].id,id);assert.equal(value.orders[0]._revision,1);
 await value.change(id,o=>({...o,title:'Updated'}),'Title changed');const writes=app.requests.filter(r=>r.url.endsWith('app_save_order')).map(r=>JSON.parse(r.options.body));assert.equal(writes[0].p_revision,0);assert.equal(writes[1].p_revision,1);
});
