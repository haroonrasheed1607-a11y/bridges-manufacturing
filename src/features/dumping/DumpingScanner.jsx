import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { DUMPING_COOLDOWN_MS, scanRequestKey, completedLoadPieces } from "./model.js";
export function DumpingScanner({ code, onDone }) {
  const { workforce, refresh, profile } = useManufacturing();
  const [result, setResult] = React.useState(null),
    [error, setError] = React.useState(""),
    [pieces, setPieces] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [ready, setReady] = React.useState(false),
    [assignment, setAssignment] = React.useState(null),
    [multiplier, setMultiplier] = React.useState(1),
    [submitted, setSubmitted] = React.useState(false);
  const lock = React.useRef(false),
    pending = React.useRef(null),
    key = scanRequestKey(profile?.id, code),
    request = React.useRef(null);
  if (!request.current) {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) { try { pending.current = JSON.parse(saved); request.current = pending.current.id; } catch { request.current = saved; } }
    } catch {}
    if (!request.current) {
      request.current = crypto.randomUUID();
      try {
        sessionStorage.setItem(key, request.current);
      } catch {}
    }
  }
  async function record() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setSubmitted(true);
    setError("");
    try {
      if (!pending.current) {
        const quantity = completedLoadPieces(assignment.batchQuantity, multiplier, pieces);
        pending.current = { id: request.current, pieces: quantity };
        try { sessionStorage.setItem(key, JSON.stringify(pending.current)); } catch {}
      }
      const r = await manufacturingApi.rpc("app_dumping_scan", {
        p_id: code,
        p_request: request.current,
        p_pieces: pending.current.pieces,
      });
      setResult(r);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      await refresh();
    } catch (e) {
      if (!pending.current || (e.status >= 400 && e.status < 500)) {
        pending.current = null;
        request.current = crypto.randomUUID();
        setSubmitted(false);
        try { sessionStorage.removeItem(key); } catch {}
      }
      setError(e.message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  React.useEffect(() => {
    let cancelled = false;
    manufacturingApi.rpc("app_dumping_list").then(rows => {
      if (cancelled) return;
      const found = rows.find(row => row.id === code);
      if (!found) throw new Error("Reusable QR not found. Ask Box Setup to check this label.");
      setAssignment(found);
      if (pending.current) { setSubmitted(true); setPieces(String(pending.current.pieces ?? "")); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [code]);
  React.useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      setReady(true);
      onDone();
    }, DUMPING_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [result?.eventId]);
  const person = workforce.people.find((p) => p.id === result?.personId);
  if (result)
    return (
      <section
        className={
          "dumping-success " + (result.duplicate ? "dumping-duplicate" : "")
        }
        role="status"
        aria-live="polite"
      >
        <div aria-hidden="true">{result.duplicate ? "✓" : "👍"}</div>
        <h2>
          {result.duplicate
            ? "Already recorded"
            : `Good job, ${person?.name || "team member"}!`}
        </h2>
        <p>
          {result.pieces} pieces{" "}
          {result.duplicate
            ? "were previously recorded. No extra pieces added."
            : "recorded."}
        </p>
        <p>{ready ? "Ready" : "Ready for the next batch in a few seconds…"}</p>
      </section>
    );
  return (
    <section className="panel">
      <h3>{busy ? "Recording batch…" : "Confirm completed load"}</h3>
      <p>{code}</p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!busy && (
        <>
          {assignment && <>
          <p>{workforce.people.find(p => p.id === assignment.personId)?.name || "Team member"} · {assignment.batchQuantity} pieces per load</p>
          <label className="field">Load size
            <select value={multiplier} disabled={submitted} onChange={e => { setMultiplier(Number(e.target.value)); setPieces(""); }}>
              <option value={1}>1× · {assignment.batchQuantity} pieces</option>
              <option value={2}>2× · {assignment.batchQuantity * 2} pieces</option>
            </select>
          </label>
          <p><strong>{pieces === "" ? assignment.batchQuantity * multiplier : pieces} pieces to record</strong></p>
          <label className="field">
            Actual pieces (only for a smaller final batch)
            <input
              type="number"
              disabled={submitted}
              max={assignment.batchQuantity * 2}
              min="1"
              step="1"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              placeholder="Use assigned batch quantity"
            />
          </label>
          <button className="primary" onClick={record}>
            {submitted ? "Retry same scan" : "Confirm completed pieces"}
          </button>
          </>}
          <button onClick={onDone}>Back to scanner</button>
          <p className="quiet">
            A failed or uncertain request keeps its reference so retrying cannot
            count it twice.
          </p>
        </>
      )}
    </section>
  );
}
