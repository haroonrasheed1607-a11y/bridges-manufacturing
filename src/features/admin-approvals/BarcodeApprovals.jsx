import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
export function BarcodeApprovals() {
  const { profile } = useManufacturing();
  return profile?.role === "admin" ? (
    <ApprovalQueue />
  ) : (
    <p role="alert">Administrator access required.</p>
  );
}
function ApprovalQueue() {
  const { refresh, setView, orders, orderDisplayTitle } = useManufacturing();
  const [kind, setKind] = React.useState("box"),
    [start, setStart] = React.useState(""),
    [end, setEnd] = React.useState(""),
    [search, setSearch] = React.useState(""),
    [offset, setOffset] = React.useState(0),
    [queue, setQueue] = React.useState({ total: 0, rows: [] }),
    [selected, setSelected] = React.useState([]),
    [reason, setReason] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [message, setMessage] = React.useState("");
  const generation = React.useRef(0),
    lock = React.useRef(false),
    request = React.useRef(null);
  async function load() {
    const n = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const r = await manufacturingApi.rpc("app_barcode_queue", {
        p_kind: kind,
        p_start: start || null,
        p_end: end || null,
        p_search: search,
        p_offset: offset,
      });
      if (n === generation.current) {
        setQueue(r);
        setSelected([]);
      }
    } catch (e) {
      if (n === generation.current) setError(e.message);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    setQueue({ total: 0, rows: [] });
    setSelected([]);
    request.current = null;
    load();
    return () => {
      generation.current++;
    };
  }, [kind, start, end, search, offset]);
  function filter(setter, value) {
    setter(value);
    setOffset(0);
    setSelected([]);
    request.current = null;
  }
  async function approve() {
    if (lock.current || !selected.length || reason.trim().length < 3) return;
    const pieces = queue.rows
      .filter((r) => selected.includes(r.id))
      .reduce((n, r) => n + Number(r.quantity), 0);
    const question =
      kind === "box"
        ? `Mark ${selected.length} box codes complete and record ${pieces} pieces now?`
        : `Close ${selected.length} reusable QR assignments? No pieces will be added.`;
    if (
      !window.confirm(
        question + " This is recorded under your administrator account.",
      )
    )
      return;
    const fingerprint = JSON.stringify([
      kind,
      [...selected].sort(),
      reason.trim(),
    ]);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await manufacturingApi.rpc("app_approve_barcodes", {
        p_kind: kind,
        p_ids: selected,
        p_request: request.current.id,
        p_reason: reason.trim(),
      });
      setMessage(
        `${result.duplicate ? "Previously processed: " : ""}${result.changed} codes ${kind === "box" ? "completed" : "closed"} · ${result.skipped} already processed · ${result.pieces} pieces recorded.`,
      );
      request.current = null;
      setSelected([]);
      await refresh();
      await load();
    } catch (e) {
      setError(
        e.message +
          " If the response was interrupted, retry the same selection to safely recover.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const chosen = queue.rows.filter((r) => selected.includes(r.id)),
    pieces =
      kind === "box" ? chosen.reduce((n, r) => n + Number(r.quantity), 0) : 0;
  return (
    <div>
      <button className="back" onClick={() => setView("configurations")}>
        ← Configurations
      </button>
      <div className="page-heading">
        <div>
          <h2>QR code approvals</h2>
          <p>
            Administrator only · process previous outstanding codes individually
            or in bulk.
          </p>
        </div>
      </div>
      <section className="panel">
        <fieldset disabled={busy} className="workspace-controls">
          <div className="form-grid">
            <label className="field">
              QR type
              <select
                value={kind}
                onChange={(e) => filter(setKind, e.target.value)}
              >
                <option value="box">Unfinished box codes</option>
                <option value="dumping">Active reusable barcodes</option>
              </select>
            </label>
            <label className="field">
              From work date
              <input
                type="date"
                value={start}
                onChange={(e) => filter(setStart, e.target.value)}
              />
            </label>
            <label className="field">
              Through work date
              <input
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => filter(setEnd, e.target.value)}
              />
            </label>
            <label className="field">
              Find barcode, individual or job
              <input
                type="search"
                value={search}
                onChange={(e) => filter(setSearch, e.target.value)}
              />
            </label>
          </div>
          <button onClick={load}>Refresh outstanding codes</button>
        </fieldset>
        <p>
          {kind === "box"
            ? "Approval records each selected box’s full assigned quantity as completed at the current time, updates piece totals and releases its booking. It does not change the order stage."
            : "Closing reusable QR codes releases those assignments and adds no production pieces. Work-date filters use the assignment creation date for reusable codes."}
        </p>
        <p>
          {queue.total} outstanding codes · {selected.length} selected ·{" "}
          {pieces} pieces to record
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all codes on this page"
                    disabled={busy || !queue.rows.length}
                    checked={
                      !!queue.rows.length &&
                      selected.length === queue.rows.length
                    }
                    onChange={(e) => {
                      setSelected(
                        e.target.checked ? queue.rows.map((r) => r.id) : [],
                      );
                      request.current = null;
                    }}
                  />
                </th>
                <th>QR code / date</th>
                <th>Individual</th>
                <th>Order / work / sub-job</th>
                <th>{kind === "box" ? "Box pieces" : "Pieces per scan"}</th>
              </tr>
            </thead>
            <tbody>
              {queue.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={"Select " + row.id}
                      disabled={busy}
                      checked={selected.includes(row.id)}
                      onChange={(e) => {
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, row.id]
                            : ids.filter((id) => id !== row.id),
                        );
                        request.current = null;
                      }}
                    />
                  </td>
                  <td>
                    <strong>{row.id}</strong>
                    <div>{row.date}</div>
                  </td>
                  <td>{row.person}</td>
                  <td>
                    {orderDisplayTitle(orders.find(order => order.id === row.order_id) ?? { title: row.title })}
                    <div>
                      {row.description} · {row.job}
                    </div>
                    <small>{row.order_id}</small>
                  </td>
                  <td>{row.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && !queue.rows.length && (
          <p>No outstanding codes match these filters.</p>
        )}
        <div className="actions">
          <button
            disabled={busy || offset === 0}
            onClick={() => setOffset((n) => Math.max(0, n - 50))}
          >
            Previous 50
          </button>
          <span>
            {queue.total ? offset + 1 : 0}–{Math.min(offset + 50, queue.total)}{" "}
            of {queue.total}
          </span>
          <button
            disabled={busy || offset + 50 >= queue.total}
            onClick={() => setOffset((n) => n + 50)}
          >
            Next 50
          </button>
        </div>
        <label className="field">
          Approval reason
          <input
            disabled={busy}
            value={reason}
            minLength={3}
            maxLength={500}
            placeholder="For example: verified previous completed work"
            onChange={(e) => {
              setReason(e.target.value);
              request.current = null;
            }}
          />
        </label>
        <button
          className="primary"
          disabled={busy || !selected.length || reason.trim().length < 3}
          onClick={approve}
        >
          {busy
            ? "Processing…"
            : kind === "box"
              ? `Approve ${selected.length} codes complete`
              : `Close ${selected.length} reusable codes`}
        </button>
      </section>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
