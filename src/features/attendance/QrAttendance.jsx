import { MobilePresentWorkers } from "./PresentWorkers.jsx";
import { QrAttendanceCount } from "./QrAttendanceCount.jsx";
import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { QrCamera } from "../production/QrCamera.jsx";
import { formatDate } from "../../utils/dates.js";

function readPending(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value?.request && /^IND-[A-F0-9]{16}$/.test(value.code) && ["in", "out"].includes(value.action)) return value;
  } catch {}
  return null;
}

export function QrAttendance() {
  const { profile } = useManufacturing();
  const key = "bridges-qr-attendance-pending-v1:" + profile.id;
  const [pending, setPending] = React.useState(() => readPending(key));
  const [action, setAction] = React.useState(pending?.action ?? "in");
  const [code, setCode] = React.useState("");
  const [camera, setCamera] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [countRefresh, setCountRefresh] = React.useState(0);
  const lock = React.useRef(false);
  const input = React.useRef(null);

  async function record(value) {
    if (lock.current) return;
    const normalized = value.trim().toUpperCase();
    if (!pending && !/^IND-[A-F0-9]{16}$/.test(normalized)) {
      setCamera(false);
      setError("Scan a system-generated Individual Job QR card.");
      return;
    }
    const submission = pending ?? { code: normalized, action, request: crypto.randomUUID() };
    lock.current = true;
    setBusy(true);
    setCamera(false);
    setError("");
    setResult(null);
    setPending(submission);
    try { sessionStorage.setItem(key, JSON.stringify(submission)); } catch {}
    try {
      const receipt = await manufacturingApi.rpc("app_qr_attendance", {
        p_code: submission.code, p_action: submission.action, p_request: submission.request,
      });
      setResult(receipt);
      setCountRefresh(value => value + 1);
      setCode("");
      setPending(null);
      try { sessionStorage.removeItem(key); } catch {}
    } catch (problem) {
      setError(problem.message);
      if (problem.status >= 400 && problem.status < 500) {
        setPending(null);
        try { sessionStorage.removeItem(key); } catch {}
      }
    } finally {
      lock.current = false;
      setBusy(false);
      input.current?.focus();
    }
  }

  return <section className="panel qr-attendance">
    <div className="qr-attendance-heading"><h2>QR attendance</h2><QrAttendanceCount refreshVersion={countRefresh} /></div>
    <div className="production-mode-tabs" role="group" aria-label="Attendance action">
      {[["in", "Time In"], ["out", "Time Out"]].map(([value, title]) => <button key={value} type="button"
        className={value === action ? "is-selected" : ""} aria-pressed={value === action}
        disabled={busy || Boolean(pending)} onClick={() => { setAction(value); setResult(null); setError(""); }}>{title}</button>)}
    </div>
    <p className="quiet">Select an action, then scan the individual’s personal QR card. The current Tulsa time is recorded.</p>
    <form className="qr-attendance-manual" onSubmit={event => { event.preventDefault(); record(code); }}>
      <label className="field">Individual QR card<input ref={input} autoFocus value={code} disabled={busy || Boolean(pending)}
        autoComplete="off" spellCheck={false} onChange={event => setCode(event.target.value)}
        placeholder="Scan the QR card and press Enter" /></label>
      <button className="primary" disabled={busy || Boolean(pending) || !code.trim()}>Record {action === "in" ? "Time In" : "Time Out"}</button>
    </form>
    {pending ? <button type="button" className="primary" disabled={busy} onClick={() => record(pending.code)}>
      {busy ? "Recording…" : "Retry same attendance scan"}</button>
      : <button type="button" className="primary qr-attendance-camera" disabled={busy} onClick={() => setCamera(true)}>
        Scan QR for {action === "in" ? "Time In" : "Time Out"}</button>}
    {error && <p className="alert" role="alert">{error}</p>}
    {result && <div className="scan-assign-result" role="status">
      <h3>{result.name}{result.number && " · " + result.number}</h3>
      <p><strong>{result.action === "in" ? "Time In" : "Time Out"} {result.time}</strong> · {formatDate(result.date)}</p>
      <p>{result.duplicate ? "Already recorded." : "Attendance recorded."}</p>
    </div>}
    <MobilePresentWorkers refreshVersion={countRefresh} />
    {camera && <QrCamera onScan={record} onClose={() => setCamera(false)}
      description={"Scan the individual’s personal QR card to record " + (action === "in" ? "Time In." : "Time Out.")} />}
  </section>;
}
