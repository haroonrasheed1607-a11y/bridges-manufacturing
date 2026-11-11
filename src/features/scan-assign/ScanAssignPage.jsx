import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingToday } from "../../utils/dates.js";
import { QrCamera } from "../production/QrCamera.jsx";
import { DumpingScanner } from "../dumping/DumpingScanner.jsx";

export function ScanAssignPage() {
  const { profile, refresh } = useManufacturing();
  const [rows, setRows] = React.useState([]);
  const [approval, setApproval] = React.useState("");
  const [loadedDate, setLoadedDate] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [seconds, setSeconds] = React.useState(0);
  const [camera, setCamera] = React.useState(false);
  const [productionCode, setProductionCode] = React.useState("");
  const lock = React.useRef(false);
  const input = React.useRef(null);
  const request = React.useRef(0);
  const today = manufacturingToday();

  async function load() {
    const ticket = ++request.current;
    setLoadedDate("");
    try {
      const value = await manufacturingApi.rpc("app_scan_assign_approvals", { p_date: today });
      if (ticket !== request.current) return;
      setRows(value);
      setLoadedDate(today);
      setApproval(current => value.some(row => row.id === current) ? current : "");
    } catch (problem) { if (ticket === request.current) setError(problem.message); }
  }
  React.useEffect(() => { load(); return () => { request.current++; }; }, [today]);

  React.useEffect(() => {
    if (!result?.waitSeconds) { setSeconds(0); return; }
    const until = Date.now() + result.waitSeconds * 1000;
    const update = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [result]);

  async function scan(value) {
    const normalized = value.trim().toUpperCase();
    if (lock.current || !approval || loadedDate !== manufacturingToday()) return;
    setCamera(false);
    if (!/^IND-[A-F0-9]{16}$/.test(normalized)) {
      setError("Scan a system-generated Individual Job QR card.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await manufacturingApi.rpc("app_scan_and_assign", { p_approval: approval, p_code: normalized });
      setResult(response);
      setCode("");
      if (response.waitSeconds === 0 && profile?.role !== "box_setup") setProductionCode(normalized);
      await refresh();
    } catch (problem) { setError(problem.message); }
    finally { lock.current = false; setBusy(false); input.current?.focus(); }
  }

  if (productionCode) return <DumpingScanner key={productionCode} code={productionCode} autoRecord onDone={() => {
    setProductionCode(""); setResult(null); setTimeout(() => input.current?.focus(), 0);
  }} />;
  return <section className="panel scan-assign-page">
    <header className="section-heading"><div><h2>Scan & Assign</h2><p className="quiet">First scan assigns the individual. Scan again after one minute to record the planned pieces.</p></div>
      <button type="button" disabled={busy} onClick={load}>Refresh orders</button></header>
    <label className="field">Approved order<select value={approval} disabled={busy || loadedDate !== today} onChange={e => {
      setApproval(e.target.value); setResult(null); setError("");
    }}><option value="">Select an approved order</option>{rows.map(row => <option key={row.id} value={row.id}>
      {row.orderTitle}{row.orderCode && " · " + row.orderCode} · {row.jobName || row.jobId} · {row.piecesPerScan} pieces/scan
    </option>)}</select></label>
    {loadedDate === today && !rows.length && <p className="quiet">Approve an order for today in Plan to use Scan & Assign.</p>}
    <form onSubmit={event => { event.preventDefault(); scan(code); }}>
      <label className="field">Individual QR card<input ref={input} value={code} autoComplete="off" spellCheck={false}
        placeholder="Scan the individual’s QR card and press Enter" disabled={busy || !approval}
        onChange={e => setCode(e.target.value)} /></label>
      <div className="form-actions"><button className="primary" disabled={busy || !approval || !code.trim()}>{busy ? "Checking card…" : "Scan card"}</button>
        <button type="button" disabled={busy || !approval} onClick={() => setCamera(true)}>Scan with camera</button></div>
    </form>
    {error && <p role="alert" className="alert">{error}</p>}
    {result && <div className="scan-assign-result" role="status"><h3>{result.personName} · Assigned</h3>
      <p>{result.piecesPerScan} pieces per scan</p>
      <p>{seconds > 0 ? "Production scans unlock in " + seconds + " seconds."
        : profile?.role === "box_setup" ? "Ready for production scanning."
          : "Ready. Scan this card again to record production."}</p>
    </div>}
    {camera && <QrCamera onScan={scan} onClose={() => setCamera(false)}
      description="Scan a system-generated Individual Job QR card to assign it to the selected order." />}
  </section>;
}
