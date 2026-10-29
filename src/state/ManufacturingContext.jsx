import {createContext,useContext,useState,useEffect} from 'react';
import {seedOrders} from '../data/demoData.js';
import {uid,gate} from '../features/work-orders/workflow.js';
const Context=createContext(null), key='bridges-manufacturing-screen-draft-v1';
export function ManufacturingProvider({children}){
 const [orders,setOrders]=useState(()=>{try{const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:seedOrders();}catch{return seedOrders();}});
 const [view,setView]=useState('orders'),[selected,setSelected]=useState(null),[notice,setNotice]=useState(''),[storageError,setStorageError]=useState('');
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(orders));setStorageError('');}catch{setStorageError('Browser storage is unavailable or full. Export your data before leaving.');}},[orders]);
 const order=orders.find(o=>o.id===selected);
 function open(id){setSelected(id);setView('detail');setNotice('');}
 function change(id,fn,message){setOrders(prev=>prev.map(o=>o.id===id?{...fn(o),history:[...(o.history||[]),{id:uid('EV'),message,at:new Date().toISOString()}]}:o));setNotice(message);}
 function updateWork(id,fn,message){if(!order)return;change(order.id,o=>({...o,workOrders:o.workOrders.map(w=>w.id===id?fn(w):w)}),message);}
 function advance(){const error=gate(order);if(error){setNotice(error);return;}change(order.id,o=>({...o,stage:o.stage+1}),'Order moved to the next stage.');}
 function create(data){const id=uid('ORD');setOrders(p=>[{...data,id,stage:0,workOrders:[],history:[{id:uid('EV'),message:'Order created.',at:new Date().toISOString()}]},...p]);open(id);}
 function exportData(){const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,orders},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Bridges_Manufacturing_Export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <Context.Provider value={{orders,order,view,setView,open,create,change,updateWork,advance,notice,setNotice,storageError,exportData}}>{children}</Context.Provider>;
}
export function useManufacturing(){return useContext(Context);}
