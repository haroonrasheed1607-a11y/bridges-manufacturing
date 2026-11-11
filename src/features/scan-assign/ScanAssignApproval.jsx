import { planningOrderOption, planningWorkDetails } from "../plan/workOrderOption.js";
import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";

export function ScanAssignApproval({ date, onChange, refreshVersion = 0 }) {
  const { orders, orderDisplayTitle } = useManufacturing();
  const [orderId, setOrderId] = React.useState("");
  const [jobId, setJobId] = React.useState("");
  const [pieces, setPieces] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [loaded, setLoaded] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const request = React.useRef(0);
  const saving = React.useRef(false);
  const eligible = orders.filter(order => order.stage === 1 && order.workOrders.some(work => work.jobs.some(job => job.completed < job.quantity)));
  const order = eligible.find(item => item.id === orderId);
  const selectedWork = order?.workOrders.find(work => work.jobs.some(job => job.id === jobId));
  const jobs = order?.workOrders.flatMap(work => work.jobs.filter(job => job.completed < job.quantity)) ?? [];

  async function load() {
    const ticket = ++request.current;
    setLoaded("");
    setError("");
    try {
      const value = await manufacturingApi.rpc("app_scan_assign_approvals", { p_date: date });
      if (ticket === request.current) { setRows(value); setLoaded(date); }
    } catch (problem) { if (ticket === request.current) setError(problem.message); }
  }
  React.useEffect(() => { load(); return () => { request.current++; }; }, [date, refreshVersion]);

  async function approve(job, enabled) {
    if (saving.current || loaded !== date) return;
    if (!enabled && !window.confirm("Revoke Scan & Assign approval? Current card assignments for this approval will be closed.")) return;
    const ticket = request.current;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await manufacturingApi.rpc("app_approve_scan_assign", {
        p_date: date, p_job: job, p_pieces: enabled && pieces !== "" ? Number(pieces) : null, p_enabled: enabled,
      });
      if (ticket === request.current) { setRows(value); onChange(); }
    } catch (problem) { if (ticket === request.current) setError(problem.message); }
    finally { setBusy(false); saving.current = false; }
  }

  return <section className="panel scan-assign-approval" aria-labelledby="scan-assign-approval-title">
    <div className="section-heading"><div><h3 id="scan-assign-approval-title">Scan & Assign approval</h3>
      <p className="quiet">Approve an order for the selected work date. Individuals join by scanning their own QR cards at Shop Floor.</p></div>
      <button type="button" onClick={load} disabled={busy}>Refresh approvals</button></div>
    <div className="form-grid">
      <label className="field">Order<select value={orderId} disabled={busy} onChange={e => {
        setOrderId(e.target.value);
        const selectedOrder = eligible.find(item => item.id === e.target.value);
        setJobId(selectedOrder?.workOrders.flatMap(work => work.jobs.filter(job => job.completed < job.quantity))[0]?.id ?? "");
        setPieces("");
      }}><option value="">Select an order</option>{eligible.map(item => <option key={item.id} value={item.id}>{planningOrderOption(item, orderDisplayTitle(item))}</option>)}</select></label>
      <label className="field">Sub-job<select value={jobId} disabled={busy || !order} onChange={e => setJobId(e.target.value)}>
        <option value="">Select a sub-job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.name} · {job.quantity - job.completed} remaining</option>)}
      </select></label>
      <label className="field">Pieces per scan (optional override)<input type="number" min="1" max="1000000" step="1" value={pieces}
        placeholder="Use the order’s scan quantity" disabled={busy} onChange={e => setPieces(e.target.value)} /></label>
    </div>
    {selectedWork && <p className="quiet">{planningWorkDetails(selectedWork)}</p>}
    <button type="button" className="primary" disabled={busy || loaded !== date || !jobId || (pieces !== "" && (!Number.isInteger(Number(pieces)) || Number(pieces) < 1))}
      onClick={() => approve(jobId, true)}>Approve for Scan & Assign</button>
    {error && <p role="alert" className="alert">{error}</p>}
    {loaded !== date ? <p role="status">Loading Scan & Assign approvals…</p> : rows.length ? <ul className="scan-assign-approval-list">{rows.map(row => <li key={row.id}>
      <div><strong>{row.orderTitle}{row.orderCode && " · " + row.orderCode}</strong><small className="block quiet">{row.jobName || row.jobId} · {row.piecesPerScan} pieces/scan · {row.assigned} assigned</small></div>
      <button type="button" disabled={busy} onClick={() => approve(row.jobId, false)}>Revoke approval</button>
    </li>)}</ul> : <p className="quiet">No orders approved for Scan & Assign on this date.</p>}
  </section>;
}
