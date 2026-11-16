import { React } from '../../vendor/react-runtime.js';
import { manufacturingToday } from '../../utils/dates.js';
const money=value=>value==null?'Missing rate':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export function BillableUnitsReport({api}){
 const [start,setStart]=React.useState(manufacturingToday),[end,setEnd]=React.useState(manufacturingToday),[offset,setOffset]=React.useState(0);
 const [report,setReport]=React.useState(null),[error,setError]=React.useState('');
 React.useEffect(()=>{let live=true;setReport(null);setError('');api.rpc('app_billable_unit_report',{p_start:start,p_end:end,p_offset:offset}).then(value=>{if(live)setReport(value);}).catch(problem=>{if(live)setError(problem.message);});return()=>{live=false;};},[api,start,end,offset]);
 return <section className="panel"><h2>Billable Units · Billing &amp; individual pay</h2>
 <p>New billable-unit scans only. Historical pieces remain in the legacy reports. Amounts use the rates saved with each scan.</p>
 <div className="form-actions"><label>From<input type="date" value={start} onChange={e=>{setStart(e.target.value);setOffset(0);}}/></label><label>To<input type="date" value={end} onChange={e=>{setEnd(e.target.value);setOffset(0);}}/></label><button disabled={!report} onClick={()=>window.print()}>Print</button></div>
 {error?<p className="alert" role="alert">{error}</p>:!report?<p role="status">Loading billable units…</p>:<>
 <p><strong>{report.units.toLocaleString()} billable units</strong> · {report.total} records</p>
 <div className="table-wrap"><table><thead><tr>{['Client','Item code','Item','Individual','Unit','Billable units','Scans','Client billing','Individual pay'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{report.rows.map((r,i)=><tr key={r.order_id+r.individual+i}><td>{r.client}</td><td>{r.item_code}</td><td>{r.item}</td><td>{r.individual}</td><td>{r.unit}</td><td>{r.units}</td><td>{r.scans}</td><td>{money(r.client_payment)}</td><td>{money(r.individual_pay)}</td></tr>)}</tbody></table></div>
 {!report.rows.length&&<p>No billable-unit scans in this period.</p>}
 <div className="form-actions"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span>Page {Math.floor(offset/50)+1} of {Math.max(1,Math.ceil(report.total/50))}</span><button disabled={offset+50>=report.total} onClick={()=>setOffset(offset+50)}>Next</button></div></>}
 </section>;
}
