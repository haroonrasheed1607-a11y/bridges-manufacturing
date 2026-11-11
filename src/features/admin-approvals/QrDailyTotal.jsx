import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate } from "../../utils/dates.js";

function readPending(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value?.request && value.target && value.date && Number.isInteger(value.total) && Number.isInteger(value.expected)) return value;
  } catch {}
  return null;
}

export function QrDailyTotal({ code, onDone }) {
  const { profile, refresh } = useManufacturing();
  const key = "bridges-admin-daily-total-v1:" + profile.id + ":" + code;
  const [pending, setPending] = React.useState(() => readPending(key));
  const [rows, setRows] = React.useState(null);
  const [target, setTarget] = React.useState(pending?.target ?? "");
  const [total, setTotal] = React.useState(pending?.total ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const lock = React.useRef(false);
  const generation = React.useRef(0);
  const selected = rows?.find(row => row.id === target);
  const quantity = Number(total);

  async function load() {
    const ticket = ++generation.current;
    try {
      const value = await manufacturingApi.rpc("app_admin_qr_daily_summary", { p_code: code });
      if (ticket !== generation.current) return;
      setRows(value);
      setTarget(current => value.some(row => row.id === current) ? current : value[0]?.id ?? "");
    } catch (problem) { if (ticket === generation.current) setError(problem.message); }
  }
  React.useEffect(() => { load(); return () => { generation.current++; }; }, [code]);

  async function save(event) {
    event.preventDefault();
    if (lock.current || (!pending && !selected)) return;
    const submission = pending ?? {
      request: crypto.randomUUID(), target, total: quantity, expected: selected.recorded, date: selected.date,
    };
    lock.current = true;
    setBusy(true);
    setError("");
    setPending(submission);
    try { sessionStorage.setItem(key, JSON.stringify(submission)); } catch {}
    try {
      const receipt = await manufacturingApi.rpc("app_set_qr_daily_total", {
        p_code: code, p_target: submission.target, p_date: submission.date,
        p_total: submission.total, p_expected: submission.expected, p_request: submission.request,
      });
      setResult(receipt);
      setPending(null);
      try { sessionStorage.removeItem(key); } catch {}
      await refresh();
    } catch (problem) {
      setError(problem.message);
      if (problem.status >= 400 && problem.status < 500) {
        setPending(null);
        try { sessionStorage.removeItem(key); } catch {}
        if (problem.code === "40001") { setTotal(""); await load(); }
      }
    } finally { lock.current = false; setBusy(false); }
  }

  if (profile.role !== "admin") return <p role="alert">Administrator access required.</p>;
  return <section className="panel">
    <h2>Daily production total</h2>
    <p className="quiet">{code}</p>
    {error && <p className="alert" role="alert">{error}</p>}
    {result ? <div className="scan-assign-result" role="status">
      <h3>{result.personName}</h3>
      <p><strong>{result.total.toLocaleString()} pieces total</strong> · {formatDate(result.date)}</p>
      <p>{result.duplicate ? "This entry was already saved." : result.added.toLocaleString() + " additional pieces recorded."}</p>
    </div> : <form onSubmit={save}>
      {rows?.length > 1 && <label className="field">Work for this QR today<select value={target} disabled={busy || Boolean(pending)}
        onChange={event => { setTarget(event.target.value); setTotal(""); setError(""); }}>
        {rows.map(row => <option key={row.id} value={row.id}>{row.orderTitle}{row.orderCode && " · " + row.orderCode} · {row.jobName || row.jobId}</option>)}
      </select></label>}
      {selected && <>
        <h3>{selected.personName}</h3>
        <p><strong>{selected.orderTitle}{selected.orderCode && " · " + selected.orderCode}</strong> · {selected.jobName || selected.jobId}</p>
        <p>{formatDate(selected.date)} · <strong>{selected.recorded.toLocaleString()} pieces already recorded</strong></p>
        <label className="field">Total pieces for the entire day
          <input type="number" min={selected.recorded} max={selected.maxTotal} step="1" required value={total}
            disabled={busy || Boolean(pending)} onChange={event => setTotal(event.target.value)} />
          <small>Enter the day’s total for this individual and job. Maximum {selected.maxTotal.toLocaleString()} pieces.</small>
        </label>
        {total !== "" && Number.isInteger(quantity) && quantity >= selected.recorded &&
          <p>{(quantity - selected.recorded).toLocaleString()} additional pieces to record.</p>}
      </>}
      {!rows && !error && <p role="status">Loading today’s production…</p>}
      {rows?.length === 0 && <p>No work was found for this QR today.</p>}
      <button className="primary" disabled={busy || (!pending && (!selected || total === "" || !Number.isInteger(quantity) || quantity < selected.recorded || quantity > selected.maxTotal))}>
        {busy ? "Saving…" : pending ? "Retry same daily total" : "Save daily total"}
      </button>
    </form>}
    <div className="form-actions"><button type="button" disabled={busy} onClick={onDone}>Back to Routine Scan</button></div>
  </section>;
}
