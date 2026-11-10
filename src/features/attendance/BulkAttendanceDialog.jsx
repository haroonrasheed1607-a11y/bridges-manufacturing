import { React } from "../../vendor/react-runtime.js";
import { formatDate } from "../../utils/dates.js";

export function BulkAttendanceDialog({ count, date, busy, onClose, onSave }) {
  const dialog = React.useRef(null);
  const heading = React.useId();
  const [action, setAction] = React.useState("in");
  const [time, setTime] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return <dialog ref={dialog} className="job-action-dialog" aria-labelledby={heading}
    onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <form className="job-action-body" onSubmit={async event => {
      event.preventDefault();
      if (busy || !time) return;
      setError("");
      setError(await onSave(action, time) || "");
    }}>
      <h3 id={heading}>Bulk attendance</h3>
      <p>{formatDate(date)} · {count} selected</p>
      <div className="form-grid">
        <label className="field"><span>Attendance action</span>
          <select value={action} disabled={busy} onChange={event => setAction(event.target.value)}>
            <option value="in">Time In</option>
            <option value="out">Time Out</option>
          </select>
        </label>
        <label className="field"><span>{action === "in" ? "Time In" : "Time Out"}</span>
          <input type="time" required value={time} disabled={busy} onChange={event => setTime(event.target.value)} />
        </label>
      </div>
      <p className="quiet">Existing times are kept. Time Out requires a recorded Time In.</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="submit" className="primary" disabled={busy}>{action === "in" ? "Mark Time In" : "Mark Time Out"}</button>
      </div>
    </form>
  </dialog>;
}
