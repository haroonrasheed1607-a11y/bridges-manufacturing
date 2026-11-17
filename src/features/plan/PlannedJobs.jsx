import { PlannedJobUnitEditor } from "./PlannedJobUnitEditor.jsx";
import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";

export function PlannedJobs({ date, onDateChange, refreshVersion = 0 }) {
  const { open, refresh, profile } = useManufacturing();
  const [rows, setRows] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loaded, setLoaded] = React.useState("");
  const generation = React.useRef(0);
  const saving = React.useRef(false);
  const attempts = React.useRef(new Map());
  const [notice, setNotice] = React.useState("");
  async function load() {
    const ticket = ++generation.current;
    setBusy(true); setError("");
    try {
      const value = await manufacturingApi.rpc("app_planned_jobs", { p_date: date });
      if (ticket === generation.current) { setRows(value); setLoaded(date); }
    } catch (problem) { if (ticket === generation.current) setError(problem.message); }
    finally { if (ticket === generation.current) setBusy(false); }
  }
  React.useEffect(() => { setLoaded(""); load(); return () => { generation.current++; }; }, [date, refreshVersion]);
  async function complete(row) {
    if (saving.current || busy || loaded !== date) return;
    if (!window.confirm("Mark this approval complete and remove it from Shop Floor? Recorded production will be kept.")) return;
    saving.current = true; setBusy(true); setError("");
    try {
      await manufacturingApi.rpc("app_complete_scan_assign", { p_approval: row.approvalId, p_date: date, p_approved_at: row.approvedAt });
      await Promise.all([refresh(), load()]);
    } catch (problem) { setError(problem.message); }
    finally { saving.current = false; setBusy(false); }
  }
  async function saveUnits(row, units) {
    if (saving.current || busy || loaded !== date || profile?.role !== "admin") return;
    const state = row.unitEditState;
    if (!state?.canEditUnits) return;
    const reset = Boolean(state.requiresDayReset);
    if (reset && !window.confirm(`Reset ${row.title}${row.code ? " · " + row.code : ""} for ${date}?\n\nPermanently deactivate ${state.dayScanCount} scan(s), totaling ${state.dayBillableUnits} BU, and save ${units} BU per Scan. Billing and individual pay from these scans will be removed from active reports. Completed single-use box labels for this day will be retired and need new labels.\n\nEarlier days and attendance will be preserved. All records and an audit copy will be retained. Restoration is unavailable.`)) return;
    const signature = JSON.stringify([row.jobId,date,units,reset,state.revision,state.scanFingerprint]);
    let request = attempts.current.get(signature);
    if (!request) { request = crypto.randomUUID(); attempts.current.set(signature, request); }
    saving.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await manufacturingApi.rpc("app_edit_plan_day_units", {
        p_job:row.jobId, p_date:date, p_units:units, p_reset:reset,
        p_revision:state.revision, p_fingerprint:state.scanFingerprint, p_request:request,
      });
      attempts.current.delete(signature);
      setNotice(result.removedScans ? `${result.removedScans} scans / ${result.removedUnits} BU reset for ${date}. BU/Scan saved as ${result.unitsPerScan}.` : `BU/Scan saved as ${result.unitsPerScan}.`);
      await Promise.all([refresh(),load()]);
    } catch(problem) {
      if(problem.status>=400 && problem.status<500) attempts.current.delete(signature);
      if(problem.code==='PT409') { await Promise.all([refresh(),load()]); }
      setError(problem.message);
    } finally { saving.current=false;setBusy(false); }
  }
  return <section className="panel planned-jobs" aria-labelledby="planned-jobs-title">
    <div className="section-heading"><h3 id="planned-jobs-title">Planned for the day</h3>
      <div className="form-actions"><label className="field">Work date<input type="date" required value={date} disabled={busy}
        onChange={event => { if (event.target.value) onDateChange(event.target.value); }} /></label>
        <button type="button" disabled={busy} onClick={load}>Refresh</button></div>
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="alert">{error}</p>}
    {busy && <p role="status">{saving.current ? "Updating job…" : "Loading planned jobs…"}</p>}
    {loaded === date && <PlannedJobsTable rows={rows} busy={busy} onOpen={open} onComplete={complete} isAdmin={profile?.role === "admin"} onSaveUnits={saveUnits} />}
  </section>;
}

export function PlannedJobsTable({ rows, busy, onOpen, onComplete, isAdmin = false, onSaveUnits }) {
  if (!rows.length) return <p className="quiet">No jobs planned for this date.</p>;
  return <div className="table-wrap"><table><thead><tr>
    <th>Order / item code</th><th>Sub-job</th><th>Total quantity</th><th>Quantity completed today</th><th>BU/Scan</th><th>Overall completion</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>{rows.map(row => <tr key={row.jobId}>
    <td><button type="button" className="text-link" onClick={() => onOpen(row.orderId)}>{row.title}{row.code && " · " + row.code}</button></td>
    <td>{row.jobName || row.jobId}</td><td>{row.quantity.toLocaleString()} {row.billableMode ? "billable units" : "pieces"}</td><td>{row.piecesToday.toLocaleString()}</td>
    <td><PlannedJobUnitEditor row={row} busy={busy} isAdmin={isAdmin} onSave={onSaveUnits} /></td>
    <td>{row.completed.toLocaleString()} / {row.quantity.toLocaleString()}</td><td><span className={"badge " + (row.status === "Completed" ? "green" : "")}>{row.status}</span></td>
    <td>{row.canComplete && <button type="button" disabled={busy} onClick={() => onComplete(row)}>Mark complete</button>}</td>
  </tr>)}</tbody></table></div>;
}
