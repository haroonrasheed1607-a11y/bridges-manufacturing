import { React } from '../vendor/react-runtime.js';
import { manufacturingApi } from '../api/supabaseClient.js';
import { ManufacturingSession } from '../features/auth/AuthGate.js';
import { manufacturingFindBox } from '../domain/production.js';
import { manufacturingNextOrderState, manufacturingTransitionLabel, manufacturingWorkflowBlock } from '../domain/workflow.js';
import { manufacturingIsCoach } from '../domain/workforce.js';
import { manufacturingWeekdays } from '../utils/dates.js';
import { createId } from '../utils/ids.js';

const ManufacturingContext=React.createContext(null);
function ManufacturingProvider({children}){
 const h=React.createElement,profile=React.useContext(ManufacturingSession),[data,setData]=React.useState({orders:[],customers:[],workforce:{people:[],bookings:[]}}),[loading,setLoading]=React.useState(true),[pending,setPending]=React.useState(0),[storageError,setStorageError]=React.useState(''),[notice,setNotice]=React.useState(''),[view,setView]=React.useState(profile?.role==='station'?'productionline':'dashboard'),[selectedOrderId,setSelectedOrderId]=React.useState(null);
 const current=React.useRef(data),queue=React.useRef(Promise.resolve()),busy=React.useRef(0),generation=React.useRef(0),mounted=React.useRef(true);
 const manager=['admin','manager'].includes(profile?.role);
 async function accept(result){const hydrated=await manufacturingApi.resolveFiles(result);current.current=hydrated;if(mounted.current)setData(hydrated);return hydrated;}
 async function refresh(){if(busy.current)return;const ticket=++generation.current;try{const result=await manufacturingApi.rpc('app_get_workspace');const hydrated=await manufacturingApi.resolveFiles(result);if(ticket===generation.current&&busy.current===0){current.current=hydrated;if(mounted.current)setData(hydrated);setStorageError('');}}catch(e){setStorageError(e.message);}finally{setLoading(false);}}
 React.useEffect(()=>{mounted.current=true;refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},15000);const focus=()=>refresh();window.addEventListener('focus',focus);return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[]);
 function mutate(name,args,message){busy.current++;generation.current++;setPending(busy.current);const task=queue.current.then(async()=>{setStorageError('');const result=await manufacturingApi.rpc(name,typeof args==='function'?await args():args);await accept(result);setNotice(message||'Saved to shared database.');return result;}).catch(async e=>{setStorageError(e.message);if(e.code==='40001'){try{await accept(await manufacturingApi.rpc('app_get_workspace'));}catch{}}throw e;}).finally(()=>{busy.current--;setPending(busy.current);});queue.current=task.catch(()=>{});return task;}
 async function change(id,updater,message){try{await mutate('app_save_order',async()=>{const existing=current.current.orders.find(o=>o.id===id);if(!existing)throw new Error('Order not found. Refresh and retry.');return {p_order:await manufacturingApi.prepareFiles(updater(structuredClone(existing)),id),p_revision:existing._revision,p_message:message};},message);return true;}catch{return false;}}
 const order=data.orders.find(o=>o.id===selectedOrderId);
 function updateWork(id,updater,message){if(!order)return Promise.resolve(false);return change(order.id,o=>({...o,workOrders:o.workOrders.map(w=>w.id===id?updater(w):w)}),message);}
 async function create(value){const id=createId('ORD');try{await mutate('app_save_order',async()=>({p_order:await manufacturingApi.prepareFiles({...value,id,stage:0,workOrders:[],history:[]},id),p_revision:0,p_message:'Order created.'}),'Order created.');return id;}catch{return null;}}
 async function addCustomer(value){const name=value.trim().replace(/\s+/g,' ');if(!name)return 'Enter a customer name.';if(data.customers.some(c=>c.toLowerCase()===name.toLowerCase()))return 'This customer already exists.';try{await mutate('app_save_customer',{p_name:name},'Customer added.');return '';}catch(e){return e.message;}}
 async function saveIndividual(value){const person={...value,id:value.id||createId('PERSON'),name:value.name.trim(),role:(value.role||'').trim(),kind:value.kind|| (manufacturingIsCoach(value)?'coach':'individual'),hoursPerDay:Number(value.hoursPerDay)};if(!person.name)return 'Enter a name.';if(!Number.isFinite(person.hoursPerDay)||person.hoursPerDay<=0||person.hoursPerDay>24)return 'Choose working hours greater than 0 and no more than 24.';try{await mutate('app_save_person',{p_person:person},'Person saved.');return '';}catch(e){return e.message;}}
 async function saveBooking(value){const booking={...value,id:value.id||createId('BOOK'),hours:Number(value.hours)};if(!manufacturingWeekdays(booking.start,booking.end))return 'Choose a date range containing a working day.';try{await mutate('app_save_booking',{p_booking:booking},'Booking saved.');return '';}catch(e){return e.message;}}
 async function releaseBooking(id){try{await mutate('app_release_booking',{p_id:id},'Booking released.');return '';}catch(e){return e.message;}}
 async function createProductionBox(orderId,workId,box){try{await mutate('app_create_box',{p_order_id:orderId,p_work_id:workId,p_box:box},'Box created and assigned.');return '';}catch(e){return e.message;}}
 async function completeProductionBox(boxId,pieces){try{await mutate('app_complete_box',{p_box_id:boxId,p_pieces:pieces},'Box completed: '+pieces+' pieces.');const found=manufacturingFindBox(current.current.orders,boxId);return {...found,box:found.box,job:found.job,work:found.work};}catch(e){return {error:e.message};}}
 async function advance(){const block=manufacturingWorkflowBlock(order,data.workforce);if(block){setNotice(block);return false;}return change(order.id,manufacturingNextOrderState,manufacturingTransitionLabel(order)+'.');}
 function open(id){setSelectedOrderId(id);setView('detail');setNotice('');}
 function exportData(){const blob=URL.createObjectURL(new Blob([JSON.stringify(current.current,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=blob;anchor.download='Bridges_Manufacturing_Export.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);}
 const context={...data,order,view,setView,open,create,change,updateWork,advance,completeProductionBox,createProductionBox,addCustomer,saveIndividual,saveBooking,releaseBooking,notice,setNotice,storageError,exportData,refresh,pending:pending>0,profile,manager};
 if(loading)return h('main',{className:'auth-page'},h('p',{role:'status'},'Loading shared manufacturing data…'));
 return h(ManufacturingContext.Provider,{value:context},pending>0&&h('div',{className:'database-saving',role:'status'},'Saving to shared database…'),children);
}
function useManufacturing(){return React.useContext(ManufacturingContext);}
export { ManufacturingContext, ManufacturingProvider, useManufacturing };
