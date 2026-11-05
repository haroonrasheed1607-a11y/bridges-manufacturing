import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { DUMPING_COOLDOWN_MS, scanRequestKey } from "./model.js";
export function DumpingScanner({ code, onDone }) {
  const { workforce, refresh, profile } = useManufacturing();
  const [result, setResult] = React.useState(null),
    [error, setError] = React.useState(""),
    [pieces, setPieces] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [ready, setReady] = React.useState(false);
  const lock = React.useRef(false),
    started = React.useRef(false),
    key = scanRequestKey(profile?.id, code),
    request = React.useRef(null);
  if (!request.current) {
    try {
      request.current = sessionStorage.getItem(key);
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
    setError("");
    try {
      const r = await manufacturingApi.rpc("app_dumping_scan", {
        p_id: code,
        p_request: request.current,
        p_pieces: pieces === "" ? null : Number(pieces),
      });
      setResult(r);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  React.useEffect(() => {
    if (!started.current) {
      started.current = true;
      record();
    }
  }, []);
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
      <h3>{busy ? "Recording batch…" : "Dumping scan"}</h3>
      <p>{code}</p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!busy && (
        <>
          <label className="field">
            Actual pieces (only for a smaller final batch)
            <input
              type="number"
              min="1"
              step="1"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              placeholder="Use assigned batch quantity"
            />
          </label>
          <button className="primary" onClick={record}>
            Retry same scan
          </button>
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
