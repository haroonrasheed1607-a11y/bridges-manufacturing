import { React } from '../../vendor/react-runtime.js';
import { useManufacturing } from '../../state/ManufacturingContext.jsx';
import { JobCompletion } from '../../components/common/JobCompletion.js';
export function BillableWork(){
 const {order,setView}=useManufacturing();
 return <section className="panel"><h3>Billable-unit work order</h3><JobCompletion order={order}/>
 <dl className="order-summary-facts"><div><dt>Total Billable Units</dt><dd>{order.totalBillableUnits}</dd></div><div><dt>Completed</dt><dd>{order.billableUnitsCompleted||0}</dd></div></dl>
 {order.workOrders.map(w=><div key={w.id}><h4>{w.description||w.id}</h4><p>{w.billableUnitsPerScan} billable units per scan · {order.billableUnitLabel||'Item'}</p>
 {w.jobs.map(j=><p key={j.id}>{j.name||j.id}: {j.billableUnitsCompleted||0} / {j.totalBillableUnits} units</p>)}</div>)}
 <p>Scan &amp; Assign is ready for today's work. Quantity changes are recorded through scans; older pieces-based work stays separate.</p>
 <div className="form-actions"><button onClick={()=>setView('productionline')}>Open Shop Floor</button><button onClick={()=>setView('configurations')}>Scan settings</button></div></section>;
}
