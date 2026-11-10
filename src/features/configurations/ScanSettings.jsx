import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";

export function ScanSettings() {
  const { orders, orderDisplayTitle, refresh } = useManufacturing();
  const [workId, setWorkId] = React.useState("");
  const [seconds, setSeconds] = React.useState("");
  const [pieces, setPieces] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const saving = React.useRef(false);
  const jobs = orders.filter(order => order.stage === 1)
    .flatMap(order => order.workOrders.map(work => ({ order, work })));
  const current = jobs.find(({ work }) => work.id === workId);

  function select(id) {
    const work = jobs.find(item => item.work.id === id)?.work;
    setWorkId(id);
    setSeconds(work?.scanCooldownSeconds ?? "");
    setPieces(work?.scanPieces ?? "");
    setError("");
    setNotice("");
  }

  async function save(event) {
    event.preventDefault();
    if (!current || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await manufacturingApi.rpc("app_save_scan_settings", {
        p_work: workId,
        p_seconds: seconds === "" ? null : Number(seconds),
        p_pieces: pieces === "" ? null : Number(pieces),
      });
      await refresh();
      setNotice("Scan settings saved for this work order.");
    } catch (e) {
      setError(e.message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <section className="panel" aria-labelledby="scan-settings-heading">
    <h3 id="scan-settings-heading">Reusable QR settings</h3>
    <p className="quiet">Change how reusable labels are scanned for a work order in production.</p>
    <form onSubmit={save}>
      <fieldset disabled={busy} className="workspace-controls">
        <div className="form-grid">
          <label className="field"><span>Work order in production</span>
            <select required value={workId} onChange={event => select(event.target.value)}>
              <option value="">{jobs.length ? "Select a work order" : "No work orders in production"}</option>
              {jobs.map(({ order, work }) => <option key={work.id} value={work.id}>
                {orderDisplayTitle(order)} · {work.description || work.id} · {work.id}
              </option>)}
            </select>
          </label>
          <label className="field"><span>Seconds between scans for 1× load</span>
            <input type="number" min="0" max="604800" step="1" value={seconds} disabled={!current}
              onChange={event => setSeconds(event.target.value)} placeholder="Calculated from work timing" />
            <small>Blank uses work-order timing. Zero removes the delay. A 2× load doubles the time. Applies to repeat scans of the same QR.</small>
          </label>
          <label className="field"><span>Pieces per scan (1×)</span>
            <input type="number" min="1" max={current?.work.quantity ?? 1000000} step="1" value={pieces} disabled={!current}
              onChange={event => setPieces(event.target.value)} placeholder="Use label’s original load" />
            <small>{current ? "Work order pack size: " + current.work.perPack + " pieces. " : ""}This sets the scan load for reusable labels. Single-use boxes keep their assigned quantity.</small>
          </label>
        </div>
        <button type="submit" className="primary" disabled={!current || busy}>Save scan settings</button>
      </fieldset>
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="alert" role="alert">{error}</p>}
  </section>;
}
