import {BulkBoxSetup} from './BulkBoxSetup.jsx';
import {React} from '../../vendor/react-runtime.js';
import {useManufacturing} from '../../state/ManufacturingContext.jsx';
import {useScreenMemory} from '../../state/useScreenMemory.js';
import {manufacturingIsCoach} from '../../domain/workforce.js';
import {manufacturingPrintBox} from '../../domain/boxLabels.js';
import {manufacturingToday} from '../../utils/dates.js';
import {createId} from '../../utils/ids.js';
import {nextBoxJob,remainingBoxPieces} from './boxSetupModel.js';
export function SimpleBoxSetup(){
 const {orders,workforce,createProductionBox}=useManufacturing();
 const [workId,setWorkId]=useScreenMemory('simple-box-job','');
 const [personId,setPersonId]=React.useState('');
 const [label,setLabel]=React.useState(null);
 const [error,setError]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const lock=React.useRef(false);
 const jobs=orders.filter(o=>o.stage===1).flatMap(order=>order.workOrders.filter(work=>nextBoxJob(work)).map(work=>({order,work})));
 const selected=jobs.find(x=>x.work.id===workId)||jobs[0];
 const people=workforce.people.filter(p=>!manufacturingIsCoach(p)&&p.active!==false);
 const job=selected&&nextBoxJob(selected.work);
 const quantity=job?Math.min(Number(selected.work.perPack),remainingBoxPieces(selected.work,job)):0;
 async function create(event){
  event.preventDefault();if(lock.current||!selected||!job||!personId||quantity<1)return;
  lock.current=true;setBusy(true);setError('');setLabel(null);
  try{
   const box={id:createId('BOX'),jobId:job.id,personId,quantity,date:manufacturingToday(),coachId:selected.work.coachId||null};
   const problem=await createProductionBox(selected.order.id,selected.work.id,box);
   if(problem){setError(problem);return;}
   setLabel({...selected,job,box,person:people.find(p=>p.id===personId)});
   setError(manufacturingPrintBox(selected.order,selected.work,job,box,people.find(p=>p.id===personId)));
  }catch{setError('Unable to prepare the label. If the box was saved, reprint its label instead of creating another.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <><section className="panel simple-box-setup"><h2>Box setup</h2><form onSubmit={create}>
 <label className="field"><span>Available jobs</span><select value={selected?.work.id||''} onChange={e=>{setWorkId(e.target.value);setLabel(null);setError('');}} disabled={!jobs.length}>
 {!jobs.length&&<option value="">No jobs available</option>}{jobs.map(({order,work})=><option key={work.id} value={work.id}>{order.title} · {work.description||work.id}</option>)}
 </select></label>
 <label className="field"><span>Individual</span><select required value={personId} onChange={e=>{setPersonId(e.target.value);setLabel(null);}}><option value="">Select individual</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {job&&<p className="quiet" aria-live="polite">{job.name} · {quantity} pieces per box</p>}
 <button className="primary" disabled={busy||!job||!personId||quantity<1}>{busy?'Creating…':'Create & print box'}</button>
 </form>{error&&<p className="alert" role="alert">{error}</p>}
 {label&&<div className="box-label-ready" role="status"><p>Box ready · {label.box.id}</p><button className="primary" onClick={()=>setError(manufacturingPrintBox(label.order,label.work,label.job,label.box,label.person))}>Reprint label</button></div>}
 </section>{window.bridgesDesktop?.bulkPrinting&&<BulkBoxSetup/>}</>;
}
