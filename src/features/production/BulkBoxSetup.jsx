import {React} from '../../vendor/react-runtime.js';
import {useManufacturing} from '../../state/ManufacturingContext.jsx';
import {manufacturingIsCoach} from '../../domain/workforce.js';
import {manufacturingPrintBoxBatch} from '../../domain/boxLabels.js';
import {manufacturingToday} from '../../utils/dates.js';
import {createId} from '../../utils/ids.js';
import {remainingBoxPieces} from './boxSetupModel.js';
import {bulkBoxPlan} from './bulkPlan.js';
export function BulkBoxSetup(){
 const {orders,workforce,createProductionBox}=useManufacturing();
 const [workId,setWorkId]=React.useState(''),[jobId,setJobId]=React.useState(''),[selected,setSelected]=React.useState([]),[includeBusy,setIncludeBusy]=React.useState(false),[saved,setSaved]=React.useState([]),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
 const lock=React.useRef(false);
 const works=orders.filter(o=>o.stage===1).flatMap(order=>order.workOrders.filter(w=>(w.jobs||[]).some(j=>remainingBoxPieces(w,j)>0)).map(work=>({order,work})));
 const current=works.find(x=>x.work.id===workId)||works[0],jobs=(current?.work.jobs||[]).filter(j=>remainingBoxPieces(current.work,j)>0),job=jobs.find(j=>j.id===jobId)||jobs[0];
 const assigned=new Set(orders.flatMap(o=>o.workOrders.flatMap(w=>(w.boxes||[]).filter(b=>!b.completedAt&&b.status!=='completed').map(b=>b.personId))));
 const people=workforce.people.filter(p=>!manufacturingIsCoach(p)&&p.active!==false&&(includeBusy||!assigned.has(p.id)));
 const reset=()=>{setSelected([]);setError('');};
 async function create(event){
  event.preventDefault();if(lock.current||!current||!job)return;
  let plan;try{plan=bulkBoxPlan(current.work,job,selected.filter(id=>people.some(p=>p.id===id)));}catch(e){setError(e.message);return;}
  lock.current=true;setBusy(true);setError('');setSaved([]);const created=[];
  try{
   for(const item of plan){
    const box={id:createId('BOX'),jobId:job.id,personId:item.personId,quantity:item.quantity,date:manufacturingToday(),coachId:current.work.coachId||null};
    const problem=await createProductionBox(current.order.id,current.work.id,box);
    if(problem)throw Error(problem);
    created.push({...current,job,box,person:workforce.people.find(p=>p.id===item.personId)});setSaved([...created]);
   }
   setSelected([]);setError(manufacturingPrintBoxBatch(created));
  }catch(e){setError(e.message+' · '+created.length+' boxes saved. Use Print saved batch for these; unsaved boxes were not printed.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <details className="panel"><summary>Bulk box labels</summary><form onSubmit={create}>
 <p>One box per selected individual. Only unallocated pieces are used; the final box can be partial.</p>
 <label className="field"><span>Job</span><select value={current?.work.id||''} onChange={e=>{setWorkId(e.target.value);setJobId('');reset();}}>{!works.length&&<option value="">No jobs available</option>}{works.map(x=><option value={x.work.id} key={x.work.id}>{x.order.title} · {x.work.description||x.work.id}</option>)}</select></label>
 <label className="field"><span>Sub-job</span><select value={job?.id||''} onChange={e=>{setJobId(e.target.value);reset();}}>{jobs.map(j=><option value={j.id} key={j.id}>{j.name} · {remainingBoxPieces(current.work,j)} pieces available</option>)}</select></label>
 <label><input type="checkbox" checked={includeBusy} onChange={e=>{setIncludeBusy(e.target.checked);reset();}}/> Include individuals with open boxes</label>
 <fieldset><legend>Available individuals · {selected.length} selected</legend>{people.map(p=><label key={p.id} style={{display:'block',padding:'8px'}}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/>{' '+p.name}{assigned.has(p.id)?' · Has open box':''}</label>)}{!people.length&&<p>No available individuals.</p>}</fieldset>
 <button className="primary" disabled={busy||!job||!selected.length}>{busy?'Preparing batch…':'Create & print '+selected.length+' labels'}</button>
 </form>{error&&<p className="alert" role="alert">{error}</p>}
 {saved.length>0&&<div role="status"><p>{saved.length} boxes saved. Reprinting will reuse their IDs.</p><button onClick={()=>setError(manufacturingPrintBoxBatch(saved))}>Print saved batch</button><ul>{saved.map(x=><li key={x.box.id}>{x.person?.name} · {x.box.id} · {x.box.quantity} pcs</li>)}</ul></div>}
 </details>;
}
